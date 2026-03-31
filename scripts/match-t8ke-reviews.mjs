/**
 * match-t8ke-reviews.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Matches the T8KE / American Whiskey Review Database CSV against CommonCask
 * bottle IDs, then outputs a clean CSV ready for import-reddit-ratings.mjs.
 *
 * Usage:
 *   node scripts/match-t8ke-reviews.mjs [path/to/reviews.csv]
 *
 * Outputs:
 *   scripts/t8ke-matched.csv      — rows with confident bottle_id matches
 *   scripts/t8ke-unmatched.csv    — rows that didn't match (for manual review)
 *
 * The output CSV uses the same schema as reddit-reviews-clean.csv so the
 * existing import-reddit-ratings.mjs script can ingest it directly.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import fs   from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── 1. Parse CSV (handles quoted fields) ─────────────────────────────────────
function parseCsv(text) {
  const lines = text.split("\n").filter((l) => l.trim());
  // First line may have a leading BOM or tab
  const rawHeader = lines[0].replace(/^\t/, "");
  const headers = rawHeader.split(",").map((h) => h.trim().replace(/^"|"$/g, ""));

  return lines.slice(1).map((line) => {
    const fields = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' && !inQ)        { inQ = true; }
      else if (ch === '"' && inQ) {
        if (line[i + 1] === '"')     { cur += '"'; i++; }
        else                         { inQ = false; }
      } else if (ch === "," && !inQ) { fields.push(cur); cur = ""; }
      else                           { cur += ch; }
    }
    fields.push(cur);
    const obj = {};
    headers.forEach((h, i) => {
      const v = (fields[i] ?? "").trim();
      obj[h] = v === "" ? null : v;
    });
    return obj;
  });
}

// ── 2. Normalize string for comparison ────────────────────────────────────────
function norm(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[''`]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s) {
  return new Set(norm(s).split(" ").filter(Boolean));
}

// Jaccard similarity
function jaccard(a, b) {
  const tA = tokens(a), tB = tokens(b);
  let inter = 0;
  for (const t of tA) if (tB.has(t)) inter++;
  const union = tA.size + tB.size - inter;
  return union === 0 ? 0 : inter / union;
}

// Precision: fraction of search tokens found in candidate
// Rewards candidates that cover more of the specific query terms
function precision(search, candidate) {
  const tS = tokens(search), tC = tokens(candidate);
  if (tS.size === 0) return 0;
  let hits = 0;
  for (const t of tS) if (tC.has(t)) hits++;
  return hits / tS.size;
}

// Combined score: weighted blend of Jaccard and precision
function similarity(search, candidate) {
  return jaccard(search, candidate) * 0.55 + precision(search, candidate) * 0.45;
}

// ── 3. Brand name → CommonCask brand_id anchor map ───────────────────────────
// CSV brand (uppercased) → one or more brand-level prefixes used in our bottle IDs
// This prevents cross-brand false matches.
const BRAND_MAP = {
  "BUFFALO TRACE":               "buffalo-trace",
  "BLANTONS":                    "blanton",
  "EAGLE RARE":                  "eagle-rare",
  "W.L. WELLER":                 "weller",
  "COLONEL E.H. TAYLOR":         "eh-taylor",
  "GEORGE T. STAGG":             "stagg",
  "STAGG":                       "stagg",
  "STAGG JR":                    "stagg",
  "ELMER T. LEE":                "elmer-t-lee",
  "PAPPY VAN WINKLES FAMILY RESERVE": "pappy",
  "OLD RIP VAN WINKLE":          "pappy",
  "VAN WINKLE":                  "pappy",
  "PENELOPE":                    "penelope-bourbon",
  "JIM BEAM":                    "jim-beam",
  "SMOOTH AMBLER":               "smooth-ambler",
  "BULLEIT":                     "bulleit",
  "FOUR ROSES":                  "four-roses",
  "WILD TURKEY":                 "wild-turkey",
  "RUSSELLS RESERVE":            "russells",
  "ELIJAH CRAIG":                "elijah-craig",
  "EVAN WILLIAMS":               "evan-williams",
  "BERNHEIM":                    "bernheim",
  "OLD FITZGERALD":              "old-fitzgerald",
  "LARCENY":                     "larceny",
  "HEAVEN HILL":                 "heaven-hill",
  "PARKERS HERITAGE COLLECTION": "parkers",
  "HENRY MCKENNA":               "henry-mckenna",
  "MAKERS MARK":                 "makers-mark",
  "WOODFORD RESERVE":            "woodford",
  "KNOB CREEK":                  "knob-creek",
  "BASIL HAYDEN":                "basil-haydens",
  "BOOKERS":                     "bookers",
  "BAKERS":                      "bakers",
  "OLD GRAND-DAD":               "old-grand-dad",
  "OLD OVERHOLT":                "old-overholt",
  "A. OVERHOLT":                 "a-overholt",
  "ANGELS ENVY":                 "angels-envy",
  "HIGH WEST":                   "high-west",
  "WILLETT":                     "willett",
  "BARDSTOWN BOURBON COMPANY":   "bbc",
  "STILL AUSTIN":                "still-austin",
  "NEW RIFF":                    "new-riff",
  "OL NEW RIFF":                 "new-riff",
  "TEMPLETON":                   "templeton",
  "SAGAMORE":                    "sagamore",
  "LEOPOLD BROS":                "leopold",
  "BOMBERGERS":                  "bombergers",
  "WHISTLEPIG":                  "whistlepig",
  "JEFFERSONS":                  "jeffersons",
  "MICHTERS":                    "michters",
  "BARRELL":                     "barrell",
  "GARRISON BROTHERS":           "garrison",
  "1792":                        "1792",
  "RI1":                         "ri1",
  "(RI)1":                       "ri1",
  "NULU":                        "nulu",
  "ANGELS ENVY DISTILLERY":      "angels-envy",
  "OLD FORESTER":                "old-forester",
  "BROWN FORMAN":                "brown-forman",
  "EARLY TIMES":                 "early-times",
  "GENTLEMAN JACK":              "gentleman-jack",
  "JACK DANIELS":                "jack-daniels",
  "GEORGE DICKEL":               "george-dickel",
};

// ── 4. Load all bottle IDs from whiskeys.ts ───────────────────────────────────
function loadBottles() {
  const src = fs.readFileSync(
    path.join(__dirname, "..", "src", "data", "whiskeys.ts"),
    "utf8"
  );
  const lines = src.split("\n");
  const bottles = [];
  // Walk pairs of lines: "id: ..." then "name: ..." (or "subBrandId: ..." then skip)
  // We want only bottle-level entries — they appear as: id, name, subBrandId in that order
  for (let i = 0; i < lines.length - 2; i++) {
    const idM   = lines[i].match(/^\s{10,}id:\s*"([^"]+)"/);    // deeply indented = bottle
    const nameM = lines[i + 1].match(/^\s+name:\s*"([^"]+)"/);
    const subM  = lines[i + 2].match(/subBrandId/);
    if (idM && nameM && subM) {
      bottles.push({ id: idM[1], name: nameM[1] });
    }
  }
  return bottles;
}

// ── 5. Extract Reddit post ID from link HTML ──────────────────────────────────
function extractPostId(link) {
  if (!link) return null;
  const m = link.match(/reddit\.com\/r\/[^/]+\/comments\/([a-z0-9]+)/i);
  return m ? m[1] : null;
}

// ── 6. Main ───────────────────────────────────────────────────────────────────
function main() {
  const csvPath = process.argv[2] ?? path.join(
    process.env.HOME, "Downloads", "reviews.csv"
  );

  if (!fs.existsSync(csvPath)) {
    console.error(`✗ File not found: ${csvPath}`);
    process.exit(1);
  }

  console.log(`Loading CSV: ${csvPath}`);
  const rows = parseCsv(fs.readFileSync(csvPath, "utf8"));
  console.log(`  ${rows.length} total rows`);

  const scoredRows = rows.filter((r) => r["T8KE SCORE"] != null);
  console.log(`  ${scoredRows.length} rows with T8KE SCORE`);

  const bottles = loadBottles();
  console.log(`  ${bottles.length} bottles in CommonCask catalog`);

  // Build bottle lookup: id → { id, name, normName }
  const bottleList = bottles.map((b) => ({
    id: b.id,
    name: b.name,
    normName: norm(b.name),
  }));

  // ── Match each scored row ──────────────────────────────────────────────────
  const THRESHOLD = 0.42;
  const matched   = [];
  const unmatched = [];

  for (const row of scoredRows) {
    const csvBrand   = (row["BRAND"]   || "").trim();
    const csvLabel   = (row["LABEL"]   || "").trim();
    const csvVariant = (row["VARIANT"] || "").trim();
    const score      = parseFloat(row["T8KE SCORE"]);
    if (isNaN(score)) { unmatched.push({ ...row, match_reason: "non-numeric score" }); continue; }

    // Build normalized brand key for anchor lookup
    const brandKey = norm(csvBrand).replace(/\s+/g, " ").toUpperCase();
    // Find anchor prefix
    let anchor = null;
    for (const [k, v] of Object.entries(BRAND_MAP)) {
      if (norm(k) === norm(brandKey) || norm(csvBrand) === norm(k)) {
        anchor = v;
        break;
      }
    }

    if (!anchor) {
      unmatched.push({ ...row, match_reason: "brand not in catalog" });
      continue;
    }

    // Skip generic numbered-series entries that can't be pinned to a specific bottle.
    // E.g. BBC "DISCOVERY SERIES" without a variant like "#8" or "8" would match
    // discovery-1 arbitrarily. Require a number if the label implies a numbered series.
    const numberedSeriesLabels = /discovery series|fusion series|parker.?s heritage/i;
    if (numberedSeriesLabels.test(csvLabel) && !csvVariant && !/\d/.test(csvLabel + csvVariant)) {
      unmatched.push({ ...row, match_reason: "numbered series without specific entry" });
      continue;
    }

    // Build search string from CSV fields
    const searchStr = [csvBrand, csvLabel, csvVariant].filter(Boolean).join(" ");

    // Only compare bottles that start with the anchor prefix
    const candidates = bottleList.filter((b) => b.id.startsWith(anchor));
    if (candidates.length === 0) {
      unmatched.push({ ...row, match_reason: `no bottles with prefix '${anchor}'` });
      continue;
    }

    // Score each candidate; boost when LABEL tokens appear in candidate name
    const labelTokens = tokens(csvLabel);
    let best = null, bestScore = -1;
    for (const b of candidates) {
      let sim = similarity(searchStr, b.name);
      // Label-match bonus: reward candidates containing the distinctive label terms
      for (const t of labelTokens) {
        if (tokens(b.name).has(t)) sim += 0.08;
      }
      if (sim > bestScore) { bestScore = sim; best = b; }
    }

    const postId = extractPostId(row["LINK"]);

    if (bestScore >= THRESHOLD) {
      matched.push({
        bottle_id:   best.id,
        bottle_name: best.name,
        csv_brand:   csvBrand,
        csv_label:   csvLabel,
        csv_variant: csvVariant,
        rating_raw:  score,
        reviewer:    row["REVIEWER"] || "",
        date:        row["DATE"] || "",
        proof:       row["PROOF"] || "",
        age:         row["AGE"] || "",
        link:        postId ? `https://reddit.com/comments/${postId}` : "",
        reddit_id:   postId || `t8ke_${Math.random().toString(36).slice(2,10)}`,
        sim_score:   bestScore.toFixed(3),
        source:      "t8ke",
      });
    } else {
      unmatched.push({
        ...row,
        match_reason:  `low similarity (${bestScore.toFixed(3)}) best='${best?.name}'`,
        best_candidate: best?.id || "",
      });
    }
  }

  // ── Deduplicate: one row per (bottle_id, reddit_id) ───────────────────────
  const seen = new Set();
  const deduped = matched.filter((r) => {
    const key = `${r.bottle_id}::${r.reddit_id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // ── Write matched CSV ──────────────────────────────────────────────────────
  const matchedPath = path.join(__dirname, "t8ke-matched.csv");
  const headers = Object.keys(deduped[0] ?? matched[0] ?? {});
  const toCsv = (rows) =>
    [headers.join(","), ...rows.map((r) =>
      headers.map((h) => {
        const v = String(r[h] ?? "").replace(/"/g, '""');
        return v.includes(",") || v.includes('"') ? `"${v}"` : v;
      }).join(",")
    )].join("\n");

  fs.writeFileSync(matchedPath, toCsv(deduped));

  // ── Write unmatched CSV ────────────────────────────────────────────────────
  const unmatchedPath = path.join(__dirname, "t8ke-unmatched.csv");
  if (unmatched.length > 0) {
    const uHeaders = Object.keys(unmatched[0]);
    const uCsv = [uHeaders.join(","), ...unmatched.map((r) =>
      uHeaders.map((h) => {
        const v = String(r[h] ?? "").replace(/"/g, '""');
        return v.includes(",") || v.includes('"') ? `"${v}"` : v;
      }).join(",")
    )].join("\n");
    fs.writeFileSync(unmatchedPath, uCsv);
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log(`\n✓ Matching complete`);
  console.log(`  ${deduped.length} matched (${matched.length - deduped.length} deduped)`);
  console.log(`  ${unmatched.length} unmatched`);
  console.log(`\n  Matched by bottle:`);

  const byBottle = {};
  for (const r of deduped) byBottle[r.bottle_id] = (byBottle[r.bottle_id] || 0) + 1;
  Object.entries(byBottle)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .forEach(([id, cnt]) => console.log(`    ${cnt.toString().padStart(4)}  ${id}`));

  console.log(`\n  Output:`);
  console.log(`    ${matchedPath}`);
  console.log(`    ${unmatchedPath}`);
  console.log(`\n  Next step:`);
  console.log(`    node scripts/import-reddit-ratings.mjs scripts/t8ke-matched.csv`);
}

main();
