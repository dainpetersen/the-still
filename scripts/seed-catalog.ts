/**
 * One-time seed script — migrates WHISKEY_DATA from whiskeys.ts into Supabase.
 *
 * Run once after creating the catalog tables:
 *   npx tsx scripts/seed-catalog.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

// Load .env.local without requiring dotenv
try {
  const envFile = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
  for (const line of envFile.split("\n")) {
    const match = line.match(/^([^#][^=]*)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
} catch { /* .env.local not found — env vars may already be set */ }

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

// ── Inline data (copy of whiskeys.ts without the TS import) ──────────────────
// We define it inline so this script runs as plain Node/tsx without Next.js aliases.

const WHISKEY_DATA = [
  {
    id: "buffalo-trace-distillery", name: "Buffalo Trace Distillery",
    country: "USA", region: "Frankfort, KY", isNDP: false,
    subBrands: [
      { id: "buffalo-trace", name: "Buffalo Trace", bottles: [
        { id: "buffalo-trace-ksb", name: "Buffalo Trace Kentucky Straight Bourbon", abv: 45, price: 30, rarity: "common", rarityScore: 10, description: "The flagship expression. Gentle vanilla, caramel, and a touch of spice." },
        { id: "buffalo-trace-kosher", name: "Buffalo Trace Kosher Wheat Recipe", abv: 47, price: 45, rarity: "limited", rarityScore: 38, description: "Kosher-certified wheated mash. Soft, sweet, and elegant." },
      ]},
      { id: "eagle-rare", name: "Eagle Rare", bottles: [
        { id: "eagle-rare-10", name: "Eagle Rare 10 Year", age: 10, abv: 45, price: 40, rarity: "limited", rarityScore: 42, description: "Bold and complex with a dry, lingering finish. Toffee and oak." },
        { id: "eagle-rare-17", name: "Eagle Rare 17 Year (BTAC)", age: 17, abv: 45, price: 400, rarity: "allocated", rarityScore: 88, description: "Annual BTAC release. Deep oak, toffee, and leather." },
      ]},
      { id: "pappy-van-winkle", name: "Pappy Van Winkle", bottles: [
        { id: "pappy-10", name: "Old Rip Van Winkle 10 Year", age: 10, abv: 53.5, price: 130, rarity: "allocated", rarityScore: 82, description: "Entry point to the Van Winkle family. Rich and bold at cask strength." },
        { id: "pappy-12", name: "Van Winkle Special Reserve 12 Year", age: 12, abv: 45.2, price: 150, rarity: "allocated", rarityScore: 84, description: "Lot B. Honeyed and approachable for a Van Winkle." },
        { id: "pappy-15", name: "Pappy Van Winkle 15 Year", age: 15, abv: 53.5, price: 800, rarity: "unicorn", rarityScore: 96, description: "The holy grail of American whiskey. Rich, thick, and otherworldly." },
        { id: "pappy-20", name: "Pappy Van Winkle 20 Year", age: 20, abv: 45.2, price: 1200, rarity: "unicorn", rarityScore: 98, description: "Two decades of patience. Dried fruit, tobacco, and ancient oak." },
        { id: "pappy-23", name: "Pappy Van Winkle 23 Year", age: 23, abv: 47.8, price: 2000, rarity: "unicorn", rarityScore: 99, description: "The crown jewel. Dense, complex, and nearly impossible to find." },
        { id: "vw-family-reserve-rye", name: "Van Winkle Family Reserve Rye 13 Year", age: 13, abv: 47.8, price: 450, rarity: "unicorn", rarityScore: 92, description: "Rare allocated rye. Mint, dill, and spiced fruit." },
      ]},
      { id: "weller", name: "W.L. Weller", bottles: [
        { id: "weller-special-reserve", name: "Weller Special Reserve", abv: 45, price: 25, rarity: "limited", rarityScore: 45, description: "Wheated bourbon. Soft, sweet, and deceptively complex." },
        { id: "weller-antique-107", name: "Weller Antique 107", abv: 53.5, price: 30, rarity: "limited", rarityScore: 50, description: "High proof wheater. Bold and spicy for the price." },
        { id: "weller-12", name: "Weller 12 Year", age: 12, abv: 45, price: 60, rarity: "allocated", rarityScore: 78, description: "The affordable antidote to Pappy. Vanilla-forward with honeyed finish." },
        { id: "weller-full-proof", name: "Weller Full Proof", abv: 57, price: 70, rarity: "allocated", rarityScore: 80, description: "Bottled at entry proof. Rich and warming." },
        { id: "weller-single-barrel", name: "Weller Single Barrel", abv: 48.5, price: 100, rarity: "allocated", rarityScore: 82, description: "Barrel-strength single cask expression. Caramel and baking spice." },
        { id: "weller-craft-reserve", name: "Weller Craft Reserve", abv: 45, price: 400, rarity: "unicorn", rarityScore: 90, description: "Limited distillery-only release. Among the most sought wheated bourbons." },
      ]},
      { id: "stagg", name: "George T. Stagg", bottles: [
        { id: "stagg-btac", name: "George T. Stagg (BTAC)", abv: 64.1, price: 500, rarity: "allocated", rarityScore: 90, description: "Uncut, unfiltered. A monster of a bourbon — one of the best made." },
        { id: "stagg-jr", name: "Stagg Jr.", abv: 64.5, price: 60, rarity: "limited", rarityScore: 55, description: "Mini-Stagg energy. High proof, raw, and delicious." },
      ]},
      { id: "sazerac-rye", name: "Sazerac Rye", bottles: [
        { id: "sazerac-rye-6", name: "Sazerac Rye 6 Year", age: 6, abv: 45, price: 35, rarity: "common", rarityScore: 15, description: "Classic cocktail rye. Pepper, mint, and clove." },
        { id: "sazerac-rye-18", name: "Thomas H. Handy Sazerac Rye (BTAC)", abv: 63.5, price: 500, rarity: "allocated", rarityScore: 89, description: "Uncut BTAC rye. Spicy and massive, a rye benchmark." },
      ]},
    ],
  },
  {
    id: "heaven-hill", name: "Heaven Hill Distillery",
    country: "USA", region: "Bardstown, KY", isNDP: false,
    subBrands: [
      { id: "elijah-craig", name: "Elijah Craig", bottles: [
        { id: "elijah-craig-sb", name: "Elijah Craig Small Batch", abv: 47, price: 35, rarity: "common", rarityScore: 12, description: "Approachable and reliable. Caramel, vanilla, oak." },
        { id: "elijah-craig-bp", name: "Elijah Craig Barrel Proof", age: 12, abv: 61.4, price: 65, rarity: "limited", rarityScore: 55, description: "Uncut 12-year. One of the best values in bourbon." },
        { id: "elijah-craig-18", name: "Elijah Craig 18 Year", age: 18, abv: 45, price: 125, rarity: "rare", rarityScore: 72, description: "Well-aged and refined. Rich caramel and dried fruit." },
        { id: "elijah-craig-23", name: "Elijah Craig 23 Year", age: 23, abv: 45, price: 350, rarity: "allocated", rarityScore: 85, description: "Ancient oak-forward. Rare annual release." },
      ]},
      { id: "parker-heritage", name: "Parker's Heritage Collection", bottles: [
        { id: "parkers-heritage-wheat", name: "Parker's Heritage Wheated Mash", abv: 63.3, price: 200, rarity: "rare", rarityScore: 75, description: "Annual charity release. Wheated mash, rich and full." },
        { id: "parkers-heritage-barrel", name: "Parker's Heritage Heavy Char", abv: 52, price: 250, rarity: "rare", rarityScore: 78, description: "Heavy char barrel maturation yields intense oak and caramel." },
      ]},
      { id: "bernheim", name: "Bernheim Wheat Whiskey", bottles: [
        { id: "bernheim-original", name: "Bernheim Original Wheat Whiskey", age: 7, abv: 45, price: 35, rarity: "common", rarityScore: 15, description: "America's only straight wheat whiskey. Sweet and silky." },
      ]},
      { id: "larceny", name: "Larceny", bottles: [
        { id: "larceny-small-batch", name: "Larceny Small Batch", abv: 46, price: 30, rarity: "common", rarityScore: 12, description: "Wheated bourbon at a great price. Honey and soft spice." },
        { id: "larceny-bp", name: "Larceny Barrel Proof", abv: 61.5, price: 50, rarity: "limited", rarityScore: 48, description: "Quarterly barrel proof releases. Big, bold wheated punch." },
      ]},
      { id: "heaven-hill-bib", name: "Heaven Hill Bottled-in-Bond", bottles: [
        { id: "hh-bib-7", name: "Heaven Hill 7 Year Bottled-in-Bond", age: 7, abv: 50, price: 30, rarity: "limited", rarityScore: 35, description: "Classic BIB bourbon. Earthy, corny, with good structure." },
      ]},
    ],
  },
  {
    id: "wild-turkey", name: "Wild Turkey Distillery",
    country: "USA", region: "Lawrenceburg, KY", isNDP: false,
    subBrands: [
      { id: "wild-turkey-core", name: "Wild Turkey", bottles: [
        { id: "wild-turkey-101", name: "Wild Turkey 101", abv: 50.5, price: 25, rarity: "common", rarityScore: 8, description: "The original high-rye workhorse. Spicy, bold, and timeless." },
        { id: "wild-turkey-rare-breed", name: "Wild Turkey Rare Breed", abv: 58.4, price: 45, rarity: "common", rarityScore: 18, description: "Barrel-proof blend of 6, 8, and 12-year. Full-throttle bourbon." },
        { id: "wild-turkey-longbranch", name: "Wild Turkey Longbranch", abv: 43, price: 40, rarity: "common", rarityScore: 14, description: "Matthew McConaughey collab. Refined with oak and mesquite charcoal." },
        { id: "wild-turkey-diamond", name: "Wild Turkey Diamond Anniversary", abv: 52, price: 300, rarity: "rare", rarityScore: 74, description: "Master Distiller Jimmy Russell's diamond anniversary expression." },
      ]},
      { id: "russells-reserve", name: "Russell's Reserve", bottles: [
        { id: "russells-10", name: "Russell's Reserve 10 Year", age: 10, abv: 45, price: 40, rarity: "common", rarityScore: 18, description: "Eddie Russell's flagship. Rich vanilla and toasted oak." },
        { id: "russells-6-rye", name: "Russell's Reserve 6 Year Rye", age: 6, abv: 45, price: 40, rarity: "common", rarityScore: 20, description: "Spicy, full-bodied rye. Earthy and complex." },
        { id: "russells-single-barrel", name: "Russell's Reserve Single Barrel", abv: 55, price: 60, rarity: "limited", rarityScore: 52, description: "Single barrel bottling. Caramel and charred oak." },
        { id: "russells-2002", name: "Russell's Reserve 2002 Vintage", age: 17, abv: 55, price: 500, rarity: "unicorn", rarityScore: 93, description: "A legendary vintage expression from Eddie Russell. Rare and exceptional." },
      ]},
    ],
  },
  {
    id: "four-roses", name: "Four Roses Distillery",
    country: "USA", region: "Lawrenceburg, KY", isNDP: false,
    subBrands: [
      { id: "four-roses-core", name: "Four Roses", bottles: [
        { id: "four-roses-yellow", name: "Four Roses Yellow Label", abv: 40, price: 25, rarity: "common", rarityScore: 8, description: "Smooth and fruity entry-level bourbon. Great for cocktails." },
        { id: "four-roses-small-batch", name: "Four Roses Small Batch", abv: 45, price: 35, rarity: "common", rarityScore: 15, description: "Blend of four OBSV and OBSK recipes. Balanced and floral." },
        { id: "four-roses-small-batch-select", name: "Four Roses Small Batch Select", abv: 52, price: 55, rarity: "limited", rarityScore: 45, description: "Six recipe blend at 104 proof. Bold and richly layered." },
        { id: "four-roses-single-barrel", name: "Four Roses Single Barrel", abv: 50, price: 45, rarity: "common", rarityScore: 20, description: "OBSV recipe. Fruity, spicy, and full-bodied." },
      ]},
      { id: "four-roses-limited", name: "Four Roses Limited", bottles: [
        { id: "four-roses-limited-edition-sb", name: "Four Roses Limited Edition Single Barrel", abv: 56, price: 150, rarity: "rare", rarityScore: 72, description: "Annual limited release single barrel. The best the distillery has to offer." },
        { id: "four-roses-elliot-wright", name: "Four Roses Elliott's Select", abv: 53, price: 80, rarity: "limited", rarityScore: 60, description: "Distillery-only private selection. Exceptionally smooth." },
      ]},
    ],
  },
  {
    id: "brown-forman", name: "Brown-Forman",
    country: "USA", region: "Louisville, KY", isNDP: false,
    subBrands: [
      { id: "woodford-reserve", name: "Woodford Reserve", bottles: [
        { id: "woodford-reserve-bourbon", name: "Woodford Reserve Bourbon", abv: 43.2, price: 40, rarity: "common", rarityScore: 10, description: "Triple-distilled in pot stills. Dried fruit, vanilla, and rich spice." },
        { id: "woodford-reserve-double-oaked", name: "Woodford Reserve Double Oaked", abv: 43.2, price: 55, rarity: "common", rarityScore: 20, description: "Finished in heavily toasted new oak. Lush caramel and toffee." },
        { id: "woodford-reserve-masters-collection", name: "Woodford Reserve Master's Collection", abv: 45, price: 120, rarity: "rare", rarityScore: 68, description: "Annual release exploring unique production methods." },
      ]},
      { id: "old-forester", name: "Old Forester", bottles: [
        { id: "old-forester-86", name: "Old Forester 86 Proof", abv: 43, price: 22, rarity: "common", rarityScore: 8, description: "America's first bottled bourbon. Classic and dependable." },
        { id: "old-forester-100", name: "Old Forester 100 Proof Bottled-in-Bond", abv: 50, price: 28, rarity: "common", rarityScore: 12, description: "BIB expression. Bold and spicy with great value." },
        { id: "old-forester-1920", name: "Old Forester 1920 Prohibition Style", abv: 57.5, price: 55, rarity: "limited", rarityScore: 50, description: "High-proof homage to Prohibition-era bourbon. Rich and intense." },
        { id: "old-forester-birthday", name: "Old Forester Birthday Bourbon", abv: 48, price: 150, rarity: "rare", rarityScore: 73, description: "Annual September release. Exceptional aged expressions." },
      ]},
      { id: "jack-daniels", name: "Jack Daniel's", bottles: [
        { id: "jack-daniels-old-no-7", name: "Jack Daniel's Old No. 7", abv: 40, price: 25, rarity: "common", rarityScore: 5, description: "The world's best-selling American whiskey. Charcoal-mellowed Tennessee." },
        { id: "jack-daniels-single-barrel", name: "Jack Daniel's Single Barrel Select", abv: 47, price: 55, rarity: "common", rarityScore: 18, description: "Top-barrel selections. Richer and more complex than the standard." },
        { id: "jack-daniels-triple-mash", name: "Jack Daniel's Triple Mash", abv: 50, price: 45, rarity: "limited", rarityScore: 38, description: "A blend of three mash bills. Unique and layered." },
      ]},
    ],
  },
  {
    id: "beam-suntory", name: "Beam Suntory",
    country: "USA", region: "Clermont, KY", isNDP: false,
    subBrands: [
      { id: "knob-creek", name: "Knob Creek", bottles: [
        { id: "knob-creek-9", name: "Knob Creek 9 Year", age: 9, abv: 50, price: 40, rarity: "common", rarityScore: 15, description: "Flagship small batch. Full-bodied, oaky, and smooth." },
        { id: "knob-creek-12", name: "Knob Creek 12 Year", age: 12, abv: 50, price: 55, rarity: "limited", rarityScore: 48, description: "Extended age adds complexity. Dense oak and caramel." },
        { id: "knob-creek-single-barrel", name: "Knob Creek Single Barrel Reserve", abv: 60, price: 60, rarity: "limited", rarityScore: 52, description: "Barrel-strength single barrel. Massive and robust." },
      ]},
      { id: "bookers", name: "Booker's", bottles: [
        { id: "bookers-bourbon", name: "Booker's Bourbon", abv: 63, price: 90, rarity: "limited", rarityScore: 55, description: "Uncut and unfiltered straight from the barrel. Booker Noe's legacy." },
        { id: "bookers-25th", name: "Booker's 25th Anniversary", abv: 63, price: 300, rarity: "rare", rarityScore: 78, description: "Special anniversary release celebrating Jim Beam's heritage." },
      ]},
      { id: "basil-haydens", name: "Basil Hayden's", bottles: [
        { id: "basil-haydens-bourbon", name: "Basil Hayden's Bourbon", abv: 40, price: 40, rarity: "common", rarityScore: 12, description: "High-rye mash bill. Light and spicy with broad appeal." },
        { id: "basil-haydens-dark-rye", name: "Basil Hayden's Dark Rye", abv: 40, price: 45, rarity: "common", rarityScore: 15, description: "Blended with Quebec rye and port. Unique and approachable." },
      ]},
      { id: "bakers", name: "Baker's", bottles: [
        { id: "bakers-7", name: "Baker's 7 Year", age: 7, abv: 53.5, price: 55, rarity: "limited", rarityScore: 42, description: "Single barrel, 7-year aged. Rich and complex with great structure." },
      ]},
    ],
  },
  {
    id: "michters", name: "Michter's Distillery",
    country: "USA", region: "Louisville, KY", isNDP: false,
    subBrands: [
      { id: "michters-us1", name: "Michter's US*1", bottles: [
        { id: "michters-us1-bourbon", name: "Michter's US*1 Bourbon", abv: 45.7, price: 50, rarity: "limited", rarityScore: 42, description: "Single barrel American bourbon. Warm, approachable, and refined." },
        { id: "michters-us1-rye", name: "Michter's US*1 Rye", abv: 42.4, price: 50, rarity: "limited", rarityScore: 42, description: "Single barrel straight rye. Spicy and complex." },
        { id: "michters-us1-sour-mash", name: "Michter's US*1 Sour Mash", abv: 43, price: 50, rarity: "limited", rarityScore: 40, description: "Classic American sour mash. Balanced and earthy." },
        { id: "michters-us1-american", name: "Michter's US*1 American Whiskey", abv: 41.7, price: 45, rarity: "limited", rarityScore: 38, description: "Unaged American whiskey. Light and approachable." },
      ]},
      { id: "michters-aged", name: "Michter's Aged Expressions", bottles: [
        { id: "michters-10", name: "Michter's 10 Year Bourbon", age: 10, abv: 47.2, price: 150, rarity: "rare", rarityScore: 72, description: "Annual limited release. Silky and complex with deep fruit notes." },
        { id: "michters-20", name: "Michter's 20 Year Bourbon", age: 20, abv: 57.1, price: 800, rarity: "unicorn", rarityScore: 94, description: "Exceptionally rare. Dense and layered with ancient character." },
        { id: "michters-25", name: "Michter's 25 Year Bourbon", age: 25, abv: 58.4, price: 3000, rarity: "unicorn", rarityScore: 99, description: "Perhaps the rarest bourbon released annually. A profound experience." },
      ]},
      { id: "michters-toasted", name: "Michter's Toasted Barrel", bottles: [
        { id: "michters-toasted-bourbon", name: "Michter's Toasted Barrel Bourbon", abv: 45.7, price: 80, rarity: "rare", rarityScore: 65, description: "Finished in toasted barrels. Caramel and baking spices amplified." },
        { id: "michters-toasted-sour-mash", name: "Michter's Toasted Barrel Sour Mash", abv: 43, price: 80, rarity: "rare", rarityScore: 63, description: "Sour mash finished in toasted oak. Distinctive and warming." },
      ]},
    ],
  },
  {
    id: "high-west", name: "High West Distillery",
    country: "USA", region: "Park City, UT", isNDP: true,
    subBrands: [
      { id: "high-west-core", name: "High West", bottles: [
        { id: "high-west-american-prairie", name: "High West American Prairie", abv: 46, price: 35, rarity: "common", rarityScore: 15, description: "Blended bourbon from multiple sources. Approachable and food-friendly." },
        { id: "high-west-double-rye", name: "High West Double Rye!", abv: 46, price: 35, rarity: "common", rarityScore: 18, description: "Blend of 2-year and 16-year rye. Spicy and fruity." },
        { id: "high-west-rendezvous-rye", name: "High West Rendezvous Rye", abv: 46, price: 50, rarity: "limited", rarityScore: 45, description: "A well-crafted blend of straight ryes. Rich and layered." },
        { id: "high-west-yippee-ki-yay", name: "High West Yippee Ki Yay", abv: 46, price: 80, rarity: "rare", rarityScore: 65, description: "Rye whiskey finished in Syrah, Petite Sirah, and French oak barrels." },
        { id: "high-west-campfire", name: "High West Campfire", abv: 46, price: 60, rarity: "limited", rarityScore: 52, description: "Unique blend of Bourbon, Rye, and Scotch. Smoky and adventurous." },
      ]},
    ],
  },
  {
    id: "willett", name: "Willett Distillery",
    country: "USA", region: "Bardstown, KY", isNDP: false,
    subBrands: [
      { id: "willett-core", name: "Willett", bottles: [
        { id: "willett-pot-still-reserve", name: "Willett Pot Still Reserve", abv: 47, price: 45, rarity: "limited", rarityScore: 42, description: "The iconic pot still bottle. Fruity and approachable." },
        { id: "willett-family-estate-4", name: "Willett Family Estate 4 Year Rye", age: 4, abv: 55, price: 60, rarity: "limited", rarityScore: 50, description: "Young and spicy pot-still rye. Distilled in-house." },
        { id: "willett-family-estate-bourbon", name: "Willett Family Estate Bourbon", abv: 55, price: 100, rarity: "rare", rarityScore: 68, description: "Single barrel estate bourbon. Each barrel is unique and exceptional." },
        { id: "johnny-drum-private-stock", name: "Johnny Drum Private Stock", abv: 50, price: 35, rarity: "common", rarityScore: 18, description: "A classic Willett label. Rich and warming Kentucky straight bourbon." },
        { id: "old-bardstown-estate-bottled", name: "Old Bardstown Estate Bottled", abv: 50.5, price: 40, rarity: "limited", rarityScore: 38, description: "Estate-distilled expression. Full-bodied with wood spice." },
      ]},
    ],
  },
  {
    id: "angels-envy", name: "Angel's Envy Distillery",
    country: "USA", region: "Louisville, KY", isNDP: true,
    subBrands: [
      { id: "angels-envy-core", name: "Angel's Envy", bottles: [
        { id: "angels-envy-bourbon", name: "Angel's Envy Bourbon", abv: 43.3, price: 50, rarity: "limited", rarityScore: 40, description: "Finished in port wine barrels. Smooth with fruit and caramel." },
        { id: "angels-envy-rye", name: "Angel's Envy Rye", abv: 50, price: 80, rarity: "rare", rarityScore: 65, description: "Finished in Caribbean rum casks. Rich and spicy with tropical notes." },
        { id: "angels-envy-cask-strength", name: "Angel's Envy Cask Strength", abv: 59, price: 180, rarity: "allocated", rarityScore: 82, description: "Annual cask-strength port finish. The pinnacle of the Angel's Envy lineup." },
      ]},
    ],
  },
  {
    id: "bardstown-bourbon", name: "Bardstown Bourbon Company",
    country: "USA", region: "Bardstown, KY", isNDP: true,
    subBrands: [
      { id: "bardstown-collaborative", name: "Bardstown Collaborative Series", bottles: [
        { id: "bardstown-collaborative-phifer", name: "Collaborative Series: Phifer Pavitt", abv: 48.975, price: 100, rarity: "rare", rarityScore: 70, description: "Bourbon finished in Napa Valley Cabernet Sauvignon barrels." },
        { id: "bardstown-collaborative-prisoner", name: "Collaborative Series: The Prisoner", abv: 49.1, price: 100, rarity: "rare", rarityScore: 68, description: "Finished in Prisoner Wine Company barrels. Fruity and rich." },
        { id: "bardstown-collaborative-ferrand", name: "Collaborative Series: Ferrand Cognac", abv: 49.35, price: 90, rarity: "rare", rarityScore: 66, description: "Finished in Pierre Ferrand Cognac casks. Elegant and complex." },
      ]},
      { id: "bardstown-origin", name: "Bardstown Origin Series", bottles: [
        { id: "bardstown-origin-kentucky", name: "Origin Series: Kentucky Straight Bourbon", abv: 47, price: 45, rarity: "limited", rarityScore: 40, description: "In-house distilled Kentucky straight bourbon." },
        { id: "bardstown-origin-rye", name: "Origin Series: Kentucky Straight Rye", abv: 47, price: 45, rarity: "limited", rarityScore: 40, description: "In-house distilled Kentucky straight rye. Spicy and earthy." },
      ]},
    ],
  },
] as const;

