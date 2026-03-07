/**
 * upsert-nulu.mjs
 * ──────────────────────────────────────────────────────────────────────────
 * Expands the NuLu (PCS Distilling / Prohibition Craft Spirits) catalog.
 *
 * NuLu is an NDP: all liquid is sourced from MGP Indiana and finished /
 * single-barrel selected at their Louisville facility.
 *
 * Sub-brands (new):
 *   nulu-limited   — Experimental finishes, CA exclusive, Maple Brûlée
 *   nulu-hazmat    — HAZMAT-proof expressions (≥130 proof)
 *
 * Existing sub-brand updated in-place via upsert:
 *   nulu-core      — Single Barrel, Reserve Small Batch, Toasted, French Oak,
 *                    Double Oaked Bourbon
 *
 * Idempotent — safe to re-run.
 * Usage: node scripts/upsert-nulu.mjs
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
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, "");
  }
}

// ── Catalog data ─────────────────────────────────────────────────────────────

const BRAND_ID = "nulu";

const NEW_SUB_BRANDS = [
  { id: "nulu-limited", name: "NuLu Experimental & Limited",  brand_id: BRAND_ID },
  { id: "nulu-hazmat",  name: "NuLu HAZMAT High Proof",       brand_id: BRAND_ID },
];

const BOTTLES = [

  // ═══════════════════════════════════════════════════════════════════
  //  CORE (updates existing 3 placeholder bottles + adds new ones)
  // ═══════════════════════════════════════════════════════════════════

  {
    // Existing — update with accurate data
    id: "nulu-straight-bourbon",
    sub_brand_id: "nulu-core",
    name: "NuLu Single Barrel Straight Bourbon",
    age: null,
    abv: 54.5,          // cask strength, varies by barrel ~106–125 proof
    price: 65,
    rarity: "common",
    rarity_score: 2,
    style: "Bourbon",
    availability: "current",
    entry_source: "catalog",
    description: "The flagship NuLu expression — a single barrel, cask-strength MGP bourbon (75% corn / 21% rye / 4% malted barley) bottled non-chill filtered without water addition. Every barrel is unique; proof typically ranges 106–125. Rich caramel, vanilla, dried fruit, and lingering toasted oak.",
  },
  {
    id: "nulu-reserve-small-batch",
    sub_brand_id: "nulu-core",
    name: "NuLu Reserve Small Batch Bourbon",
    age: 6,
    abv: 54.3,          // 108.6 proof
    price: 65,
    rarity: "common",
    rarity_score: 2,
    style: "Bourbon",
    availability: "current",
    entry_source: "catalog",
    description: "A 6-year MGP small batch bottled at 108.6 proof, non-chill filtered. The nose leads with stewed fruit, vanilla, and toasted oak; the palate develops caramel, cream, baking spice, and brown sugar, with a long finish of dark fruit and tannin.",
  },
  {
    // Existing — update with accurate data
    id: "nulu-toasted-barrel",
    sub_brand_id: "nulu-core",
    name: "NuLu Toasted Small Batch Bourbon",
    age: null,
    abv: 54.6,          // 109.2 proof (Batch #2)
    price: 75,
    rarity: "common",
    rarity_score: 2,
    style: "Bourbon",
    availability: "current",
    entry_source: "catalog",
    description: "MGP bourbon finished in precisely toasted (not charred) barrels, bottled at 109.2 proof non-chill filtered. The toasted wood imparts layers of caramelized sugar, coconut, and baking spice that amplify the baseline vanilla and fruit character.",
  },
  {
    id: "nulu-french-oak",
    sub_brand_id: "nulu-core",
    name: "NuLu French Oak Bourbon",
    age: 6,
    abv: 54,            // 108 proof (Batch #1); Batch #2 is 104.8 proof — use midpoint
    price: 75,
    rarity: "common",
    rarity_score: 3,
    style: "Bourbon",
    availability: "current",
    entry_source: "catalog",
    description: "6-year MGP bourbon finished with precision-toasted French oak staves imported directly from France, bottled ~108 proof non-chill filtered. Adds a distinct layer of dark chocolate, espresso, clove, and dried cherry on top of the classic MGP caramel-vanilla base.",
  },
  {
    // Existing — update with accurate data
    id: "nulu-double-oaked",
    sub_brand_id: "nulu-core",
    name: "NuLu Double Oaked Bourbon",
    age: 6,
    abv: 54,            // approximately 108 proof based on batch data
    price: 75,
    rarity: "limited",
    rarity_score: 3,
    style: "Bourbon",
    availability: "current",
    entry_source: "catalog",
    description: "6-year MGP bourbon matured a second time in new charred oak barrels for additional wood integration, bottled non-chill filtered. Deep vanilla, toffee, dark cherry, and amplified oak spice from the double maturation.",
  },

  // ═══════════════════════════════════════════════════════════════════
  //  EXPERIMENTAL & LIMITED
  // ═══════════════════════════════════════════════════════════════════

  {
    id: "nulu-toasted-rye",
    sub_brand_id: "nulu-limited",
    name: "NuLu Toasted Single Barrel Straight Rye",
    age: 5,
    abv: 57.5,          // 115 proof; cask strength varies barrel to barrel (112–123 proof)
    price: 90,
    rarity: "limited",
    rarity_score: 4,
    style: "Rye Whiskey",
    availability: "current",
    entry_source: "catalog",
    description: "Single-barrel MGP straight rye (95% rye / 5% malted barley) aged ~5 years and finished 1–4 weeks in toasted barrels, bottled cask strength NCF. Proof varies by barrel (~112–123). Tangerine citrus, rye spice, maple syrup, cloves, and toffee.",
  },
  {
    id: "nulu-ca-exclusive",
    sub_brand_id: "nulu-limited",
    name: "NuLu Reserve Straight Bourbon California Exclusive",
    age: null,
    abv: 58,            // 116 proof
    price: 70,
    rarity: "limited",
    rarity_score: 4,
    style: "Bourbon",
    availability: "current",
    entry_source: "catalog",
    description: "California-exclusive release — MGP bourbon (75% corn / 21% rye / 4% malted barley) aged 4–6 years and bottled at 116 proof non-chill filtered. Bolder and more concentrated than the standard Reserve Small Batch; bold caramel, rye spice, and oak.",
  },
  {
    id: "nulu-experimental-sherry",
    sub_brand_id: "nulu-limited",
    name: "NuLu Experimental Sherry Apple Brandy Finish",
    age: null,
    abv: 58,            // 116 proof
    price: 90,
    rarity: "limited",
    rarity_score: 5,
    style: "Bourbon",
    availability: "limited_release",
    entry_source: "catalog",
    description: "Part of NuLu's Experimental Finish Series — MGP bourbon re-casked in sherry apple brandy barrels, bottled at 116 proof non-chill filtered. Sweet apple and rich sherry on the nose; caramel, dried fruit, and toasted spice on the palate with a long, warming finish.",
  },
  {
    id: "nulu-experimental-amburana",
    sub_brand_id: "nulu-limited",
    name: "NuLu Experimental Amburana Finish",
    age: null,
    abv: 55,            // approximate — varies by batch
    price: 90,
    rarity: "limited",
    rarity_score: 5,
    style: "Bourbon",
    availability: "limited_release",
    entry_source: "catalog",
    description: "Part of NuLu's Experimental Finish Series — MGP bourbon finished in amburana wood barrels (a Brazilian timber prized for imparting cinnamon, cumin, and coconut notes), bottled non-chill filtered. One of the more distinctive finishes in the NuLu lineup.",
  },
  {
    id: "nulu-maple-brulee",
    sub_brand_id: "nulu-limited",
    name: "NuLu 8-Year Single Barrel Maple Brûlée Bourbon",
    age: 8,
    abv: 54.6,          // 109.2 proof ("Wheated Peanut Butter Pancake" batch)
    price: 105,
    rarity: "rare",
    rarity_score: 6,
    style: "Bourbon",
    availability: "limited_release",
    entry_source: "catalog",
    description: "8-year MGP bourbon (wheated mash) finished in Maple Brûlée barrels, bottled at cask strength ~109 proof NCF. Each release carries a whimsical name (e.g., 'Berry Butter Pancake', 'Wheated Peanut Butter Pancake'). Caramelized maple, brown butter, vanilla, and stone fruit.",
  },

  // ═══════════════════════════════════════════════════════════════════
  //  HAZMAT (≥ 130 proof)
  // ═══════════════════════════════════════════════════════════════════

  {
    id: "nulu-ky-custard",
    sub_brand_id: "nulu-hazmat",
    name: "NuLu 10-Year 'KY Custard' Bourbon",
    age: 10,
    abv: 70.1,          // 140.2 proof — HAZMAT level
    price: 300,
    rarity: "rare",
    rarity_score: 7,
    style: "Bourbon",
    availability: "limited_release",
    entry_source: "catalog",
    description: "A 10-year MGP single barrel bottled at a staggering 140.2 proof (70.1% ABV), qualifying as HAZMAT. Deep, concentrated caramel custard, brown sugar, and toasted oak. Nicknamed 'KY Custard' for its rich, dessert-like profile. Water-sensitive — best enjoyed with a splash.",
  },
  {
    id: "nulu-redneck-sangria",
    sub_brand_id: "nulu-hazmat",
    name: "NuLu 8-Year 'Redneck Sangria' Bourbon",
    age: 8,
    abv: 66.5,          // 133 proof
    price: 130,
    rarity: "rare",
    rarity_score: 6,
    style: "Bourbon",
    availability: "limited_release",
    entry_source: "catalog",
    description: "8-year MGP single barrel bottled at 133 proof (66.5% ABV), just over the HAZMAT threshold. Named 'Redneck Sangria' for its vivid dark fruit and berry-forward character — blackberry, cherry, and plum layered over caramel, vanilla, and charred oak.",
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

  // 2. Upsert bottles
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

  // 3. Report final NuLu bottle count
  const { data: allNuluBottles } = await db
    .from("bottles")
    .select("id")
    .in("sub_brand_id", ["nulu-core", "nulu-limited", "nulu-hazmat"]);

  console.log(`\n🎉 Done! NuLu now has ${allNuluBottles?.length ?? "?"} bottles across 3 sub-brands.`);
  console.log("   Core · Experimental & Limited · HAZMAT High Proof\n");
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
