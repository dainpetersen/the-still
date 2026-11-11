"use client";

import { useMemo, useState } from "react";
import { Brand } from "@/types/whiskey";
import { MIN_RATINGS_TO_RANK, byRating, isRanked, type Rating, type RatingMap } from "@/lib/ratings";

interface Row {
  id: string;
  name: string;
  brandName: string;
  style?: string;
  price: number;
  abv: number;
  age?: number;
  rating?: Rating;
  searchText: string;
}

type SortKey = "rating" | "priceAsc" | "priceDesc" | "name";

interface Props {
  brands: Brand[];
  ratings: RatingMap;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  /** Open a bottle's details. */
  onSelect: (bottleId: string) => void;
}

const PAGE = 40;
const MUTED = "rgba(13,11,8,0.6)";

const SORTS: { value: SortKey; label: string }[] = [
  { value: "rating", label: "Top rated" },
  { value: "priceAsc", label: "Price: low to high" },
  { value: "priceDesc", label: "Price: high to low" },
  { value: "name", label: "Name A–Z" },
];

function compare(sort: SortKey): (a: Row, b: Row) => number {
  const byName = (a: Row, b: Row) => a.name.localeCompare(b.name);
  switch (sort) {
    case "priceAsc":
      return (a, b) => (a.price || Infinity) - (b.price || Infinity) || byName(a, b);
    case "priceDesc":
      return (a, b) => b.price - a.price || byName(a, b);
    case "name":
      return byName;
    case "rating":
      // Ranked bottles first, best to worst; then the rest, most-rated first.
      return (a, b) => {
        const ra = isRanked(a.rating);
        const rb = isRanked(b.rating);
        if (ra && rb) return byRating(a.rating!, b.rating!) || byName(a, b);
        if (ra !== rb) return ra ? -1 : 1;
        return (b.rating?.count ?? 0) - (a.rating?.count ?? 0) || byName(a, b);
      };
  }
}

/**
 * The phone view of the catalog: a searchable, sortable list. (The bubble
 * chart needs hover and room to breathe; on a phone it was a column of
 * unlabelled dots.)
 */
