/**
 * upsert-distilleries-batch2.mjs
 * ──────────────────────────────────────────────────────────────────────────
 * Fills in / adds the following American whiskey brands:
 *
 *   Wild Turkey      — adds Wild Turkey 81 + Kentucky Spirit (existing brand)
 *   Still Austin     — adds full lineup (existing brand, empty in DB)
 *   Barton 1792      — new brand (Sazerac; Bardstown, KY)
 *   George Dickel    — new brand / Cascade Hollow (Diageo; Tullahoma, TN)
 *   New Riff          — new brand (Newport, KY)
 *   Wilderness Trail — new brand (Campari; Danville, KY)
 *   Rabbit Hole      — new brand (Louisville, KY)
 *   NuLu             — new NDP brand (PCS Distilling; Louisville, KY)
 *
 * Idempotent — safe to re-run.
 * Usage: node scripts/upsert-distilleries-batch2.mjs
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

// ── Data ──────────────────────────────────────────────────────────────────────

const NEW_BRANDS = [
  // still-austin exists in whiskeys.ts but was never upserted to Supabase
  {
    id: "still-austin",
    name: "Still Austin Whiskey Co.",
    country: "USA",
    region: "Austin, TX",
    state: "Texas",
    is_ndp: false,
  },
  {
    id: "barton-1792",
    name: "Barton 1792 Distillery",
    country: "USA",
    region: "Bardstown, KY",
    state: "Kentucky",
    is_ndp: false,
  },
  {
    id: "cascade-hollow",
    name: "Cascade Hollow Distilling Co.",
    country: "USA",
    region: "Tullahoma, TN",
    state: "Tennessee",
    is_ndp: false,
  },
  {
    id: "new-riff",
    name: "New Riff Distilling",
    country: "USA",
    region: "Newport, KY",
    state: "Kentucky",
    is_ndp: false,
  },
  {
    id: "wilderness-trail",
    name: "Wilderness Trail Distillery",
    country: "USA",
    region: "Danville, KY",
    state: "Kentucky",
    is_ndp: false,
  },
  {
    id: "rabbit-hole",
    name: "Rabbit Hole Distillery",
    country: "USA",
    region: "Louisville, KY",
    state: "Kentucky",
    is_ndp: false,
  },
  {
    id: "nulu",
    name: "NuLu (PCS Distilling)",
    country: "USA",
    region: "Louisville, KY",
    state: "Kentucky",
    is_ndp: true,
  },
];

const NEW_SUB_BRANDS = [
  // ── Still Austin (brand now added above) ────────────────────────────────
  { id: "still-austin-core",     name: "Still Austin Core",         brand_id: "still-austin" },
  { id: "still-austin-bib",      name: "Still Austin Bottled in Bond Series", brand_id: "still-austin" },

  // ── Barton 1792 ──────────────────────────────────────────────────────────
  { id: "1792-core",             name: "1792 Bourbon",              brand_id: "barton-1792" },
  { id: "1792-limited",          name: "1792 Limited Releases",     brand_id: "barton-1792" },

  // ── Cascade Hollow / George Dickel ───────────────────────────────────────
  { id: "george-dickel-core",    name: "George Dickel",             brand_id: "cascade-hollow" },
  { id: "george-dickel-bib",     name: "George Dickel Bottled in Bond", brand_id: "cascade-hollow" },

  // ── New Riff ─────────────────────────────────────────────────────────────
  { id: "new-riff-core",         name: "New Riff",                  brand_id: "new-riff" },

  // ── Wilderness Trail ─────────────────────────────────────────────────────
  { id: "wilderness-trail-core", name: "Wilderness Trail",          brand_id: "wilderness-trail" },

  // ── Rabbit Hole ──────────────────────────────────────────────────────────
  { id: "rabbit-hole-core",      name: "Rabbit Hole Core",          brand_id: "rabbit-hole" },

  // ── NuLu ─────────────────────────────────────────────────────────────────
  { id: "nulu-core",             name: "NuLu Bourbon",              brand_id: "nulu" },
];

const NEW_BOTTLES = [

  // ════════════════════════════════════════════════════════════════════════════
  // WILD TURKEY — fills gaps in existing brand
  // sub_brand_id "wild-turkey-core" is the existing sub-brand (name: "Wild Turkey")
  // ════════════════════════════════════════════════════════════════════════════
  {
    id: "wild-turkey-81",
    name: "Wild Turkey 81",
    sub_brand_id: "wild-turkey-core",
    abv: 40.5,
    price: 22,
    rarity: "common",
    rarity_score: 10,
    style: "Bourbon",
    description: "The lighter sibling to the flagship 101. Smooth entry-level pour with vanilla, caramel, and light spice. Great value for cocktails and casual sipping.",
  },
  {
    id: "wild-turkey-ks",
    name: "Wild Turkey Kentucky Spirit",
    sub_brand_id: "wild-turkey-core",
    abv: 50.5,
    price: 55,
    rarity: "limited",
    rarity_score: 42,
    style: "Bourbon",
    description: "Single barrel bottled at 101 proof. Rich and full-bodied with deep vanilla, oak, and baking spice. Hand-selected barrels vary batch to batch.",
  },
  {
    id: "wild-turkey-rye-101",
    name: "Wild Turkey Rye 101",
    sub_brand_id: "wild-turkey-core",
    abv: 50.5,
    price: 28,
    rarity: "common",
    rarity_score: 10,
    style: "Rye Whiskey",
    description: "Approachable rye at full Wild Turkey proof. Spicy, herbal, and fruity — a classic cocktail rye with real backbone.",
  },

  // ════════════════════════════════════════════════════════════════════════════
  // STILL AUSTIN — builds out the empty brand
  // ════════════════════════════════════════════════════════════════════════════
  {
    id: "still-austin-musician",
    name: "Still Austin The Musician",
    sub_brand_id: "still-austin-core",
    abv: 49.2,
    price: 45,
    rarity: "common",
    rarity_score: 10,
    style: "Bourbon",
    description: "Flagship grain-to-glass Texas bourbon. 100% Texas-grown corn, Elbon rye, and malted barley. Floral, herbal, and honey-sweet with a long rye-spice finish.",
  },
  {
    id: "still-austin-cask-strength-bourbon",
    name: "Still Austin Cask Strength Bourbon",
    sub_brand_id: "still-austin-core",
    abv: 58,
    price: 60,
    rarity: "limited",
    rarity_score: 40,
    style: "Bourbon",
    description: "The Musician at barrel strength. Double Gold at San Francisco World Spirits 2022 & 2023. Brandied cherries, blackberry cobbler, and bold rye spice.",
  },
  {
    id: "still-austin-the-artist-rye",
    name: "Still Austin The Artist Cask Strength Rye",
    sub_brand_id: "still-austin-core",
    abv: 58,
    price: 60,
    rarity: "limited",
    rarity_score: 40,
    style: "Rye Whiskey",
    description: "Cask strength Texas straight rye. Intense rye spice, orange peel, and green herbs — the boldest expression in the core lineup.",
  },
  {
    id: "still-austin-bib-bourbon",
    name: "Still Austin Bottled in Bond Bourbon",
    sub_brand_id: "still-austin-bib",
    abv: 50,
    price: 80,
    age: 4,
    rarity: "limited",
    rarity_score: 45,
    style: "Bourbon",
    description: "Seasonal BiB release. 100% Texas grain, 4+ years, 100 proof. Each seasonal edition (Jimmy Red corn, High Rye, Blue Corn) offers a distinct character.",
  },
  {
    id: "still-austin-bib-rye",
    name: "Still Austin Bottled in Bond Rye",
    sub_brand_id: "still-austin-bib",
    abv: 50,
    price: 80,
    age: 4,
    rarity: "limited",
    rarity_score: 45,
    style: "Rye Whiskey",
    description: "Spring seasonal BiB rye. 100% Texas rye, 4 years, 100 proof. Cherry, strawberry shortcake, and chile pepper spice. Whisky Advocate noted it drinks above its age.",
  },

  // ════════════════════════════════════════════════════════════════════════════
  // BARTON 1792 DISTILLERY
  // ════════════════════════════════════════════════════════════════════════════
  {
    id: "1792-small-batch",
    name: "1792 Small Batch",
    sub_brand_id: "1792-core",
    abv: 46.85,
    price: 32,
    rarity: "common",
    rarity_score: 10,
    style: "High Rye Bourbon",
    description: "Flagship high-rye bourbon from historic Barton 1792 Distillery in Bardstown. Aromas of corn, caramel, and shortbread; balanced spice and dry oak finish.",
  },
  {
    id: "1792-single-barrel",
    name: "1792 Single Barrel",
    sub_brand_id: "1792-core",
    abv: 49.3,
    price: 48,
    rarity: "limited",
    rarity_score: 38,
    style: "High Rye Bourbon",
    description: "Rich vanilla, toffee, and butterscotch with hints of stone fruit. Bottled at 98.6 proof from single barrels of the high-rye recipe.",
  },
  {
    id: "1792-bottled-in-bond",
    name: "1792 Bottled in Bond",
    sub_brand_id: "1792-core",
    abv: 50,
    price: 52,
    rarity: "limited",
    rarity_score: 42,
    style: "High Rye Bourbon",
    description: "High-rye mash bill, 4+ years, 100 proof. Charred oak, fresh mint, and caramel apple. Solid value in the bonded category.",
  },
  {
    id: "1792-sweet-wheat",
    name: "1792 Sweet Wheat",
    sub_brand_id: "1792-core",
    abv: 45.6,
    price: 45,
    rarity: "limited",
    rarity_score: 42,
    style: "Wheated Bourbon",
    description: "Wheat replaces rye as the secondary grain, yielding a softer, sweeter profile. Vanilla, caramel, and gentle oak — approachable and distinctive in the lineup.",
  },
  {
    id: "1792-full-proof",
    name: "1792 Full Proof",
    sub_brand_id: "1792-core",
    abv: 62.5,
    price: 60,
    rarity: "limited",
    rarity_score: 50,
    style: "High Rye Bourbon",
    description: "Bottled at its original 125-proof barrel entry. Not chill filtered. Bold, intense high-rye character with caramel and deep oak. Outstanding value for the proof.",
  },
  {
    id: "1792-12-year",
    name: "1792 Aged 12 Years",
    sub_brand_id: "1792-limited",
    age: 12,
    abv: 48.3,
    price: 50,
    rarity: "limited",
    rarity_score: 55,
    style: "High Rye Bourbon",
    description: "Annual summer release. Same high-rye recipe as Small Batch, allowed to mature 12 years. Rich oak, dried fruit, and pronounced baking spice.",
  },
  {
    id: "1792-port-finish",
    name: "1792 Port Finish",
    sub_brand_id: "1792-limited",
    abv: 44.45,
    price: 50,
    rarity: "limited",
    rarity_score: 48,
    style: "High Rye Bourbon",
    description: "High-rye bourbon finished in port wine barrels. Dark fruit, sweet grape, and vanilla merge with the classic spicy Barton character.",
  },

  // ════════════════════════════════════════════════════════════════════════════
  // CASCADE HOLLOW / GEORGE DICKEL
  // ════════════════════════════════════════════════════════════════════════════
  {
    id: "george-dickel-no8",
    name: "George Dickel No. 8",
    sub_brand_id: "george-dickel-core",
    abv: 40,
    price: 18,
    rarity: "common",
    rarity_score: 10,
    style: "Tennessee Whiskey",
    description: "Classic Tennessee sour mash. Light caramel, maple, and buttered corn. Chilled and charcoal-mellowed twice — Dickel's signature process yields exceptional smoothness.",
  },
  {
    id: "george-dickel-no12",
    name: "George Dickel No. 12",
    sub_brand_id: "george-dickel-core",
    abv: 45,
    price: 30,
    rarity: "common",
    rarity_score: 10,
    style: "Tennessee Whiskey",
    description: "The flagship expression. 84% corn, 8% rye, 8% malted barley. Winner of 95 points at USC 2013 — Best Tennessee Whisky. Caramel, vanilla, and lightly sweet oak.",
  },
  {
    id: "george-dickel-rye",
    name: "George Dickel Rye Whisky",
    sub_brand_id: "george-dickel-core",
    abv: 45,
    price: 30,
    rarity: "common",
    rarity_score: 10,
    style: "Rye Whiskey",
    description: "95% rye, 5% malted barley — distilled at MGP, then charcoal-mellowed at Dickel. Exceptionally smooth for a high-rye mash. Great for cocktails at a fantastic price.",
    source_distillery: "MGP",
  },
  {
    id: "george-dickel-8yr-bourbon",
    name: "George Dickel 8 Year Bourbon",
    sub_brand_id: "george-dickel-core",
    age: 8,
    abv: 40,
    price: 30,
    rarity: "common",
    rarity_score: 15,
    style: "Bourbon",
    description: "Dickel's first expression labeled as Bourbon rather than Tennessee Whiskey. Sweet vanilla, cherry, and orange with almond toffee and oak.",
  },
  {
    id: "george-dickel-barrel-select",
    name: "George Dickel Barrel Select",
    sub_brand_id: "george-dickel-core",
    abv: 43,
    price: 38,
    rarity: "limited",
    rarity_score: 38,
    style: "Tennessee Whiskey",
    description: "Small batch hand-selected from 10 barrels aged 10–12 years. Balanced vanilla, baking spice, and subtle charcoal — Dickel craft at its most refined.",
  },
  {
    id: "george-dickel-bib-12yr",
    name: "George Dickel Bottled in Bond",
    sub_brand_id: "george-dickel-bib",
    age: 12,
    abv: 50,
    price: 45,
    rarity: "limited",
    rarity_score: 55,
    style: "Tennessee Whiskey",
    description: "Annual release. 2024 edition distilled Spring 2011, aged 12 years. The series' inaugural release won Whisky Advocate Whisky of the Year. Exceptional age-to-value ratio.",
    availability: "limited_release",
  },

  // ════════════════════════════════════════════════════════════════════════════
  // NEW RIFF DISTILLING
  // ════════════════════════════════════════════════════════════════════════════
  {
    id: "new-riff-bourbon-bib",
    name: "New Riff Kentucky Straight Bourbon — Bottled in Bond",
    sub_brand_id: "new-riff-core",
    age: 4,
    abv: 50,
    price: 45,
    rarity: "common",
    rarity_score: 15,
    style: "High Rye Bourbon",
    description: "65% corn, 30% rye, 5% malted barley. Non-GMO grains. Butterscotch and fresh oak on the nose; broad mouthfeel with vanilla and gathering rye spice on the finish. Always BIB, never chill filtered.",
  },
  {
    id: "new-riff-rye-bib",
    name: "New Riff Kentucky Straight Rye — Bottled in Bond",
    sub_brand_id: "new-riff-core",
    age: 4,
    abv: 50,
    price: 45,
    rarity: "common",
    rarity_score: 15,
    style: "Rye Whiskey",
    description: "95% rye, 5% malted rye — one of the most intense rye mash bills in Kentucky. Full sour mash, BIB, non-chill filtered. Hugely spicy with brambly red-black fruits and white pepper.",
  },
  {
    id: "new-riff-bourbon-8yr",
    name: "New Riff 8 Year Kentucky Straight Bourbon",
    sub_brand_id: "new-riff-core",
    age: 8,
    abv: 50,
    price: 68,
    rarity: "limited",
    rarity_score: 48,
    style: "High Rye Bourbon",
    description: "Same high-rye mash bill as the 4-year BiB, allowed to develop 8 years. Deeper, more complex oak alongside developed rye spice and rich vanilla. 2024 release.",
  },

  // ════════════════════════════════════════════════════════════════════════════
  // WILDERNESS TRAIL DISTILLERY
  // ════════════════════════════════════════════════════════════════════════════
  {
    id: "wilderness-trail-wheated-bib",
    name: "Wilderness Trail Wheated Bourbon Bottled in Bond",
    sub_brand_id: "wilderness-trail-core",
    abv: 50,
    price: 57,
    rarity: "limited",
    rarity_score: 45,
    style: "Wheated Bourbon",
    description: "64% corn, 24% wheat, 12% malted barley. Sweet mash process — no backset used. Soft, grain-forward, and elegant. 20-barrel small batches, Cooper Select #4 char barrels.",
  },
  {
    id: "wilderness-trail-high-rye-bib",
    name: "Wilderness Trail High Rye Bourbon Bottled in Bond",
    sub_brand_id: "wilderness-trail-core",
    abv: 50,
    price: 60,
    rarity: "limited",
    rarity_score: 45,
    style: "High Rye Bourbon",
    description: "64% corn, 24% rye, 12% malted barley. Same sweet mash philosophy as the Wheated expression. Spicier and more herbal, with the same silky texture. 18-barrel batches.",
  },
  {
    id: "wilderness-trail-rye-cs",
    name: "Wilderness Trail Settlers Select Rye Cask Strength",
    sub_brand_id: "wilderness-trail-core",
    abv: 55,
    price: 62,
    rarity: "limited",
    rarity_score: 52,
    style: "Rye Whiskey",
    description: "56% rye, 33% corn, 11% malted barley. Entered at 100 proof — lowest rye entry proof in Kentucky. Cask strength single barrel program. Deeply spicy with a silky sweet mash foundation.",
  },

  // ════════════════════════════════════════════════════════════════════════════
  // RABBIT HOLE DISTILLERY
  // ════════════════════════════════════════════════════════════════════════════
  {
    id: "rabbit-hole-heigold",
    name: "Rabbit Hole Heigold",
    sub_brand_id: "rabbit-hole-core",
    abv: 47.5,
    price: 45,
    rarity: "limited",
    rarity_score: 38,
    style: "High Rye Bourbon",
    description: "Named for a German immigrant stonecutter who helped build Louisville. High-rye mash with malted German rye and malted barley. Toasted malt, butterscotch, and crescendo of pepper spice.",
  },
  {
    id: "rabbit-hole-cavehill",
    name: "Rabbit Hole Cavehill",
    sub_brand_id: "rabbit-hole-core",
    abv: 47.5,
    price: 65,
    rarity: "limited",
    rarity_score: 45,
    style: "Bourbon",
    description: "Four-grain mash: corn, malted barley, honey malted barley, and malted wheat — one of the most complex recipes in American whiskey. Small batches of 15 barrels max.",
  },
  {
    id: "rabbit-hole-dareringer",
    name: "Rabbit Hole Dareringer",
    sub_brand_id: "rabbit-hole-core",
    abv: 46.5,
    price: 87,
    rarity: "rare",
    rarity_score: 62,
    style: "Wheated Bourbon",
    description: "Wheated bourbon finished in hand-made Pedro Ximenez Sherry casks from Spain. Sherry and cherry on the nose; raisins, currants, almond, and vanilla on the palate. Named for the founder's wife.",
  },
  {
    id: "rabbit-hole-boxergrail",
    name: "Rabbit Hole Boxergrail",
    sub_brand_id: "rabbit-hole-core",
    abv: 47.5,
    price: 54,
    rarity: "limited",
    rarity_score: 40,
    style: "Rye Whiskey",
    description: "95% rye, 5% malted barley. Named for Louisville's greatest athlete, Muhammad Ali. Sour mash rye with big spice and a clean Kentucky finish.",
  },

  // ════════════════════════════════════════════════════════════════════════════
  // NULU (NDP — sources from MGP)
  // ════════════════════════════════════════════════════════════════════════════
  {
    id: "nulu-straight-bourbon",
    name: "NuLu Straight Bourbon",
    sub_brand_id: "nulu-core",
    abv: 53,
    price: 65,
    rarity: "limited",
    rarity_score: 48,
    style: "Bourbon",
    description: "MGP-sourced single barrel bourbon (75% corn, 21% rye, 4% malted barley), bottled non-chill filtered at cask strength. Each bottle hand-labeled with barrel number, proof, and age.",
    source_distillery: "MGP",
  },
  {
    id: "nulu-toasted-barrel",
    name: "NuLu Toasted Barrel Bourbon",
    sub_brand_id: "nulu-core",
    abv: 52,
    price: 70,
    rarity: "limited",
    rarity_score: 52,
    style: "Bourbon",
    description: "MGP sourced bourbon finished in additional toasted (not charred) barrels. Adds a layer of vanilla, cream, and sweet wood without the heavy char influence.",
    source_distillery: "MGP",
  },
  {
    id: "nulu-double-oaked",
    name: "NuLu Double Oaked Bourbon",
    sub_brand_id: "nulu-core",
    abv: 52,
    price: 75,
    rarity: "limited",
    rarity_score: 52,
    style: "Bourbon",
    description: "MGP sourced bourbon matured in two separate oak barrels. Deep vanilla, caramel, and toasted coconut notes from the extended wood contact.",
    source_distillery: "MGP",
  },
];

// ── Runner ────────────────────────────────────────────────────────────────────

async function main() {
  loadEnv();
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  // 1. Upsert new brands
  console.log(`\nUpserting ${NEW_BRANDS.length} new brands…`);
  const { error: brandErr } = await supabase
    .from("brands")
    .upsert(NEW_BRANDS, { onConflict: "id" });
  if (brandErr) { console.error("Brands error:", brandErr.message); process.exit(1); }
  console.log("  ✓ Brands done");

  // 2. Upsert sub-brands
  console.log(`\nUpserting ${NEW_SUB_BRANDS.length} sub-brands…`);
  const { error: sbErr } = await supabase
    .from("sub_brands")
    .upsert(NEW_SUB_BRANDS, { onConflict: "id" });
  if (sbErr) { console.error("Sub-brands error:", sbErr.message); process.exit(1); }
  console.log("  ✓ Sub-brands done");

  // 3. Upsert bottles
  console.log(`\nUpserting ${NEW_BOTTLES.length} bottles…`);
  const { error: btErr } = await supabase
    .from("bottles")
    .upsert(NEW_BOTTLES, { onConflict: "id" });
  if (btErr) { console.error("Bottles error:", btErr.message); process.exit(1); }
  console.log("  ✓ Bottles done");

  console.log(`\n✅ Batch 2 complete — ${NEW_BRANDS.length} brands, ${NEW_SUB_BRANDS.length} sub-brands, ${NEW_BOTTLES.length} bottles.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
