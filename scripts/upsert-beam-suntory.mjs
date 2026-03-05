/**
 * upsert-beam-suntory.mjs
 * ──────────────────────────────────────────────────────────────────────────
 * Upserts the full Beam Suntory American whiskey catalog into Supabase:
 *   Jim Beam · Maker's Mark · Knob Creek · Basil Hayden ·
 *   Baker's · Booker's · Legent
 *
 * New sub-brands: jim-beam, jim-beam-single-barrel, makers-mark,
 *   makers-mark-wood-finishing, knob-creek-rye, legent
 * Updates existing: knob-creek, bookers, basil-haydens, bakers
 *   (adds style + description + missing bottles)
 *
 * Idempotent: uses upsert (onConflict: "id") — safe to re-run.
 * Usage: node scripts/upsert-beam-suntory.mjs
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

const BRAND_ID = "beam-suntory";

const NEW_SUB_BRANDS = [
  { id: "jim-beam",                   name: "Jim Beam",                              brand_id: BRAND_ID },
  { id: "jim-beam-single-barrel",     name: "Jim Beam Single Barrel",                brand_id: BRAND_ID },
  { id: "makers-mark",                name: "Maker's Mark",                          brand_id: BRAND_ID },
  { id: "makers-mark-wood-finishing", name: "Maker's Mark Wood Finishing Series",    brand_id: BRAND_ID },
  { id: "knob-creek-rye",             name: "Knob Creek Rye",                        brand_id: BRAND_ID },
  { id: "legent",                     name: "Legent",                                brand_id: BRAND_ID },
];

const BOTTLES = [
  // ═══════════════════════════════════════════════════════════════════
  //  JIM BEAM — Core
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "jim-beam-original",
    sub_brand_id: "jim-beam",
    name: "Jim Beam Original",
    age: 4,
    abv: 40,
    price: 18,
    rarity: "common",
    rarity_score: 1,
    style: "Bourbon",
    availability: "current",
    entry_source: "catalog",
    description: "The world's #1 bourbon. Aged four years in newly charred oak barrels, delivering sweet caramel, vanilla, woody grain, and oak. Smooth and versatile — the definitive Jim Beam expression carrying 225+ years of family tradition.",
  },
  {
    id: "jim-beam-black",
    sub_brand_id: "jim-beam",
    name: "Jim Beam Black",
    age: 7,
    abv: 45,
    price: 22,
    rarity: "common",
    rarity_score: 2,
    style: "Bourbon",
    availability: "current",
    entry_source: "catalog",
    description: "Aged seven years — the sweet spot where smoothness meets rich caramel, vanilla, and warm oak. Full-bodied and meant to be sipped and savored at 90 proof.",
  },
  {
    id: "jim-beam-double-oak",
    sub_brand_id: "jim-beam",
    name: "Jim Beam Double Oak",
    age: null,
    abv: 43,
    price: 21,
    rarity: "common",
    rarity_score: 2,
    style: "Bourbon",
    availability: "current",
    entry_source: "catalog",
    description: "Twice barreled for extra depth — first aged in a freshly charred American White Oak barrel, then transferred into a second newly charred oak barrel. Bold, spicy oak with smooth, sweet caramel and toffee notes.",
  },
  {
    id: "jim-beam-devils-cut",
    sub_brand_id: "jim-beam",
    name: "Jim Beam Devil's Cut",
    age: null,
    abv: 45,
    price: 23,
    rarity: "common",
    rarity_score: 2,
    style: "Bourbon",
    availability: "current",
    entry_source: "catalog",
    description: "Uses a proprietary process to extract bourbon trapped deep inside the barrel wood staves — 'the devil's cut' — then blends it with extra-aged Kentucky straight bourbon. Robust, full-bodied oak and vanilla at 90 proof.",
  },
  {
    id: "jim-beam-rye",
    sub_brand_id: "jim-beam",
    name: "Jim Beam Rye",
    age: null,
    abv: 45,
    price: 20,
    rarity: "common",
    rarity_score: 2,
    style: "Rye Whiskey",
    availability: "current",
    entry_source: "catalog",
    description: "A bold, old-school pre-Prohibition-style rye with warm notes, a spicy kick, black pepper bite, and hints of vanilla and oak. Bespoke rye spiciness with rich oaky smokiness and caramelized brown-sugar sweetness.",
  },
  {
    id: "jim-beam-repeal-batch",
    sub_brand_id: "jim-beam",
    name: "Jim Beam Repeal Batch",
    age: null,
    abv: 43,
    price: 18,
    rarity: "limited",
    rarity_score: 3,
    style: "Bourbon",
    availability: "limited_release",
    entry_source: "catalog",
    description: "A tribute to James B. Beam's first post-Prohibition batch, distilled just 120 days after repeal in 1933. Non-chill filtered for a big, robust flavor with oaky notes balanced by light vanilla and brown spice.",
  },
  {
    id: "jim-beam-old-tub",
    sub_brand_id: "jim-beam",
    name: "Jim Beam Old Tub",
    age: 4,
    abv: 50,
    price: 20,
    rarity: "limited",
    rarity_score: 3,
    style: "Bourbon",
    availability: "limited_release",
    entry_source: "catalog",
    description: "A nostalgic tribute to the Beam family's original pre-Jim Beam bourbon. Bottled-in-bond at 100 proof, unfiltered, with oak, grain, warm caramel, honey, and citrus zest. A small-batch limited release.",
  },
  {
    id: "jim-beam-winter-reserve",
    sub_brand_id: "jim-beam",
    name: "Jim Beam Winter Reserve",
    age: 6,
    abv: 43,
    price: 25,
    rarity: "limited",
    rarity_score: 3,
    style: "Bourbon",
    availability: "limited_release",
    entry_source: "catalog",
    description: "A limited seasonal release aged six years then finished in two toasted barrels. Smooth and elevated with notes of sweet vanilla, cinnamon spice, and a hint of clove for a warm, wintry finish at 86 proof.",
  },

  // ═══════════════════════════════════════════════════════════════════
  //  JIM BEAM — Single Barrel
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "jim-beam-single-barrel",
    sub_brand_id: "jim-beam-single-barrel",
    name: "Jim Beam Single Barrel",
    age: null,
    abv: 54,
    price: 35,
    rarity: "limited",
    rarity_score: 4,
    style: "Bourbon",
    availability: "current",
    entry_source: "catalog",
    description: "Hand-selected from less than 1% of all barrels laid down — each bottle is unique, labeled, and hand-numbered. Rich oaky vanilla, caramel, and light spice with a long, satisfying finish at 108 proof.",
  },

  // ═══════════════════════════════════════════════════════════════════
  //  MAKER'S MARK — Core
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "makers-mark",
    sub_brand_id: "makers-mark",
    name: "Maker's Mark Kentucky Straight Bourbon",
    age: null,
    abv: 45,
    price: 30,
    rarity: "common",
    rarity_score: 1,
    style: "Wheated Bourbon",
    availability: "current",
    entry_source: "catalog",
    description: "The original, with soft red winter wheat as the secondary grain instead of rye. Barrels are hand-rotated and aged to taste, not time. Each bottle hand-dipped in signature red wax at the Star Hill Farm distillery in Loretto, KY.",
  },
  {
    id: "makers-mark-46",
    sub_brand_id: "makers-mark",
    name: "Maker's Mark 46",
    age: null,
    abv: 47,
    price: 40,
    rarity: "common",
    rarity_score: 2,
    style: "Wheated Bourbon",
    availability: "current",
    entry_source: "catalog",
    description: "The first new major expression since the original. Fully matured cask-strength Maker's Mark is finished with 10 seared French oak staves (Stave Profile No. 46) in the limestone cellar, imparting layers of caramel, vanilla, and baking spice with a velvety finish.",
  },
  {
    id: "makers-mark-101",
    sub_brand_id: "makers-mark",
    name: "Maker's Mark 101",
    age: null,
    abv: 50.5,
    price: 35,
    rarity: "common",
    rarity_score: 2,
    style: "Wheated Bourbon",
    availability: "current",
    entry_source: "catalog",
    description: "Everything of the classic Maker's Mark profile turned up to 101 proof. Originally a favorite of founder Bill Samuels Sr., set aside for friends and special occasions. Rich, creamy, and soft with spice, fruit, and caramel. Particularly well suited for cocktails.",
  },
  {
    id: "makers-mark-cask-strength",
    sub_brand_id: "makers-mark",
    name: "Maker's Mark Cask Strength",
    age: null,
    abv: 55.25,
    price: 45,
    rarity: "limited",
    rarity_score: 4,
    style: "Wheated Bourbon",
    availability: "current",
    entry_source: "catalog",
    description: "Bottled at barrel proof (107–114 proof, varies by batch) — the boldest representation of the distillery's craft. Aged a minimum of 7 years, each small-batch release is unique in proof. Amplified caramel, dark cherry, toasted oak, and warm spices.",
  },
  {
    id: "makers-mark-cellar-aged",
    sub_brand_id: "makers-mark",
    name: "Maker's Mark Cellar Aged (2025)",
    age: null,
    abv: 56.45,
    price: 150,
    rarity: "rare",
    rarity_score: 7,
    style: "Wheated Bourbon",
    availability: "limited_release",
    entry_source: "catalog",
    description: "Maker's Mark's first-ever older expression. The 2025 release blends 11-, 13-, and 14-year-old bourbons at cask strength (112.9 proof), aged in the LEED-certified limestone cellar. Dark brown sugar, caramelized oak, baked apple, creamy fudge, and butterscotch finish.",
  },

  // ═══════════════════════════════════════════════════════════════════
  //  MAKER'S MARK — Wood Finishing Series
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "makers-mark-wfs-heart",
    sub_brand_id: "makers-mark-wood-finishing",
    name: "Maker's Mark Wood Finishing Series — The Heart (2024)",
    age: null,
    abv: 55.25,
    price: 60,
    rarity: "rare",
    rarity_score: 6,
    style: "Wheated Bourbon",
    availability: "limited_release",
    entry_source: "catalog",
    description: "First release in the 'Unsung Heroes' chapter, celebrating the distillery team — the heart of whisky-making at Star Hill Farm. Cask-strength expression finished with 10 specially selected oak staves. Fruit forward with caramel, maple, dark chocolate, and a rich, creamy mouthfeel.",
  },
  {
    id: "makers-mark-wfs-keepers",
    sub_brand_id: "makers-mark-wood-finishing",
    name: "Maker's Mark Wood Finishing Series — The Keepers (2025)",
    age: null,
    abv: 55.25,
    price: 60,
    rarity: "rare",
    rarity_score: 6,
    style: "Wheated Bourbon",
    availability: "limited_release",
    entry_source: "catalog",
    description: "Second release in the 'Unsung Heroes' chapter, celebrating the maturation team who hand-rotate barrels for 6+ years. Bold expression with seasoned oak and brûlée sugar, dried dark fruit, and a long, enveloping roasted finish at cask strength.",
  },

  // ═══════════════════════════════════════════════════════════════════
  //  KNOB CREEK — Bourbon (update existing + add new)
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "knob-creek-9",
    sub_brand_id: "knob-creek",
    name: "Knob Creek 9 Year Old Bourbon",
    age: 9,
    abv: 50,
    price: 35,
    rarity: "common",
    rarity_score: 2,
    style: "Bourbon",
    availability: "current",
    entry_source: "catalog",
    description: "The flagship expression. Patiently aged nine years in white oak barrels, delivering an unflinching balance of deep pre-Prohibition-style bourbon with robust oak, smooth vanilla, and layered caramel at 100 proof.",
  },
  {
    id: "knob-creek-12",
    sub_brand_id: "knob-creek",
    name: "Knob Creek 12 Year Old Bourbon",
    age: 12,
    abv: 50,
    price: 55,
    rarity: "limited",
    rarity_score: 4,
    style: "Bourbon",
    availability: "current",
    entry_source: "catalog",
    description: "Full proof for full flavor. An honest pre-Prohibition style bourbon with bold and spicy overtones, leathered fruits, vanilla, caramelized wood, and a warm smoky char finish at 100 proof.",
  },
  {
    id: "knob-creek-single-barrel",
    sub_brand_id: "knob-creek",
    name: "Knob Creek 9 Year Single Barrel Reserve",
    age: 9,
    abv: 60,
    price: 60,
    rarity: "limited",
    rarity_score: 4,
    style: "Bourbon",
    availability: "current",
    entry_source: "catalog",
    description: "Distillers handpick exceptional barrels to be enjoyed in their full, unblended glory at 120 proof. Deep and complex flavors of vanilla, nuts, and oak with robust caramel notes and a slightly smoky character.",
  },
  {
    id: "knob-creek-single-barrel-cask-strength",
    sub_brand_id: "knob-creek",
    name: "Knob Creek Single Barrel Cask Strength Bourbon",
    age: null,
    abv: 63.55,
    price: 65,
    rarity: "limited",
    rarity_score: 5,
    style: "Bourbon",
    availability: "limited_release",
    entry_source: "catalog",
    description: "Uncut, unfiltered cask-strength expression bottled from individual barrels at ~127 proof. Bold and complex vanilla, nuts, and oak with an expansive caramel aroma and lingering warm full-flavored finish.",
  },
  {
    id: "knob-creek-18",
    sub_brand_id: "knob-creek",
    name: "Knob Creek 18 Year Old Bourbon",
    age: 18,
    abv: 50,
    price: 120,
    rarity: "rare",
    rarity_score: 7,
    style: "Bourbon",
    availability: "limited_release",
    entry_source: "catalog",
    description: "A limited-edition release aged twice as long as the flagship bourbon. Rich copper color with deep caramelized oak, brown sugar, char, and a warm finish with spice and floral notes at 100 proof.",
  },
  {
    id: "knob-creek-21",
    sub_brand_id: "knob-creek",
    name: "Knob Creek 21 Year Old Bourbon",
    age: 21,
    abv: 50,
    price: 200,
    rarity: "rare",
    rarity_score: 8,
    style: "Bourbon",
    availability: "limited_release",
    entry_source: "catalog",
    description: "The oldest Knob Creek release to date. A complex, balanced limited-edition with rich bronze color, deep caramelized oak, bold char, caramel, and subtle fruit notes at 100 proof.",
  },

  // ═══════════════════════════════════════════════════════════════════
  //  KNOB CREEK — Rye
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "knob-creek-rye-7",
    sub_brand_id: "knob-creek-rye",
    name: "Knob Creek 7 Year Old Rye Whiskey",
    age: 7,
    abv: 50,
    price: 40,
    rarity: "common",
    rarity_score: 2,
    style: "Rye Whiskey",
    availability: "current",
    entry_source: "catalog",
    description: "Aged seven years in deeply charred barrels at full 100 proof. Achieves the optimal balance between sweet barrel notes and spicy rye character. A higher corn mashbill makes it approachable for bourbon drinkers.",
  },
  {
    id: "knob-creek-rye-10",
    sub_brand_id: "knob-creek-rye",
    name: "Knob Creek 10 Year Old Rye Whiskey",
    age: 10,
    abv: 50,
    price: 55,
    rarity: "limited",
    rarity_score: 4,
    style: "Rye Whiskey",
    availability: "current",
    entry_source: "catalog",
    description: "Unparalleled richness and complexity through ten years of meticulous aging. Pronounced flavors of char, oak, and caramel with black peppercorn, creamy vanilla, and dried apple aromas at 100 proof.",
  },
  {
    id: "knob-creek-rye-single-barrel",
    sub_brand_id: "knob-creek-rye",
    name: "Knob Creek 7 Year Single Barrel Reserve Rye",
    age: 7,
    abv: 57.5,
    price: 60,
    rarity: "limited",
    rarity_score: 5,
    style: "Rye Whiskey",
    availability: "limited_release",
    entry_source: "catalog",
    description: "Each barrel is aged seven years and bottled individually to become one-of-a-kind at 115 proof. Deep and complex flavors of vanilla, nuts, and oak with robust caramel notes and a slightly smoky character.",
  },
  {
    id: "knob-creek-rye-cask-strength",
    sub_brand_id: "knob-creek-rye",
    name: "Knob Creek Single Barrel Cask Strength Rye",
    age: null,
    abv: 63.55,
    price: 65,
    rarity: "limited",
    rarity_score: 5,
    style: "Rye Whiskey",
    availability: "limited_release",
    entry_source: "catalog",
    description: "Bottled from individual barrels at ~127 proof — an even bolder expression of Knob Creek's signature rye. Bold rye spiciness with undertones of vanilla and oak, herbaceous aromas, and a lingering warm spiced finish.",
  },
  {
    id: "knob-creek-bourbon-x-rye",
    sub_brand_id: "knob-creek-rye",
    name: "Knob Creek Bourbon x Rye",
    age: null,
    abv: 56.5,
    price: 70,
    rarity: "limited",
    rarity_score: 5,
    style: "Blended American",
    availability: "limited_release",
    entry_source: "catalog",
    description: "A blend of 30% 9-year-old Kentucky Straight Bourbon and 70% 7-year-old Kentucky Straight Rye at 113 proof. Rich flavors of silky vanilla, caramel, and black pepper. Named to Whisky Advocate's Top 20 Most Exciting Whiskies of 2024.",
  },

  // ═══════════════════════════════════════════════════════════════════
  //  BASIL HAYDEN — Bourbon (update existing + add new)
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "basil-haydens-bourbon",
    sub_brand_id: "basil-haydens",
    name: "Basil Hayden Kentucky Straight Bourbon",
    age: null,
    abv: 40,
    price: 50,
    rarity: "common",
    rarity_score: 2,
    style: "High Rye Bourbon",
    availability: "current",
    entry_source: "catalog",
    description: "Named after distiller Meredith Basil Hayden Sr. who pioneered a high-rye recipe in 1792. Built on a 63% corn, 27% rye, 10% malted barley mashbill — twice the rye of a standard Beam bourbon. Approachable at 80 proof with notes of honey, dried fruit, and peppery rye.",
  },
  {
    id: "basil-hayden-toast",
    sub_brand_id: "basil-haydens",
    name: "Basil Hayden Toast",
    age: null,
    abv: 40,
    price: 55,
    rarity: "common",
    rarity_score: 2,
    style: "Bourbon",
    availability: "current",
    entry_source: "catalog",
    description: "A softer expression built on a brown rice mashbill (63% corn, 27% brown rice, 10% malted barley). A portion undergoes secondary aging in toasted then flash-charred oak barrels before blending back, adding layers of vanilla and caramel. Toasted oak, dried fruit, and caramelized sugar at 80 proof.",
  },
  {
    id: "basil-hayden-10-year",
    sub_brand_id: "basil-haydens",
    name: "Basil Hayden 10 Year Old Bourbon",
    age: 10,
    abv: 40,
    price: 70,
    rarity: "limited",
    rarity_score: 5,
    style: "High Rye Bourbon",
    availability: "limited_release",
    entry_source: "catalog",
    description: "An annual limited release featuring the classic high-rye mashbill aged a full decade. Big oak, hints of char, vanilla, and rye on the nose; caramel sweetness and rye spice on the palate; lightly smoky, subtly charred finish.",
  },
  {
    id: "basil-hayden-red-wine-cask",
    sub_brand_id: "basil-haydens",
    name: "Basil Hayden Red Wine Cask Finish Bourbon",
    age: null,
    abv: 40,
    price: 60,
    rarity: "limited",
    rarity_score: 5,
    style: "High Rye Bourbon",
    availability: "limited_release",
    entry_source: "catalog",
    description: "The classic high-rye Kentucky Straight Bourbon finished in Californian red wine casks. Dried cherries, cranberry, raisins, and apricot on the nose; ripe cherry, dried fruit, vanilla, and charred oak on the palate; warm dried fruit and toasted oak finish.",
  },
  {
    id: "basil-hayden-subtle-smoke",
    sub_brand_id: "basil-haydens",
    name: "Basil Hayden Subtle Smoke Bourbon",
    age: null,
    abv: 40,
    price: 50,
    rarity: "limited",
    rarity_score: 4,
    style: "High Rye Bourbon",
    availability: "limited_release",
    entry_source: "catalog",
    description: "The signature high-rye bourbon given secondary aging in barrels treated with hickory-smoked chips. Mellow smoke and sweet vanilla on the nose; soft char, butterscotch, and maple on the palate; crisp, delicate hickory smokiness on the finish.",
  },

  // ═══════════════════════════════════════════════════════════════════
  //  BASIL HAYDEN — Rye (update existing + add new)
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "basil-haydens-dark-rye",
    sub_brand_id: "basil-haydens",
    name: "Basil Hayden Dark Rye",
    age: null,
    abv: 40,
    price: 45,
    rarity: "common",
    rarity_score: 2,
    style: "Rye Whiskey",
    availability: "current",
    entry_source: "catalog",
    description: "A blend of Kentucky Straight Rye Whiskey and Canadian Rye Whisky, finished with a splash of California-style port wine. Rich cherry, plum, and dark fruit alongside rye spice and caramel sweetness. Bold, approachable, and beautifully balanced at 80 proof.",
  },
  {
    id: "basil-hayden-malted-rye",
    sub_brand_id: "basil-haydens",
    name: "Basil Hayden Malted Rye",
    age: null,
    abv: 40,
    price: 60,
    rarity: "limited",
    rarity_score: 3,
    style: "Rye Whiskey",
    availability: "current",
    entry_source: "catalog",
    description: "Made from a 100% malted rye mashbill — malting the rye delivers a softer, more approachable rye character. Floral and dill aromas with hints of oak and caramel; cinnamon, sweet vanilla, and toasted rye bread on the palate; delicate chocolate and warm spice finish.",
  },
  {
    id: "basil-hayden-caribbean-reserve",
    sub_brand_id: "basil-haydens",
    name: "Basil Hayden Caribbean Reserve Rye",
    age: null,
    abv: 40,
    price: 45,
    rarity: "limited",
    rarity_score: 4,
    style: "Rye Whiskey",
    availability: "discontinued",
    entry_source: "catalog",
    description: "A limited-edition blend of 8-year-old Kentucky Straight Rye and 4-year-old Canadian Rye, finished with Black Strap Rum. Notes of brown sugar, molasses, and dark spice alongside classic rye character. Now discontinued.",
  },

  // ═══════════════════════════════════════════════════════════════════
  //  BAKER'S — update existing + add new
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "bakers-7",
    sub_brand_id: "bakers",
    name: "Baker's Single Barrel Bourbon",
    age: 7,
    abv: 53.5,
    price: 65,
    rarity: "limited",
    rarity_score: 4,
    style: "Bourbon",
    availability: "current",
    entry_source: "catalog",
    description: "Named for Baker Beam, grandnephew of Jim Beam. A Kentucky Straight Bourbon bottled at 107 proof from a single barrel, aged a minimum of 7 years on the upper floors of Jim Beam rickhouses. Bold vanilla, oak, and caramel with a long, warming finish.",
  },
  {
    id: "bakers-13-year",
    sub_brand_id: "bakers",
    name: "Baker's 13 Year Old Bourbon",
    age: 13,
    abv: 53.5,
    price: 150,
    rarity: "rare",
    rarity_score: 7,
    style: "Bourbon",
    availability: "limited_release",
    entry_source: "catalog",
    description: "A limited-edition extra-aged single barrel expression aged 13 years at 107 proof. Each bottle is unique to its barrel — expect deep fruit, vanilla, and caramel on the nose with oak, toasted nuts, and a robust, medium-long finish.",
  },
  {
    id: "bakers-high-rye",
    sub_brand_id: "bakers",
    name: "Baker's High Rye Bourbon",
    age: 7,
    abv: 53.5,
    price: 75,
    rarity: "limited",
    rarity_score: 5,
    style: "Bourbon",
    availability: "limited_release",
    entry_source: "catalog",
    description: "A limited single barrel expression using a higher-rye mash bill than the standard Baker's recipe. Pays homage to Baker Beam's trucking roots delivering grain to the distillery. Charred oak and brown sweets with pronounced rye spice at 107 proof.",
  },

  // ═══════════════════════════════════════════════════════════════════
  //  BOOKER'S — update existing + add new
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "bookers-bourbon",
    sub_brand_id: "bookers",
    name: "Booker's Bourbon",
    age: null,
    abv: 63.2,
    price: 100,
    rarity: "limited",
    rarity_score: 5,
    style: "Bourbon",
    availability: "current",
    entry_source: "catalog",
    description: "The namesake bourbon of Sixth-Generation Master Distiller Booker Noe, originally a holiday gift to friends. Released in quarterly named batches — uncut, unfiltered, and bottled straight from the barrel at full cask strength (~125–130 proof). Bold, complex, and unmistakably American.",
  },
  {
    id: "bookers-the-reserves",
    sub_brand_id: "bookers",
    name: "Booker's The Reserves (2025)",
    age: null,
    abv: 61.65,
    price: 130,
    rarity: "rare",
    rarity_score: 7,
    style: "Bourbon",
    availability: "limited_release",
    entry_source: "catalog",
    description: "Annual limited release and the first Booker's expression to carry a cask finish. Barrels were sent to Jalisco for El Tesoro tequila aging, then returned to Kentucky for a final finish. Caramel, vanilla, and agave on the nose; rich caramel, oak, and baking spice on the palate; agave and black pepper on the finish.",
  },
  {
    id: "bookers-25th",
    sub_brand_id: "bookers",
    name: "Booker's 25th Anniversary",
    age: null,
    abv: 63,
    price: 300,
    rarity: "rare",
    rarity_score: 8,
    style: "Bourbon",
    availability: "discontinued",
    entry_source: "catalog",
    description: "A commemorative limited release celebrating 25 years of Booker's Bourbon. Bottled at cask strength from carefully selected barrels, honoring the legacy of Booker Noe with an exceptional expression of his namesake bourbon.",
  },

  // ═══════════════════════════════════════════════════════════════════
  //  LEGENT
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "legent-bourbon",
    sub_brand_id: "legent",
    name: "Legent Bourbon",
    age: null,
    abv: 47,
    price: 40,
    rarity: "common",
    rarity_score: 2,
    style: "Bourbon",
    availability: "current",
    entry_source: "catalog",
    description: "A collaboration between Fred Noe (7th-generation Jim Beam Master Distiller) and Shinji Fukuyo (Chief Blender, Suntory). Kentucky Straight Bourbon partially finished in wine and sherry casks — blending American bourbon tradition with Japanese whisky craftsmanship. Smooth, complex, and approachable at 94 proof.",
  },
  {
    id: "legent-yamazaki-cask-finish",
    sub_brand_id: "legent",
    name: "Legent Yamazaki Cask Finish Blend",
    age: null,
    abv: 57,
    price: 200,
    rarity: "rare",
    rarity_score: 8,
    style: "Bourbon",
    availability: "limited_release",
    entry_source: "catalog",
    description: "Limited edition marking Suntory's 100th anniversary. An 8-year Kentucky Straight Bourbon finished at Yamazaki Distillery in French Oak wine casks, Spanish Oak sherry casks, and rare ex-Yamazaki Spanish Oak casks. Blended back with 8-year Kentucky Straight Bourbon and bottled at 114 proof. Round and complex with oak, dried raisins, and spice.",
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

  console.log(`\n🎉 Done! Upserted ${NEW_SUB_BRANDS.length} new sub-brands + ${BOTTLES.length} bottles for Beam Suntory.\n`);
  console.log("   Sub-brands covered: Jim Beam, Maker's Mark, Knob Creek, Basil Hayden, Baker's, Booker's, Legent");
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
