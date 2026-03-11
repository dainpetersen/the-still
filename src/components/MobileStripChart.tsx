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

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
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

// Human-readable rarity labels for label cards
const RARITY_DISPLAY: Record<string, string> = {
  "unicorn":   "Unicorn",
  "allocated": "Allocated",
  "limited":   "Limited",
  "seasonal":  "Seasonal",
  "available": "Shelf Find",
};
function rarityLabel(rarity?: string): string {
  return RARITY_DISPLAY[rarity ?? ""] ?? "Available";
}

// ── Normal mode: price Y axis ──────────────────────────────────────────────
const PRICE_CAP = 350; // prices above this cap at the top
const PRICE_AXIS = [
  { price: 300, label: "$300+" },
  { price: 200, label: "$200"  },
  { price: 100, label: "$100"  },
  { price: 50,  label: "$50"   },
  { price: 20,  label: "~$20"  },
];

/** Normalise price to 0–1 (higher = more expensive = top of chart).
 *  Bottles with no price sit near the bottom (treated as ~$25). */
function normalizePrice(price?: number): number {
  if (price == null) return 25 / PRICE_CAP;
  return Math.min(price / PRICE_CAP, 1);
}

const DOT_R      = 5;
const PAD_LEFT   = 54;  // room for price axis labels
const PAD_RIGHT  = 10;
const PAD_TOP    = 20;
const PAD_BOTTOM = 28;