export default function MobileBottleList({ brands, ratings, searchQuery, onSearchChange, onSelect }: Props) {
  const [sort, setSort] = useState<SortKey>("rating");
  const [style, setStyle] = useState<string | null>(null);
  const [shown, setShown] = useState(PAGE);

  const rows = useMemo(() => {
    const out: Row[] = [];
    for (const brand of brands) {
      for (const sub of brand.subBrands) {
        for (const bottle of sub.bottles) {
          out.push({
            id: bottle.id,
            name: bottle.name,
            brandName: brand.name,
            style: bottle.style,
            price: bottle.price,
            abv: bottle.abv,
            age: bottle.age,
            rating: ratings[bottle.id],
            searchText: [bottle.name, brand.name, sub.name, bottle.style ?? ""].join(" ").toLowerCase(),
          });
        }
      }
    }
    return out;
  }, [brands, ratings]);

  const styles = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) if (r.style) counts.set(r.style, (counts.get(r.style) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  }, [rows]);

  const visible = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return rows
      .filter((r) => (!q || r.searchText.includes(q)) && (!style || r.style === style))
      .sort(compare(sort));
  }, [rows, searchQuery, style, sort]);

  const reset = () => setShown(PAGE);
  const filtered = !!searchQuery.trim() || !!style;

  return (
    <section aria-label="Bottles">
      {/* Controls — stay in view under the site header while the list scrolls */}
      <div
        className="sticky z-30 px-4 pt-3 pb-2"
        style={{
          top: 49,
          background: "rgba(240,232,216,0.97)",
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid rgba(13,11,8,0.1)",
        }}
      >
        <div className="flex gap-2">
          <label className="flex-1 min-w-0">
            <span className="sr-only">Search bottles and distilleries</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => { onSearchChange(e.target.value); reset(); }}
              placeholder="Search bottles…"
              className="search-input w-full rounded-sm px-3 py-2.5 outline-none"
              style={{
                fontSize: 16, // below 16px iOS zooms the page on focus
                background: "rgba(255,255,255,0.6)",
                border: "1px solid rgba(13,11,8,0.25)",
                color: "#0d0b08",
              }}
            />
          </label>
          <label className="flex-shrink-0">
            <span className="sr-only">Sort by</span>
            <select
              value={sort}
              onChange={(e) => { setSort(e.target.value as SortKey); reset(); }}
              className="h-full rounded-sm px-2 outline-none"
              style={{
                fontSize: 16,
                background: "rgba(255,255,255,0.6)",
                border: "1px solid rgba(13,11,8,0.25)",
                color: "#0d0b08",
                maxWidth: 150,
              }}
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </label>
        </div>

        {/* Style filter */}
        <div className="flex gap-2 mt-2 overflow-x-auto pb-1 -mx-4 px-4" role="group" aria-label="Filter by style">
          {[null, ...styles].map((s) => {
            const active = style === s;
            return (
              <button
                key={s ?? "all"}
                onClick={() => { setStyle(s); reset(); }}
                aria-pressed={active}
                className="flex-shrink-0 rounded-full px-3 py-1.5 text-[13px] whitespace-nowrap"
                style={
                  active
                    ? { background: "#0d0b08", color: "#f4eed8", border: "1px solid #0d0b08" }
                    : { background: "transparent", color: "rgba(13,11,8,0.75)", border: "1px solid rgba(13,11,8,0.25)" }
                }
              >
                {s ?? "All styles"}
              </button>
            );
          })}
        </div>
      </div>

      <p className="px-4 pt-3 text-[13px]" style={{ color: MUTED }} aria-live="polite">
        {visible.length.toLocaleString("en-US")} {visible.length === 1 ? "bottle" : "bottles"}
        {filtered ? " match" : ""}
        {sort === "rating" ? ` · ranked bottles have ${MIN_RATINGS_TO_RANK}+ ratings` : ""}
      </p>

      {visible.length === 0 ? (
        <p className="px-4 py-10 text-[15px]" style={{ color: MUTED, fontFamily: "Georgia,serif", fontStyle: "italic" }}>
          Nothing matches. Try a shorter search or a different style.
        </p>
      ) : (
        <ol className="mt-1">
          {visible.slice(0, shown).map((row, i) => {
            const ranked = sort === "rating" && isRanked(row.rating);
            const meta = [
              row.abv > 0 ? `${Math.round(row.abv * 20) / 10} proof` : null,
              row.price > 0 ? `$${row.price.toLocaleString("en-US")}` : null,
              row.age ? `${row.age} yr` : null,
            ].filter(Boolean);
            return (
              <li key={row.id} style={{ borderBottom: "1px solid rgba(13,11,8,0.1)" }}>
                <button
                  type="button"
                  onClick={() => onSelect(row.id)}
                  className="w-full flex items-start gap-3 text-left px-4 py-3 active:bg-black/[0.05]"
                >
                  {ranked && (
                    <span
                      className="text-[13px] font-bold tabular-nums w-6 text-right flex-shrink-0 mt-0.5"
                      style={{ color: i < 3 ? "#8b1515" : "rgba(13,11,8,0.45)", fontFamily: "Georgia,serif" }}
                    >
                      {i + 1}
                    </span>
                  )}
                  <span className="flex-1 min-w-0">
                    <span className="block text-[16px] leading-snug" style={{ color: "#0d0b08" }}>
                      {row.name}
                    </span>
                    <span
                      className="block text-[14px] mt-0.5"
                      style={{ color: MUTED, fontFamily: "Georgia,serif", fontStyle: "italic" }}
                    >
                      {row.brandName}
                      {row.style ? ` · ${row.style}` : ""}
                    </span>
                    <span className="block font-mono text-[12px] mt-1" style={{ color: MUTED }}>
                      {meta.join(" · ")}
                    </span>
                  </span>
                  <span className="flex-shrink-0 text-right pt-0.5">
                    {row.rating ? (
                      <>
                        <span className="block text-[18px] leading-none tabular-nums" style={{ color: "#8b1515", fontFamily: "Georgia,serif" }}>
                          {row.rating.avg.toFixed(1)}
                        </span>
                        <span className="block text-[11px] mt-1 tabular-nums" style={{ color: MUTED }}>
                          {row.rating.count.toLocaleString("en-US")} {row.rating.count === 1 ? "rating" : "ratings"}
                        </span>
                      </>
                    ) : (
                      <span className="text-[12px]" style={{ color: "rgba(13,11,8,0.45)" }}>unrated</span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}

      {visible.length > shown && (
        <div className="px-4 py-5">
          <button
            onClick={() => setShown((n) => n + PAGE)}
            className="w-full rounded-sm py-3 text-[15px] font-semibold"
            style={{ border: "1px solid rgba(13,11,8,0.3)", color: "#0d0b08", background: "transparent" }}
          >
            Show {Math.min(PAGE, visible.length - shown)} more
          </button>
        </div>
      )}
    </section>
  );
}
