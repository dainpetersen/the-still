import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  AVAILABILITY_LABEL,
  MIN_RATINGS_TO_RANK,
  RARITY_LABEL,
  bottleCount,
  decodeSlug,
  getCatalog,
  proofOf,
  type BottleEntry,
  type Catalog,
} from "@/lib/catalog";
import { stateFromRegion } from "@/lib/mergeCatalog";
import { OG_IMAGES, absoluteUrl } from "@/lib/site";
import type { Brand, WhiskeyStyle } from "@/types/whiskey";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import Breadcrumbs from "@/components/site/Breadcrumbs";
import RatingBadge from "@/components/site/RatingBadge";

// Rebuild at most hourly so ratings and catalog edits appear without a deploy;
// distilleries added after the build render on first request.
export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  const { brandBySlug } = await getCatalog();
  return [...brandBySlug.keys()].map((id) => ({ id }));
}

type Params = { params: Promise<{ id: string }> };

async function findBrand(params: Params["params"]): Promise<{ catalog: Catalog; brand?: Brand; path: string }> {
  const { id } = await params;
  const slug = decodeSlug(id);
  const catalog = await getCatalog();
  // The explorer links by catalog id, which for community entries isn't the
  // slug; resolve those too and report the slug URL as canonical.
  const brand = catalog.brandBySlug.get(slug) ?? catalog.brandById.get(slug);
  return { catalog, brand, path: brand ? catalog.brandPaths.get(brand.id)! : `/brands/${slug}` };
}

function stylesOf(brand: Brand): WhiskeyStyle[] {
  return [
    ...new Set(
      brand.subBrands.flatMap((sb) => sb.bottles.map((b) => b.style)).filter((s): s is WhiskeyStyle => Boolean(s))
    ),
  ];
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { catalog, brand, path } = await findBrand(params);
  if (!brand) return {};

  const count = bottleCount(catalog, brand);
  const styles = stylesOf(brand).join(", ");
  const description = `Every ${brand.name} bottle in one place: ${count} ${count === 1 ? "expression" : "expressions"} from ${brand.region || "the USA"}${styles ? ` (${styles})` : ""}, with proof, age, suggested retail price, rarity and community ratings.`;

  return {
    title: `${brand.name} — Bottles, Prices & Ratings`,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: `${brand.name} | Common Cask`,
      description,
      url: absoluteUrl(path),
      type: "website",
      images: OG_IMAGES,
    },
  };
}

// ── Style accent colours ──────────────────────────────────────────────────────
const STYLE_ACCENT: Record<WhiskeyStyle, { badge: string; bar: string }> = {
  Bourbon: { badge: "bg-amber-800/10 text-amber-900 border-amber-700/30 dark:bg-amber-300/10 dark:text-amber-300 dark:border-amber-300/30", bar: "bg-amber-700 dark:bg-amber-400" },
  "Wheated Bourbon": { badge: "bg-yellow-800/10 text-yellow-900 border-yellow-700/30 dark:bg-yellow-300/10 dark:text-yellow-300 dark:border-yellow-300/30", bar: "bg-yellow-700 dark:bg-yellow-400" },
  "High Rye Bourbon": { badge: "bg-orange-800/10 text-orange-900 border-orange-700/30 dark:bg-orange-300/10 dark:text-orange-300 dark:border-orange-300/30", bar: "bg-orange-700 dark:bg-orange-400" },
  "Rye Whiskey": { badge: "bg-emerald-800/10 text-emerald-900 border-emerald-700/30 dark:bg-emerald-300/10 dark:text-emerald-300 dark:border-emerald-300/30", bar: "bg-emerald-700 dark:bg-emerald-400" },
  "Wheat Whiskey": { badge: "bg-lime-800/10 text-lime-900 border-lime-700/30 dark:bg-lime-300/10 dark:text-lime-300 dark:border-lime-300/30", bar: "bg-lime-700 dark:bg-lime-400" },
  "Tennessee Whiskey": { badge: "bg-sky-800/10 text-sky-900 border-sky-700/30 dark:bg-sky-300/10 dark:text-sky-300 dark:border-sky-300/30", bar: "bg-sky-700 dark:bg-sky-400" },
  "Blended American": { badge: "bg-violet-800/10 text-violet-900 border-violet-700/30 dark:bg-violet-300/10 dark:text-violet-300 dark:border-violet-300/30", bar: "bg-violet-700 dark:bg-violet-400" },
  "American Single Malt": { badge: "bg-teal-800/10 text-teal-900 border-teal-700/30 dark:bg-teal-300/10 dark:text-teal-300 dark:border-teal-300/30", bar: "bg-teal-700 dark:bg-teal-400" },
};
const FALLBACK_ACCENT = { badge: "bg-stone-400/10 text-stone-800 border-stone-500/30 dark:text-stone-300 dark:border-stone-400/30", bar: "bg-stone-500" };

