/**
 * upsert-2026-releases.mjs
 * ──────────────────────────────────────────────────────────────────────────
 * 2026 release backfill (November 2026).
 *
 * Most of the backfill lives in src/data/whiskeys.ts. This script covers the
 * bottles whose producer exists only in Supabase (Rabbit Hole, Wilderness
 * Trail), which whiskeys.ts cannot add to.
 *
 * The full list, with the calendar line each bottle came from, is in
 * scripts/data/2026-release-backfill.json; this script inserts the entries
 * marked "_target": "database".
 *
 * Idempotent — safe to re-run.
 * Usage: node scripts/upsert-2026-releases.mjs [--dry-run]
 * Undo:  delete the listed ids from the `bottles` table.
 * ──────────────────────────────────────────────────────────────────────────
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, "");
  }
}

const all = JSON.parse(fs.readFileSync(path.join(__dirname, "data", "2026-release-backfill.json"), "utf8"));
const rows = all
  .filter((e) => e._target === "database")
  .map((e) => ({
    id: e.id,
    sub_brand_id: e.subBrandId,
    name: e.name,
    price: e.price,
    abv: e.abv,
    age: e.age ?? null,
    rarity: e.rarity,
    rarity_score: e.rarityScore,
    description: e.description,
    entry_source: "official",
    availability: e.availability ?? "current",
    style: e.style ?? null,
  }));

async function main() {
  console.log(`${rows.length} bottles:`);
  for (const r of rows) console.log(`  ${r.id} → ${r.sub_brand_id} (${r.abv}% ABV, $${r.price})`);
  if (process.argv.includes("--dry-run")) return;

  loadEnv();
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { error } = await supabase.from("bottles").upsert(rows, { onConflict: "id" });
  if (error) {
    console.error("Bottles error:", error.message);
    process.exit(1);
  }
  console.log("✓ Done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
