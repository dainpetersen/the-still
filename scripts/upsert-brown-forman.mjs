/**
 * upsert-brown-forman.mjs
 * ──────────────────────────────────────────────────────────────────────────
 * Upserts the full Brown-Forman American whiskey catalog into Supabase:
 *   Jack Daniel's · Woodford Reserve · Old Forester · Coopers' Craft
 *
 * Sub-brands created: jack-daniels-single-barrel, jack-daniels-bonded,
 *   jack-daniels-aged, woodford-reserve-masters, woodford-reserve-distillery-series,
 *   old-forester-whiskey-row, old-forester-single-barrel, coopers-craft
 *
 * Idempotent: uses upsert (onConflict: "id") — safe to re-run.
 * Usage: node scripts/upsert-brown-forman.mjs
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

const BRAND_ID = "brown-forman";

// New sub-brands to create (existing: jack-daniels, woodford-reserve, old-forester)
const NEW_SUB_BRANDS = [
  { id: "jack-daniels-single-barrel",         name: "Jack Daniel's Single Barrel Collection", brand_id: BRAND_ID },
  { id: "jack-daniels-bonded",                name: "Jack Daniel's Bonded Series",            brand_id: BRAND_ID },
  { id: "jack-daniels-aged",                  name: "Jack Daniel's Age Stated",               brand_id: BRAND_ID },
  { id: "woodford-reserve-masters",           name: "Woodford Reserve Master's Collection",   brand_id: BRAND_ID },
  { id: "woodford-reserve-distillery-series", name: "Woodford Reserve Distillery Series",     brand_id: BRAND_ID },
  { id: "old-forester-whiskey-row",           name: "Old Forester Whiskey Row Series",        brand_id: BRAND_ID },
  { id: "old-forester-single-barrel",         name: "Old Forester Single Barrel",             brand_id: BRAND_ID },
  { id: "coopers-craft",                      name: "Coopers' Craft",                         brand_id: BRAND_ID },
];

const BOTTLES = [
  // ═══════════════════════════════════════════════════════════════════
  //  JACK DANIEL'S — Core
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "jack-daniels-old-no-7",
    sub_brand_id: "jack-daniels",
    name: "Jack Daniel's Old No. 7 Tennessee Whiskey",
    age: null,
    abv: 40,
    price: 30,
    rarity: "common",
    rarity_score: 1,
    style: "Tennessee Whiskey",
    availability: "current",
    entry_source: "catalog",
    description: "The original. Mellowed drop by drop through 10 feet of sugar maple charcoal, then matured in handcrafted new American white oak barrels. Complex and well-balanced with notes of dried fruits, wood, and vanilla.",
  },
  {
    id: "jack-daniels-gentleman-jack",
    sub_brand_id: "jack-daniels",
    name: "Gentleman Jack Tennessee Whiskey",
    age: null,
    abv: 40,
    price: 30,
    rarity: "common",
    rarity_score: 2,
    style: "Tennessee Whiskey",
    availability: "current",
    entry_source: "catalog",
    description: "Double charcoal mellowed — once before and once after maturation — for exceptional smoothness. Balanced oak flavor with notes of caramel and vanilla and a buttery finish.",
  },
  {
    id: "jack-daniels-sinatra-select",
    sub_brand_id: "jack-daniels",
    name: "Sinatra Select Tennessee Whiskey",
    age: null,
    abv: 45,
    price: 150,
    rarity: "rare",
    rarity_score: 6,
    style: "Tennessee Whiskey",
    availability: "limited_release",
    entry_source: "catalog",
    description: "A tribute to Frank Sinatra. Made with special 'Sinatra Barrels' with deep grooves carved into staves to expose the whiskey to extra layers of toasted oak, imparting rich amber color, bold character, and pleasant smokiness.",
  },

  // ═══════════════════════════════════════════════════════════════════
  //  JACK DANIEL'S — Single Barrel Collection
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "jack-daniels-single-barrel",
    sub_brand_id: "jack-daniels-single-barrel",
    name: "Jack Daniel's Single Barrel Select",
    age: null,
    abv: 47,
    price: 50,
    rarity: "limited",
    rarity_score: 3,
    style: "Tennessee Whiskey",
    availability: "current",
    entry_source: "catalog",
    description: "Bottled at 94 proof from a single barrel. Sweet fruit and vanilla on the nose, spice with warm rich caramel on the palate, and a medium oak, clove, and banana finish.",
  },
  {
    id: "jack-daniels-single-barrel-barrel-proof",
    sub_brand_id: "jack-daniels-single-barrel",
    name: "Jack Daniel's Single Barrel Barrel Proof",
    age: null,
    abv: 66,
    price: 70,
    rarity: "limited",
    rarity_score: 4,
    style: "Tennessee Whiskey",
    availability: "current",
    entry_source: "catalog",
    description: "Bottled straight from the barrel at full proof — anywhere from 125 to 140 proof (62.5–70% ABV). Intense vanilla and toasted oak at bold new levels. Robust yet surprisingly smooth.",
  },
  {
    id: "jack-daniels-single-barrel-rye",
    sub_brand_id: "jack-daniels-single-barrel",
    name: "Jack Daniel's Single Barrel Rye",
    age: null,
    abv: 45,
    price: 50,
    rarity: "limited",
    rarity_score: 3,
    style: "Rye Whiskey",
    availability: "current",
    entry_source: "catalog",
    description: "Jack Daniel's first new grain bill in 150 years — a 70% rye, 18% corn, 12% barley mash bill. Complex flavors of ripe fruit mingle with light toasted oak, rich spice, and a pleasant lingering finish.",
  },
  {
    id: "jack-daniels-single-barrel-heritage-barrel",
    sub_brand_id: "jack-daniels-single-barrel",
    name: "Jack Daniel's Single Barrel Heritage Barrel",
    age: 7,
    abv: 50,
    price: 100,
    rarity: "allocated",
    rarity_score: 7,
    style: "Tennessee Whiskey",
    availability: "limited_release",
    entry_source: "catalog",
    description: "Matured at least seven years in the highest elevation barrelhouses, barreled and bottled at 100 proof. Soft oak nose with vanilla and graham cracker, rich vanilla and toffee on the palate, lingering brown sugar finish.",
  },
  {
    id: "jack-daniels-single-barrel-100-proof",
    sub_brand_id: "jack-daniels-single-barrel",
    name: "Jack Daniel's Single Barrel 100 Proof",
    age: null,
    abv: 50,
    price: 60,
    rarity: "limited",
    rarity_score: 4,
    style: "Tennessee Whiskey",
    availability: "limited_release",
    entry_source: "catalog",
    description: "Bottled in Bond at 100 proof for the full depth and intensity of its rich flavor. Rare and distinct smoothness with slight differences from bottle to bottle. Available in select duty-free airports worldwide.",
  },

  // ═══════════════════════════════════════════════════════════════════
  //  JACK DANIEL'S — Bonded Series
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "jack-daniels-bonded-tennessee",
    sub_brand_id: "jack-daniels-bonded",
    name: "Jack Daniel's Bonded Tennessee Whiskey",
    age: null,
    abv: 50,
    price: 40,
    rarity: "common",
    rarity_score: 2,
    style: "Tennessee Whiskey",
    availability: "current",
    entry_source: "catalog",
    description: "Made from the classic Old No. 7 recipe, produced in one distilling season, aged at least four years in federally bonded barrelhouses, bottled at 100 proof. Named Whiskey of the Year 2022 by Whisky Advocate.",
  },
  {
    id: "jack-daniels-bonded-rye",
    sub_brand_id: "jack-daniels-bonded",
    name: "Jack Daniel's Bonded Rye",
    age: null,
    abv: 50,
    price: 40,
    rarity: "limited",
    rarity_score: 3,
    style: "Rye Whiskey",
    availability: "current",
    entry_source: "catalog",
    description: "Bold bonded rye bottled at 100 proof, meeting all Bottled-in-Bond Act of 1897 requirements. Crisp pear and apple on the nose, vanilla and fruit with hints of maple sugar, bold classic rye spice finish.",
  },
  {
    id: "jack-daniels-triple-mash",
    sub_brand_id: "jack-daniels-bonded",
    name: "Jack Daniel's Bonded Triple Mash Blended Straight Whiskey",
    age: null,
    abv: 50,
    price: 40,
    rarity: "limited",
    rarity_score: 3,
    style: "Blended American",
    availability: "current",
    entry_source: "catalog",
    description: "Bottled-in-bond blend combining bonded American Malt, Rye, and Tennessee Whiskeys. Dried fruit and toast on the nose, honey sweetness with grain spice and dry oak on the palate, well-rounded spicy finish.",
  },

  // ═══════════════════════════════════════════════════════════════════
  //  JACK DANIEL'S — Age Stated
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "jack-daniels-10-year",
    sub_brand_id: "jack-daniels-aged",
    name: "Jack Daniel's 10 Year Old Tennessee Whiskey",
    age: 10,
    abv: 50,
    price: 70,
    rarity: "limited",
    rarity_score: 4,
    style: "Tennessee Whiskey",
    availability: "limited_release",
    entry_source: "catalog",
    description: "The first age-stated expression from the distillery in about 120 years. Dry fig and raisin laced with oak on the nose, warm butterscotch mingling with soft fruit and smoke, an incredibly long finish of sweet tobacco and spice.",
  },
  {
    id: "jack-daniels-12-year",
    sub_brand_id: "jack-daniels-aged",
    name: "Jack Daniel's 12 Year Old Tennessee Whiskey",
    age: 12,
    abv: 53.5,
    price: 100,
    rarity: "rare",
    rarity_score: 6,
    style: "Tennessee Whiskey",
    availability: "limited_release",
    entry_source: "catalog",
    description: "Bottled at 107 proof. Sweet and creamy notes of pipe tobacco, seasoned oak, and butterscotch. Additional years in the barrelhouse yield a complex, rich flavor perfect for sipping. Released in limited annual batches.",
  },
  {
    id: "jack-daniels-14-year",
    sub_brand_id: "jack-daniels-aged",
    name: "Jack Daniel's 14 Year Old Tennessee Whiskey",
    age: 14,
    abv: 63.15,
    price: 175,
    rarity: "rare",
    rarity_score: 7,
    style: "Tennessee Whiskey",
    availability: "limited_release",
    entry_source: "catalog",
    description: "Bottled at 126.3 proof. Forward notes of sweet bakery spices with layers of oak, cinnamon and creamy butterscotch balanced with rich leather on the palate, lingering into aged oak and pipe tobacco. First 14-year-old in over a century. Batch 1 released 2025.",
  },

  // ═══════════════════════════════════════════════════════════════════
  //  WOODFORD RESERVE — Core
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "woodford-reserve-bourbon",
    sub_brand_id: "woodford-reserve",
    name: "Woodford Reserve Kentucky Straight Bourbon Whiskey",
    age: null,
    abv: 45.2,
    price: 35,
    rarity: "common",
    rarity_score: 1,
    style: "Bourbon",
    availability: "current",
    entry_source: "catalog",
    description: "The flagship expression with more than 200 detectable flavor notes from bold grain and wood to sweet aromatics, spice, fruit, and floral notes. Rich, chewy, and rounded with complex citrus, cinnamon, and cocoa.",
  },
  {
    id: "woodford-reserve-double-oaked",
    sub_brand_id: "woodford-reserve",
    name: "Woodford Reserve Double Oaked",
    age: null,
    abv: 45.2,
    price: 45,
    rarity: "common",
    rarity_score: 2,
    style: "Bourbon",
    availability: "current",
    entry_source: "catalog",
    description: "Uniquely matured in separate charred oak barrels — the second barrel deeply toasted before a light charring — to extract additional soft, sweet oak character. Rich dark fruit, caramel, hazelnut, and apple.",
  },
  {
    id: "woodford-reserve-rye",
    sub_brand_id: "woodford-reserve",
    name: "Woodford Reserve Kentucky Straight Rye Whiskey",
    age: null,
    abv: 45.2,
    price: 40,
    rarity: "common",
    rarity_score: 2,
    style: "Rye Whiskey",
    availability: "current",
    entry_source: "catalog",
    description: "Pre-Prohibition style rye using a 53% rye mash bill. Clove, mint, molasses, and honey with apple and malt hints; long, sweetly spiced finish.",
  },
  {
    id: "woodford-reserve-wheat",
    sub_brand_id: "woodford-reserve",
    name: "Woodford Reserve Kentucky Straight Wheat Whiskey",
    age: null,
    abv: 45.2,
    price: 40,
    rarity: "common",
    rarity_score: 2,
    style: "Wheat Whiskey",
    availability: "current",
    entry_source: "catalog",
    description: "Uses wheat as the dominant grain at 52%. Fruit and floral forward with cinnamon, cedar, cooked apple, pear, and banana. Dry cocoa nibs and lingering apple peel finish.",
  },
  {
    id: "woodford-reserve-malt",
    sub_brand_id: "woodford-reserve",
    name: "Woodford Reserve Kentucky Straight Malt Whiskey",
    age: null,
    abv: 45.2,
    price: 40,
    rarity: "common",
    rarity_score: 2,
    style: "Bourbon",
    availability: "current",
    entry_source: "catalog",
    description: "Crafted from 51% malt and aged in new charred oak barrels. Rich and complex with amplified nutty characteristics. Soft caramel, milk chocolate, dark chocolate, and caramel-coated nuts.",
  },
  {
    id: "woodford-reserve-batch-proof",
    sub_brand_id: "woodford-reserve",
    name: "Woodford Reserve Batch Proof",
    age: null,
    abv: 59.75,
    price: 60,
    rarity: "limited",
    rarity_score: 4,
    style: "Bourbon",
    availability: "current",
    entry_source: "catalog",
    description: "Bottled at actual batch proof (currently 119.5 proof) without dilution. Uses the same grain bill and process as the Distiller's Select but amplified — trademark sweet vanilla and toasted oak in their purest, most intense form.",
  },
  {
    id: "woodford-reserve-double-double-oaked",
    sub_brand_id: "woodford-reserve",
    name: "Woodford Reserve Double Double Oaked",
    age: null,
    abv: 45.2,
    price: 130,
    rarity: "limited",
    rarity_score: 5,
    style: "Bourbon",
    availability: "limited_release",
    entry_source: "catalog",
    description: "An intensified take on Double Oaked, aged in a second custom-crafted deeply toasted and lightly charred barrel. Robust maple syrup, dark butterscotch, brittle caramel, bittersweet chocolate, and sweet hickory smoke.",
  },
  {
    id: "woodford-reserve-baccarat",
    sub_brand_id: "woodford-reserve",
    name: "Woodford Reserve Baccarat Edition",
    age: null,
    abv: 45.2,
    price: 600,
    rarity: "rare",
    rarity_score: 7,
    style: "Bourbon",
    availability: "limited_release",
    entry_source: "catalog",
    description: "The core bourbon finished in select XO Cognac barrels for three seasons, presented in a bespoke Baccarat crystal decanter. Balances crisp American and French oak with complex fruit, subtle spice, and a creamy confectionary finish.",
  },
  {
    id: "woodford-reserve-personal-selection",
    sub_brand_id: "woodford-reserve",
    name: "Woodford Reserve Personal Selection",
    age: null,
    abv: 55,
    price: 80,
    rarity: "limited",
    rarity_score: 4,
    style: "Bourbon",
    availability: "limited_release",
    entry_source: "catalog",
    description: "110-proof offering where consumers select from three distinct flavor profiles crafted by the Master Distiller. The brand's first consumer-participatory bottling experience.",
  },
  {
    id: "woodford-reserve-kentucky-derby",
    sub_brand_id: "woodford-reserve",
    name: "Woodford Reserve Kentucky Derby Commemorative Bottle",
    age: null,
    abv: 45.2,
    price: 45,
    rarity: "limited",
    rarity_score: 3,
    style: "Bourbon",
    availability: "limited_release",
    entry_source: "catalog",
    description: "Annual commemorative edition honoring the Kentucky Derby. Same Distiller's Select liquid presented in a collectible artist-designed bottle. Official Bourbon of the Kentucky Derby since 1999.",
  },

  // ═══════════════════════════════════════════════════════════════════
  //  WOODFORD RESERVE — Master's Collection
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "woodford-reserve-masters-collection",
    sub_brand_id: "woodford-reserve-masters",
    name: "Woodford Reserve Master's Collection",
    age: null,
    abv: 45.2,
    price: 150,
    rarity: "rare",
    rarity_score: 7,
    style: "Bourbon",
    availability: "limited_release",
    entry_source: "catalog",
    description: "Annual limited release exploring unique barrel finishes, grain varieties, and distillation innovations. Each year's expression highlights a distinctive aspect of the Master Distiller's craft.",
  },
  {
    id: "woodford-reserve-masters-madeira-cask",
    sub_brand_id: "woodford-reserve-masters",
    name: "Woodford Reserve Master's Collection — Madeira Cask Finish (2024)",
    age: null,
    abv: 45.2,
    price: 150,
    rarity: "rare",
    rarity_score: 7,
    style: "Blended American",
    availability: "limited_release",
    entry_source: "catalog",
    description: "2024 release. Bourbon, rye, and wheat whiskies finished in Madeira barrels, blended with Kentucky Straight Wheat Whiskey. Dark cherries, candied oranges, cocoa, pepper, clove, and nutmeg.",
  },
  {
    id: "woodford-reserve-masters-sonoma-triple",
    sub_brand_id: "woodford-reserve-masters",
    name: "Woodford Reserve Master's Collection — Sonoma Triple Finish (2023)",
    age: null,
    abv: 45.2,
    price: 150,
    rarity: "rare",
    rarity_score: 7,
    style: "Bourbon",
    availability: "limited_release",
    entry_source: "catalog",
    description: "2023 release. Finished in three distinct Sonoma County barrel types: Pinot Noir, brandy, and former bourbon barrels aged in red wine. Grilled pineapple, red plum, vanilla, cinnamon, and long red grape tannin finish.",
  },
  {
    id: "woodford-reserve-masters-historic-barrel",
    sub_brand_id: "woodford-reserve-masters",
    name: "Woodford Reserve Master's Collection — Historic Barrel Entry (2022)",
    age: null,
    abv: 45.2,
    price: 150,
    rarity: "rare",
    rarity_score: 7,
    style: "Bourbon",
    availability: "limited_release",
    entry_source: "catalog",
    description: "2022 release. Entered the barrel at 100 proof vs. the standard 125. Vanilla bean, dried apple, nutmeg on the nose; rich toasted oak with overripe banana and cooked berry; charred oak, leather, and orange oil finish.",
  },

  // ═══════════════════════════════════════════════════════════════════
  //  WOODFORD RESERVE — Distillery Series
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "woodford-reserve-ds-wheat-bib",
    sub_brand_id: "woodford-reserve-distillery-series",
    name: "Woodford Reserve Distillery Series — Wheat Whiskey Bottled in Bond",
    age: null,
    abv: 50,
    price: 60,
    rarity: "limited",
    rarity_score: 5,
    style: "Wheat Whiskey",
    availability: "limited_release",
    entry_source: "catalog",
    description: "Wheat whiskey from one distilling season, aged in a bonded warehouse, bottled at 100 proof. Toasted whole wheat bread with apple butter on the nose; delicate dried berry compote; long dried berry finish.",
  },
  {
    id: "woodford-reserve-ds-toasted-oak",
    sub_brand_id: "woodford-reserve-distillery-series",
    name: "Woodford Reserve Distillery Series — Toasted Oak Four Grain",
    age: null,
    abv: 45.2,
    price: 60,
    rarity: "limited",
    rarity_score: 5,
    style: "Blended American",
    availability: "limited_release",
    entry_source: "catalog",
    description: "Bourbon, rye, and wheat whiskies each finished in heavily toasted new oak barrels. Sweet marzipan, honeycomb, brown sugar, and butterscotch. Limited to the distillery and select Kentucky retailers.",
  },
  {
    id: "woodford-reserve-ds-cabernet-finish",
    sub_brand_id: "woodford-reserve-distillery-series",
    name: "Woodford Reserve Distillery Series — Cabernet Sauvignon Barrel Finish",
    age: null,
    abv: 45.2,
    price: 60,
    rarity: "limited",
    rarity_score: 5,
    style: "Bourbon",
    availability: "limited_release",
    entry_source: "catalog",
    description: "The signature bourbon finished in hand-selected Cabernet Sauvignon barrels, marrying Kentucky bourbon character with rich, dark fruit nuances. Limited availability.",
  },

  // ═══════════════════════════════════════════════════════════════════
  //  OLD FORESTER — Core
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "old-forester-86",
    sub_brand_id: "old-forester",
    name: "Old Forester 86 Proof",
    age: null,
    abv: 43,
    price: 23,
    rarity: "common",
    rarity_score: 1,
    style: "Bourbon",
    availability: "current",
    entry_source: "catalog",
    description: "Created in 1870, the only bourbon continuously distilled and marketed by the founding family before, during and after Prohibition. Rich, full flavor and smooth character — ideal for sipping or cocktails.",
  },
  {
    id: "old-forester-100",
    sub_brand_id: "old-forester",
    name: "Old Forester 100 Proof",
    age: null,
    abv: 50,
    price: 27,
    rarity: "common",
    rarity_score: 1,
    style: "Bourbon",
    availability: "current",
    entry_source: "catalog",
    description: "A bartender favorite honoring founder George Garvin Brown. Handpicked from select barrels — rich and complex, spicy and robust at 100 proof.",
  },
  {
    id: "old-forester-rye",
    sub_brand_id: "old-forester",
    name: "Old Forester Rye Whisky",
    age: null,
    abv: 50,
    price: 33,
    rarity: "common",
    rarity_score: 2,
    style: "Rye Whiskey",
    availability: "current",
    entry_source: "catalog",
    description: "The first Kentucky Straight Rye Whisky from The First Bottled Bourbon. A historic mash bill of 65% rye, 20% malted barley, 15% corn acquired in 1940. Bold and spicy at 100 proof.",
  },
  {
    id: "old-forester-statesman",
    sub_brand_id: "old-forester",
    name: "Old Forester Statesman Bourbon",
    age: null,
    abv: 47.5,
    price: 43,
    rarity: "common",
    rarity_score: 2,
    style: "Bourbon",
    availability: "current",
    entry_source: "catalog",
    description: "Inspired by the film 'Kingsman: The Golden Circle.' Blended to a smooth 95 proof from hand-selected casks from the warmest places in the warehouse, delivering an exceptional balance of heat and spice.",
  },
  {
    id: "old-forester-birthday",
    sub_brand_id: "old-forester",
    name: "Old Forester Birthday Bourbon 2023",
    age: 12,
    abv: 48,
    price: 150,
    rarity: "rare",
    rarity_score: 7,
    style: "Bourbon",
    availability: "limited_release",
    entry_source: "catalog",
    description: "The 23rd limited edition annual vintage-dated Birthday Bourbon. Hand selected from 12-year-old barrels chosen from a single day of production, presented at 96 proof.",
  },
  {
    id: "old-forester-king-ranch",
    sub_brand_id: "old-forester",
    name: "Old Forester King Ranch Edition",
    age: null,
    abv: 52.5,
    price: 60,
    rarity: "limited",
    rarity_score: 5,
    style: "Bourbon",
    availability: "limited_release",
    entry_source: "catalog",
    description: "A collaboration between Old Forester and King Ranch. Bespoke blend matured in heavily charred barrels and filtered through King Ranch mesquite charcoal at 105 proof. Available only in Texas.",
  },

  // ═══════════════════════════════════════════════════════════════════
  //  OLD FORESTER — Whiskey Row Series
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "old-forester-1870",
    sub_brand_id: "old-forester-whiskey-row",
    name: "Old Forester 1870 Original Batch Whisky",
    age: null,
    abv: 45,
    price: 40,
    rarity: "common",
    rarity_score: 2,
    style: "Bourbon",
    availability: "current",
    entry_source: "catalog",
    description: "A tribute to George Garvin Brown's original batching process — barrels from three different warehouses, each from a different day of production and age profile, minimally filtered at 90 proof.",
  },
  {
    id: "old-forester-1897",
    sub_brand_id: "old-forester-whiskey-row",
    name: "Old Forester 1897 Bottled in Bond Whisky",
    age: null,
    abv: 50,
    price: 45,
    rarity: "common",
    rarity_score: 2,
    style: "Bourbon",
    availability: "current",
    entry_source: "catalog",
    description: "Crafted to honor the U.S. Bottled-in-Bond Act of 1897. Aged at least four years in a federally bonded warehouse, from one distillation season, one distiller, one distillery, and bottled at 100 proof.",
  },
  {
    id: "old-forester-1910",
    sub_brand_id: "old-forester-whiskey-row",
    name: "Old Forester 1910 Old Fine Whisky",
    age: null,
    abv: 46.5,
    price: 50,
    rarity: "common",
    rarity_score: 2,
    style: "Bourbon",
    availability: "current",
    entry_source: "catalog",
    description: "Inspired by a 1910 bottling line fire that forced mature whisky into a secondary barrel. Undergoes a second barreling at low proof to absorb sweet wood sugars. Presented at 93 proof.",
  },
  {
    id: "old-forester-1920",
    sub_brand_id: "old-forester-whiskey-row",
    name: "Old Forester 1920 Prohibition Style Whisky",
    age: null,
    abv: 57.5,
    price: 55,
    rarity: "common",
    rarity_score: 2,
    style: "Bourbon",
    availability: "current",
    entry_source: "catalog",
    description: "One of only six Kentucky distilleries permitted to bottle during Prohibition for medicinal purposes. Rich and intense at 115 proof, paying homage to that storied era.",
  },
  {
    id: "old-forester-1924",
    sub_brand_id: "old-forester-whiskey-row",
    name: "Old Forester 1924 10 Year Old Whisky",
    age: 10,
    abv: 49.5,
    price: 90,
    rarity: "limited",
    rarity_score: 5,
    style: "Bourbon",
    availability: "limited_release",
    entry_source: "catalog",
    description: "A limited annual release commemorating Old Forester's 1924 acquisition of barrels from closed distilleries during Prohibition. A 10-year-old expression presented at 99 proof.",
  },

  // ═══════════════════════════════════════════════════════════════════
  //  OLD FORESTER — Single Barrel
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "old-forester-single-barrel-100",
    sub_brand_id: "old-forester-single-barrel",
    name: "Old Forester Single Barrel 100 Proof",
    age: null,
    abv: 50,
    price: 65,
    rarity: "limited",
    rarity_score: 4,
    style: "Bourbon",
    availability: "limited_release",
    entry_source: "catalog",
    description: "Bottles from one individual barrel — no two are exactly alike. Each barrel produces 200–240 bottles of unique single barrel bourbon at 100 proof, crafted using time-honored methods established over 140 years ago.",
  },
  {
    id: "old-forester-presidents-choice",
    sub_brand_id: "old-forester-single-barrel",
    name: "Old Forester President's Choice",
    age: null,
    abv: 57.5,
    price: 100,
    rarity: "limited",
    rarity_score: 5,
    style: "Bourbon",
    availability: "limited_release",
    entry_source: "catalog",
    description: "A single barrel expression of Old Forester's most exceptional barrels, historically hand selected by the company President. Barrels typically aged 7–9 years at full proof. Released only at Old Forester Distilling Co. and select Kentucky retailers.",
  },

  // ═══════════════════════════════════════════════════════════════════
  //  COOPERS' CRAFT
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "coopers-craft-original",
    sub_brand_id: "coopers-craft",
    name: "Coopers' Craft Original",
    age: null,
    abv: 41.1,
    price: 22,
    rarity: "common",
    rarity_score: 1,
    style: "Bourbon",
    availability: "current",
    entry_source: "catalog",
    description: "Launched in 2016. Aged 4–6 years, then finished through a proprietary beech and birch charcoal filtration ('Beeched & Birched') for a smooth, approachable character. Light toasted oak, baked apple, and citrus custard notes at 82.2 proof.",
  },
  {
    id: "coopers-craft-barrel-reserve",
    sub_brand_id: "coopers-craft",
    name: "Coopers' Craft Barrel Reserve",
    age: null,
    abv: 50,
    price: 32,
    rarity: "common",
    rarity_score: 2,
    style: "Bourbon",
    availability: "current",
    entry_source: "catalog",
    description: "Aged in proprietary 'Chiseled & Charred' American White Oak barrels with machine-chiseled stave interiors creating ~50% additional wood surface area. Bold 100 proof character with caramel, apple, and assertive cinnamon spice.",
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

  console.log(`\n🎉 Done! Upserted ${NEW_SUB_BRANDS.length} sub-brands + ${BOTTLES.length} bottles for Brown-Forman.\n`);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
