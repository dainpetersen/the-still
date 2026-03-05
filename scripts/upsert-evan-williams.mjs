/**
 * upsert-evan-williams.mjs
 * ──────────────────────────────────────────────────────────────────────────
 * Upserts the full Evan Williams catalog into Supabase under the
 * existing heaven-hill brand:
 *   Black Label · Bottled-in-Bond · 1783 Small Batch · Single Barrel Vintage
 *
 * New sub-brand: evan-williams
 * Skips flavored expressions (Honey, Peach, Cherry, Fire) — not whiskeys.
 *
 * Idempotent: uses upsert (onConflict: "id") — safe to re-run.
 * Usage: node scripts/upsert-evan-williams.mjs
 * ──────────────────────────────────────────────────────────────────────────
 */

import fs   from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, "");
  }
}

// ── Catalog data ─────────────────────────────────────────────────────────────

const BRAND_ID = "heaven-hill";

const NEW_SUB_BRANDS = [
  { id: "evan-williams", name: "Evan Williams", brand_id: BRAND_ID },
];

const BOTTLES = [
  // ═══════════════════════════════════════════════════════════════════
  //  EVAN WILLIAMS — Core Lineup
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "evan-williams-black-label",
    sub_brand_id: "evan-williams",
    name: "Evan Williams Black Label Kentucky Straight Bourbon",
    age: null,
    abv: 43,
    price: 15,
    rarity: "common",
    rarity_score: 1,
    style: "Bourbon",
    availability: "current",
    entry_source: "catalog",
    description: "Kentucky's 1st distiller since 1783. Rich, smooth, and full of character — the everyday bourbon that delivers genuine quality at an unbeatable price. Nose of light vanilla and mint; notes of oak, brown sugar, and caramel on the palate; medium to long finish. Bottled at 86 proof.",
  },
  {
    id: "evan-williams-bib",
    sub_brand_id: "evan-williams",
    name: "Evan Williams Bottled-in-Bond Kentucky Straight Bourbon",
    age: 4,
    abv: 50,
    price: 20,
    rarity: "common",
    rarity_score: 2,
    style: "Bourbon",
    availability: "current",
    entry_source: "catalog",
    description: "One vision. One distillery. One season. Aged four years and bottled at 100 proof per the strict Bottled-in-Bond Act of 1897. Nose of caramel with hints of vanilla, oak, and barley; citrus over vanilla and black pepper on the palate; warm, long, and dry finish. Look for the white label.",
  },
  {
    id: "evan-williams-1783",
    sub_brand_id: "evan-williams",
    name: "Evan Williams 1783 Small Batch Bourbon",
    age: null,
    abv: 43,
    price: 25,
    rarity: "common",
    rarity_score: 2,
    style: "Bourbon",
    availability: "current",
    entry_source: "catalog",
    description: "No more than 200 handpicked barrels go into this award-winning small batch Kentucky Bourbon, extra aged for smooth, rich character. Nose of oaky vanilla, sautéed butter, and sweet corn; semi-sweet, oaky, and honeyed palate; lean, off-dry, and regal finish. Named for the year Evan Williams first distilled in Kentucky.",
  },
  {
    id: "evan-williams-single-barrel",
    sub_brand_id: "evan-williams",
    name: "Evan Williams Single Barrel Vintage Bourbon",
    age: null,
    abv: 43.3,
    price: 30,
    rarity: "limited",
    rarity_score: 3,
    style: "Bourbon",
    availability: "current",
    entry_source: "catalog",
    description: "A five-time 'Whiskey of the Year' award winner. Carefully hand-selected by the Master Distiller — only the best bourbon makes it into each specially marked, vintage-dated bottle. Nose of dark caramel, sweet oak, and charred wood; lush and spicy palate with oak, honey, apple, and orange; long, graceful, and relaxed finish. Bottled at 86.6 proof.",
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  loadEnv();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const db = createClient(supabaseUrl, serviceKey);

  // 1. Upsert new sub-brand
  console.log(`\n📦 Upserting ${NEW_SUB_BRANDS.length} new sub-brand…`);
  const { error: sbError } = await db
    .from("sub_brands")
    .upsert(NEW_SUB_BRANDS, { onConflict: "id" });
  if (sbError) {
    console.error("❌ sub_brands upsert failed:", sbError.message);
    process.exit(1);
  }
  console.log(`   ✅ ${NEW_SUB_BRANDS.length} sub-brand upserted`);

  // 2. Upsert bottles
  console.log(`\n🥃 Upserting ${BOTTLES.length} bottles…`);
  const { error } = await db
    .from("bottles")
    .upsert(BOTTLES, { onConflict: "id" });
  if (error) {
    console.error("❌ bottles upsert failed:", error.message);
    process.exit(1);
  }
  console.log(`   ✅ ${BOTTLES.length} bottles upserted`);

  console.log(`\n🎉 Done! Upserted 1 sub-brand + ${BOTTLES.length} bottles for Evan Williams.\n`);
  console.log("   Expressions: Black Label · Bottled-in-Bond · 1783 Small Batch · Single Barrel Vintage");
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
