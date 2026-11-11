import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  AVAILABILITY_LABEL,
  MIN_RATINGS_TO_RANK,
  RARITY_LABEL,
  decodeSlug,
  getCatalog,
  proofOf,
  qualifiedName,
  type BottleEntry,
  type Catalog,
} from "@/lib/catalog";
import { OG_IMAGES, absoluteUrl } from "@/lib/site";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import Breadcrumbs from "@/components/site/Breadcrumbs";
import RatingBadge from "@/components/site/RatingBadge";

// Rebuild each page at most hourly so new ratings and catalog edits show up
// without a deploy; bottles added after the build render on first request.
export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  const { bottles } = await getCatalog();
  return bottles.map((e) => ({ slug: e.slug }));
}

type Params = { params: Promise<{ slug: string }> };

async function findBottle(params: Params["params"]): Promise<{ catalog: Catalog; entry?: BottleEntry }> {
  const slug = decodeSlug((await params).slug);
  const catalog = await getCatalog();
  // A duplicate catalog row's slug shows the page of the bottle that represents
  // it; that page's canonical is its own URL, so the two are never indexed as
  // separate pages. (Nothing links to these slugs and they aren't in the sitemap.)
  return { catalog, entry: catalog.bottleBySlug.get(slug) ?? catalog.bottleAliases.get(slug) };
}

// ── Copy helpers ──────────────────────────────────────────────────────────────

function article(word: string): string {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}

function styleNoun(entry: BottleEntry): string {
  return entry.bottle.style ? entry.bottle.style.toLowerCase().replace("american", "American").replace("tennessee", "Tennessee") : "American whiskey";
}

