import {
  fetchAllAverageRatings,
  fetchApprovedSubmissions,
  fetchCatalog,
  fetchRatingSourceCounts,
} from "@/lib/supabase";
import { MIN_RATINGS_TO_RANK, type Rating } from "@/lib/ratings";
import { mergeApprovedSubmissions } from "@/lib/mergeSubmissions";
import { mergeCatalog } from "@/lib/mergeCatalog";
import type { Bottle, Brand, SubBrand } from "@/types/whiskey";

/**
 * Server-side view of the full catalog — the same merge of Supabase + static
 * data + approved community submissions that the explorer builds in the
 * browser, so the crawlable pages and the sitemap cover every distillery and
 * bottle a visitor can see (not just the ones in whiskeys.ts).
 */

export { MIN_RATINGS_TO_RANK };
export type { Rating };

export interface BottleEntry {
  bottle: Bottle;
  subBrand: SubBrand;
  brand: Brand;
  rating?: Rating;
  /** URL segment — see slugFor(). */
  slug: string;
  /** "/bottles/<slug>" */
  path: string;
  /** "/brands/<slug>" of the producing brand */
  brandPath: string;
}

export interface Catalog {
  brands: Brand[];
  bottles: BottleEntry[];
  /** Keyed by URL slug. */
  brandBySlug: Map<string, Brand>;
  bottleBySlug: Map<string, BottleEntry>;
  /**
   * Slugs of duplicate catalog rows → the entry that represents them, so one
   * bottle only ever has one canonical URL.
   */
  bottleAliases: Map<string, BottleEntry>;
  /** Keyed by catalog id. */
  bottleById: Map<string, BottleEntry>;
  /** brand id → its bottles, in catalog order */
  brandBottles: Map<string, BottleEntry[]>;
  /** brand id → "/brands/<slug>" */
  brandPaths: Map<string, string>;
  /** Keyed by catalog id (the explorer links by id; slugs can differ). */
  brandById: Map<string, Brand>;
  ratings: Record<string, Rating>;
  /**
   * Total ratings, and how many were imported from public Reddit reviews
   * rather than entered here. Null when the counts couldn't be loaded.
   */
  ratingSources: { total: number; imported: number } | null;
  /** Bottles with enough ratings to rank, best first. */
  ranked: BottleEntry[];
}

/** How long one server instance reuses a loaded catalog. */
const TTL_MS = 10 * 60 * 1000;

let cached: { at: number; value: Promise<Catalog> } | null = null;

const SLUG_SAFE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-/;

export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’.]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Catalog ids written by hand ("eagle-rare-10") are already good URL slugs and
 * are used as-is, so existing URLs never change. Community submissions get
 * database UUIDs as ids; those are given a readable slug built from the name.
 */
function isHandWrittenId(id: string): boolean {
  return SLUG_SAFE.test(id) && !UUID_LIKE.test(id);
}

function claimSlug(id: string, readable: string, taken: Set<string>): string {
  if (isHandWrittenId(id)) return id;
  const base = slugify(readable) || slugify(id) || "item";
  let slug = base;
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
  taken.add(slug);
  return slug;
}