// ── Seed function ─────────────────────────────────────────────────────────────

async function seed() {
  let brandCount = 0, subBrandCount = 0, bottleCount = 0;

  for (const brand of WHISKEY_DATA) {
    const { error: be } = await supabase.from("brands").upsert({
      id: brand.id,
      name: brand.name,
      country: brand.country,
      region: brand.region,
      is_ndp: brand.isNDP,
    });
    if (be) { console.error(`  ✗ Brand ${brand.name}:`, be.message); continue; }
    brandCount++;

    for (const sub of brand.subBrands) {
      const { error: se } = await supabase.from("sub_brands").upsert({
        id: sub.id,
        brand_id: brand.id,
        name: sub.name,
      });
      if (se) { console.error(`  ✗ Sub-brand ${sub.name}:`, se.message); continue; }
      subBrandCount++;

      for (const bottle of sub.bottles) {
        const { error: bte } = await supabase.from("bottles").upsert({
          id: bottle.id,
          sub_brand_id: sub.id,
          name: bottle.name,
          price: "price" in bottle ? bottle.price : null,
          abv: "abv" in bottle ? bottle.abv : null,
          age: "age" in bottle ? bottle.age : null,
          rarity: "rarity" in bottle ? bottle.rarity : null,
          rarity_score: "rarityScore" in bottle ? bottle.rarityScore : null,
          description: "description" in bottle ? bottle.description : null,
          source_distillery: "sourceDistillery" in bottle ? (bottle as { sourceDistillery?: string }).sourceDistillery ?? null : null,
          entry_source: "official",
        });
        if (bte) { console.error(`  ✗ Bottle ${bottle.name}:`, bte.message); continue; }
        bottleCount++;
      }
    }
  }

  console.log(`\n✅ Seeded: ${brandCount} brands, ${subBrandCount} sub-brands, ${bottleCount} bottles`);
}

seed().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