function median(values: number[]): number | undefined {
  const v = values.filter((n) => n > 0).sort((a, b) => a - b);
  if (v.length === 0) return undefined;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

/** One factual sentence or two describing the bottle, built from its data. */
function summarize(entry: BottleEntry): string {
  const { bottle, brand } = entry;
  const noun = styleNoun(entry);
  const where = brand.region ? ` in ${brand.region}` : "";
  const sourced =
    bottle.sourceDistillery && bottle.sourceDistillery.toLowerCase() !== brand.name.toLowerCase()
      ? ` The whiskey is sourced from ${bottle.sourceDistillery}.`
      : "";
  const strength = bottle.abv > 0 ? ` It is bottled at ${proofOf(bottle.abv)} proof (${bottle.abv}% ABV)` : "";
  const age = bottle.age
    ? `${strength ? " and" : " It"} carries a ${bottle.age}-year age statement.`
    : strength
      ? " with no age statement."
      : "";
  const price = bottle.price > 0 ? ` Suggested retail is about $${bottle.price.toLocaleString("en-US")}.` : "";
  return `${bottle.name} is ${article(noun)} ${noun} from ${brand.name}${where}.${strength}${age}${sourced}${price}`;
}

/** How this bottle sits against the rest of its style — price, proof, rank. */
function comparisons(entry: BottleEntry, catalog: Catalog): string[] {
  const { bottle, brand } = entry;
  const out: string[] = [];
  const noun = styleNoun(entry);
  const peers = catalog.bottles.filter((e) => e.bottle.style === bottle.style && e.bottle.id !== bottle.id);

  if (bottle.style && peers.length >= 5) {
    const medPrice = median(peers.map((e) => e.bottle.price));
    if (medPrice && bottle.price > 0) {
      const ratio = bottle.price / medPrice;
      const price = `$${bottle.price.toLocaleString("en-US")}`;
      const versus = `the median ${noun} in the catalog ($${Math.round(medPrice)})`;
      if (ratio >= 2) {
        out.push(`At ${price}, it costs ${ratio.toFixed(1)} times ${versus}.`);
      } else if (Math.abs(ratio - 1) < 0.1) {
        out.push(`At ${price}, it is priced right around ${versus}.`);
      } else {
        const pct = Math.round(Math.abs(ratio - 1) * 100);
        out.push(`At ${price}, it is priced ${pct}% ${ratio < 1 ? "below" : "above"} ${versus}.`);
      }
    }
    const medAbv = median(peers.map((e) => e.bottle.abv));
    if (medAbv && bottle.abv > 0) {
      const delta = proofOf(bottle.abv) - proofOf(medAbv);
      if (Math.abs(delta) >= 4) {
        out.push(
          `At ${proofOf(bottle.abv)} proof it runs ${Math.abs(Math.round(delta))} proof points ${delta > 0 ? "hotter" : "lower"} than the typical ${noun} here (${proofOf(medAbv)} proof).`
        );
      }
    }
  }

  const rank = catalog.ranked.findIndex((e) => e.bottle.id === bottle.id);
  if (rank >= 0) {
    const brandRanked = catalog.ranked.filter((e) => e.brand.id === brand.id);
    const brandRank = brandRanked.findIndex((e) => e.bottle.id === bottle.id);
    out.push(
      `It ranks #${rank + 1} of ${catalog.ranked.length} rated bottles overall` +
        (brandRanked.length > 1 ? `, and #${brandRank + 1} of ${brandRanked.length} from ${brand.name}.` : ".")
    );
  }
  return out;
}

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { entry } = await findBottle(params);
  if (!entry) return {};
  const { bottle, brand, rating } = entry;

  const facts = [
    bottle.abv > 0 ? `${proofOf(bottle.abv)} proof` : null,
    bottle.age ? `${bottle.age} year` : null,
    bottle.price > 0 ? `$${bottle.price.toLocaleString("en-US")} MSRP` : null,
    rating && rating.count >= MIN_RATINGS_TO_RANK ? `rated ${rating.avg.toFixed(1)}/10 from ${rating.count} ratings` : null,
  ].filter(Boolean);
  const description = `${bottle.name} from ${brand.name}: ${facts.join(", ")}. Tasting notes, rarity, and similar ${styleNoun(entry)} bottles.`;
  // Search results cut titles at roughly 60 characters, so long names stand alone.
  const name = qualifiedName(entry);
  const title = name.length <= 42 ? `${name} — Proof, Price & Rating` : name;

  return {
    title,
    description,
    alternates: { canonical: entry.path },
    openGraph: {
      title: `${name} | Common Cask`,
      description,
      url: absoluteUrl(entry.path),
      type: "article",
      images: OG_IMAGES,
    },
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

function Spec({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-3" style={{ borderBottom: "1px solid rgba(13,11,8,0.1)" }}>
      <dt className="cc-mono-label">{label}</dt>
      <dd className="mt-1 text-[17px]" style={{ color: "#0d0b08" }}>{children}</dd>
    </div>
  );
}

function BottleLink({ entry, showBrand }: { entry: BottleEntry; showBrand?: boolean }) {
  const { bottle, brand, rating } = entry;
  return (
    <li>
      <Link href={entry.path} className="cc-card flex items-center gap-3 rounded-sm px-4 py-3 h-full">
        <span className="flex-1 min-w-0">
          <span className="block text-[15px] leading-snug" style={{ color: "#0d0b08" }}>{bottle.name}</span>
          <span className="block text-[13px] mt-0.5" style={{ color: "rgba(13,11,8,0.6)" }}>
            {[showBrand ? brand.name : null, bottle.abv > 0 ? `${proofOf(bottle.abv)} proof` : null, bottle.price > 0 ? `$${bottle.price.toLocaleString("en-US")}` : null]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
        <RatingBadge rating={rating} />
      </Link>
    </li>
  );
}

export default async function BottlePage({ params }: Params) {
  const { catalog, entry } = await findBottle(params);
  if (!entry) notFound();
  const { bottle, brand, subBrand, rating } = entry;

  const isRanked = (rating?.count ?? 0) >= MIN_RATINGS_TO_RANK;
  const notes = comparisons(entry, catalog);

  // Same distillery: the rest of this bottle's line first, then other lines.
  const siblings = catalog.bottles
    .filter((e) => e.brand.id === brand.id && e.bottle.id !== bottle.id)
    .sort(
      (a, b) =>
        Number(b.subBrand.id === subBrand.id) - Number(a.subBrand.id === subBrand.id) ||
        (b.rating?.count ?? 0) - (a.rating?.count ?? 0)
    )
    .slice(0, 8);

  // Same style from other producers, closest in price.
  const similar = bottle.style
    ? catalog.bottles
        .filter((e) => e.bottle.style === bottle.style && e.brand.id !== brand.id && e.bottle.price > 0)
        .sort(
          (a, b) =>
            Math.abs(Math.log(a.bottle.price / Math.max(bottle.price, 1))) -
              Math.abs(Math.log(b.bottle.price / Math.max(bottle.price, 1))) ||
            (b.rating?.count ?? 0) - (a.rating?.count ?? 0)
        )
        .slice(0, 6)
    : [];

  const explorerHref = `/?q=${encodeURIComponent(bottle.name)}`;

  return (
    <div className="min-h-screen" style={{ background: "#f0e8d8", color: "#0d0b08" }}>
      <SiteHeader />

      <main className="max-w-5xl mx-auto px-5 sm:px-8 pt-8">
        <Breadcrumbs
          currentPath={entry.path}
          trail={[
            { name: "Distilleries", path: "/brands" },
            { name: brand.name, path: entry.brandPath },
            { name: bottle.name },
          ]}
        />

        <article>
          <header className="pb-8" style={{ borderBottom: "1px solid rgba(13,11,8,0.15)" }}>
            <h1
              className="cc-serif leading-[1.08] tracking-tight"
              style={{ fontSize: "clamp(2rem, 5vw, 3.25rem)", fontWeight: 400, textWrap: "balance" }}
            >
              {bottle.name}
            </h1>
            <p className="cc-serif mt-3 text-[17px]" style={{ fontStyle: "italic", color: "rgba(13,11,8,0.65)" }}>
              {bottle.style ? `${bottle.style} · ` : ""}
              <Link href={entry.brandPath} className="cc-link">{brand.name}</Link>
              {brand.region ? ` · ${brand.region}` : ""}
            </p>
          </header>

          <div className="grid gap-x-12 gap-y-10 md:grid-cols-[minmax(0,1fr)_300px] mt-8">
            {/* Left: prose */}
            <div className="min-w-0">
              <p className="cc-serif text-[18px] leading-[1.65]" style={{ color: "rgba(13,11,8,0.85)" }}>
                {summarize(entry)}
              </p>

              {bottle.description && (
                <section className="mt-8">
                  <h2 className="cc-mono-label">Tasting notes</h2>
                  <p className="cc-serif mt-2 text-[18px] leading-[1.65]" style={{ fontStyle: "italic", color: "rgba(13,11,8,0.8)" }}>
                    {bottle.description}
                  </p>
                </section>
              )}

              {notes.length > 0 && (
                <section className="mt-8">
                  <h2 className="cc-mono-label">How it compares</h2>
                  <ul className="mt-2 space-y-2 text-[16px] leading-relaxed" style={{ color: "rgba(13,11,8,0.8)" }}>
                    {notes.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            {/* Right: rating + specs */}
            <aside>
              <section
                aria-label="Community rating"
                className="rounded-sm p-5"
                style={{ border: "1px solid rgba(13,11,8,0.14)", background: "rgba(244,238,224,0.7)" }}
              >
                <h2 className="cc-mono-label">Community rating</h2>
                {rating && rating.count > 0 ? (
                  <>
                    <p className="mt-2 flex items-baseline gap-2">
                      <span className="cc-serif tabular-nums" style={{ fontSize: "3rem", lineHeight: 1, color: "#8b1515" }}>
                        {rating.avg.toFixed(1)}
                      </span>
                      <span className="text-[15px]" style={{ color: "rgba(13,11,8,0.55)" }}>/ 10</span>
                    </p>
                    <p className="mt-2 text-[14px]" style={{ color: "rgba(13,11,8,0.65)" }}>
                      Average of {rating.count.toLocaleString("en-US")} {rating.count === 1 ? "rating" : "ratings"}
                      {isRanked ? "" : ` — needs ${MIN_RATINGS_TO_RANK} to be ranked`}.
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-[15px]" style={{ color: "rgba(13,11,8,0.65)" }}>
                    No ratings yet. Be the first to score it.
                  </p>
                )}
                <Link
                  href={explorerHref}
                  className="mt-4 inline-block rounded-sm px-4 py-2.5 text-[14px] font-semibold"
                  style={{ background: "#8b1515", color: "#f4eee0" }}
                >
                  Rate it in the Explorer →
                </Link>
              </section>

              <dl className="mt-6">
                {bottle.abv > 0 && (
                  <Spec label="Proof">
                    {proofOf(bottle.abv)} <span style={{ color: "rgba(13,11,8,0.55)" }}>({bottle.abv}% ABV)</span>
                  </Spec>
                )}
                <Spec label="Age">{bottle.age ? `${bottle.age} years` : "No age statement"}</Spec>
                {bottle.price > 0 && <Spec label="Suggested retail">${bottle.price.toLocaleString("en-US")}</Spec>}
                {bottle.style && <Spec label="Style">{bottle.style}</Spec>}
                <Spec label="Rarity">{RARITY_LABEL[bottle.rarity] ?? bottle.rarity}</Spec>
                <Spec label="Availability">{AVAILABILITY_LABEL[bottle.availability ?? "current"]}</Spec>
                <Spec label={brand.isNDP ? "Producer (non-distilling)" : "Distillery"}>
                  <Link href={entry.brandPath} className="cc-link">{brand.name}</Link>
                </Spec>
                {bottle.sourceDistillery && <Spec label="Distilled by">{bottle.sourceDistillery}</Spec>}
              </dl>
            </aside>
          </div>
        </article>

        {siblings.length > 0 && (
          <section className="mt-14">
            <h2 className="cc-serif text-[24px]" style={{ fontWeight: 400 }}>
              More from {brand.name}
            </h2>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {siblings.map((e) => (
                <BottleLink key={e.bottle.id} entry={e} />
              ))}
            </ul>
            <p className="mt-3 text-[14px]">
              <Link href={entry.brandPath} className="cc-link">
                See the full {brand.name} lineup →
              </Link>
            </p>
          </section>
        )}

        {similar.length > 0 && (
          <section className="mt-14">
            <h2 className="cc-serif text-[24px]" style={{ fontWeight: 400 }}>
              Similar {styleNoun(entry)} bottles
            </h2>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {similar.map((e) => (
                <BottleLink key={e.bottle.id} entry={e} showBrand />
              ))}
            </ul>
          </section>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
