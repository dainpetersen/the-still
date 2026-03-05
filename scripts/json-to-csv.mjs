/**
 * json-to-csv.mjs
 * Converts reddit-reviews-raw.json → reddit-reviews-raw.csv
 * Open the CSV in Excel / Numbers / Google Sheets to clean it up.
 *
 * Columns you need to fill in / fix:
 *   bottle_id    ← look up in bottle-ids-reference.tsv
 *   bottle_name  ← verify the parsed name is correct
 *   distillery   ← verify the guessed distillery
 *   rating_raw   ← the parsed float rating — leave as-is
 *
 * Columns you can ignore / leave blank:
 *   nose / palate / finish  (optional tasting notes)
 *
 * DELETE entire rows for anything not in your catalog.
 *
 * When done, save as reddit-reviews-clean.csv in this folder.
 * Then run: node scripts/import-reddit-ratings.mjs scripts/reddit-reviews-clean.csv
 *
 * Usage: node scripts/json-to-csv.mjs
 */

import fs   from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IN  = path.join(__dirname, "reddit-reviews-raw.json");
const OUT = path.join(__dirname, "reddit-reviews-raw.csv");

const COLUMNS = [
  "bottle_id",
  "bottle_name",
  "distillery",
  "rating_raw",
  "nose",
  "palate",
  "finish",
  "reddit_id",
  "subreddit",
  "score",
  "url",
  "title",
];

function escapeCsv(val) {
  if (val == null) return "";
  const s = String(val);
  // Wrap in quotes if contains comma, quote, or newline
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const rows = JSON.parse(fs.readFileSync(IN, "utf8"));
const lines = [
  COLUMNS.join(","),
  ...rows.map((r) => COLUMNS.map((c) => escapeCsv(r[c])).join(",")),
];

fs.writeFileSync(OUT, lines.join("\n"));
console.log(`✓ ${rows.length} rows written to ${OUT}`);
console.log("  Open it in Excel / Numbers / Google Sheets to clean it up.");
console.log("  Save the cleaned version as: scripts/reddit-reviews-clean.csv");
