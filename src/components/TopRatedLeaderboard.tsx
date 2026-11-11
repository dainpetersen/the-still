"use client";

import { useMemo } from "react";
import { Brand, GroupMode } from "@/types/whiskey";
import { getAgeTier, getPriceTier } from "@/data/whiskeys";
import { MIN_RATINGS_TO_RANK, byRating, isRanked, type RatingMap } from "@/lib/ratings";

interface RankedEntry {
  id: string;
  name: string;
  brandName: string;
  avg: number;
  count: number;
  groupLabel: string;
}

interface Props {
  brands: Brand[];
  ratings: RatingMap;
  searchQuery: string;
  groupMode: GroupMode;
  selectedGroup: string | null;
  /** Open a bottle's details. */
  onSelect: (bottleId: string) => void;
}

const PANEL_LABEL: Record<GroupMode, string> = {
  distillery: "Top Rated",
  style:      "Best by Style",
  state:      "Best by State",
  ageTier:    "Best by Age",
  priceTier:  "Best by Price",
};

function computeEntries(
  brands: Brand[],
  ratings: RatingMap,
  searchQuery: string,
  groupMode: GroupMode,
  selectedGroup: string | null,
): { entries: RankedEntry[]; label: string; sublabel?: string } {
  const q = searchQuery.toLowerCase().trim();

  // Every bottle with enough ratings to be ranked, with its group for this view.
  const all: (RankedEntry & { searchText: string })[] = [];
  for (const brand of brands) {
    for (const sub of brand.subBrands) {
      for (const bottle of sub.bottles) {
        const r = ratings[bottle.id];
        if (!isRanked(r)) continue;

        let groupLabel = "";
        switch (groupMode) {
          case "distillery": groupLabel = brand.name; break;
          case "style":      groupLabel = bottle.style ?? "Unknown"; break;
          case "state":      groupLabel = brand.state ?? "Unknown"; break;
          case "ageTier":    groupLabel = getAgeTier(bottle.age); break;
          case "priceTier":  groupLabel = getPriceTier(bottle.price); break;
        }

        all.push({
          id: bottle.id,
          name: bottle.name,
          brandName: brand.name,
          avg: r.avg,
          count: r.count,
          groupLabel,
          searchText: [bottle.name, brand.name, sub.name, bottle.style ?? ""].join(" ").toLowerCase(),
        });
      }
    }
  }

  // ── Search active: top 10 across matching bottles ─────────────────────────
  if (q) {
    return {
      entries: all.filter((e) => e.searchText.includes(q)).sort(byRating).slice(0, 10),
      label: "Top Rated",
      sublabel: `"${searchQuery}"`,
    };
  }

  // ── Group label selected (clicked a label on the chart) ───────────────────
  if (selectedGroup) {
    return {
      entries: all.filter((e) => e.groupLabel === selectedGroup).sort(byRating).slice(0, 10),
      label: "Top Rated",
      sublabel: selectedGroup,
    };
  }

  // ── Group mode: best bottle per group ────────────────────────────────────
  if (groupMode !== "distillery") {
    const best = new Map<string, RankedEntry>();
    for (const e of all) {
      const prev = best.get(e.groupLabel);
      if (!prev || byRating(e, prev) < 0) best.set(e.groupLabel, e);
    }
    return { entries: [...best.values()].sort(byRating), label: PANEL_LABEL[groupMode] };
  }

  // ── Default: global top 10 ────────────────────────────────────────────────
  return { entries: all.sort(byRating).slice(0, 10), label: "Top Rated" };
}

const MUTED = "rgba(13,11,8,0.6)";

export default function TopRatedLeaderboard({
  brands, ratings, searchQuery, groupMode, selectedGroup, onSelect,
}: Props) {
  const { entries, label, sublabel } = useMemo(
    () => computeEntries(brands, ratings, searchQuery, groupMode, selectedGroup),
    [brands, ratings, searchQuery, groupMode, selectedGroup],
  );

  const hasAnyRatings = Object.keys(ratings).length > 0;
  const showGroupLabel = groupMode !== "distillery" && !searchQuery && !selectedGroup;

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{ borderRight: "1px solid rgba(13,11,8,0.1)", padding: "16px 14px 12px" }}
    >
      {/* Header */}
      <div className="flex-shrink-0 mb-2">
        <p
          className="text-xs uppercase"
          style={{ color: MUTED, fontFamily: "Georgia,serif", letterSpacing: "0.13em" }}
        >
          {label}
        </p>
        {sublabel && (
          <p
            className="text-[13px] mt-0.5 truncate"
            style={{ color: "#8b1515", fontFamily: "Georgia,serif", fontStyle: "italic" }}
          >
            {sublabel}
          </p>
        )}
        <p className="text-[11px] mt-1" style={{ color: MUTED }}>
          {MIN_RATINGS_TO_RANK}+ ratings to qualify
        </p>
        <div className="mt-2" style={{ height: "1px", background: "rgba(13,11,8,0.1)" }} />
      </div>

      {/* Body */}
      {!hasAnyRatings ? (
        <p
          className="text-[13px] mt-1 leading-relaxed"
          style={{ color: MUTED, fontFamily: "Georgia,serif", fontStyle: "italic" }}
        >
          No ratings yet. Select any bottle to rate it.
        </p>
      ) : entries.length === 0 ? (
        <p
          className="text-[13px] mt-1 leading-relaxed"
          style={{ color: MUTED, fontFamily: "Georgia,serif", fontStyle: "italic" }}
        >
          No matching bottle has {MIN_RATINGS_TO_RANK} ratings yet.
        </p>
      ) : (
        <ol className="flex flex-col overflow-y-auto flex-1 -mx-1.5">
          {entries.map((item, i) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onSelect(item.id)}
                className="w-full flex items-start gap-2 text-left rounded-sm px-1.5 py-2 transition-colors hover:bg-black/[0.04]"
              >
                {/* Rank */}
                <span
                  className="text-[12px] font-bold tabular-nums w-4 text-right flex-shrink-0 mt-px"
                  style={{ color: i < 3 ? "#8b1515" : "rgba(13,11,8,0.45)", fontFamily: "Georgia,serif" }}
                >
                  {i + 1}
                </span>

                {/* Info */}
                <span className="flex-1 min-w-0">
                  <span
                    className="block text-[13px] font-semibold leading-snug line-clamp-2"
                    style={{ color: "#0d0b08" }}
                  >
                    {item.name}
                  </span>
                  <span
                    className="block text-[12px] truncate mt-[1px]"
                    style={{ color: MUTED, fontFamily: "Georgia,serif", fontStyle: "italic" }}
                  >
                    {showGroupLabel ? item.groupLabel : item.brandName}
                  </span>

                  {/* Rating bar */}
                  <span className="flex items-center gap-1.5 mt-1">
                    <span
                      className="flex-1 rounded-full overflow-hidden"
                      style={{ height: "2px", background: "rgba(13,11,8,0.08)" }}
                    >
                      <span
                        className="block h-full rounded-full transition-all duration-500"
                        style={{ width: `${(item.avg / 10) * 100}%`, background: "rgba(139,21,21,0.5)" }}
                      />
                    </span>
                    <span className="text-[12px] tabular-nums flex-shrink-0" style={{ fontFamily: "Georgia,serif" }}>
                      <span className="font-semibold" style={{ color: "#8b1515" }}>{item.avg.toFixed(1)}</span>
                      <span style={{ color: MUTED }}> · {item.count}</span>
                    </span>
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
