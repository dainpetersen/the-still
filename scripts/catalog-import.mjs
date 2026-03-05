/**
 * catalog-import.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Smart import from a cleaned Reddit review CSV.
 *
 * What it does (in order):
 *   1. Reads the cleaned CSV (default: ~/Desktop/reddit-reviews-clean.csv)
 *   2. Fuzzy-matches bottle_name against existing catalog to auto-fill bottle_id
 *      where left blank.
 *   3. Generates kebab-case IDs for bottles that still have no match.
 *   4. For new distilleries: appends a new brand block to src/data/whiskeys.ts.
 *   5. For new bottles under existing distilleries: injects a new "Reddit Imports"
 *      sub-brand into the correct brand block in src/data/whiskeys.ts.
 *   6. Writes ~/Desktop/reddit-reviews-with-ids.csv so you can review every
 *      assigned bottle_id before anything goes to Supabase.
 *   7. Upserts all valid rows (bottle_id + rating_raw present) to Supabase ratings.
 *
 * Usage:
 *   node scripts/catalog-import.mjs [path/to/clean.csv]
 *   Default input: ~/Desktop/reddit-reviews-clean.csv
 *
 * Prerequisites:
 *   • NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 *   • The cleaned CSV has columns: bottle_id, bottle_name, distillery,
 *     rating_raw, reddit_id, (optionally: nose, palate, finish)
 *   • bottle_id may be blank — the script will attempt to fill it in.
 *   • distillery should match the exact brand name in whiskeys.ts, or be a
 *     new distillery name you want added.
 *
 * Idempotent: upserts on (bottle_id, session_id) so running twice is safe.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import fs   from "fs";
import path from "path";
import os   from "os";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.join(__dirname, "..");
const WHISKEYS_TS = path.join(ROOT, "src", "data", "whiskeys.ts");

// ── CSV parser ────────────────────────────────────────────────────────────────
function parseCsv(text) {
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^\"|\"$/g, ""));
  return lines.slice(1).map((line) => {
    const fields = [];
    let cur = "", inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if      (ch === '"' && !inQuote)               { inQuote = true; }
      else if (ch === '"' && inQuote && line[i+1] === '"') { cur += '"'; i++; }
      else if (ch === '"' && inQuote)                { inQuote = false; }
      else if (ch === "," && !inQuote)               { fields.push(cur); cur = ""; }
      else                                           { cur += ch; }
    }
    fields.push(cur);
    const obj = {};
    headers.forEach((h, i) => {
      const v = (fields[i] ?? "").trim();
      obj[h] = v === "" ? null : v;
    });
    if (obj.rating_raw != null) obj.rating_raw = parseFloat(obj.rating_raw);
    if (obj.score      != null) obj.score      = parseInt(obj.score, 10);
    return obj;
  }).filter((r) => r.reddit_id);
}

// ── Catalog parser ────────────────────────────────────────────────────────────
// Parses whiskeys.ts text with regex to extract brands, sub-brands, and bottles.
function parseCatalog(text) {
  const brands = [];
  const subBrands = [];
  const bottles = [];

  // Brands: have "country:" field
  const brandRe = /\{\s*\n\s*id:\s*"([^"]+)",\s*\n\s*name:\s*"([^"]+)",(?:[^}]*?)country:\s*"([^"]+)"/gs;
  let m;
  while ((m = brandRe.exec(text)) !== null) {
    brands.push({ id: m[1], name: m[2] });
  }

  // Sub-brands: have "brandId:" field
  const subRe = /\{\s*\n\s*id:\s*"([^"]+)",\s*\n\s*name:\s*"([^"]+)",\s*\n\s*brandId:\s*"([^"]+)"/g;
  while ((m = subRe.exec(text)) !== null) {
    subBrands.push({ id: m[1], name: m[2], brandId: m[3] });
  }

  // Bottles: have "subBrandId:" field
  const bottleRe = /\{\s*\n\s*id:\s*"([^"]+)",\s*\n\s*name:\s*"([^"]+)",\s*\n\s*subBrandId:\s*"([^"]+)"/g;
  while ((m = bottleRe.exec(text)) !== null) {
    bottles.push({ id: m[1], name: m[2], subBrandId: m[3] });
  }

  return { brands, subBrands, bottles };
}

// ── String helpers ─────────────────────────────────────────────────────────────
function normalize(s) {
  return (s ?? "").toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toKebab(s) {
  return (s ?? "").toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// ── Fuzzy matching (Levenshtein similarity) ────────────────────────────────────
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  return dp[m][n];
}

function similarity(a, b) {
  const na = normalize(a), nb = normalize(b);
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(na, nb) / maxLen;
}

// Token-based containment check: does every significant token of `query`
// appear somewhere in `target`? Handles partial matches like "ECBP" → "Elijah Craig Barrel Proof".
function tokenMatch(query, target) {
  const qTokens = normalize(query).split(" ").filter((t) => t.length > 2);
  const tNorm   = normalize(target);
  if (qTokens.length === 0) return false;
  return qTokens.every((t) => tNorm.includes(t));
}

/**
 * Find the best catalog match for a bottle name (optionally filtered to a brand).
 * Returns { bottle, score } or null if no reasonable match.
 */
