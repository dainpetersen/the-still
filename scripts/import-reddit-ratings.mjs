/**
 * import-reddit-ratings.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * One-time import of cleaned Reddit review data into the Supabase ratings table.
 *
 * Prerequisites:
 *   • NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 *   • scripts/reddit-reviews-clean.json exists and is fully cleaned
 *     (every row has a non-empty bottle_id and a numeric rating_raw)
 *
 * Usage:
 *   node scripts/import-reddit-ratings.mjs [path/to/clean.json]
 *
 * The script is idempotent — it uses `upsert` with (bottle_id, session_id)
 * as the conflict target, so running it twice won't create duplicates.
 * session_id = "reddit_<post_id>" for every imported row.
 *
 * Ratings are stored as integers (1–10). If rating_raw is a decimal (e.g. 8.5)
 * it is rounded to the nearest integer before insert.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import fs   from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── CSV parser ────────────────────────────────────────────────────────────────
function parseCsv(text) {
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    // Handle quoted fields containing commas
    const fields = [];
    let cur = "", inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' && !inQuote)          { inQuote = true; }
      else if (ch === '"' && inQuote) {
        if (line[i + 1] === '"')           { cur += '"'; i++; }
        else                               { inQuote = false; }
      } else if (ch === "," && !inQuote)   { fields.push(cur); cur = ""; }
      else                                 { cur += ch; }
    }
    fields.push(cur);
    const obj = {};
    headers.forEach((h, i) => {
      const v = (fields[i] ?? "").trim();
      obj[h] = v === "" ? null : v;
    });
    // Coerce numeric fields
    if (obj.rating_raw != null) obj.rating_raw = parseFloat(obj.rating_raw);
    if (obj.score      != null) obj.score      = parseInt(obj.score, 10);
    return obj;
  }).filter((r) => r.reddit_id); // skip blank rows
}

// ── Load .env.local ───────────────────────────────────────────────────────────
function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) {
    throw new Error(".env.local not found — are you running from the project root?");
  }
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    process.env[key] = val;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  loadEnv();

  // Accept .csv or .json — default tries clean.csv first, then clean.json
  const inputFile = process.argv[2] ?? (
    fs.existsSync(path.join(__dirname, "reddit-reviews-clean.csv"))
      ? path.join(__dirname, "reddit-reviews-clean.csv")
      : path.join(__dirname, "reddit-reviews-clean.json")
  );

  if (!fs.existsSync(inputFile)) {
    console.error(`✗ File not found: ${inputFile}`);
    console.error("  Expected: scripts/reddit-reviews-clean.csv  (or .json)");
    process.exit(1);
  }

  const rows = inputFile.endsWith(".csv")
    ? parseCsv(fs.readFileSync(inputFile, "utf8"))
    : JSON.parse(fs.readFileSync(inputFile, "utf8"));
  console.log(`Loaded ${rows.length} rows from ${inputFile}`);

  // ── Validation ──────────────────────────────────────────────────────────────
  const invalid = rows.filter((r) => !r.bottle_id || r.rating_raw == null);
  if (invalid.length) {
    console.error(`\n✗ ${invalid.length} row(s) are missing bottle_id or rating_raw:`);
    invalid.slice(0, 5).forEach((r) =>
      console.error(`  reddit_id=${r.reddit_id}  bottle_name="${r.bottle_name}"`)
    );
    console.error("  Fix these rows before importing.");
    process.exit(1);
  }

  // ── Supabase client (service role — bypasses RLS) ───────────────────────────
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set in .env.local");
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // ── Build upsert payload ────────────────────────────────────────────────────
  const payload = rows.map((r) => ({
    bottle_id:  r.bottle_id,
    rating:     Math.min(10, Math.max(1, Math.round(r.rating_raw))),
    nose:       r.nose   || null,
    palate:     r.palate || null,
    finish:     r.finish || null,
    session_id: `reddit_${r.reddit_id}`,
    // user_id intentionally left null — these are community-sourced ratings
  }));

  // ── Upsert in batches of 50 ─────────────────────────────────────────────────
  const BATCH = 50;
  let inserted = 0;
  let skipped  = 0;

  for (let i = 0; i < payload.length; i += BATCH) {
    const batch = payload.slice(i, i + BATCH);
    const { error, count } = await supabase
      .from("ratings")
      .upsert(batch, { onConflict: "bottle_id,session_id", count: "exact" });

    if (error) {
      console.error(`\n✗ Supabase error on batch ${i / BATCH + 1}:`, error.message);
      process.exit(1);
    }

    inserted += count ?? batch.length;
    process.stdout.write(`\r  ${Math.min(i + BATCH, payload.length)} / ${payload.length}`);
  }

  console.log(`\n\n✓ Done.`);
  console.log(`  ${inserted} ratings upserted (${skipped} skipped as duplicates)`);
  console.log(`  Reload the app — new ratings will appear immediately.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