// ── Bottle row ────────────────────────────────────────────────────────────────
function BottleRow({ entry }: { entry: BottleEntry }) {
  const { bottle, rating } = entry;
  const accent = bottle.style ? (STYLE_ACCENT[bottle.style] ?? FALLBACK_ACCENT) : FALLBACK_ACCENT;
  const meta = [
    bottle.abv > 0 ? `${proofOf(bottle.abv)} proof` : null,
    bottle.age ? `${bottle.age} yr` : "NAS",
    RARITY_LABEL[bottle.rarity] ?? bottle.rarity,
    bottle.availability && bottle.availability !== "current" ? AVAILABILITY_LABEL[bottle.availability] : null,
    bottle.sourceDistillery ? `via ${bottle.sourceDistillery}` : null,
  ].filter(Boolean);

  return (
    <li className="cc-row">
      <Link href={entry.path} className="flex items-start gap-4 py-4 px-2 -mx-2">
        <span aria-hidden="true" className={`mt-1 w-[3px] h-9 flex-shrink-0 rounded-full opacity-60 ${accent.bar}`} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[16px] font-medium leading-snug" style={{ color: "var(--ink)" }}>
              {bottle.name}
            </h3>
            {bottle.style && (
              <span className={`text-[11px] uppercase tracking-[0.08em] font-mono px-1.5 py-[2px] rounded-sm border ${accent.badge}`}>
                {bottle.style}
              </span>
            )}
          </div>
          <span className="block mt-1 font-mono text-[12px]" style={{ color: "rgb(var(--ink-rgb) / 0.6)" }}>
            {meta.join(" · ")}
          </span>
          {bottle.description && (
            <span
              className="cc-serif block mt-1 text-[14px] leading-relaxed line-clamp-2"
              style={{ color: "rgb(var(--ink-rgb) / 0.65)", fontStyle: "italic" }}
            >
              {bottle.description}
            </span>
          )}
        </div>

        <span className="flex flex-col items-end gap-1 flex-shrink-0 pt-0.5">
          <span className="font-mono tabular-nums text-[15px] font-semibold" style={{ color: "var(--ink)" }}>
            {bottle.price > 0 ? `$${bottle.price.toLocaleString("en-US")}` : "—"}
          </span>
          <RatingBadge rating={rating} />
        </span>
      </Link>
    </li>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function BrandPage({ params }: Params) {
  const { catalog, brand, path } = await findBrand(params);
  if (!brand) notFound();

  const entries = catalog.brandBottles.get(brand.id) ?? [];
  const total = entries.length;
  const state = brand.state ?? stateFromRegion(brand.region);
  const showSubBrandHeaders = brand.subBrands.length > 1;

  const prices = entries.map((e) => e.bottle.price).filter((p) => p > 0);
  const ranked = catalog.ranked.filter((e) => e.brand.id === brand.id);
  const best = ranked[0];
  const totalRatings = entries.reduce((sum, e) => sum + (e.rating?.count ?? 0), 0);

  // Other producers in the same state, for onward links.
  const neighbours = catalog.brands
    .filter((b) => b.id !== brand.id && (b.state ?? stateFromRegion(b.region)) === state && catalog.brandPaths.has(b.id))
    .sort((a, b) => bottleCount(catalog, b) - bottleCount(catalog, a))
    .slice(0, 8);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${brand.name} bottles`,
    numberOfItems: total,
    itemListElement: entries.map((e, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: e.bottle.name,
      url: absoluteUrl(e.path),
    })),
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)", color: "var(--ink)" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader />

      <main className="max-w-4xl mx-auto px-5 sm:px-8 pt-8">
        <Breadcrumbs currentPath={path} trail={[{ name: "Distilleries", path: "/brands" }, { name: brand.name }]} />

        <header className="pb-8" style={{ borderBottom: "1px solid rgb(var(--ink-rgb) / 0.15)" }}>
          <h1
            className="cc-serif leading-[1.05] tracking-tight"
            style={{ fontSize: "clamp(2.2rem, 5vw, 3.6rem)", fontWeight: 400, textWrap: "balance" }}
          >
            {brand.name}
          </h1>
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            {brand.region && (
              <p className="cc-serif text-[17px]" style={{ color: "rgb(var(--ink-rgb) / 0.65)", fontStyle: "italic" }}>
                {brand.region}
              </p>
            )}
            {brand.isNDP && (
              <span
                className="cc-mono-label px-1.5 py-0.5 rounded-sm"
                style={{ border: "1px solid rgb(var(--ink-rgb) / 0.25)" }}
                title="Non-distilling producer — bottles whiskey distilled elsewhere"
              >
                Non-distilling producer
              </span>
            )}
          </div>

          {brand.description && (
            <p className="cc-serif mt-6 max-w-2xl text-[17px] leading-[1.65]" style={{ color: "rgb(var(--ink-rgb) / 0.8)" }}>
              {brand.description}
            </p>
          )}

          <dl className="mt-7 flex flex-wrap gap-x-10 gap-y-4">
            <div>
              <dt className="cc-mono-label">Bottles</dt>
              <dd className="cc-serif text-[24px] mt-0.5">{total}</dd>
            </div>
            {prices.length > 0 && (
              <div>
                <dt className="cc-mono-label">Price range</dt>
                <dd className="cc-serif text-[24px] mt-0.5">
                  ${Math.min(...prices).toLocaleString("en-US")}
                  {Math.max(...prices) !== Math.min(...prices) ? `–$${Math.max(...prices).toLocaleString("en-US")}` : ""}
                </dd>
              </div>
            )}
            {totalRatings > 0 && (
              <div>
                <dt className="cc-mono-label">Community ratings</dt>
                <dd className="cc-serif text-[24px] mt-0.5">{totalRatings.toLocaleString("en-US")}</dd>
              </div>
            )}
            {best && (
              <div>
                <dt className="cc-mono-label">Highest rated</dt>
                <dd className="text-[16px] mt-1.5">
                  <Link href={best.path} className="cc-link">{best.bottle.name}</Link>{" "}
                  <span style={{ color: "var(--accent)" }} className="font-mono font-semibold">{best.rating!.avg.toFixed(1)}</span>
                </dd>
              </div>
            )}
          </dl>
        </header>

        <div className="flex flex-col gap-10 mt-8">
          {brand.subBrands.map((subBrand) => {
            const rows = entries.filter((e) => e.subBrand.id === subBrand.id);
            if (rows.length === 0) return null;
            return (
              <section key={subBrand.id}>
                {showSubBrandHeaders && (
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="cc-mono-label" style={{ fontSize: "12px", color: "rgb(var(--ink-rgb) / 0.7)" }}>
                      {subBrand.name}
                    </h2>
                    <span aria-hidden="true" className="flex-1 h-px" style={{ background: "rgb(var(--ink-rgb) / 0.12)" }} />
                    <span className="cc-mono-label" aria-label={`${rows.length} bottles`}>{rows.length}</span>
                  </div>
                )}
                <ul className="flex flex-col">
                  {rows.map((e) => (
                    <BottleRow key={e.bottle.id} entry={e} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>

        <p className="mt-6 text-[13px]" style={{ color: "var(--ink-muted)" }}>
          Prices are suggested retail. Ratings are out of 10, shown with the number of ratings; a bottle needs{" "}
          {MIN_RATINGS_TO_RANK} to be ranked. Most ratings are scores from public Reddit whiskey reviews.{" "}
          <Link href="/about#ratings" className="cc-link">How ratings work</Link>
        </p>

        {neighbours.length > 0 && (
          <section className="mt-14">
            <h2 className="cc-serif text-[24px]" style={{ fontWeight: 400 }}>
              More {state} producers
            </h2>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {neighbours.map((b) => (
                <li key={b.id}>
                  <Link href={catalog.brandPaths.get(b.id)!} className="cc-card flex items-baseline justify-between gap-3 rounded-sm px-4 py-3">
                    <span className="text-[15px]">{b.name}</span>
                    <span className="font-mono text-[12px]" style={{ color: "var(--ink-muted)" }}>
                      {bottleCount(catalog, b)} bottles
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[14px]">
              <Link href="/brands" className="cc-link">All distilleries →</Link>
            </p>
          </section>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