async function load(): Promise<Catalog> {
  let brands: Brand[];
  let ratings: Record<string, Rating> = {};
  let ratingSources: Catalog["ratingSources"] = null;
  try {
    const [ratingsData, approvedSubs, catalogData, sources] = await Promise.all([
      fetchAllAverageRatings(),
      fetchApprovedSubmissions(),
      fetchCatalog(),
      fetchRatingSourceCounts().catch(() => null),
    ]);
    ratings = ratingsData;
    ratingSources = sources;
    const base = mergeCatalog(catalogData);
    brands = approvedSubs.length > 0 ? mergeApprovedSubmissions(base, approvedSubs) : base;
  } catch {
    // Supabase unreachable or not configured — the static catalog still builds.
    brands = mergeCatalog(null);
  }

  const bottles: BottleEntry[] = [];
  const brandBySlug = new Map<string, Brand>();
  const bottleBySlug = new Map<string, BottleEntry>();
  const bottleById = new Map<string, BottleEntry>();
  const brandPaths = new Map<string, string>();
  const brandById = new Map<string, Brand>();
  const bottleAliases = new Map<string, BottleEntry>();

  // Hand-written ids claim their slugs first, so a community entry can never
  // take the URL of a curated one.
  const brandSlugsTaken = new Set(brands.map((b) => b.id).filter(isHandWrittenId));
  const bottleSlugsTaken = new Set(
    brands
      .flatMap((b) => b.subBrands.flatMap((sb) => sb.bottles.map((bt) => bt.id)))
      .filter(isHandWrittenId)
  );

  for (const brand of brands) {
    const brandSlug = claimSlug(brand.id, brand.name, brandSlugsTaken);
    if (brandBySlug.has(brandSlug)) continue;
    brandBySlug.set(brandSlug, brand);
    brandById.set(brand.id, brand);
    const brandPath = `/brands/${brandSlug}`;
    brandPaths.set(brand.id, brandPath);

    // The same bottle is sometimes in the catalog twice under two ids (once
    // from whiskeys.ts, once from Supabase). Publishing both would give Google
    // two near-identical pages, so keep the row people have actually rated and
    // point the other id at it.
    const byName = new Map<string, BottleEntry>();

    for (const subBrand of brand.subBrands) {
      for (const bottle of subBrand.bottles) {
        if (bottleById.has(bottle.id)) continue;
        const readable = bottle.name.toLowerCase().startsWith(brand.name.toLowerCase().split(" ")[0])
          ? bottle.name
          : `${brand.name} ${bottle.name}`;
        const slug = claimSlug(bottle.id, readable, bottleSlugsTaken);
        const entry: BottleEntry = {
          bottle,
          subBrand,
          brand,
          rating: ratings[bottle.id],
          slug,
          path: `/bottles/${slug}`,
          brandPath,
        };
        bottleById.set(bottle.id, entry);

        const nameKey = bottle.name.trim().toLowerCase();
        const twin = byName.get(nameKey);
        if (!twin) {
          byName.set(nameKey, entry);
          bottles.push(entry);
          bottleBySlug.set(slug, entry);
        } else if ((entry.rating?.count ?? 0) > (twin.rating?.count ?? 0)) {
          // This row is the rated one — it takes the twin's place.
          bottles[bottles.indexOf(twin)] = entry;
          bottleBySlug.delete(twin.slug);
          bottleBySlug.set(slug, entry);
          bottleAliases.set(twin.slug, entry);
          for (const [alias, target] of bottleAliases) if (target === twin) bottleAliases.set(alias, entry);
          byName.set(nameKey, entry);
        } else {
          bottleAliases.set(slug, twin);
        }
      }
    }
  }

  const brandBottles = new Map<string, BottleEntry[]>();
  for (const entry of bottles) {
    if (!brandBottles.has(entry.brand.id)) brandBottles.set(entry.brand.id, []);
    brandBottles.get(entry.brand.id)!.push(entry);
  }

  const ranked = bottles
    .filter((e) => (e.rating?.count ?? 0) >= MIN_RATINGS_TO_RANK)
    .sort(
      (a, b) =>
        b.rating!.avg - a.rating!.avg ||
        b.rating!.count - a.rating!.count ||
        a.bottle.name.localeCompare(b.bottle.name)
    );

  return { brands, bottles, brandBySlug, bottleBySlug, bottleAliases, bottleById, brandBottles, brandPaths, brandById, ratings, ratingSources, ranked };
}

export function getCatalog(): Promise<Catalog> {
  const now = Date.now();
  if (cached && now - cached.at < TTL_MS) return cached.value;
  const value = load();
  cached = { at: now, value };
  // Never keep a rejected promise around.
  value.catch(() => {
    if (cached?.value === value) cached = null;
  });
  return value;
}

// ── URL + formatting helpers shared by the catalog pages ─────────────────────

/** Route params may arrive percent-encoded; slugs are stored decoded. */
export function decodeSlug(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** Bottles a brand has pages for (duplicate rows collapsed). */
export function bottleCount(catalog: Catalog, brand: Brand): number {
  return catalog.brandBottles.get(brand.id)?.length ?? 0;
}

/**
 * A bottle's name with its producer appended when the name alone doesn't say
 * who makes it ("Toasted Bourbon" → "Toasted Bourbon by Kentucky Peerless").
 */
export function qualifiedName(entry: BottleEntry): string {
  const { bottle, brand } = entry;
  const lead = brand.name.toLowerCase().split(/[\s-]/)[0].replace(/[^a-z0-9]/g, "");
  const flat = bottle.name.toLowerCase().replace(/[^a-z0-9 ]/g, "");
  return lead && flat.includes(lead) ? bottle.name : `${bottle.name} by ${brand.name}`;
}

export function proofOf(abv: number): number {
  return Math.round(abv * 2 * 10) / 10;
}

export const RARITY_LABEL: Record<string, string> = {
  common: "Common",
  limited: "Limited",
  rare: "Rare",
  allocated: "Allocated",
  unicorn: "Unicorn",
};

export const AVAILABILITY_LABEL: Record<string, string> = {
  current: "In production",
  limited_release: "Limited release",
  discontinued: "Discontinued",
};
