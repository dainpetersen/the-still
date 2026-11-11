import Link from "next/link";
import { MIN_RATINGS_TO_RANK, bottleCount, type BottleEntry, type Catalog } from "@/lib/catalog";
import type { WhiskeyStyle } from "@/types/whiskey";
import RatingBadge from "@/components/site/RatingBadge";

const STYLE_ORDER: WhiskeyStyle[] = [
  "Bourbon",
  "Wheated Bourbon",
  "High Rye Bourbon",
  "Rye Whiskey",
  "Tennessee Whiskey",
  "Wheat Whiskey",
  "American Single Malt",
  "Blended American",
];

function RankedItem({ entry, rank }: { entry: BottleEntry; rank?: number }) {
  return (
    <li className="cc-row">
      <Link href={entry.path} className="flex items-baseline gap-3 py-2.5">
        {rank !== undefined && (
          <span className="font-mono tabular-nums text-[12px] w-5 text-right flex-shrink-0" style={{ color: "rgba(13,11,8,0.45)" }}>
            {rank}
          </span>
        )}
        <span className="flex-1 min-w-0">
          <span className="block text-[15px] leading-snug">{entry.bottle.name}</span>
          <span className="cc-serif block text-[13px]" style={{ fontStyle: "italic", color: "rgba(13,11,8,0.6)" }}>
            {entry.brand.name}
          </span>
        </span>
        <RatingBadge rating={entry.rating} />
      </Link>
    </li>
  );
}

/**
 * The part of the home page that exists in the HTML before any JavaScript
 * runs: what the site is, the top-rated bottles, and a link to every
 * distillery. The explorer above it is a client-only canvas, so without this
 * a crawler sees a page with almost no text and a single link.
 */
export default function HomeDirectory({ catalog }: { catalog: Catalog }) {
  const { brands, bottles, ranked } = catalog;
  const topRated = ranked.slice(0, 10);
  const byStyle = STYLE_ORDER.map((style) => ({
    style,
    total: bottles.filter((e) => e.bottle.style === style).length,
    best: ranked.filter((e) => e.bottle.style === style).slice(0, 3),
  })).filter((g) => g.best.length > 0);
  const directory = brands
    .filter((b) => catalog.brandPaths.has(b.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  const ratingTotal = Object.values(catalog.ratings).reduce((sum, r) => sum + r.count, 0);

  return (
    <div style={{ borderTop: "1px solid rgba(13,11,8,0.12)" }}>
      <div className="max-w-5xl mx-auto px-5 sm:px-8 py-12">
        <section className="max-w-3xl">
          <h1
            className="cc-serif leading-[1.1] tracking-tight"
            style={{ fontSize: "clamp(1.9rem, 4.5vw, 2.9rem)", fontWeight: 400, textWrap: "balance" }}
          >
            A community catalog of American whiskey
          </h1>
          <p className="cc-serif mt-4 text-[18px] leading-[1.65]" style={{ color: "rgba(13,11,8,0.8)" }}>
            Common Cask maps {bottles.length} bottles from {brands.length} distilleries and independent bottlers —
            bourbon, rye, wheated bourbon, Tennessee whiskey and American single malt — each with its proof, age,
            suggested retail price, rarity and a community rating out of 10
            {ratingTotal > 0 ? `, drawn from ${ratingTotal.toLocaleString("en-US")} ratings` : ""}. No sponsored
            placements and no paid rankings.
          </p>
          <p className="mt-3 text-[15px] leading-relaxed" style={{ color: "rgba(13,11,8,0.7)" }}>
            The chart above plots every bottle: group it by distillery, style, state, age or price, colour it by
            price, rating or rarity, and select any bottle to rate it. Missing something? Sign in and use{" "}
            <em>Submit a Bottle</em> — every entry is reviewed before it goes live.
          </p>
        </section>

        <div className="grid gap-x-14 gap-y-12 md:grid-cols-2 mt-12">
          {topRated.length > 0 && (
            <section>
              <h2 className="cc-serif text-[24px]" style={{ fontWeight: 400 }}>Top-rated bottles</h2>
              <p className="text-[13px] mt-1" style={{ color: "rgba(13,11,8,0.55)" }}>
                Ranked by average rating; a bottle needs at least {MIN_RATINGS_TO_RANK} ratings to qualify.
              </p>
              <ol className="mt-3">
                {topRated.map((e, i) => (
                  <RankedItem key={e.bottle.id} entry={e} rank={i + 1} />
                ))}
              </ol>
            </section>
          )}

          {byStyle.length > 0 && (
            <section>
              <h2 className="cc-serif text-[24px]" style={{ fontWeight: 400 }}>Best by style</h2>
              <p className="text-[13px] mt-1" style={{ color: "rgba(13,11,8,0.55)" }}>
                The three highest-rated bottles in each style.
              </p>
              <div className="mt-3 flex flex-col gap-5">
                {byStyle.map((group) => (
                  <div key={group.style}>
                    <h3 className="cc-mono-label">
                      {group.style} <span style={{ color: "rgba(13,11,8,0.4)" }}>· {group.total} bottles</span>
                    </h3>
                    <ul>
                      {group.best.map((e) => (
                        <RankedItem key={e.bottle.id} entry={e} />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <section className="mt-14">
          <h2 className="cc-serif text-[24px]" style={{ fontWeight: 400 }}>Browse by distillery</h2>
          <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8">
            {directory.map((brand) => (
              <li key={brand.id} className="cc-row">
                <Link href={catalog.brandPaths.get(brand.id)!} className="flex items-baseline justify-between gap-3 py-2.5">
                  <span className="text-[15px]">{brand.name}</span>
                  <span className="font-mono text-[12px] flex-shrink-0" style={{ color: "rgba(13,11,8,0.55)" }}>
                    {bottleCount(catalog, brand)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[14px]">
            <Link href="/brands" className="cc-link">All distilleries by state →</Link>
          </p>
        </section>
      </div>
    </div>
  );
}