// Compact mode layout constants
const COMPACT_DOT_ZONE = 44;
const COMPACT_LABEL_GAP = 10;
const COMPACT_THRESHOLD = 20;

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
  const [containerSize, setContainerSize] = useState({ width: 320, height: 600 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) =>
      setContainerSize({ width: e.contentRect.width, height: e.contentRect.height })
    );
    ro.observe(el);
    setContainerSize({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const { width: chartWidth, height: containerHeight } = containerSize;

  // Flatten all bottles
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

  // Search: non-matching dots disappear entirely
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

  // Compact: search active + small result set
  const isCompact =
    searchQuery.trim().length > 0 &&
    filtered.length > 0 &&
    filtered.length < COMPACT_THRESHOLD;

  // Chart height
  const CHART_H = isCompact
    ? Math.max(containerHeight, 200)
    : Math.max(800, allBottles.length * 4.5);

  const usableW = chartWidth - PAD_LEFT - PAD_RIGHT;
  const usableH = CHART_H - PAD_TOP - PAD_BOTTOM;

  // Label zone (compact only)
  const labelStartX = PAD_LEFT + COMPACT_DOT_ZONE + COMPACT_LABEL_GAP;
  const labelW = chartWidth - labelStartX - PAD_RIGHT;

  // Compute dot positions
  const rawDots = useMemo(() => {
    if (isCompact) {
      // Sort by price descending (expensive at top), space evenly — no axis needed
      const sorted = [...filtered].sort(
        (a, b) => (b.price ?? 0) - (a.price ?? 0)
      );
      const n = sorted.length;
      return sorted.map((b, i) => {
        const jitter = seededJitter(b.id);
        const x = PAD_LEFT + DOT_R + jitter * (COMPACT_DOT_ZONE - DOT_R * 2);
        // Even spacing top-to-bottom
        const y = n === 1
          ? PAD_TOP + usableH / 2
          : PAD_TOP + (i / (n - 1)) * usableH;
        return { ...b, x, y, labelY: y };
      });
    } else {
      // Normal: Y = price (expensive at top)
      return filtered.map((b) => {
        const jitter = seededJitter(b.id);
        const x = PAD_LEFT + DOT_R * 2 + jitter * (usableW - DOT_R * 4);
        const y = PAD_TOP + (1 - normalizePrice(b.price)) * usableH;
        return { ...b, x, y, labelY: y };
      });
    }
  }, [filtered, isCompact, usableW, usableH]);

  // Greedy label collision avoidance (compact only)
  const dots = useMemo(() => {
    if (!isCompact) return rawDots;
    const LABEL_H = 36;
    const result: typeof rawDots = [];
    let prevLabelBottom = -Infinity;
    for (const dot of rawDots) {
      const idealTop = dot.y - LABEL_H / 2;
      const top = Math.max(idealTop, prevLabelBottom + 2);
      prevLabelBottom = top + LABEL_H;
      result.push({ ...dot, labelY: top + LABEL_H / 2 });
    }
    return result;
  }, [rawDots, isCompact]);

  // Only show styles present in data
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
              boxShadow: searchQuery ? "0 0 0 3px rgba(245,158,11,0.08)" : undefined,
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

      {/* ── Chart area ──────────────────────────────────────────────── */}
      <div
        className="flex-1"
        ref={containerRef}
        style={{ overflowY: isCompact ? "hidden" : "auto" }}
      >
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

            {/* Price axis (normal mode only) */}
            {!isCompact && PRICE_AXIS.map(({ price, label }) => {
              const y = PAD_TOP + (1 - normalizePrice(price)) * usableH;
              return (
                <g key={label}>
                  <line
                    x1={PAD_LEFT} x2={chartWidth - PAD_RIGHT}
                    y1={y} y2={y}
                    stroke="rgba(245,158,11,0.18)"
                    strokeWidth={1}
                    strokeDasharray="3,7"
                  />
                  <text
                    x={PAD_LEFT - 6}
                    y={y}
                    textAnchor="end"
                    dominantBaseline="middle"
                    fontSize="10"
                    fontWeight="600"
                    fill="rgba(245,158,11,0.55)"
                    fontFamily="system-ui, -apple-system, sans-serif"
                    letterSpacing="0.02em"
                  >
                    {label}
                  </text>
                </g>
              );
            })}

            {/* Dots + compact label cards */}
            {dots.map((dot) => {
              const color = getColor(dot.style);
              const nameMaxChars = Math.floor(labelW / 6.2);
              const metaMaxChars = Math.floor(labelW / 5.4);
              const meta = [
                dot.price ? `$${dot.price}` : null,
                rarityLabel(dot.rarity),
                dot.brandName,
              ].filter(Boolean).join(" · ");

              return (
                <g key={dot.id} onClick={() => onBottleClick(dot)} style={{ cursor: "pointer" }}>
                  {/* Touch target */}
                  <circle cx={dot.x} cy={dot.y} r={22} fill="transparent" />

                  {/* Dot */}
                  <circle
                    cx={dot.x}
                    cy={dot.y}
                    r={isCompact ? DOT_R + 1 : DOT_R}
                    fill={color}
                    fillOpacity={0.88}
                    stroke={color}
                    strokeWidth={0.5}
                  />

                  {/* Compact label card */}
                  {isCompact && (
                    <g>
                      {/* Connector line when label is offset from dot */}
                      {Math.abs(dot.labelY - dot.y) > 8 && (
                        <line
                          x1={dot.x + DOT_R + 2} y1={dot.y}
                          x2={labelStartX - 4}    y2={dot.labelY}
                          stroke={color}
                          strokeWidth={0.75}
                          strokeOpacity={0.3}
                        />
                      )}

                      {/* Background pill */}
                      <rect
                        x={labelStartX}
                        y={dot.labelY - 18}
                        width={labelW}
                        height={36}
                        rx={6}
                        fill="rgba(12,10,20,0.75)"
                        stroke={color}
                        strokeWidth={0.5}
                        strokeOpacity={0.3}
                      />

                      {/* Bottle name */}
                      <text
                        x={labelStartX + 8}
                        y={dot.labelY - 4}
                        fontSize="11"
                        fontWeight="500"
                        fill="rgba(255,255,255,0.9)"
                        fontFamily="system-ui, -apple-system, sans-serif"
                      >
                        {truncate(dot.name, nameMaxChars)}
                      </text>

                      {/* Brand · Rarity · Price */}
                      <text
                        x={labelStartX + 8}
                        y={dot.labelY + 11}
                        fontSize="9.5"
                        fill="rgba(245,158,11,0.55)"
                        fontFamily="system-ui, -apple-system, sans-serif"
                      >
                        {truncate(meta, metaMaxChars)}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        )}
      </div>

      {/* ── Style legend (normal mode only) ─────────────────────────── */}
      {!isCompact && (
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
      )}
    </div>
  );
}
