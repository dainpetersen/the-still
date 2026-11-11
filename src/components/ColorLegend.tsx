"use client";

import { useMemo } from "react";
import * as d3 from "d3";
import { ColorMode } from "@/types/whiskey";
import { PRICE_RAMP, buildPriceScale } from "@/lib/colorScales";

interface Props {
  colorMode: ColorMode;
  onColorModeChange: (mode: ColorMode) => void;
  distilleryColors?: Map<string, string>;
  /** Prices of the bottles on the chart — the price colours are ranked from these. */
  prices: number[];
}

const MODES: { value: ColorMode; label: string; emoji: string }[] = [
  { value: "price",  label: "Price",  emoji: "💰" },
  { value: "rating", label: "Rating", emoji: "⭐" },
  { value: "rarity", label: "Rarity", emoji: "💎" },
  { value: "brand",  label: "Brand",  emoji: "🏭" },
];

const BAR_WIDTH = 160;
const BAR_HEIGHT = 10;
const LABEL_COLOR = "rgba(13,11,8,0.6)";

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
function PriceLegend({ prices }: { prices: number[] }) {
  const ticks = useMemo(() => buildPriceScale(prices).ticks, [prices]);
  const stops = useMemo(() => d3.range(0, 1.0001, 0.125).map((t) => PRICE_RAMP(t)), []);
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

function RangeLegend({ colorMode }: { colorMode: "rating" | "rarity" }) {
  const scale =
    colorMode === "rating"
      ? d3.scaleSequential(d3.interpolate("#c8b880", "#6b1200")).domain([0, 1])
      : d3.scaleSequential(d3.interpolate("#ddd0b0", "#5c0a0a")).domain([0, 1]);
  const stops = [0, 0.25, 0.5, 0.75, 1].map((t) => scale(t));
  const [min, max] = colorMode === "rating" ? ["1", "10"] : ["Common", "Unicorn"];

  return (
    <div className="mt-3">
      <Bar id={`legend-gradient-${colorMode}`} stops={stops} />
      <div className="flex justify-between mt-1 text-[11px]" style={{ width: BAR_WIDTH, color: LABEL_COLOR }}>
        <span>{min}</span>
        <span>{max}</span>
      </div>
      {colorMode === "rating" && <Note>Pale grey-tan = not yet rated.</Note>}
    </div>
  );
}

function BrandLegend({ distilleryColors }: { distilleryColors: Map<string, string> }) {
  return (
    <div className="mt-3 space-y-1.5 overflow-y-auto" style={{ maxHeight: 180 }}>
      {[...distilleryColors.entries()].map(([name, color]) => (
        <div key={name} className="flex items-center gap-2">
          <div className="flex-shrink-0 rounded-full" style={{ width: 8, height: 8, background: color }} />
          <span className="text-[12px] truncate" style={{ color: "rgba(13,11,8,0.7)" }}>
            {name}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function ColorLegend({ colorMode, onColorModeChange, distilleryColors, prices }: Props) {
  return (
    <div
      className="rounded-sm p-4 select-none"
      style={{
        background: "rgba(244,238,224,0.92)",
        border: "1px solid rgba(0,0,0,0.14)",
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
                ? { background: "rgba(13,11,8,0.1)", color: "#0d0b08", border: "1px solid rgba(13,11,8,0.25)" }
                : { background: "transparent", color: "rgba(13,11,8,0.6)", border: "1px solid transparent" }
            }
          >
            <span aria-hidden="true">{m.emoji}</span>
            <span>{m.label}</span>
          </button>
        ))}
      </div>

      {colorMode === "price" && <PriceLegend prices={prices} />}
      {(colorMode === "rating" || colorMode === "rarity") && <RangeLegend colorMode={colorMode} />}
      {colorMode === "brand" && distilleryColors && <BrandLegend distilleryColors={distilleryColors} />}
    </div>
  );
}
