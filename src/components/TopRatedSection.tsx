"use client";

import { useMemo } from "react";
import { Brand } from "@/types/whiskey";

interface Props {
  brands: Brand[];
  ratings: Record<string, { avg: number; count: number }>;
}

const RARITY_COLOR: Record<string, string> = {
  common: "rgba(156,163,175,0.7)",
  limited: "rgba(245,158,11,0.7)",
  rare: "rgba(251,146,60,0.8)",
  allocated: "rgba(239,68,68,0.8)",
  unicorn: "rgba(167,139,250,0.9)",
};

export default function TopRatedSection({ brands, ratings }: Props) {
  // Flatten all bottles, attach rating data + brand/sub-brand names
  const ranked = useMemo(() => {
    const rows: {
      id: string;
      name: string;
      brandName: string;
      subBrandName: string;
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
              subBrandName: sub.name,
              avg: r.avg,
              count: r.count,
              rarity: bottle.rarity ?? "common",
            });
          }
        }
      }
    }

    return rows.sort((a, b) => b.avg - a.avg || b.count - a.count).slice(0, 15);
  }, [brands, ratings]);

  const maxRating = 10;

  return (
    <section
      className="px-6 py-16 md:px-12 lg:px-20"
      style={{ background: "linear-gradient(180deg, #080a0f 0%, #0a0610 100%)" }}
    >
      {/* Heading */}
      <div className="mb-10">
        <p
          className="text-xs uppercase tracking-[0.25em] mb-1"
          style={{ color: "rgba(245,158,11,0.6)" }}
        >
          Community Scores
        </p>
        <h2 className="text-3xl font-bold text-white">Top Rated Bottles</h2>
        <p className="mt-2 text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
          Ranked by average community rating · {Object.keys(ratings).length} bottles rated so far
        </p>
      </div>

      {ranked.length === 0 ? (
        <div
          className="rounded-2xl p-10 text-center"
          style={{ border: "1px solid rgba(245,158,11,0.12)", background: "rgba(10,10,20,0.6)" }}
        >
          <p className="text-lg font-semibold text-white mb-2">No ratings yet</p>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
            Explore the treemap above and be the first to rate a bottle.
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-w-4xl">
          {ranked.map((item, i) => (
            <div
              key={item.id}
              className="flex items-center gap-4 group"
            >
              {/* Rank number */}
              <span
                className="w-6 text-right text-sm font-bold flex-shrink-0"
                style={{ color: i < 3 ? "rgba(245,158,11,0.9)" : "rgba(255,255,255,0.2)" }}
              >
                {i + 1}
              </span>

              {/* Name + brand */}
              <div className="w-64 flex-shrink-0 min-w-0">
                <p className="text-sm font-semibold text-white truncate leading-tight">{item.name}</p>
                <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.35)" }}>
                  {item.brandName}
                </p>
              </div>

              {/* Bar */}
              <div className="flex-1 relative h-6 flex items-center min-w-0">
                <div
                  className="h-2 rounded-full absolute left-0"
                  style={{
                    width: `${(item.avg / maxRating) * 100}%`,
                    background: `linear-gradient(90deg, rgba(245,158,11,0.4) 0%, ${RARITY_COLOR[item.rarity] ?? "rgba(245,158,11,0.7)"} 100%)`,
                    transition: "width 0.6s ease",
                  }}
                />
                <div
                  className="h-2 rounded-full absolute left-0 w-full opacity-10"
                  style={{ background: "rgba(255,255,255,0.1)" }}
                />
              </div>

              {/* Score */}
              <div className="flex items-baseline gap-1 flex-shrink-0 w-20 justify-end">
                <span
                  className="text-lg font-bold tabular-nums"
                  style={{ color: RARITY_COLOR[item.rarity] ?? "rgba(245,158,11,0.9)" }}
                >
                  {item.avg.toFixed(1)}
                </span>
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
                  / 10
                </span>
              </div>

              {/* Count */}
              <span
                className="text-xs flex-shrink-0 w-16 text-right hidden sm:block"
                style={{ color: "rgba(255,255,255,0.2)" }}
              >
                {item.count} {item.count === 1 ? "rating" : "ratings"}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
