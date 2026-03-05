/**
 * upsert-angels-envy.mjs
 * ──────────────────────────────────────────────────────────────────────────
 * Upserts the full Angel's Envy catalog into Supabase:
 *   Signature Series · Limited Releases (annual CS + Cellar Collection +
 *   Founders) · Distillery Series · Private Selection
 *
 * New sub-brands: angels-envy-limited, angels-envy-distillery-series,
 *   angels-envy-private-selection
 * Updates existing: angels-envy-core (adds Triple Oak + BIB CS),
 *   existing bottles (adds style + descriptions)
 *
 * Idempotent: uses upsert (onConflict: "id") — safe to re-run.
 * Usage: node scripts/upsert-angels-envy.mjs
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

const BRAND_ID = "angels-envy";

const NEW_SUB_BRANDS = [
  { id: "angels-envy-limited",            name: "Angel's Envy Limited Releases",   brand_id: BRAND_ID },
  { id: "angels-envy-distillery-series",  name: "Angel's Envy Distillery Series",  brand_id: BRAND_ID },
  { id: "angels-envy-private-selection",  name: "Angel's Envy Private Selection",  brand_id: BRAND_ID },
];

const BOTTLES = [
  // ═══════════════════════════════════════════════════════════════════
  //  SIGNATURE SERIES (update existing + add new)
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "angels-envy-bourbon",
    sub_brand_id: "angels-envy-core",
    name: "Angel's Envy Kentucky Straight Bourbon Finished in Port Wine Barrels",
    age: null,
    abv: 43.3,
    price: 50,
    rarity: "common",
    rarity_score: 2,
    style: "Bourbon",
    availability: "current",
    entry_source: "catalog",
    description: "The flagship expression. Aged 4–6 years in new American white oak, then finished up to 6 months in port wine casks imported from Portugal's Douro Valley. Subtle vanilla, raisins, and maple on the nose; ripe fruit, toast, and bittersweet chocolate on the palate; clean, lingering sweetness on the finish. Bottled at 86.6 proof.",
  },
  {
    id: "angels-envy-rye",
    sub_brand_id: "angels-envy-core",
    name: "Angel's Envy Rye Whiskey Finished in Caribbean Rum Casks",
    age: null,
    abv: 44,
    price: 90,
    rarity: "common",
    rarity_score: 2,
    style: "Rye Whiskey",
    availability: "current",
    entry_source: "catalog",
    description: "Aged in new American oak then finished up to 18 months in authentic Caribbean rum barrels. Aromas of citrus, caramel candy, maple sugar, and vanilla mingle with oak and hazelnut; sweet rum and soft oak on the palate; a finish that is both sweet and dry. Bottled at 88 proof.",
  },
  {
    id: "angels-envy-triple-oak",
    sub_brand_id: "angels-envy-core",
    name: "Angel's Envy Triple Oak Kentucky Straight Bourbon Whiskey",
    age: null,
    abv: 46,
    price: 75,
    rarity: "limited",
    rarity_score: 3,
    style: "Bourbon",
    availability: "current",
    entry_source: "catalog",
    description: "The first new addition to the Signature Series in over 10 years. Finished in a blend of three distinctive casks — Hungarian, Chinkapin (a seasoned Kentucky oak), and French oak — each contributing layers of toasted oak, ripe apricot, brown sugar, baking spices, chocolate, and caramel. Bottled at 92 proof.",
  },
  {
    id: "angels-envy-bib-cask-strength",
    sub_brand_id: "angels-envy-core",
    name: "Angel's Envy Cask Strength Bottled-in-Bond",
    age: 6,
    abv: 50,
    price: 60,
    rarity: "limited",
    rarity_score: 3,
    style: "Bourbon",
    availability: "current",
    entry_source: "catalog",
    description: "Angel's Envy's first unfinished whiskey — meeting the strict Bottled-in-Bond Act of 1897 requirements while naturally reaching cask strength at 100 proof through a lower barrel entry proof. Aged nearly 6 years. Lightly caramelized sugars and vanilla wafers on the nose; honey latte and light fruit on the palate; a rounded, soft finish.",
  },

  // ═══════════════════════════════════════════════════════════════════
  //  LIMITED RELEASES — Annual Cask Strength
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "angels-envy-cask-strength",
    sub_brand_id: "angels-envy-limited",
    name: "Angel's Envy 2025 10 Year Cask Strength Bourbon",
    age: 10,
    abv: 61.3,
    price: 250,
    rarity: "allocated",
    rarity_score: 8,
    style: "Bourbon",
    availability: "limited_release",
    entry_source: "catalog",
    description: "The brand's first age-stated cask strength release, marking Angel's Envy's 15th Anniversary. A 10-year Kentucky Straight Bourbon finished in Ruby Port wine barrels, non-chill filtered and bottled at 122.6 proof. Limited to 24,480 bottles.",
  },
  {
    id: "angels-envy-cs-2024",
    sub_brand_id: "angels-envy-limited",
    name: "Angel's Envy 2024 Cask Strength Bourbon",
    age: null,
    abv: 59.4,
    price: 230,
    rarity: "allocated",
    rarity_score: 7,
    style: "Bourbon",
    availability: "discontinued",
    entry_source: "catalog",
    description: "The 13th annual cask strength release, using the Solera method for the first time — finished in both Ruby and Tawny Port wine barrels for added depth. Bottled at 118.8 proof. Limited to 23,196 bottles.",
  },
  {
    id: "angels-envy-cs-2023",
    sub_brand_id: "angels-envy-limited",
    name: "Angel's Envy 2023 12th Annual Cask Strength Bourbon",
    age: null,
    abv: 59.1,
    price: 230,
    rarity: "allocated",
    rarity_score: 7,
    style: "Bourbon",
    availability: "discontinued",
    entry_source: "catalog",
    description: "The 12th annual Port wine barrel-finished cask strength bourbon, hand-selected from barrels aged 5–9 years and finished up to 14 additional months. Bottled at 118.2 proof. Limited to 22,656 bottles.",
  },
  {
    id: "angels-envy-cs-2022",
    sub_brand_id: "angels-envy-limited",
    name: "Angel's Envy 2022 Cask Strength Bourbon",
    age: null,
    abv: 59.9,
    price: 230,
    rarity: "allocated",
    rarity_score: 7,
    style: "Bourbon",
    availability: "discontinued",
    entry_source: "catalog",
    description: "The 11th annual cask strength release, Kentucky Straight Bourbon finished in Portuguese Ruby Port wine barrels for 14 additional months. Bottled at 119.8 proof. Limited to 16,980 bottles.",
  },

  // ═══════════════════════════════════════════════════════════════════
  //  LIMITED RELEASES — Cask Strength Rye
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "angels-envy-cs-rye-2023",
    sub_brand_id: "angels-envy-limited",
    name: "Angel's Envy 2023 Cask Strength Straight Rye",
    age: null,
    abv: 57.2,
    price: 270,
    rarity: "allocated",
    rarity_score: 8,
    style: "Rye Whiskey",
    availability: "discontinued",
    entry_source: "catalog",
    description: "The brand's first-ever cask strength rye release — a blend finished in Sauternes barrels and toasted American and French oak barrels. Bottled at 114.4 proof. Ultra-limited to only 5,500 bottles.",
  },

  // ═══════════════════════════════════════════════════════════════════
  //  LIMITED RELEASES — Cellar Collection
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "angels-envy-cellar-vol5-2025",
    sub_brand_id: "angels-envy-limited",
    name: "Angel's Envy Cellar Collection Vol. 5 — Straight Rye Finished in French Oak Tequila Barrels (2025)",
    age: 7,
    abv: 52.1,
    price: 270,
    rarity: "rare",
    rarity_score: 8,
    style: "Rye Whiskey",
    availability: "limited_release",
    entry_source: "catalog",
    description: "A 7-year MGP straight rye finished 12 months in French oak ex-Patrón Extra Añejo tequila barrels, then blended with an 11-year unfinished straight rye. The first Cellar Collection developed entirely under Master Distiller Owen Martin. Limited to 3,000 nine-liter cases at 104.2 proof.",
  },
  {
    id: "angels-envy-cellar-trinity-2024",
    sub_brand_id: "angels-envy-limited",
    name: "Angel's Envy Cellar Collection Volumes 1–3 Trinity (2024)",
    age: null,
    abv: 51.9,
    price: 400,
    rarity: "rare",
    rarity_score: 8,
    style: "Bourbon",
    availability: "discontinued",
    entry_source: "catalog",
    description: "A limited 3×375mL set re-releasing the first three Cellar Collection expressions side-by-side: Vol. 1 in Oloroso Sherry (100 proof), Vol. 2 in Tawny Port (111.6 proof), and Vol. 3 in Madeira casks (100 proof). The first time any Cellar Collection whiskey was re-released to the public.",
  },
  {
    id: "angels-envy-cellar-vol4-ice-cider",
    sub_brand_id: "angels-envy-limited",
    name: "Angel's Envy Cellar Collection Vol. 4 — Rye Finished in Ice Cider Casks (2022)",
    age: 7,
    abv: 53.5,
    price: 250,
    rarity: "rare",
    rarity_score: 8,
    style: "Rye Whiskey",
    availability: "discontinued",
    entry_source: "catalog",
    description: "A 7-year, 95% rye whiskey finished 364 days in French oak casks that previously held Vermont Northern Spy apple ice cider from Eden Specialty Ciders. The fourth Cellar Collection release, presented in a frosted glass bottle at 107 proof. Limited to 6,000 bottles.",
  },
  {
    id: "angels-envy-cellar-vol3-madeira",
    sub_brand_id: "angels-envy-limited",
    name: "Angel's Envy Cellar Collection Vol. 3 — Finished in Madeira Casks (2021)",
    age: null,
    abv: 50,
    price: 230,
    rarity: "rare",
    rarity_score: 8,
    style: "Bourbon",
    availability: "discontinued",
    entry_source: "catalog",
    description: "A blend of bourbons finished approximately one year in hand-selected Madeira wine casks, sourced after the Henderson family visited the island of Madeira. Won Double Gold at the San Francisco World Spirits Competition. Limited to 3,360 bottles at 100 proof.",
  },
  {
    id: "angels-envy-cellar-vol2-tawny",
    sub_brand_id: "angels-envy-limited",
    name: "Angel's Envy Cellar Collection Vol. 2 — Finished in Tawny Port Wine Barrels (2020)",
    age: 10,
    abv: 55.8,
    price: 250,
    rarity: "rare",
    rarity_score: 8,
    style: "Bourbon",
    availability: "discontinued",
    entry_source: "catalog",
    description: "The brand's oldest single release at the time — a 10-year Kentucky Straight Bourbon finished 10 months in Tawny Port wine barrels. Scored 93 points from Whisky Advocate. Limited to 5,400 bottles at 111.6 proof.",
  },
  {
    id: "angels-envy-cellar-vol1-sherry",
    sub_brand_id: "angels-envy-limited",
    name: "Angel's Envy Cellar Collection Vol. 1 — Finished in Oloroso Sherry Casks (2019)",
    age: null,
    abv: 50,
    price: 200,
    rarity: "rare",
    rarity_score: 8,
    style: "Bourbon",
    availability: "discontinued",
    entry_source: "catalog",
    description: "The inaugural Cellar Collection release — a Kentucky Straight Bourbon aged 4–9 years then finished an additional 2–3 years in hand-selected Oloroso Sherry casks. Scored 94 points from Robb Report. Limited to 3,600 bottles at 100 proof.",
  },

  // ═══════════════════════════════════════════════════════════════════
  //  LIMITED RELEASES — Founders Collection
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "angels-envy-founders-mizunara",
    sub_brand_id: "angels-envy-limited",
    name: "Angel's Envy Founders Collection — Finished in Mizunara Oak Casks (2020)",
    age: null,
    abv: 48.9,
    price: 350,
    rarity: "unicorn",
    rarity_score: 9,
    style: "Bourbon",
    availability: "discontinued",
    entry_source: "catalog",
    description: "The inaugural Founders Collection release — a 50/50 blend of 4-year and 9-year Kentucky Straight Bourbons finished two additional years in new charred Japanese Mizunara oak casks. Ultra-limited to approximately 1,200 crystal-glass bottles at 97.8 proof.",
  },

  // ═══════════════════════════════════════════════════════════════════
  //  DISTILLERY SERIES
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "angels-envy-ds-two-grain",
    sub_brand_id: "angels-envy-distillery-series",
    name: "Angel's Envy Distillery Series — Two-Grain Kentucky Straight Bourbon",
    age: null,
    abv: 56,
    price: 55,
    rarity: "limited",
    rarity_score: 5,
    style: "Bourbon",
    availability: "limited_release",
    entry_source: "catalog",
    description: "Reveals the impact of a simple two-grain mash bill (90% corn, 10% malted barley) and Kelvin Cooperage barrel influence. Toasted grain, warm baking spices, buttered brioche, mulled cider on the palate, and a silky finish of brown butter and vanilla custard. Bottled at 112 proof. Distillery exclusive, limited to 17,592 bottles.",
  },
  {
    id: "angels-envy-ds-peated-rye",
    sub_brand_id: "angels-envy-distillery-series",
    name: "Angel's Envy Distillery Series — Peated Cask Kentucky Straight Rye Finished in Scotch Barrels",
    age: 7,
    abv: 50,
    price: 55,
    rarity: "limited",
    rarity_score: 5,
    style: "Rye Whiskey",
    availability: "limited_release",
    entry_source: "catalog",
    description: "Aged 6 years then finished one additional year in Islay Scotch whisky casks — merging American rye tradition with the smoky depth of the Scottish Isles. Smoked sugar and orchard fruit on the nose; grilled plums, red licorice, and campfire on the palate; long, smoky finish of salted caramel and honeyed cream. Bottled at 100 proof. Distillery exclusive, limited to 7,200 bottles.",
  },

  // ═══════════════════════════════════════════════════════════════════
  //  PRIVATE SELECTION
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "angels-envy-private-selection",
    sub_brand_id: "angels-envy-private-selection",
    name: "Angel's Envy Private Selection Single Barrel",
    age: null,
    abv: 55,
    price: null,
    rarity: "allocated",
    rarity_score: 7,
    style: "Bourbon",
    availability: "current",
    entry_source: "catalog",
    description: "An exclusive barrel-acquisition experience at the Louisville distillery. Guests taste and compare three barrels with guidance from single-barrel experts, then select one full barrel of 110-proof port wine barrel-finished bourbon. Each barrel yields approximately 250 custom-labeled bottles. Ideal for private collections, corporate events, and charitable auctions.",
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

  // 1. Upsert new sub-brands
  console.log(`\n📦 Upserting ${NEW_SUB_BRANDS.length} new sub-brands…`);
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

  console.log(`\n🎉 Done! Upserted ${NEW_SUB_BRANDS.length} new sub-brands + ${BOTTLES.length} bottles for Angel's Envy.\n`);
  console.log("   Coverage: Signature Series · Annual CS · Cellar Collection · Founders · Distillery Series · Private Selection");
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
