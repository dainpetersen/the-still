"use client";

import { useMemo } from "react";
import { Brand, GroupMode } from "@/types/whiskey";
import { getAgeTier, getPriceTier } from "@/data/whiskeys";

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
  ratings: Record<string, { avg: number; count: number }>;
  searchQuery: string;
  groupMode: GroupMode;
  selectedGroup: string | null;
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
  ratings: Record<string, { avg: number; count: number }>,
  searchQuery: string,
  groupMode: GroupMode,
  selectedGroup: string | null,
): { entries: RankedEntry[]; label: string; sublabel?: string } {
  const q = searchQuery.toLowerCase().trim();

  // Flatten all rated bottles with their groupKey
  const all: (RankedEntry & { searchText: string })[] = [];
  for (const brand of brands) {
    for (const sub of brand.subBrands) {
      for (const bottle of sub.bottles) {
        const r = ratings[bottle.id];
        if (!r || r.count < 1) continue;

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

  const byRating = (a: RankedEntry, b: RankedEntry) =>
    b.avg - a.avg || b.count - a.count;

  // ── Search active: top 10 across matching bottles ─────────────────────────
  if (q) {
    const filtered = all.filter((e) => e.searchText.includes(q));
    return {
      entries: filtered.sort(byRating).slice(0, 10),
      label: "Top Rated",
      sublabel: `"${searchQuery}"`,
    };
  }

  // ── Group label selected (clicked a label on the chart) ───────────────────
  if (selectedGroup) {
    const filtered = all.filter((e) => e.groupLabel === selectedGroup);
    return {
      entries: filtered.sort(byRating).slice(0, 10),
      label: "Top Rated",
      sublabel: selectedGroup,
    };
  }

  // ── Group mode: best bottle per group ────────────────────────────────────
  if (groupMode !== "distillery") {
    const best = new Map<string, RankedEntry>();
    for (const e of all) {
      const prev = best.get(e.groupLabel);
      if (!prev || e.avg > prev.avg || (e.avg === prev.avg && e.count > prev.count)) {
        best.set(e.groupLabel, e);
      }
    }
    return {
      entries: [...best.values()].sort(byRating),
      label: PANEL_LABEL[groupMode],
    };
  }

  // ── Default: global top 10 ────────────────────────────────────────────────
  return {
    entries: all.sort(byRating).slice(0, 10),
    label: "Top Rated",
  };
}

export default function TopRatedLeaderboard({
  brands, ratings, searchQuery, groupMode, selectedGroup,
}: Props) {
  const { entries, label, sublabel } = useMemo(
    () => computeEntries(brands, ratings, searchQuery, groupMode, selectedGroup),
    [brands, ratings, searchQuery, groupMode, selectedGroup],
  );

  const hasAnyRatings = Object.keys(ratings).length > 0;
  const showGroupLabel = groupMode !== "distillery" && !searchQuery && !selectedGroup;

  return (
    <div
      className="flex flex-col h-full overflow-hidden select-none"
      style={{ borderRight: "1px solid rgba(13,11,8,0.1)", padding: "16px 14px 12px" }}
    >
      {/* Header */}
      <div className="flex-shrink-0 mb-3">
        <p
          className="text-[9px] uppercase tracking-[0.15em]"
          style={{ color: "rgba(13,11,8,0.35)", fontFamily: "Georgia,serif" }}
        >
          {label}
        </p>
        {sublabel && (
          <p
            className="text-[10px] mt-0.5 truncate"
            style={{ color: "#8b1515", fontFamily: "Georgia,serif", fontStyle: "italic" }}
          >
            {sublabel}
          </p>
        )}
        <div className="mt-2" style={{ height: "1px", background: "rgba(13,11,8,0.1)" }} />
      </div>

      {/* Body */}
      {!hasAnyRatings ? (
        <p
          className="text-[10px] mt-1 leading-relaxed"
          style={{ color: "rgba(13,11,8,0.3)", fontFamily: "Georgia,serif", fontStyle: "italic" }}
        >
          No ratings yet. Click any bubble to rate a bottle.
        </p>
      ) : entries.length === 0 ? (
        <p
          className="text-[10px] mt-1 leading-relaxed"
          style={{ color: "rgba(13,11,8,0.3)", fontFamily: "Georgia,serif", fontStyle: "italic" }}
        >
          No rated bottles match.
        </p>
      ) : (
        <div className="flex flex-col gap-3 overflow-y-auto flex-1">
          {entries.map((item, i) => (
            <div key={item.id} className="flex items-start gap-2">
              {/* Rank */}
              <span
                className="text-[10px] font-bold tabular-nums w-4 text-right flex-shrink-0 mt-px"
                style={{
                  color: i < 3 ? "#8b1515" : "rgba(13,11,8,0.22)",
                  fontFamily: "Georgia,serif",
                }}
              >
                {i + 1}
              </span>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p
                  className="text-[11px] font-semibold leading-tight truncate"
                  style={{ color: "#0d0b08" }}
                >
                  {item.name}
                </p>
                <p
                  className="text-[9px] truncate mt-[1px]"
                  style={{ color: "rgba(13,11,8,0.4)", fontFamily: "Georgia,serif", fontStyle: "italic" }}
                >
                  {showGroupLabel ? item.groupLabel : item.brandName}
                </p>

                {/* Rating bar */}
                <div className="flex items-center gap-1.5 mt-1">
                  <div
                    className="flex-1 rounded-full overflow-hidden"
                    style={{ height: "2px", background: "rgba(13,11,8,0.08)" }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${(item.avg / 10) * 100}%`,
                        background: "rgba(139,21,21,0.45)",
                      }}
                    />
                  </div>
                  <span
                    className="text-[10px] tabular-nums flex-shrink-0"
                    style={{ color: "rgba(13,11,8,0.55)", fontFamily: "Georgia,serif" }}
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
