"use client";

import { useMemo } from "react";
import * as d3 from "d3";
import { ColorMode } from "@/types/whiskey";
import { buildPriceScale, chartPalette, priceRamp, type ChartTheme } from "@/lib/colorScales";

interface Props {
  colorMode: ColorMode;
  onColorModeChange: (mode: ColorMode) => void;
  distilleryColors?: Map<string, string>;
  /** Prices of the bottles on the chart — the price colours are ranked from these. */
  prices: number[];
  /** Which theme is showing; the chart's colours differ between them. */
  theme: ChartTheme;
}

const MODES: { value: ColorMode; label: string; emoji: string }[] = [
  { value: "price",  label: "Price",  emoji: "💰" },
  { value: "rating", label: "Rating", emoji: "⭐" },
  { value: "rarity", label: "Rarity", emoji: "💎" },
  { value: "brand",  label: "Brand",  emoji: "🏭" },
];

const BAR_WIDTH = 160;
const BAR_HEIGHT = 10;
const LABEL_COLOR = "var(--ink-muted)";

/** "$45", "$3.5k" — short enough for five values to share the bar's width. */
function formatPrice(value: number): string {
  if (value < 1000) return `$${value}`;
  const thousands = Math.round(value / 100) / 10;
  return `$${thousands}k`;
}

function Bar({ id, stops }: { id: string; stops: string[] }) {
  return (
    <svg width={BAR_WIDTH} height={BAR_HEIGHT} role="presentation">
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="0%">
          {stops.map((color, i) => (
            <stop key={i} offset={`${(i / (stops.length - 1)) * 100}%`} stopColor={color} />
          ))}
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={BAR_WIDTH} height={BAR_HEIGHT} fill={`url(#${id})`} rx={1} ry={1} />
    </svg>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[12px] mt-1.5 leading-snug" style={{ color: LABEL_COLOR, fontFamily: "Georgia,serif", fontStyle: "italic" }}>
      {children}
    </p>
  );
}

/**
 * Price is coloured by rank, so the bar is marked at the quartiles: each
 * quarter of the bar holds a quarter of the bottles.
 */
function PriceLegend({ prices, theme }: { prices: number[]; theme: ChartTheme }) {
  const ticks = useMemo(() => buildPriceScale(prices, theme).ticks, [prices, theme]);
  const stops = useMemo(() => {
    const ramp = priceRamp(theme);
    return d3.range(0, 1.0001, 0.125).map((t) => ramp(t));
  }, [theme]);
  if (ticks.length === 0) return null;

  return (
    <div className="mt-3">
      <Bar id="legend-gradient-price" stops={stops} />
      <div
        className="flex justify-between mt-1 text-[11px] tabular-nums"
        style={{ width: BAR_WIDTH, color: LABEL_COLOR }}
      >
        {ticks.map((value, i) => (
          <span key={i}>{formatPrice(value)}</span>
        ))}
      </div>
      <Note>Each quarter of the bar is a quarter of the bottles.</Note>
    </div>
  );
}

function RangeLegend({ colorMode, theme }: { colorMode: "rating" | "rarity"; theme: ChartTheme }) {
  const stops = chartPalette(theme)[colorMode];
  const [min, max] = colorMode === "rating" ? ["1", "10"] : ["Common", "Unicorn"];

  return (
    <div className="mt-3">
      <Bar id={`legend-gradient-${colorMode}`} stops={[...stops]} />
      <div className="flex justify-between mt-1 text-[11px]" style={{ width: BAR_WIDTH, color: LABEL_COLOR }}>
        <span>{min}</span>
        <span>{max}</span>
      </div>
      {colorMode === "rating" && <Note>Dull, flat-coloured bubbles are not yet rated.</Note>}
    </div>
  );
}

function BrandLegend({ distilleryColors }: { distilleryColors: Map<string, string> }) {
  return (
    <div className="mt-3 space-y-1.5 overflow-y-auto" style={{ maxHeight: 180 }}>
      {[...distilleryColors.entries()].map(([name, color]) => (
        <div key={name} className="flex items-center gap-2">
          <div className="flex-shrink-0 rounded-full" style={{ width: 8, height: 8, background: color }} />
          <span className="text-[12px] truncate" style={{ color: "rgb(var(--ink-rgb) / 0.75)" }}>
            {name}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function ColorLegend({ colorMode, onColorModeChange, distilleryColors, prices, theme }: Props) {
  return (
    <div
      className="rounded-sm p-4 select-none"
      style={{
        background: "rgb(var(--panel-rgb) / 0.92)",
        border: "1px solid var(--line)",
        backdropFilter: "blur(4px)",
      }}
    >
      <p
        className="text-xs uppercase tracking-widest mb-3"
        style={{ color: LABEL_COLOR, fontFamily: "Georgia,serif", letterSpacing: "0.13em" }}
      >
        Color by
      </p>

      <div className="flex flex-col gap-1">
        {MODES.map((m) => (
          <button
            key={m.value}
            onClick={() => onColorModeChange(m.value)}
            aria-pressed={colorMode === m.value}
            className="flex items-center gap-2 px-3 py-1.5 rounded-sm text-sm font-medium transition-all text-left"
            style={
              colorMode === m.value
                ? { background: "rgb(var(--ink-rgb) / 0.1)", color: "var(--ink)", border: "1px solid rgb(var(--ink-rgb) / 0.25)" }
                : { background: "transparent", color: "var(--ink-muted)", border: "1px solid transparent" }
            }
          >
            <span aria-hidden="true">{m.emoji}</span>
            <span>{m.label}</span>
          </button>
        ))}
      </div>

      {colorMode === "price" && <PriceLegend prices={prices} theme={theme} />}
      {(colorMode === "rating" || colorMode === "rarity") && <RangeLegend colorMode={colorMode} theme={theme} />}
      {colorMode === "brand" && distilleryColors && <BrandLegend distilleryColors={distilleryColors} />}
    </div>
  );
}
