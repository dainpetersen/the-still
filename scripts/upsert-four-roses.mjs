/**
 * upsert-four-roses.mjs
 * ──────────────────────────────────────────────────────────────────────────
 * Upserts the full Four Roses Distillery catalog into Supabase:
 *   Core Lineup · Single Barrel Collection · Private Selection ·
 *   Annual Limited Edition Small Batch (2023–2025) · Legacy/Anniversary
 *
 * Sub-brands:
 *   four-roses-core            — Yellow Label, Small Batch, Small Batch Select
 *   four-roses-single-barrel   — Standard OBSV + 2025 Collection (OBSF/OESK/OESO)
 *   four-roses-private-selection — Store-pick barrel-strength program
 *   four-roses-limited         — Annual LE Small Batch + anniversary releases
 *
 * Idempotent: uses upsert (onConflict: "id") — safe to re-run.
 * Usage: node scripts/upsert-four-roses.mjs
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

const BRAND_ID = "four-roses";

const NEW_SUB_BRANDS = [
  { id: "four-roses-core",              name: "Four Roses Core Lineup",           brand_id: BRAND_ID },
  { id: "four-roses-single-barrel",     name: "Four Roses Single Barrel",         brand_id: BRAND_ID },
  { id: "four-roses-private-selection", name: "Four Roses Private Selection",      brand_id: BRAND_ID },
  { id: "four-roses-limited",           name: "Four Roses Limited Edition",        brand_id: BRAND_ID },
];

const BOTTLES = [

  // ═══════════════════════════════════════════════════════════════════
  //  CORE LINEUP
  // ═══════════════════════════════════════════════════════════════════

  {
    id: "four-roses-yellow-label",
    sub_brand_id: "four-roses-core",
    name: "Four Roses Bourbon (Yellow Label)",
    age: null,
    abv: 40,
    price: 20,
    rarity: "common",
    rarity_score: 1,
    style: "Bourbon",
    availability: "current",
    entry_source: "catalog",
    description: "The entry-level expression blending all 10 of Four Roses' proprietary recipes across a range of approximately 4–12 year old barrels (avg ~5.5 years). Bottled at 80 proof; approachable and mixable with light fruit, vanilla, and subtle rye spice.",
  },
  {
    id: "four-roses-small-batch",
    sub_brand_id: "four-roses-core",
    name: "Four Roses Small Batch",
    age: null,
    abv: 45,
    price: 35,
    rarity: "common",
    rarity_score: 1,
    style: "Bourbon",
    availability: "current",
    entry_source: "catalog",
    description: "A blend of 4 of Four Roses' 10 recipes, bottled at 90 proof. More complex and sippable than Yellow Label, with notes of rich fruit, caramel, light oak, and a hint of spice on a smooth, lingering finish.",
  },
  {
    id: "four-roses-small-batch-select",
    sub_brand_id: "four-roses-core",
    name: "Four Roses Small Batch Select",
    age: null,
    abv: 52,
    price: 65,
    rarity: "common",
    rarity_score: 2,
    style: "Bourbon",
    availability: "current",
    entry_source: "catalog",
    description: "A non-chill-filtered blend of 6 of Four Roses' 10 recipes, bottled at 104 proof. Introduced in 2019, it offers a rich, full-bodied experience with creamy vanilla, baking spices, dried fruit, and a long, warming finish.",
  },

  // ═══════════════════════════════════════════════════════════════════
  //  SINGLE BARREL COLLECTION
  // ═══════════════════════════════════════════════════════════════════

  {
    id: "four-roses-single-barrel-obsv",
    sub_brand_id: "four-roses-single-barrel",
    name: "Four Roses Single Barrel (OBSV)",
    age: null,
    abv: 50,
    price: 50,
    rarity: "common",
    rarity_score: 2,
    style: "Bourbon",
    availability: "current",
    entry_source: "catalog",
    description: "The flagship single barrel expression — OBSV recipe (60% corn / 35% rye / 5% malted barley, 'V' yeast) aged 7–9 years and bottled at 100 proof. Hand-selected by the Master Distiller; full-bodied with caramel, vanilla, ripe fruit, and a mellow, clean finish.",
  },
  {
    id: "four-roses-single-barrel-obsf",
    sub_brand_id: "four-roses-single-barrel",
    name: "Four Roses Single Barrel OBSF",
    age: null,
    abv: 50,
    price: 50,
    rarity: "limited",
    rarity_score: 3,
    style: "Bourbon",
    availability: "limited_release",
    entry_source: "catalog",
    description: "Part of the 2025 Single Barrel Collection — OBSF recipe (60% corn / 35% rye, 'F' yeast: mint, fruity, full body) aged 7–9 years at 100 proof. Lush apple, vanilla, cocoa, and bright rye; part of an annually rotating single-barrel program launched to celebrate Four Roses' 20th anniversary.",
  },
  {
    id: "four-roses-single-barrel-oesk",
    sub_brand_id: "four-roses-single-barrel",
    name: "Four Roses Single Barrel OESK",
    age: null,
    abv: 50,
    price: 50,
    rarity: "limited",
    rarity_score: 3,
    style: "Bourbon",
    availability: "limited_release",
    entry_source: "catalog",
    description: "Part of the 2025 Single Barrel Collection — OESK recipe (75% corn / 20% rye, 'K' yeast: baking spice, slight spice, full body) aged 7–9 years at 100 proof. Nutmeg, cinnamon, almond, cherry, and caramel; rich and well-rounded with layered spice.",
  },
  {
    id: "four-roses-single-barrel-oeso",
    sub_brand_id: "four-roses-single-barrel",
    name: "Four Roses Single Barrel OESO",
    age: null,
    abv: 50,
    price: 50,
    rarity: "limited",
    rarity_score: 3,
    style: "Bourbon",
    availability: "limited_release",
    entry_source: "catalog",
    description: "Part of the 2025 Single Barrel Collection — OESO recipe (75% corn / 20% rye, 'O' yeast: rich red fruit, vanilla, brown sugar) aged 7–9 years at 100 proof. Ripe red apple, maraschino cherry, toffee, and stone fruit; spicy, viscous, and intensely fruity.",
  },

  // ═══════════════════════════════════════════════════════════════════
  //  PRIVATE SELECTION (Barrel-Strength Store Picks)
  // ═══════════════════════════════════════════════════════════════════

  {
    id: "four-roses-private-selection",
    sub_brand_id: "four-roses-private-selection",
    name: "Four Roses Private Selection Single Barrel Barrel Strength",
    age: null,
    abv: 56,
    price: 100,
    rarity: "limited",
    rarity_score: 4,
    style: "Bourbon",
    availability: "current",
    entry_source: "catalog",
    description: "Retailer-exclusive single-barrel bottlings using any of Four Roses' 10 proprietary recipes, bottled at cask strength (typically 105–122 proof) after 9–12 years of aging. Each bottle carries its full recipe code (e.g., OBSQ, OESV, OBSK), allowing enthusiasts to explore individual yeast and mashbill character. MSRP ~$100; barrel proofs and recipe availability vary by selection.",
  },

  // ═══════════════════════════════════════════════════════════════════
  //  LIMITED EDITION ANNUAL RELEASES
  // ═══════════════════════════════════════════════════════════════════

  {
    id: "four-roses-le-2025",
    sub_brand_id: "four-roses-limited",
    name: "Four Roses 2025 Limited Edition Small Batch (18th Annual)",
    age: null,
    abv: 54.5,
    price: 249,
    rarity: "allocated",
    rarity_score: 7,
    style: "Bourbon",
    availability: "limited_release",
    entry_source: "catalog",
    description: "The 18th annual LE release — a non-chill-filtered barrel-strength blend of four recipes: 38% 13-year OBSV, 35% 13-year OESV, 17% 13-year OBSK, and 10% 19-year OESV. Bottled at 109 proof; 16,854 bottles. Notes of apricot, caramel, vanilla, spiced oak, and crème brûlée.",
  },
  {
    id: "four-roses-le-2024",
    sub_brand_id: "four-roses-limited",
    name: "Four Roses 2024 Limited Edition Small Batch (17th Annual)",
    age: null,
    abv: 54.1,
    price: 220,
    rarity: "allocated",
    rarity_score: 7,
    style: "Bourbon",
    availability: "discontinued",
    entry_source: "catalog",
    description: "The 17th annual LE release — a non-chill-filtered blend of four recipes: 39% 16-year OESF, 31% 12-year OBSV, 23% 15-year OESK, and 7% 20-year OBSV (average age ~14.8 years). Bottled at 108.2 proof; ~16,680 bottles. Creamy vanilla, honey, ripe berries, tangy citrus, and mellow spice.",
  },
  {
    id: "four-roses-le-2023",
    sub_brand_id: "four-roses-limited",
    name: "Four Roses 135th Anniversary Limited Edition Small Batch (2023, 16th Annual)",
    age: null,
    abv: 54,
    price: 200,
    rarity: "allocated",
    rarity_score: 7,
    style: "Bourbon",
    availability: "discontinued",
    entry_source: "catalog",
    description: "The 16th annual LE release celebrating Four Roses' 135th anniversary — a blend of 35% 12-year OESV, 40% 14-year OESK, 20% 16-year OESV, and 5% 25-year OBSV (the oldest recipe ever used in a Four Roses LE). Bottled at 108 proof; non-chill filtered. Notes of allspice, vanilla, oak, cinnamon, and clove.",
  },
  {
    id: "four-roses-le-2022",
    sub_brand_id: "four-roses-limited",
    name: "Four Roses 2022 Limited Edition Small Batch (15th Annual)",
    age: null,
    abv: 54.5,
    price: 180,
    rarity: "allocated",
    rarity_score: 7,
    style: "Bourbon",
    availability: "discontinued",
    entry_source: "catalog",
    description: "The 15th annual LE release — a non-chill-filtered barrel-strength blend featuring a 20-year OBSV, 15-year OESK, 14-year OESF, and 14-year OESV. Bottled at 109 proof. Rich dried fruit, oak spice, vanilla, and subtle herbal notes from the long-aged components.",
  },

  // ═══════════════════════════════════════════════════════════════════
  //  ANNIVERSARY / SPECIAL HERITAGE RELEASES
  // ═══════════════════════════════════════════════════════════════════

  {
    id: "four-roses-130th-anniversary-2018",
    sub_brand_id: "four-roses-limited",
    name: "Four Roses 130th Anniversary Limited Edition Small Batch (2018, 11th Annual)",
    age: null,
    abv: 54.2,
    price: 140,
    rarity: "rare",
    rarity_score: 8,
    style: "Bourbon",
    availability: "discontinued",
    entry_source: "catalog",
    description: "The 11th annual LE release celebrating Four Roses' 130th anniversary — a blend of 10-year OBSV, 13-year OBSF, 14-year OESV, and 16-year OESK. Bottled at 108.4 proof; ~13,140 bottles. Warm vanilla, crème brûlée, ripe berries, apricot, mint, and a long cinnamon-spice finish.",
  },
  {
    id: "four-roses-al-young-50th",
    sub_brand_id: "four-roses-limited",
    name: "Four Roses Al Young 50th Anniversary Limited Edition Small Batch",
    age: null,
    abv: 53.8,
    price: 500,
    rarity: "unicorn",
    rarity_score: 10,
    style: "Bourbon",
    availability: "discontinued",
    entry_source: "catalog",
    description: "A tribute to Senior Brand Ambassador Al Young's 50 years at Four Roses (2017 release) — a blend of 20% 12-year OBSF, 50% 13-year OESV, 25% 15-year OBSK, and 5% 23-year OBSV. Bottled at 107.6 proof. Notes of vanilla bean, magnolia, honeysuckle, macadamia, honey-citrus, and cherry oak. Secondary market prices have exceeded $1,000.",
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

  // 1. Upsert sub-brands
  console.log(`\n📦 Upserting ${NEW_SUB_BRANDS.length} sub-brands…`);
  const { error: sbError } = await db
    .from("sub_brands")
    .upsert(NEW_SUB_BRANDS, { onConflict: "id" });
  if (sbError) {
    console.error("❌ sub_brands upsert failed:", sbError.message);
    process.exit(1);
  }
  console.log(`   ✅ ${NEW_SUB_BRANDS.length} sub-brands upserted`);

  // 2. Upsert bottles in batches of 25
  console.log(`\n🥃 Upserting ${BOTTLES.length} bottles…`);
  const BATCH = 25;
  let inserted = 0;
  for (let i = 0; i < BOTTLES.length; i += BATCH) {
    const batch = BOTTLES.slice(i, i + BATCH);
    const { error } = await db
      .from("bottles")
      .upsert(batch, { onConflict: "id" });
    if (error) {
      console.error(`❌ Batch ${Math.floor(i / BATCH) + 1} failed:`, error.message);
      process.exit(1);
    }
    inserted += batch.length;
    console.log(`   ✅ Batch ${Math.floor(i / BATCH) + 1}: ${inserted}/${BOTTLES.length} bottles`);
  }

  console.log(`\n🎉 Done! Upserted ${NEW_SUB_BRANDS.length} sub-brands + ${BOTTLES.length} bottles for Four Roses.\n`);
  console.log("   Coverage: Core · Single Barrel Collection · Private Selection · Annual LE (2022–2025) · Anniversary Releases");
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
