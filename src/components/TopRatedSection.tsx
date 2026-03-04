"use client";

import { useMemo } from "react";
import { Brand } from "@/types/whiskey";

interface Props {
  brands: Brand[];
  ratings: Record<string, { avg: number; count: number }>;
  /** When true, renders as a compact right-panel column */
  panel?: boolean;
}

const RARITY_COLOR: Record<string, string> = {
  common: "rgba(156,163,175,0.7)",
  limited: "rgba(245,158,11,0.7)",
  rare: "rgba(251,146,60,0.8)",
  allocated: "rgba(239,68,68,0.8)",
  unicorn: "rgba(167,139,250,0.9)",
};

export default function TopRatedSection({ brands, ratings, panel = false }: Props) {
  const ranked = useMemo(() => {
    const rows: {
      id: string;
      name: string;
      brandName: string;
      avg: number;
      count: number;
      rarity: string;
    }[] = [];

    for (const brand of brands) {
      for (const sub of brand.subBrands) {
        for (const bottle of sub.bottles) {
          const r = ratings[bottle.id];
          if (r && r.count >= 1) {
            rows.push({
              id: bottle.id,
              name: bottle.name,
              brandName: brand.name,
              avg: r.avg,
              count: r.count,
              rarity: bottle.rarity ?? "common",
            });
          }
        }
      }
    }

    return rows.sort((a, b) => b.avg - a.avg || b.count - a.count).slice(0, 10);
  }, [brands, ratings]);

  const maxRating = 10;

  if (panel) {
    return (
      <div
        className="flex flex-col rounded-xl p-4"
        style={{
          background: "rgba(10,10,20,0.85)",
          border: "1px solid rgba(245,158,11,0.15)",
        }}
      >
        {/* Heading */}
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Top Rated
        </p>

        {ranked.length === 0 ? (
          <div
            className="flex-1 rounded-xl flex flex-col items-center justify-center text-center p-6 gap-2"
            style={{ border: "1px solid rgba(245,158,11,0.1)", background: "rgba(10,10,20,0.5)" }}
          >
            <p className="text-sm font-semibold text-white">No ratings yet</p>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
              Rate a bottle in the treemap below — it will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3 flex-1">
            {ranked.map((item, i) => (
              <div key={item.id} className="flex items-center gap-2">
                {/* Rank */}
                <span
                  className="w-4 text-right text-xs font-bold flex-shrink-0"
                  style={{ color: i < 3 ? "rgba(245,158,11,0.9)" : "rgba(255,255,255,0.2)" }}
                >
                  {i + 1}
                </span>

                {/* Name + brand */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white truncate leading-tight">{item.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {/* Bar */}
                    <div className="relative h-1 flex-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                      <div
                        className="absolute left-0 top-0 h-full rounded-full"
                        style={{
                          width: `${(item.avg / maxRating) * 100}%`,
                          background: `linear-gradient(90deg, rgba(245,158,11,0.4) 0%, ${RARITY_COLOR[item.rarity] ?? "rgba(245,158,11,0.7)"} 100%)`,
                          transition: "width 0.6s ease",
                        }}
                      />
                    </div>
                    {/* Score */}
                    <span
                      className="text-xs font-bold tabular-nums flex-shrink-0"
                      style={{ color: RARITY_COLOR[item.rarity] ?? "rgba(245,158,11,0.9)" }}
                    >
                      {item.avg.toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Full-width standalone section (kept for potential future use)
  return (
    <section
      className="px-6 py-16 md:px-12 lg:px-20"
      style={{ background: "linear-gradient(180deg, #080a0f 0%, #0a0610 100%)" }}
    >
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.25em] mb-1" style={{ color: "rgba(245,158,11,0.6)" }}>
          Community Scores
        </p>
        <h2 className="text-3xl font-bold text-white">Top Rated Bottles</h2>
        <p className="mt-2 text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
          Ranked by average community rating · {Object.keys(ratings).length} bottles rated so far
        </p>
      </div>

      {ranked.length === 0 ? (
        <div
          className="rounded-2xl p-10 text-center max-w-xl"
          style={{ border: "1px solid rgba(245,158,11,0.12)", background: "rgba(10,10,20,0.6)" }}
        >
          <p className="text-lg font-semibold text-white mb-2">No ratings yet</p>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
            Explore the treemap and be the first to rate a bottle.
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-w-2xl">
          {ranked.map((item, i) => (
            <div key={item.id} className="flex items-center gap-4">
              <span
                className="w-6 text-right text-sm font-bold flex-shrink-0"
                style={{ color: i < 3 ? "rgba(245,158,11,0.9)" : "rgba(255,255,255,0.2)" }}
              >
                {i + 1}
              </span>
              <div className="w-48 flex-shrink-0 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{item.name}</p>
                <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.35)" }}>{item.brandName}</p>
              </div>
              <div className="flex-1 relative h-5 flex items-center">
                <div className="h-1.5 rounded-full absolute left-0 w-full" style={{ background: "rgba(255,255,255,0.07)" }} />
                <div
                  className="h-1.5 rounded-full absolute left-0"
                  style={{
                    width: `${(item.avg / maxRating) * 100}%`,
                    background: `linear-gradient(90deg, rgba(245,158,11,0.4) 0%, ${RARITY_COLOR[item.rarity] ?? "rgba(245,158,11,0.7)"} 100%)`,
                  }}
                />
              </div>
              <span className="text-sm font-bold tabular-nums flex-shrink-0" style={{ color: RARITY_COLOR[item.rarity] ?? "rgba(245,158,11,0.9)" }}>
                {item.avg.toFixed(1)}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
