/**
 * upsert-sagamore.mjs
 * ──────────────────────────────────────────────────────────────────────────
 * One-time script to upsert the full Sagamore Spirit catalog into Supabase:
 *   brands → sub_brands → bottles
 *
 * Idempotent: uses upsert (onConflict: "id") so safe to re-run.
 * Usage: node scripts/upsert-sagamore.mjs
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

const BRAND = {
  id: "sagamore-spirit",
  name: "Sagamore Spirit",
  country: "USA",
  region: "Baltimore, MD",
  state: "Maryland",
  is_ndp: false,
};

const SUB_BRANDS = [
  { id: "sagamore-core",      name: "Core Collection",       brand_id: "sagamore-spirit" },
  { id: "sagamore-reserve",   name: "Reserve Series",        brand_id: "sagamore-spirit" },
  { id: "sagamore-exclusive", name: "Distillery Exclusive",  brand_id: "sagamore-spirit" },
  { id: "sagamore-limited",   name: "Limited Releases",      brand_id: "sagamore-spirit" },
  { id: "sagamore-past",      name: "Past Releases",         brand_id: "sagamore-spirit" },
];

const BOTTLES = [
  // ── Core Collection ────────────────────────────────────────────────────────
  {
    id: "sagamore-small-batch",
    sub_brand_id: "sagamore-core",
    name: "Sagamore Small Batch Rye Whiskey",
    age: 4,
    abv: 46.5,
    price: 40,
    rarity: "common",
    rarity_score: 12,
    style: "Rye Whiskey",
    availability: "current",
    entry_source: "official",
    description: "The flagship Maryland-style rye blending high- and low-rye mash bills, triple distilled and aged 4–6 years. Classic baking spices, caramel, and a smooth finish.",
  },
  {
    id: "sagamore-cask-strength",
    sub_brand_id: "sagamore-core",
    name: "Sagamore Cask Strength Rye Whiskey",
    age: 4,
    abv: 56.1,
    price: 70,
    rarity: "limited",
    rarity_score: 30,
    style: "Rye Whiskey",
    availability: "current",
    entry_source: "official",
    description: "Near-cask-strength Maryland rye (4–7 yr) proofed with 1909 limestone spring water. Bold cinnamon, dark chocolate, and intense black pepper.",
  },
  {
    id: "sagamore-double-oak",
    sub_brand_id: "sagamore-core",
    name: "Sagamore Double Oak Rye Whiskey",
    age: 4,
    abv: 48.3,
    price: 58,
    rarity: "limited",
    rarity_score: 22,
    style: "Rye Whiskey",
    availability: "current",
    entry_source: "official",
    description: "Maryland rye aged in high-char new oak then finished 18 months in toasted wave stave barrels. Caramel, toasted coconut, hazelnut, and vanilla.",
  },

  // ── Reserve Series ─────────────────────────────────────────────────────────
  {
    id: "sagamore-bib-7",
    sub_brand_id: "sagamore-reserve",
    name: "Sagamore Bottled in Bond Straight Rye Whiskey",
    age: 7,
    abv: 50,
    price: 60,
    rarity: "limited",
    rarity_score: 38,
    style: "Rye Whiskey",
    availability: "current",
    entry_source: "official",
    description: "Annual small-batch release of triple-distilled Maryland rye aged 7 years at 100 proof. Brûléed sugar, orange zest, ginger spice cake, and warm rye finish.",
  },
  {
    id: "sagamore-9-year",
    sub_brand_id: "sagamore-reserve",
    name: "Sagamore 9-Year-Old Straight Rye Whiskey",
    age: 9,
    abv: 56.3,
    price: 83,
    rarity: "limited",
    rarity_score: 52,
    style: "Rye Whiskey",
    availability: "current",
    entry_source: "official",
    description: "Reserve Series aged 9 years in new charred American white oak. Stone fruit, pecan pie, peppery honey, and cinnamon toast.",
  },
  {
    id: "sagamore-10-year",
    sub_brand_id: "sagamore-reserve",
    name: "Sagamore 10-Year-Old Straight Rye Whiskey",
    age: 10,
    abv: 55.4,
    price: 80,
    rarity: "limited",
    rarity_score: 55,
    style: "Rye Whiskey",
    availability: "current",
    entry_source: "official",
    description: "Decade-aged Maryland rye balanced in new charred American white oak. Peach crumble, roasted nuts, crème brûlée, and lingering white pepper.",
  },
  {
    id: "sagamore-manhattan-finish",
    sub_brand_id: "sagamore-reserve",
    name: "Sagamore Manhattan Finish Rye Whiskey",
    age: 4,
    abv: 51.5,
    price: 80,
    rarity: "limited",
    rarity_score: 48,
    style: "Rye Whiskey",
    availability: "limited_release",
    entry_source: "official",
    description: "2025 limited release finished 30 months in vermouth, bitters, and cherry brandy barrels. Cherry, bitter orange, vanilla, and rye spice.",
  },

  // ── Distillery Exclusive ───────────────────────────────────────────────────
  {
    id: "sagamore-high-rye-bourbon",
    sub_brand_id: "sagamore-exclusive",
    name: "Sagamore High Rye Bourbon Straight Whiskey",
    age: 6,
    abv: 59,
    price: 49,
    rarity: "limited",
    rarity_score: 42,
    style: "High Rye Bourbon",
    availability: "limited_release",
    entry_source: "official",
    description: "100% Maryland-made, triple-distilled high-rye bourbon available only at the distillery. Caramel, orchard fruit, cinnamon, espresso, and rye spice.",
  },

  // ── Limited Releases ───────────────────────────────────────────────────────
  {
    id: "sagamore-ravens-purple-rising",
    sub_brand_id: "sagamore-limited",
    name: "Ravens Purple Rising Rye Whiskey (2024)",
    age: 4,
    abv: 46.5,
    price: 60,
    rarity: "limited",
    rarity_score: 38,
    style: "Rye Whiskey",
    availability: "limited_release",
    entry_source: "official",
    description: "Baltimore Ravens 2024 collaboration celebrating the team's inaugural alternate purple helmet. Two straight rye mash bills, proofed with 1909 limestone water.",
  },

  // ── Past Releases (discontinued) ──────────────────────────────────────────
  {
    id: "sagamore-port-finish-2023",
    sub_brand_id: "sagamore-past",
    name: "Sagamore Port Finish Rye Whiskey (2023)",
    age: 9,
    abv: 51.5,
    price: 80,
    rarity: "rare",
    rarity_score: 62,
    style: "Rye Whiskey",
    availability: "discontinued",
    entry_source: "official",
    description: "9-year Maryland rye finished in Boordy Vineyards port barrels. Raspberries, dark cherry, plums, caramel, and dark chocolate. Third edition of the award-winning series.",
  },
  {
    id: "sagamore-sherry-finish",
    sub_brand_id: "sagamore-past",
    name: "Sagamore Sherry Finish Rye Whiskey",
    age: 4,
    abv: 53,
    price: 75,
    rarity: "rare",
    rarity_score: 60,
    style: "Rye Whiskey",
    availability: "discontinued",
    entry_source: "official",
    description: "Maryland rye finished 18 months in 132-gallon PX Sherry casks. Toasted almond, dried fig, raisins, honey, toffee, and candied orange peel.",
  },
  {
    id: "sagamore-8-year",
    sub_brand_id: "sagamore-past",
    name: "Sagamore 8-Year-Old Rye Whiskey",
    age: 8,
    abv: 55.7,
    price: 75,
    rarity: "rare",
    rarity_score: 58,
    style: "Rye Whiskey",
    availability: "discontinued",
    entry_source: "official",
    description: "Spring 2023 Reserve release aged 8 years in new charred American white oak. Dried cherries, clove, smoked vanilla, candied ginger, and molasses.",
  },
  {
    id: "sagamore-bib-6",
    sub_brand_id: "sagamore-past",
    name: "Sagamore Bottled in Bond Straight Rye Whiskey (6-Year)",
    age: 6,
    abv: 50,
    price: 55,
    rarity: "rare",
    rarity_score: 50,
    style: "Rye Whiskey",
    availability: "discontinued",
    entry_source: "official",
    description: "First BiB expression from Sagamore, aged 6 years. Brown sugar, orange spice cake, cherries, and warming rye spice.",
  },
  {
    id: "sagamore-rum-cask-finish",
    sub_brand_id: "sagamore-past",
    name: "Sagamore Rum Cask Finish Rye Whiskey",
    age: 5,
    abv: 49,
    price: 65,
    rarity: "rare",
    rarity_score: 55,
    style: "Rye Whiskey",
    availability: "discontinued",
    entry_source: "official",
    description: "Maryland rye finished in South American and Jamaican rum casks. Demerara sugar, ripe banana, passion fruit, spiced pineapple, and vanilla.",
  },
  {
    id: "sagamore-tequila-finish",
    sub_brand_id: "sagamore-past",
    name: "Sagamore Tequila Finish Rye Whiskey",
    age: 4,
    abv: 49,
    price: 65,
    rarity: "rare",
    rarity_score: 55,
    style: "Rye Whiskey",
    availability: "discontinued",
    entry_source: "official",
    description: "Maryland rye finished in Extra Añejo Tequila barrels. Rich agave, honey, bitter orange, dried fig, and a smooth dry finish.",
  },
  {
    id: "sagamore-barleywine-finish",
    sub_brand_id: "sagamore-past",
    name: "Sagamore Barleywine Cask Finish Rye Whiskey",
    age: 4,
    abv: 46.5,
    price: 60,
    rarity: "rare",
    rarity_score: 52,
    style: "Rye Whiskey",
    availability: "discontinued",
    entry_source: "official",
    description: "Maryland rye finished 13 months in rye-turned-barleywine barrels from 603 Brewery. Malty toffee, brown sugar, cinnamon, and a creamy mouthfeel.",
  },
  {
    id: "sagamore-ale-finish",
    sub_brand_id: "sagamore-past",
    name: "Sagamore Ale Cask Finish Rye Whiskey",
    age: 4,
    abv: 49,
    price: 65,
    rarity: "rare",
    rarity_score: 52,
    style: "Rye Whiskey",
    availability: "discontinued",
    entry_source: "official",
    description: "Maryland rye finished 11 months in ex-bourbon/ale barrels. Clove, bitter orange peel, herbaceous notes, honey, and candied ginger.",
  },
  {
    id: "sagamore-rye-ale-finish",
    sub_brand_id: "sagamore-past",
    name: "Sagamore Rye Ale Finish",
    age: 4,
    abv: 45,
    price: 55,
    rarity: "rare",
    rarity_score: 50,
    style: "Rye Whiskey",
    availability: "discontinued",
    entry_source: "official",
    description: "Maryland rye finished in Sierra Nevada ale barrels. Rich cocoa, creamy caramel, candied oranges, toasted oak, and a smooth dry finish.",
  },
  {
    id: "sagamore-calvados-finish",
    sub_brand_id: "sagamore-past",
    name: "Sagamore Calvados Finish Rye Whiskey",
    age: 4,
    abv: 50.5,
    price: 70,
    rarity: "rare",
    rarity_score: 58,
    style: "Rye Whiskey",
    availability: "discontinued",
    entry_source: "official",
    description: "Maryland rye finished in French Calvados (apple brandy) barrels. Baked apples, pear, honey, vanilla, cloves, and a smooth dry finish.",
  },
  {
    id: "sagamore-port-finish-2019",
    sub_brand_id: "sagamore-past",
    name: "Sagamore Port Finish Rye Whiskey (2019 World's Best)",
    age: 4,
    abv: 50.6,
    price: 75,
    rarity: "rare",
    rarity_score: 65,
    style: "Rye Whiskey",
    availability: "discontinued",
    entry_source: "official",
    description: "World's Best Rye Whiskey at the 2019 San Francisco World Spirits Competition. Finished in European and American port barrels. Bold cherry jam, dark fruits, and caramel.",
  },
  {
    id: "sagamore-vintners-finish",
    sub_brand_id: "sagamore-past",
    name: "Sagamore Vintner's Finish Rye Whiskey",
    age: 4,
    abv: 49.2,
    price: 65,
    rarity: "rare",
    rarity_score: 50,
    style: "Rye Whiskey",
    availability: "discontinued",
    entry_source: "official",
    description: "Maryland rye finished 7 months in pinot noir, shiraz, and port barrels. Cherry, cinnamon, nutmeg, and a smooth dry finish.",
  },
  {
    id: "sagamore-moscatel-finish",
    sub_brand_id: "sagamore-past",
    name: "Sagamore Moscatel Barrel Finish Rye Whiskey",
    age: 4,
    abv: 50.6,
    price: 65,
    rarity: "rare",
    rarity_score: 50,
    style: "Rye Whiskey",
    availability: "discontinued",
    entry_source: "official",
    description: "Maryland rye finished in moscatel wine barrels. Rich dark fruits, subtle sweetness, and a long finish with hints of dry plum and honey.",
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  loadEnv();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("✗ NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set in .env.local");
    process.exit(1);
  }

  const db = createClient(url, key, { auth: { persistSession: false } });

  // 1. Upsert brand
  console.log("Upserting brand…");
  const { error: be } = await db.from("brands").upsert(BRAND, { onConflict: "id" });
  if (be) { console.error("✗ brands:", be.message); process.exit(1); }
  console.log("  ✓ sagamore-spirit");

  // 2. Upsert sub-brands
  console.log("Upserting sub-brands…");
  const { error: se } = await db.from("sub_brands").upsert(SUB_BRANDS, { onConflict: "id" });
  if (se) { console.error("✗ sub_brands:", se.message); process.exit(1); }
  SUB_BRANDS.forEach((s) => console.log(`  ✓ ${s.id}`));

  // 3. Upsert bottles in batches of 20
  console.log("Upserting bottles…");
  const BATCH = 20;
  for (let i = 0; i < BOTTLES.length; i += BATCH) {
    const batch = BOTTLES.slice(i, i + BATCH);
    const { error: bte } = await db.from("bottles").upsert(batch, { onConflict: "id" });
    if (bte) { console.error(`✗ bottles batch ${i}–${i + batch.length}:`, bte.message); process.exit(1); }
    batch.forEach((b) => console.log(`  ✓ ${b.id}`));
  }

  console.log(`\n✅ Done — 1 brand, ${SUB_BRANDS.length} sub-brands, ${BOTTLES.length} bottles upserted.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
