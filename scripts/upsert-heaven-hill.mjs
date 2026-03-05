/**
 * upsert-heaven-hill.mjs
 * ──────────────────────────────────────────────────────────────────────────
 * Upserts the full Heaven Hill American whiskey catalog into Supabase.
 *
 * Brands covered (all under brand_id: "heaven-hill"):
 *   Elijah Craig · Larceny · Bernheim · Old Fitzgerald
 *   Rittenhouse · Henry McKenna · Pikesville · Parker's Heritage
 *   Heaven Hill BiB · Heaven Hill Heritage Collection
 *   Heaven Hill Grain to Glass · Mellow Corn
 *
 * Existing sub-brands (no bottles yet):
 *   elijah-craig · larceny · bernheim · parker-heritage · heaven-hill-bib
 *
 * New sub-brands added here:
 *   elijah-craig-barrel-proof · elijah-craig-rye · larceny-barrel-proof
 *   bernheim-barrel-proof · old-fitzgerald · old-fitzgerald-decanter
 *   rittenhouse · henry-mckenna · pikesville · heaven-hill-heritage
 *   heaven-hill-grain-to-glass · mellow-corn
 *
 * Idempotent: uses upsert (onConflict: "id") — safe to re-run.
 * Usage: node scripts/upsert-heaven-hill.mjs
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
  // Elijah Craig extensions
  { id: "elijah-craig-barrel-proof", name: "Elijah Craig Barrel Proof",      brand_id: BRAND_ID },
  { id: "elijah-craig-rye",          name: "Elijah Craig Rye",                brand_id: BRAND_ID },
  // Larceny extensions
  { id: "larceny-barrel-proof",      name: "Larceny Barrel Proof",            brand_id: BRAND_ID },
  // Bernheim extensions
  { id: "bernheim-barrel-proof",     name: "Bernheim Barrel Proof",           brand_id: BRAND_ID },
  // Old Fitzgerald
  { id: "old-fitzgerald",            name: "Old Fitzgerald",                  brand_id: BRAND_ID },
  { id: "old-fitzgerald-decanter",   name: "Old Fitzgerald BiB Decanter",     brand_id: BRAND_ID },
  // Standalone brands
  { id: "rittenhouse",               name: "Rittenhouse",                     brand_id: BRAND_ID },
  { id: "henry-mckenna",             name: "Henry McKenna",                   brand_id: BRAND_ID },
  { id: "pikesville",                name: "Pikesville",                      brand_id: BRAND_ID },
  // Heaven Hill premium / specialty
  { id: "heaven-hill-heritage",      name: "Heaven Hill Heritage Collection", brand_id: BRAND_ID },
  { id: "heaven-hill-grain-to-glass",name: "Heaven Hill Grain to Glass",      brand_id: BRAND_ID },
  // Corn whiskey
  { id: "mellow-corn",               name: "Mellow Corn",                     brand_id: BRAND_ID },
];

const BOTTLES = [

  // ═══════════════════════════════════════════════════════════════════════════
  //  ELIJAH CRAIG — Core (sub-brand: elijah-craig, already exists)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "elijah-craig-small-batch",
    sub_brand_id: "elijah-craig",
    name: "Elijah Craig Small Batch Bourbon",
    age: null,
    abv: 47,
    price: 35,
    rarity: "common",
    rarity_score: 2,
    style: "Bourbon",
    availability: "current",
    entry_source: "catalog",
    description: "Named after the Reverend Elijah Craig, credited as the first to age whiskey in charred oak barrels. Hand-selected barrels aged 8–12 years are blended for a perfect balance of rich flavor and full body. Nose of vanilla bean, sweet fruit, and fresh mint; smooth and warm palate with woody spice, smoke, and nutmeg; long, sweet, and slightly toasty finish. Bottled at 94 proof.",
  },
  {
    id: "elijah-craig-toasted-barrel",
    sub_brand_id: "elijah-craig",
    name: "Elijah Craig Toasted Barrel Bourbon",
    age: null,
    abv: 47,
    price: 50,
    rarity: "common",
    rarity_score: 2,
    style: "Bourbon",
    availability: "current",
    entry_source: "catalog",
    description: "Fully aged Elijah Craig Small Batch Bourbon finished in custom-toasted new oak barrels — charred to start, toasted to finish. The secondary toasting adds sweet oak complexity and deeper layers of caramel, chocolate, and baking spice. Nose of toasted oak and rich caramel; palate of complex spice, pepper, and milk chocolate; warming finish with lingering chocolate and baking spices. Bottled at 94 proof.",
  },
  {
    id: "elijah-craig-18yr",
    sub_brand_id: "elijah-craig",
    name: "Elijah Craig 18-Year Single Barrel Bourbon",
    age: 18,
    abv: 45,
    price: 175,
    rarity: "limited",
    rarity_score: 4,
    style: "Bourbon",
    availability: "limited_release",
    entry_source: "catalog",
    description: "Bold and robust: a single barrel Kentucky Straight Bourbon aged 18 years and individually selected by the Master Distiller. Warm, deep amber coloring; aromas of aged oak, spiced vanilla, mint, and chocolate; richly textured nutty and semisweet palate with honey and toasted wood; long vanilla and pepper finish. Double Gold at the 2021 San Francisco World Spirits Competition. Bottled at 90 proof.",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  //  ELIJAH CRAIG BARREL PROOF (sub-brand: elijah-craig-barrel-proof)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "elijah-craig-barrel-proof",
    sub_brand_id: "elijah-craig-barrel-proof",
    name: "Elijah Craig Barrel Proof Bourbon",
    age: 12,
    abv: 65,
    price: 70,
    rarity: "limited",
    rarity_score: 3,
    style: "Bourbon",
    availability: "limited_release",
    entry_source: "catalog",
    description: "Uncut, unfiltered, and straight from the barrel — bottled at full natural proof with no water added, preserving every nuance of the 12-year-old spirit exactly as the Master Distiller tastes it in the rickhouse. Released in three batches annually (January, May, September). ABV varies by batch, typically ranging 59–70%. Deep amber; caramel, toasted oak, apple, and orange nose; vanilla, caramel, butterscotch, black pepper, and cinnamon palate; long, layered, slow-fading finish.",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  //  ELIJAH CRAIG RYE (sub-brand: elijah-craig-rye)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "elijah-craig-rye",
    sub_brand_id: "elijah-craig-rye",
    name: "Elijah Craig Straight Rye Whiskey",
    age: null,
    abv: 47,
    price: 40,
    rarity: "common",
    rarity_score: 2,
    style: "Rye Whiskey",
    availability: "current",
    entry_source: "catalog",
    description: "The first rye whiskey to carry Elijah Craig's name. Made from a rye-forward mashbill that imbues bold spice, perfectly balanced with corn for distinct smoothness. Nose of dark chocolate with spice and a hint of smoke; rich baking spices and honey backed by smooth oak on the palate; long, lingering finish. Bottled at 94 proof.",
  },
  {
    id: "elijah-craig-toasted-rye",
    sub_brand_id: "elijah-craig-rye",
    name: "Elijah Craig Toasted Rye Whiskey",
    age: null,
    abv: 47,
    price: 55,
    rarity: "common",
    rarity_score: 2,
    style: "Rye Whiskey",
    availability: "current",
    entry_source: "catalog",
    description: "Fully matured Elijah Craig Straight Rye Whiskey finished in a second, custom-toasted new oak barrel — adding a balanced layer of sweet oak complexity to the spirit's natural rye spice. Nose of toasted oak, crème brûlée, almond, and hazelnut; soft, creamy palate of milk chocolate and subtle baking spices; softly warming, long-spiced finish. Bottled at 94 proof.",
  },
  {
    id: "elijah-craig-bp-rye",
    sub_brand_id: "elijah-craig-rye",
    name: "Elijah Craig Barrel Proof Rye Whiskey",
    age: null,
    abv: 54,
    price: 60,
    rarity: "limited",
    rarity_score: 3,
    style: "Rye Whiskey",
    availability: "limited_release",
    entry_source: "catalog",
    description: "Uncut, unfiltered, and bottled straight from the barrel with no water addition or chill filtration. Each bottle displays its unique proof, batch number, and age statement — ABV varies by batch (current batch A925: 54% ABV). Bright copper; nose of baking spices and molasses; complex stewed fruit with cinnamon and nutmeg on the palate; long, warm butterscotch and rye-spice finish.",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  //  LARCENY — Core (sub-brand: larceny, already exists)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "larceny-small-batch",
    sub_brand_id: "larceny",
    name: "Larceny Kentucky Straight Bourbon",
    age: 6,
    abv: 46,
    price: 27,
    rarity: "common",
    rarity_score: 1,
    style: "Wheated Bourbon",
    availability: "current",
    entry_source: "catalog",
    description: "A wheated Kentucky Straight Bourbon using wheat as the secondary grain instead of rye, producing a softer, rounder character. Named for the legend of John E. Fitzgerald, said to have 'borrowed' from the Treasury bonded warehouse. Mashbill: 68% corn, 20% wheat, 12% malted barley. Nose of fresh bread and toffee with butterscotch; buttery caramel and honey palate with rich mouthfeel; long, gently sweet and savory finish. Aged 6 years, bottled at 92 proof.",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  //  LARCENY BARREL PROOF (sub-brand: larceny-barrel-proof)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "larceny-barrel-proof",
    sub_brand_id: "larceny-barrel-proof",
    name: "Larceny Barrel Proof Bourbon",
    age: null,
    abv: 60,
    price: 50,
    rarity: "limited",
    rarity_score: 3,
    style: "Wheated Bourbon",
    availability: "limited_release",
    entry_source: "catalog",
    description: "The wheated bourbon mashbill in its purest form — uncut, non-chill filtered, bottled at full barrel strength. Released three times annually (A=January, B=May, C=September). Aged 6–8 years; ABV varies by batch (typically 57–64%). Winner of Whisky Advocate's Whisky of the Year 2020 (batch B520). Bold, rich, and concentrated with all the signature Larceny softness amplified. Mashbill: 68% corn, 20% wheat, 12% malted barley.",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  //  BERNHEIM — Core (sub-brand: bernheim, already exists)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "bernheim-original",
    sub_brand_id: "bernheim",
    name: "Bernheim Original Kentucky Straight Wheat Whiskey",
    age: 7,
    abv: 45,
    price: 33,
    rarity: "common",
    rarity_score: 1,
    style: "Wheat Whiskey",
    availability: "current",
    entry_source: "catalog",
    description: "America's first new style of American whiskey since Prohibition — a straight wheat whiskey distilled at Heaven Hill's Bernheim Distillery in Louisville. Winter wheat is the primary grain (51%+), creating a lighter, gentler profile than bourbon. Mildly sweet nose with hints of vanilla and honey; hints of toffee, berries, and spice on the palate; elegant, warm, toasted oak finish. Aged 7 years, bottled at 90 proof.",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  //  BERNHEIM BARREL PROOF (sub-brand: bernheim-barrel-proof)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "bernheim-barrel-proof",
    sub_brand_id: "bernheim-barrel-proof",
    name: "Bernheim Original Barrel Proof Wheat Whiskey",
    age: 7,
    abv: 61,
    price: 60,
    rarity: "limited",
    rarity_score: 3,
    style: "Wheat Whiskey",
    availability: "limited_release",
    entry_source: "catalog",
    description: "Bernheim Original Wheat Whiskey in its uncut, non-chill filtered form — the unique wheat mashbill experienced at full barrel strength. Released twice annually. A chance to discover the soft, sweet wheat character amplified by natural proof. Aged 7–9 years; ABV varies by batch (typically 59–63%, recent batches 118–125 proof). The purest expression of America's first straight wheat whiskey.",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  //  OLD FITZGERALD — Standard BiB (sub-brand: old-fitzgerald)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "old-fitzgerald-7yr",
    sub_brand_id: "old-fitzgerald",
    name: "Old Fitzgerald 7-Year Bottled-in-Bond Bourbon",
    age: 7,
    abv: 50,
    price: 45,
    rarity: "common",
    rarity_score: 2,
    style: "Wheated Bourbon",
    availability: "current",
    entry_source: "catalog",
    description: "A bottled-in-bond wheated bourbon honoring Old Fitzgerald's heritage dating to 1870. Meets all requirements of the 1897 Bottled-in-Bond Act: single distillery, single season, aged 7 years (three beyond the legal minimum), bottled at 100 proof. A whisper of wheat gives it rich, viscous character. Nose of Graham crackers, honey, and citrus; brown sugar, baking spices, and oak palate; long-lasting richness fading to gentle oak.",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  //  OLD FITZGERALD BiB DECANTER (sub-brand: old-fitzgerald-decanter)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "old-fitzgerald-decanter-spring-2025",
    sub_brand_id: "old-fitzgerald-decanter",
    name: "Old Fitzgerald BiB 9-Year Decanter Spring 2025",
    age: 9,
    abv: 50,
    price: 70,
    rarity: "allocated",
    rarity_score: 4,
    style: "Wheated Bourbon",
    availability: "limited_release",
    entry_source: "catalog",
    description: "The Spring 2025 release of the iconic Old Fitzgerald Bottled-in-Bond Decanter Series — a 9-year wheated bourbon in the classic diamond decanter inspired by the original 1950s Old Fitzgerald design. Released twice annually (spring and fall), each edition carries its own age statement and meets strict Bottled-in-Bond requirements. Bottled at 100 proof.",
  },
  {
    id: "old-fitzgerald-decanter-fall-2025",
    sub_brand_id: "old-fitzgerald-decanter",
    name: "Old Fitzgerald BiB 11-Year Decanter Fall 2025",
    age: 11,
    abv: 50,
    price: 70,
    rarity: "allocated",
    rarity_score: 4,
    style: "Wheated Bourbon",
    availability: "limited_release",
    entry_source: "catalog",
    description: "The Fall 2025 release of the Old Fitzgerald Bottled-in-Bond Decanter Series — an 11-year wheated bourbon in the classic diamond decanter inspired by the original 1950s design. Each semi-annual release carries its own age statement and meets strict Bottled-in-Bond requirements at 100 proof. A highly sought-after allocated release from Heaven Hill's wheated bourbon program.",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  //  RITTENHOUSE (sub-brand: rittenhouse)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "rittenhouse-bib",
    sub_brand_id: "rittenhouse",
    name: "Rittenhouse Straight Rye Whisky Bottled-in-Bond",
    age: 4,
    abv: 50,
    price: 27,
    rarity: "common",
    rarity_score: 1,
    style: "Rye Whiskey",
    availability: "current",
    entry_source: "catalog",
    description: "Pennsylvania-style rye whisky with a storied heritage, named for Philadelphia's Rittenhouse Square. Meets all seven requirements of the 1897 Bottled-in-Bond Act: single distillery, single season, aged 4 years, bottled at 100 proof. A bartender's staple for its assertive spice and value. Nose of dried fruits, toffee, and sweet peppers; clean, rich palate of cocoa, citrus, cinnamon, and nutmeg; lingering maple-like spiciness.",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  //  HENRY McKENNA (sub-brand: henry-mckenna)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "henry-mckenna-10yr",
    sub_brand_id: "henry-mckenna",
    name: "Henry McKenna 10-Year Single Barrel Bottled-in-Bond",
    age: 10,
    abv: 50,
    price: 40,
    rarity: "common",
    rarity_score: 2,
    style: "Bourbon",
    availability: "current",
    entry_source: "catalog",
    description: "Named for Irish immigrant Henry McKenna, who adapted his family whiskey recipe to Kentucky in 1855. A 10-year-old single-barrel Bottled-in-Bond bourbon — each bottle labeled with its barrel number, rick house, and floor. 2019 San Francisco World Spirits Competition Best in Show Whisky. Nose of vanilla, caramel, oak, and light herbaceous notes; smooth oak, sharp spices, honey, and sweetness on the palate; long, sweet and spicy finish. Bottled at 100 proof.",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  //  PIKESVILLE (sub-brand: pikesville)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "pikesville-rye",
    sub_brand_id: "pikesville",
    name: "Pikesville Straight Rye Whiskey",
    age: 6,
    abv: 55,
    price: 50,
    rarity: "common",
    rarity_score: 2,
    style: "Rye Whiskey",
    availability: "current",
    entry_source: "catalog",
    description: "Originally produced in Maryland in the 1890s, Pikesville Rye was shuttered by Prohibition along with the once-booming Maryland rye industry. Revived by Heaven Hill as a premium Kentucky-distilled expression, aged 6 years and bottled at 110 proof. Nose of dusty cocoa and oaky smoke; dry and spicy with honeyed rye and cloves on the palate; soft vanilla and baking spice finish.",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  //  PARKER'S HERITAGE COLLECTION (sub-brand: parker-heritage, already exists)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "parkers-heritage-19th",
    sub_brand_id: "parker-heritage",
    name: "Parker's Heritage Collection 19th Edition",
    age: null,
    abv: 61.25,
    price: 150,
    rarity: "allocated",
    rarity_score: 4,
    style: "Blended American",
    availability: "limited_release",
    entry_source: "catalog",
    description: "The 19th annual release honoring Heaven Hill Master Distiller Parker Beam (1941–2017), with proceeds benefiting ALS research. A blend of 160 barrels: 15-year-old wheated bourbon, 11-year-old straight corn whiskey, and 12-year-old grain whiskey. Bottled at 122.5 proof. Nose of butterscotch, toasted marshmallow, and peanut brittle with oak spices; rich caramel and rye spices with roasted nuts on the palate; stewed apples, aged malt, and white pepper finish.",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  //  HEAVEN HILL BiB (sub-brand: heaven-hill-bib, already exists)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "heaven-hill-bib-7yr",
    sub_brand_id: "heaven-hill-bib",
    name: "Heaven Hill Bottled-in-Bond 7-Year Bourbon",
    age: 7,
    abv: 50,
    price: 25,
    rarity: "common",
    rarity_score: 1,
    style: "Bourbon",
    availability: "current",
    entry_source: "catalog",
    description: "Paying tribute to Heaven Hill's very first release in 1939, this flagship Bottled-in-Bond bourbon is aged three full years beyond the legal minimum. Single distillery, single distilling season. Nose of vanilla, honey, and caramel sweetness; smooth and sweet with rye spice, caramel, honey, oak, and char on the palate; long, lingering finish. One of the best proof-for-age-for-price bourbons available. Bottled at 100 proof.",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  //  HEAVEN HILL HERITAGE COLLECTION (sub-brand: heaven-hill-heritage)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "heaven-hill-heritage-22yr",
    sub_brand_id: "heaven-hill-heritage",
    name: "Heaven Hill Heritage Collection 22-Year Bourbon",
    age: 22,
    abv: 64.6,
    price: 250,
    rarity: "allocated",
    rarity_score: 5,
    style: "Bourbon",
    availability: "limited_release",
    entry_source: "catalog",
    description: "The 2026 release of Heaven Hill's most prestigious annual limited expression — 271 carefully selected barrels from February, July, and August 2003, drawn from Rickhouse Y (floors 5–6) and bottled in December 2025 at 129.2 proof. Mashbill: 78% corn, 10% rye, 12% malted barley. A rare opportunity to taste ultra-aged Heaven Hill distillate, with decades of Cox's Creek rickhouse influence producing profound depth and complexity.",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  //  HEAVEN HILL GRAIN TO GLASS (sub-brand: heaven-hill-grain-to-glass)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "heaven-hill-gtg-bourbon",
    sub_brand_id: "heaven-hill-grain-to-glass",
    name: "Heaven Hill Grain to Glass Bourbon 2nd Edition",
    age: 6,
    abv: 52.5,
    price: 55,
    rarity: "limited",
    rarity_score: 3,
    style: "Bourbon",
    availability: "limited_release",
    entry_source: "catalog",
    description: "The 2nd Edition of Heaven Hill's vertically integrated Grain to Glass series, distilled in 2018 from Beck's 6225 corn seed varietal and aged 6 years in Rickhouses W5 and W6 at Cox's Creek. Non-chill filtered at barrel proof (105 proof). Each bottle carries unique production data — corn seed varietal, distillation year, and rickhouse details. Notes of butterscotch, caramel, and cardamom-spiced apple pie; rich and viscous mouthfeel; vanilla ice cream and warm apple pie finish giving way to rye and ginger spices.",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  //  MELLOW CORN (sub-brand: mellow-corn)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "mellow-corn",
    sub_brand_id: "mellow-corn",
    name: "Mellow Corn Kentucky Straight Corn Whiskey",
    age: 4,
    abv: 50,
    price: 12,
    rarity: "common",
    rarity_score: 1,
    style: "Bourbon",
    availability: "current",
    entry_source: "catalog",
    description: "One of America's few remaining straight corn whiskeys — distilled from a mash of at least 80% corn and aged 4 years in previously-used bourbon barrels, creating a pale straw hue and uniquely gentle character. Aged in used barrels (unlike bourbon, which requires new charred oak), giving it a sweeter, lighter wood profile. 100 proof with oak and delicate spice on the nose; full-bodied, softly spiced sweetness on the palate; sweet and chewy finish. A cult favorite for extraordinary value.",
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
  for (let i = 0; i < BOTTLES.length; i += BATCH) {
    const chunk = BOTTLES.slice(i, i + BATCH);
    const { error } = await db
      .from("bottles")
      .upsert(chunk, { onConflict: "id" });
    if (error) {
      console.error(`❌ bottles upsert failed (batch ${Math.floor(i / BATCH) + 1}):`, error.message);
      process.exit(1);
    }
    console.log(`   ✅ Batch ${Math.floor(i / BATCH) + 1}: ${chunk.length} bottles`);
  }

  console.log(`\n🎉 Done! Upserted ${NEW_SUB_BRANDS.length} sub-brands + ${BOTTLES.length} bottles for Heaven Hill.\n`);
  console.log("   Brands covered:");
  console.log("   Elijah Craig (Small Batch · Toasted Barrel · 18yr Single Barrel)");
  console.log("   Elijah Craig Barrel Proof (12yr, 3 batches/yr)");
  console.log("   Elijah Craig Rye (Rye · Toasted Rye · Barrel Proof Rye)");
  console.log("   Larceny (Small Batch · Barrel Proof)");
  console.log("   Bernheim Original (Original · Barrel Proof)");
  console.log("   Old Fitzgerald (7yr BiB · BiB Decanter Spring/Fall 2025)");
  console.log("   Rittenhouse · Henry McKenna 10yr · Pikesville");
  console.log("   Parker's Heritage Collection 19th Edition");
  console.log("   Heaven Hill BiB 7yr · Heritage Collection 22yr · Grain to Glass 2nd Ed.");
  console.log("   Mellow Corn");
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
