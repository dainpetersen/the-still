import { WHISKEY_DATA } from "@/data/whiskeys";
import type { Brand, WhiskeyStyle } from "@/types/whiskey";

/**
 * Combining the Supabase catalog with the static catalog in whiskeys.ts.
 *
 * Shared by the explorer (client) and the crawlable pages (server) so both
 * always describe the same set of distilleries and bottles.
 */

// Supabase brand IDs that are duplicates/typos consolidated into static data
const DEPRECATED_CATALOG_IDS = new Set(["new-rifff", "new-riff"]);

const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi",
  MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire",
  NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina",
  ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee",
  TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
  WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", DC: "District of Columbia",
};
const STATE_NAME_SET = new Set(Object.values(STATE_NAMES));

/** "Louisville, KY" → "Kentucky"; "Colorado" → "Colorado"; otherwise undefined. */
export function stateFromRegion(region?: string): string | undefined {
  if (!region) return undefined;
  const last = region.split(",").pop()!.trim();
  if (STATE_NAMES[last.toUpperCase()]) return STATE_NAMES[last.toUpperCase()];
  if (STATE_NAME_SET.has(last)) return last;
  return undefined;
}

/**
 * The Supabase catalog has no style / state / description columns for older
 * rows, so fill those in from the static data (and derive state from the
 * region for brands that only exist in Supabase).
 */
export function enrichCatalogStyles(catalog: Brand[]): Brand[] {
  const styleMap = new Map<string, WhiskeyStyle>();
  const stateMap = new Map<string, string>();
  const descriptionMap = new Map<string, string>();
  for (const brand of WHISKEY_DATA) {
    if (brand.state) stateMap.set(brand.id, brand.state);
    if (brand.description) descriptionMap.set(brand.id, brand.description);
    for (const sb of brand.subBrands) {
      for (const bt of sb.bottles) {
        if (bt.style) styleMap.set(bt.id, bt.style);
      }
    }
  }
  return catalog.map((brand) => ({
    ...brand,
    state: brand.state ?? stateMap.get(brand.id) ?? stateFromRegion(brand.region),
    description: brand.description ?? descriptionMap.get(brand.id),
    subBrands: brand.subBrands.map((sb) => ({
      ...sb,
      bottles: sb.bottles.map((bt) => ({
        ...bt,
        style: bt.style ?? styleMap.get(bt.id),
      })),
    })),
  }));
}

/**
 * Use the Supabase catalog as the base (enriched with static style/state),
 * then merge in any static sub-brands/bottles not yet in Supabase so that new
 * entries in whiskeys.ts always appear even for brands already in the catalog.
 * With no Supabase catalog, the static data is returned as-is.
 */
export function mergeCatalog(catalogData: Brand[] | null): Brand[] {
  if (!catalogData) return WHISKEY_DATA;

  const enriched = enrichCatalogStyles(catalogData).filter(
    (b) => !DEPRECATED_CATALOG_IDS.has(b.id)
  );
  const catalogBrandMap = new Map(enriched.map((b) => [b.id, b]));
  // IDs of static top-level brands — used to skip Supabase sub-brands whose
  // ID collides with a standalone static brand (e.g. Supabase "makers-mark"
  // sub-brand under beam-suntory vs static "makers-mark" top-level brand).
  const staticTopLevelBrandIds = new Set(WHISKEY_DATA.map((b) => b.id));

  const merged = WHISKEY_DATA.map((staticBrand) => {
    const catalogBrand = catalogBrandMap.get(staticBrand.id);
    if (!catalogBrand) return staticBrand; // brand only in static data, use as-is

    // Brand exists in both — merge sub-brands: use catalog version but add
    // any static sub-brands/bottles not present in the catalog.
    // Two-pass to prevent duplicates when static/Supabase use different sub-brand IDs
    // for the same bottles (e.g. static "stagg-jr-sub" vs Supabase "stagg").
    const catalogSubMap = new Map(catalogBrand.subBrands.map((sb) => [sb.id, sb]));

    // Pass 1: merge sub-brands that have a catalog match (catalog wins for metadata)
    const matchedSubBrands = staticBrand.subBrands
      .filter((staticSub) => catalogSubMap.has(staticSub.id))
      .map((staticSub) => {
        const catalogSub = catalogSubMap.get(staticSub.id)!;
        const catalogBottleIds = new Set(catalogSub.bottles.map((b) => b.id));
        const staticOnlyBottles = staticSub.bottles.filter((b) => !catalogBottleIds.has(b.id));
        return { ...catalogSub, bottles: [...catalogSub.bottles, ...staticOnlyBottles] };
      });

    // Pass 2: add static-only sub-brands, excluding bottles already merged above
    const matchedBottleIds = new Set(matchedSubBrands.flatMap((sb) => sb.bottles.map((b) => b.id)));
    const staticOnlySubBrands = staticBrand.subBrands
      .filter((staticSub) => !catalogSubMap.has(staticSub.id))
      .map((staticSub) => ({
        ...staticSub,
        bottles: staticSub.bottles.filter((b) => !matchedBottleIds.has(b.id)),
      }))
      .filter((sb) => sb.bottles.length > 0);

    const mergedSubBrands = [...matchedSubBrands, ...staticOnlySubBrands];

    // Add catalog-only sub-brands, excluding bottles already covered
    const staticSubIds = new Set(staticBrand.subBrands.map((sb) => sb.id));
    const mergedBottleIds = new Set(mergedSubBrands.flatMap((sb) => sb.bottles.map((b) => b.id)));
    const catalogOnlySubs = catalogBrand.subBrands
      .filter((sb) => !staticSubIds.has(sb.id) && !staticTopLevelBrandIds.has(sb.id))
      .map((sb) => ({ ...sb, bottles: sb.bottles.filter((b) => !mergedBottleIds.has(b.id)) }))
      .filter((sb) => sb.bottles.length > 0);

    return { ...catalogBrand, subBrands: [...mergedSubBrands, ...catalogOnlySubs] };
  });

  // Also include any catalog brands not in static data
  const staticBrandIds = new Set(WHISKEY_DATA.map((b) => b.id));
  const catalogOnlyBrands = enriched.filter((b) => !staticBrandIds.has(b.id));
  const allBrands = [...merged, ...catalogOnlyBrands];

  // Global deduplication: ensure no bottle ID appears more than once across all brands.
  // This catches any edge cases the per-brand merge logic didn't handle.
  const seenBottleIds = new Set<string>();
  return allBrands
    .map((brand) => ({
      ...brand,
      subBrands: brand.subBrands
        .map((sub) => ({
          ...sub,
          bottles: sub.bottles.filter((b) => {
            if (seenBottleIds.has(b.id)) return false;
            seenBottleIds.add(b.id);
            return true;
          }),
        }))
        .filter((sub) => sub.bottles.length > 0),
    }))
    .filter((brand) => brand.subBrands.length > 0);
}