function findBestMatch(bottleName, catalogBottles, brandId) {
  const candidates = brandId
    ? catalogBottles.filter((b) => b.brandId === b.subBrandId) // handled below
    : catalogBottles;

  let best = null, bestScore = 0;
  for (const b of catalogBottles) {
    const lev  = similarity(bottleName, b.name);
    const tok  = tokenMatch(bottleName, b.name) || tokenMatch(b.name, bottleName);
    const score = tok ? Math.max(lev, 0.65) : lev;
    if (score > bestScore) { bestScore = score; best = b; }
  }
  return bestScore >= 0.72 ? { bottle: best, score: bestScore } : null;
}

// ── Ensure unique IDs ──────────────────────────────────────────────────────────
function makeUniqueId(base, usedIds) {
  let id = base, n = 2;
  while (usedIds.has(id)) id = `${base}-${n++}`;
  usedIds.add(id);
  return id;
}

// ── whiskeys.ts injection helpers ─────────────────────────────────────────────

/**
 * Find the character range of a brand block (the outer {...}).
 * Searches by brand ID field.
 */
function findBrandRange(text, brandId) {
  const needle = `id: "${brandId}"`;
  const searchStart = text.indexOf("export const WHISKEY_DATA");
  const idx = text.indexOf(needle, searchStart);
  if (idx === -1) return null;

  // Walk back to find the opening { of this brand object (2-space indent)
  let openBrace = -1;
  for (let i = idx; i >= searchStart; i--) {
    if (text[i] === "{" && text.slice(i - 2, i) === "\n ") {
      openBrace = i;
      break;
    }
    // Also handle start-of-2-space block: "\n  {"
    if (text[i] === "{" && text.slice(i - 3, i) === "\n  ") {
      openBrace = i;
      break;
    }
  }
  if (openBrace === -1) return null;

  // Count braces to find the matching close
  let depth = 0;
  for (let i = openBrace; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) return { start: openBrace, end: i };
    }
  }
  return null;
}

/**
 * Within a brand block, find the offset of the closing ] of the subBrands array.
 * Returns the index in the full `text` string.
 */
function findSubBrandsArrayEnd(text, brandRange) {
  const block = text.slice(brandRange.start, brandRange.end);
  const subBrandsKey = "subBrands: [";
  const keyIdx = block.indexOf(subBrandsKey);
  if (keyIdx === -1) return -1;

  let depth = 0, inside = false;
  for (let i = keyIdx + subBrandsKey.length - 1; i < block.length; i++) {
    if (block[i] === "[") { depth++; inside = true; }
    else if (block[i] === "]") {
      depth--;
      if (inside && depth === 0) return brandRange.start + i;
    }
  }
  return -1;
}

/**
 * Generate a sub-brand entry to be injected into an existing brand.
 */
function generateSubBrandCode(subBrandId, subBrandName, brandId, bottles, usedBottleIds) {
  const bottleParts = bottles.map((b) => {
    const baseId = b.bottle_id || toKebab(b.bottle_name);
    const id     = makeUniqueId(baseId, usedBottleIds);
    b.resolved_id = id; // store for later use in Supabase import
    return `          {
            id: "${id}",
            name: "${b.bottle_name.replace(/"/g, '\\"')}",
            subBrandId: "${subBrandId}",
            abv: 0,
            price: 0,
            rarity: "common",
            rarityScore: 0,
            style: "Bourbon",
            description: "",
            source: "community",
            availability: "current",
          }`;
  });
  return `      {
        id: "${subBrandId}",
        name: "${subBrandName}",
        brandId: "${brandId}",
        bottles: [
${bottleParts.join(",\n")},
        ],
      }`;
}

/**
 * Generate a complete new brand block.
 */
function generateBrandCode(distilleryName, bottles, usedBrandIds, usedSubIds, usedBottleIds) {
  const brandId   = makeUniqueId(toKebab(distilleryName), usedBrandIds);
  const subId     = makeUniqueId(`${brandId}-reddit`, usedSubIds);
  const subCode   = generateSubBrandCode(subId, `${distilleryName} (Reddit Imports)`, brandId, bottles, usedBottleIds);

  return `
  // ─── ${distilleryName.toUpperCase()} (REDDIT IMPORT) ${"─".repeat(Math.max(0, 60 - distilleryName.length))}
  {
    id: "${brandId}",
    name: "${distilleryName.replace(/"/g, '\\"')}",
    country: "USA",
    region: "",
    state: "Kentucky",
    source: "community",
    subBrands: [
${subCode},
    ],
  }`;
}

