"use client";

import { useMemo, useRef, useEffect, useState } from "react";
import { Brand } from "@/types/whiskey";

export interface MobileBottle {
  id: string;
  name: string;
  brandName: string;
  subBrandName: string;
  brandId: string;
  rarityScore: number;
  style: string;
  price?: number;
  abv?: number;
  age?: number;
  rarity?: string;
  description?: string;
  avgRating?: number;
  ratingCount?: number;
}

/** Deterministic 0–1 jitter from a string seed (FNV-1a). */
function seededJitter(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

const STYLE_COLORS: Record<string, string> = {
  "Bourbon":              "#f59e0b",
  "Wheat Bourbon":        "#fbbf24",
  "High Rye Bourbon":     "#f97316",
  "Rye Whiskey":          "#ea580c",
  "Wheat Whiskey":        "#fcd34d",
  "Tennessee Whiskey":    "#84cc16",
  "American Single Malt": "#60a5fa",
  "Blended American":     "#a78bfa",
  "Corn Whiskey":         "#d97706",
};

function getColor(style: string): string {
  return STYLE_COLORS[style] ?? "#9ca3af";
}

const AXIS_LABELS = [
  { score: 95, label: "Unicorn"   },
  { score: 75, label: "Allocated" },
  { score: 55, label: "Limited"   },
  { score: 30, label: "Seasonal"  },
  { score: 8,  label: "Shelf"     },
];

const DOT_R    = 5;
const PAD_LEFT = 62;
const PAD_RIGHT = 12;
const PAD_TOP  = 20;
const PAD_BOTTOM = 28;

interface Props {
  brands: Brand[];
  ratings: Record<string, { avg: number; count: number }>;
  onBottleClick: (bottle: MobileBottle) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export default function MobileStripChart({
  brands,
  ratings,
  onBottleClick,
  searchQuery,
  onSearchChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(320);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setChartWidth(e.contentRect.width));
    ro.observe(el);
    setChartWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Flatten all bottles from brands
  const allBottles = useMemo<MobileBottle[]>(() => {
    const out: MobileBottle[] = [];
    for (const brand of brands) {
      for (const sb of brand.subBrands) {
        for (const bt of sb.bottles) {
          if (!bt.id) continue;
          const r = ratings[bt.id];
          out.push({
            id:           bt.id,
            name:         bt.name,
            brandName:    brand.name,
            subBrandName: sb.name,
            brandId:      brand.id,
            rarityScore:  bt.rarityScore ?? 25,
            style:        bt.style ?? "Bourbon",
            price:        bt.price,
            abv:          bt.abv,
            age:          bt.age,
            rarity:       bt.rarity,
            description:  bt.description,
            avgRating:    r?.avg,
            ratingCount:  r?.count,
          });
        }
      }
    }
    return out;
  }, [brands, ratings]);

  // Search filters dots out completely (no dim/shrink — they disappear)
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return allBottles;
    const q = searchQuery.toLowerCase();
    return allBottles.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.brandName.toLowerCase().includes(q) ||
        b.subBrandName.toLowerCase().includes(q) ||
        b.style.toLowerCase().includes(q)
    );
  }, [allBottles, searchQuery]);

  // Chart height: fixed on allBottles so Y scale stays stable during search
  const CHART_H = Math.max(800, allBottles.length * 4.5);
  const usableW = chartWidth - PAD_LEFT - PAD_RIGHT;
  const usableH = CHART_H - PAD_TOP - PAD_BOTTOM;

  // Compute dot positions with stable seeded X jitter
  const dots = useMemo(() => {
    const margin = DOT_R * 2;
    return filtered.map((b) => {
      const jitter = seededJitter(b.id);
      const x = PAD_LEFT + margin + jitter * (usableW - margin * 2);
      const y = PAD_TOP + (1 - b.rarityScore / 100) * usableH;
      return { ...b, x, y };
    });
  }, [filtered, usableW, usableH]);

  // Only show styles that are actually present
  const presentStyles = useMemo(
    () =>
      [...new Set(allBottles.map((b) => b.style))].filter(
        (s) => s in STYLE_COLORS
      ),
    [allBottles]
  );

  return (
    <div className="flex flex-col" style={{ height: "100%" }}>

      {/* ── Search bar ─────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 px-4 pt-3 pb-2"
        style={{
          background: "rgba(10,6,8,0.95)",
          borderBottom: "1px solid rgba(245,158,11,0.12)",
        }}
      >
        <div className="relative">
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            width="15" height="15" viewBox="0 0 16 16" fill="none"
            style={{ color: searchQuery ? "rgba(245,158,11,0.7)" : "rgba(255,255,255,0.25)" }}
          >
            <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search bottles, brands, styles…"
            className="w-full rounded-full py-3 pl-10 pr-10 text-sm outline-none"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: searchQuery
                ? "1.5px solid rgba(245,158,11,0.7)"
                : "1.5px solid rgba(245,158,11,0.3)",
              color: "#f5f5f5",
              boxShadow: searchQuery
                ? "0 0 0 3px rgba(245,158,11,0.08)"
                : undefined,
            }}
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full text-xs"
              style={{ color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.08)" }}
            >
              ✕
            </button>
          )}
        </div>

        {searchQuery ? (
          <p className="text-xs mt-1.5 px-1" style={{ color: "rgba(245,158,11,0.6)" }}>
            {filtered.length} {filtered.length === 1 ? "result" : "results"}
          </p>
        ) : (
          <p className="text-xs mt-1.5 px-1" style={{ color: "rgba(255,255,255,0.18)" }}>
            {allBottles.length} bottles · tap to rate
          </p>
        )}
      </div>

      {/* ── Scrollable strip chart ──────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto" ref={containerRef}>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-2">
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
              No bottles found
            </p>
            <button
              onClick={() => onSearchChange("")}
              className="text-xs"
              style={{ color: "rgba(245,158,11,0.6)" }}
            >
              Clear search
            </button>
          </div>
        ) : (
          <svg width={chartWidth} height={CHART_H} style={{ display: "block" }}>

            {/* Axis reference lines + labels */}
            {AXIS_LABELS.map(({ score, label }) => {
              const y = PAD_TOP + (1 - score / 100) * usableH;
              return (
                <g key={label}>
                  <line
                    x1={PAD_LEFT} x2={chartWidth - PAD_RIGHT}
                    y1={y} y2={y}
                    stroke="rgba(245,158,11,0.07)"
                    strokeWidth={1}
                    strokeDasharray="3,7"
                  />
                  <text
                    x={PAD_LEFT - 6}
                    y={y}
                    textAnchor="end"
                    dominantBaseline="middle"
                    fontSize="9"
                    fill="rgba(255,255,255,0.22)"
                    fontFamily="system-ui, -apple-system, sans-serif"
                  >
                    {label}
                  </text>
                </g>
              );
            })}

            {/* Dots */}
            {dots.map((dot) => {
              const color = getColor(dot.style);
              return (
                <g
                  key={dot.id}
                  onClick={() => onBottleClick(dot)}
                  style={{ cursor: "pointer" }}
                >
                  {/* Invisible touch target (44px diameter) */}
                  <circle cx={dot.x} cy={dot.y} r={22} fill="transparent" />
                  {/* Visible dot */}
                  <circle
                    cx={dot.x}
                    cy={dot.y}
                    r={DOT_R}
                    fill={color}
                    fillOpacity={0.82}
                    stroke={color}
                    strokeWidth={0.5}
                  />
                </g>
              );
            })}
          </svg>
        )}
      </div>

      {/* ── Style legend ────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 px-4 py-2 flex flex-wrap gap-x-3 gap-y-1"
        style={{ borderTop: "1px solid rgba(245,158,11,0.10)" }}
      >
        {presentStyles.map((style) => (
          <div key={style} className="flex items-center gap-1.5">
            <div
              className="rounded-full flex-shrink-0"
              style={{ width: 7, height: 7, background: getColor(style) }}
            />
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.32)" }}>
              {style}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