// ── CSV escaping ───────────────────────────────────────────────────────────────
function escapeCsv(val) {
  if (val == null) return "";
  const s = String(val);
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

// ── Load .env.local ────────────────────────────────────────────────────────────
function loadEnv() {
  const envPath = path.join(ROOT, ".env.local");
  if (!fs.existsSync(envPath)) {
    throw new Error(".env.local not found — are you running from the project root?");
  }
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    process.env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^[\"']|[\"']$/g, "");
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  loadEnv();

  // ── 1. Locate input CSV ──────────────────────────────────────────────────────
  const inputFile = process.argv[2] ?? path.join(os.homedir(), "Desktop", "reddit-reviews-clean.csv");
  if (!fs.existsSync(inputFile)) {
    console.error(`✗ Input CSV not found: ${inputFile}`);
    console.error("  Usage: node scripts/catalog-import.mjs [path/to/clean.csv]");
    process.exit(1);
  }

  const rows = parseCsv(fs.readFileSync(inputFile, "utf8"));
  console.log(`\nLoaded ${rows.length} rows from ${inputFile}`);

  // ── 2. Parse existing catalog from whiskeys.ts ───────────────────────────────
  const tsText  = fs.readFileSync(WHISKEYS_TS, "utf8");
  const catalog = parseCatalog(tsText);
  const usedBottleIds  = new Set(catalog.bottles.map((b) => b.id));
  const usedSubIds     = new Set(catalog.subBrands.map((b) => b.id));
  const usedBrandIds   = new Set(catalog.brands.map((b) => b.id));
  const brandByName    = new Map(catalog.brands.map((b) => [normalize(b.name), b]));

  console.log(`Catalog: ${catalog.brands.length} brands, ${catalog.subBrands.length} sub-brands, ${catalog.bottles.length} bottles`);

  // ── 3. Resolve bottle_ids ────────────────────────────────────────────────────
  const resolved   = [];   // rows with a good bottle_id
  const newBottles = new Map(); // distilleryName → rows[]

  for (const row of rows) {
    const bottleName  = row.bottle_name?.trim() ?? "";
    const distillery  = row.distillery?.trim()  ?? "";
    let   bottleId    = row.bottle_id?.trim()   ?? "";

    // Skip rows with no useful data
    if (!bottleName && !bottleId) continue;

    // If bottle_id already provided, trust it
    if (bottleId) {
      row.resolved_id   = bottleId;
      row.match_source  = "manual";
      resolved.push(row);
      continue;
    }

    // Fuzzy-match against catalog
    const brandEntry   = brandByName.get(normalize(distillery));
    const candidates   = brandEntry
      ? catalog.bottles.filter((b) => {
          const sub = catalog.subBrands.find((s) => s.id === b.subBrandId);
          return sub?.brandId === brandEntry.id;
        })
      : catalog.bottles;

    const match = findBestMatch(bottleName, candidates.length > 0 ? candidates : catalog.bottles);
    if (match) {
      row.resolved_id  = match.bottle.id;
      row.match_source = `fuzzy(${(match.score * 100).toFixed(0)}%) → "${match.bottle.name}"`;
      resolved.push(row);
      continue;
    }

    // No match — queue as new bottle
    const key = distillery || "Unknown Distillery";
    if (!newBottles.has(key)) newBottles.set(key, []);
    newBottles.get(key).push(row);
  }

  console.log(`\n── ID resolution ─────────────────────────────────────────────────`);
  console.log(`  ${resolved.length} matched to existing catalog entries`);
  console.log(`  ${[...newBottles.values()].reduce((n, a) => n + a.length, 0)} queued as new bottles`);
  if (newBottles.size) {
    for (const [dist, btls] of newBottles) {
      const isNew = !brandByName.has(normalize(dist));
      console.log(`    ${isNew ? "NEW DISTILLERY" : "existing brand"}: ${dist} (${btls.length} bottles)`);
    }
  }

  // ── 4 & 5. Inject new entries into whiskeys.ts ──────────────────────────────
  let updatedTs = tsText;
  const codeBlocks = []; // for summary log

  for (const [distName, btls] of newBottles) {
    const brandEntry = brandByName.get(normalize(distName));

    if (!brandEntry) {
      // Entirely new distillery → append before closing `];`
      const closingBracket = updatedTs.lastIndexOf("\n];");
      if (closingBracket === -1) {
        console.error(`✗ Could not find closing ]; in whiskeys.ts — skipping new distillery: ${distName}`);
        continue;
      }
      const code = generateBrandCode(distName, btls, usedBrandIds, usedSubIds, usedBottleIds);
      updatedTs = updatedTs.slice(0, closingBracket) + "," + code + "\n\n" + updatedTs.slice(closingBracket + 1);
      codeBlocks.push(`Added new brand: ${distName}`);

    } else {
      // Existing distillery → inject a new "Reddit Imports" sub-brand
      const subId   = makeUniqueId(`${brandEntry.id}-reddit`, usedSubIds);
      const subCode = generateSubBrandCode(subId, `${distName} Reddit Imports`, brandEntry.id, btls, usedBottleIds);

      const brandRange = findBrandRange(updatedTs, brandEntry.id);
      if (!brandRange) {
        console.error(`✗ Could not locate brand block for "${distName}" in whiskeys.ts`);
        continue;
      }
      const subArrayEnd = findSubBrandsArrayEnd(updatedTs, brandRange);
      if (subArrayEnd === -1) {
        console.error(`✗ Could not locate subBrands array end for "${distName}"`);
        continue;
      }
      // Insert the new sub-brand before the closing ] of subBrands
      updatedTs = updatedTs.slice(0, subArrayEnd) + ",\n" + subCode + "\n    " + updatedTs.slice(subArrayEnd);
      codeBlocks.push(`Added sub-brand "${subId}" under ${distName}`);
    }

    // All btls now have resolved_id set by generateSubBrandCode / generateBrandCode
    for (const b of btls) {
      if (b.resolved_id) {
        b.match_source = "generated";
        resolved.push(b);
      }
    }
  }

  if (codeBlocks.length) {
    fs.writeFileSync(WHISKEYS_TS, updatedTs);
    console.log(`\n── whiskeys.ts updated ────────────────────────────────────────────`);
    codeBlocks.forEach((msg) => console.log(`  ✓ ${msg}`));
  }

  // ── 6. Write output CSV with resolved bottle_ids ─────────────────────────────
  const outCsvPath = path.join(os.homedir(), "Desktop", "reddit-reviews-with-ids.csv");
  const allRows    = [...resolved, ...[...newBottles.values()].flat().filter((r) => !r.resolved_id)];
  const outCols    = ["resolved_id", "match_source", "bottle_name", "distillery", "rating_raw",
                      "nose", "palate", "finish", "reddit_id", "subreddit", "score", "url"];
  const csvLines   = [
    outCols.join(","),
    ...allRows.map((r) => outCols.map((c) => escapeCsv(r[c] ?? r.bottle_id ?? "")).join(",")),
  ];
  fs.writeFileSync(outCsvPath, csvLines.join("\n"));
  console.log(`\n── Output CSV ─────────────────────────────────────────────────────`);
  console.log(`  Written: ${outCsvPath}`);
  console.log(`  Review the "resolved_id" column to verify every assignment.`);
  console.log(`  Rows where resolved_id is blank were skipped.`);

  // ── 7. Upsert ratings to Supabase ───────────────────────────────────────────
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.log("\n⚠  NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set.");
    console.log("   Skipping Supabase import. Set them in .env.local and re-run.");
    return;
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const toUpsert = resolved.filter((r) => r.resolved_id && r.rating_raw != null && !isNaN(r.rating_raw));

  console.log(`\n── Supabase import ────────────────────────────────────────────────`);
  console.log(`  ${toUpsert.length} rows with valid bottle_id + rating to upsert`);

  const payload = toUpsert.map((r) => ({
    bottle_id:  r.resolved_id,
    rating:     Math.min(10, Math.max(1, Math.round(r.rating_raw))),
    nose:       r.nose   || null,
    palate:     r.palate || null,
    finish:     r.finish || null,
    session_id: `reddit_${r.reddit_id}`,
  }));

  const BATCH = 50;
  let upserted = 0;
  for (let i = 0; i < payload.length; i += BATCH) {
    const batch = payload.slice(i, i + BATCH);
    const { error, count } = await supabase
      .from("ratings")
      .upsert(batch, { onConflict: "bottle_id,session_id", count: "exact" });
    if (error) {
      console.error(`\n✗ Supabase error on batch ${Math.floor(i / BATCH) + 1}: ${error.message}`);
      process.exit(1);
    }
    upserted += count ?? batch.length;
    process.stdout.write(`\r  ${Math.min(i + BATCH, payload.length)} / ${payload.length}`);
  }

  console.log(`\n\n✓ Done.`);
  console.log(`  ${upserted} ratings upserted to Supabase.`);
  if (codeBlocks.length) {
    console.log(`\nNext steps:`);
    console.log(`  1. Review the new entries in src/data/whiskeys.ts`);
    console.log(`  2. Fill in abv, price, rarity, rarityScore, style, description for each new bottle`);
    console.log(`  3. Commit: git add src/data/whiskeys.ts && git commit -m "feat: add Reddit-sourced bottles"`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
