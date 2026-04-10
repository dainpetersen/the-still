"use client";

import * as d3 from "d3";
import { ColorMode } from "@/types/whiskey";

interface Props {
  colorMode: ColorMode;
  onColorModeChange: (mode: ColorMode) => void;
  distilleryColors?: Map<string, string>;
}

const MODES: { value: ColorMode; label: string; emoji: string }[] = [
  { value: "price",  label: "Price",  emoji: "💰" },
  { value: "rating", label: "Rating", emoji: "⭐" },
  { value: "rarity", label: "Rarity", emoji: "💎" },
  { value: "brand",  label: "Brand",  emoji: "🏭" },
];

function GradientBar({ colorMode }: { colorMode: ColorMode }) {
  const id = `legend-gradient-${colorMode}`;
  const width = 160;
  const height = 10;

  let stops: { offset: string; color: string }[] = [];
  let minLabel = "";
  let maxLabel = "";

  if (colorMode === "price") {
    const scale = d3.scaleSequentialLog(d3.interpolate("#e4d4a8", "#1a0800")).domain([15, 3500]);
    stops = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
      offset: `${t * 100}%`,
      color: scale(15 * Math.pow(3500 / 15, t)),
    }));
    minLabel = "$15";
    maxLabel = "$3,500";
  } else if (colorMode === "rating") {
    const scale = d3.scaleSequential(d3.interpolate("#c8b880", "#6b1200")).domain([1, 10]);
    stops = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
      offset: `${t * 100}%`,
      color: scale(1 + t * 9),
    }));
    minLabel = "1";
    maxLabel = "10";
  } else {
    const scale = d3.scaleSequential(d3.interpolate("#ddd0b0", "#5c0a0a")).domain([0, 100]);
    stops = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
      offset: `${t * 100}%`,
      color: scale(t * 100),
    }));
    minLabel = "Common";
    maxLabel = "Unicorn";
  }

  return (
    <div className="mt-2">
      <svg width={width} height={height + 20}>
        <defs>
          <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="0%">
            {stops.map((s) => (
              <stop key={s.offset} offset={s.offset} stopColor={s.color} />
            ))}
          </linearGradient>
        </defs>
        <rect x={0} y={0} width={width} height={height} fill={`url(#${id})`} rx={1} ry={1} />
        <text x={0} y={height + 14} fill="rgba(13,11,8,0.45)" fontSize={10} fontFamily="Georgia,serif">
          {minLabel}
        </text>
        <text
          x={width}
          y={height + 14}
          fill="rgba(13,11,8,0.45)"
          fontSize={10}
          fontFamily="Georgia,serif"
          textAnchor="end"
        >
          {maxLabel}
        </text>
      </svg>
      <p className="text-xs mt-1" style={{ color: "rgba(13,11,8,0.4)", fontFamily: "Georgia,serif", fontStyle: "italic" }}>
        Pale = unrated / no data
      </p>
    </div>
  );
}

function BrandLegend({ distilleryColors }: { distilleryColors: Map<string, string> }) {
  return (
    <div className="mt-2 space-y-1.5 overflow-y-auto" style={{ maxHeight: 180 }}>
      {[...distilleryColors.entries()].map(([name, color]) => (
        <div key={name} className="flex items-center gap-2">
          <div
            className="flex-shrink-0 rounded-full"
            style={{ width: 8, height: 8, background: color }}
          />
          <span className="text-xs truncate" style={{ color: "rgba(13,11,8,0.6)" }}>
            {name}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function ColorLegend({ colorMode, onColorModeChange, distilleryColors }: Props) {
  return (
    <div
      className="rounded-sm p-4 select-none"
      style={{
        background: "rgba(244,238,224,0.92)",
        border: "1px solid rgba(0,0,0,0.14)",
        backdropFilter: "blur(4px)",
        minWidth: "200px",
      }}
    >
      <p
        className="text-xs uppercase tracking-widest mb-3"
        style={{ color: "rgba(13,11,8,0.45)", fontFamily: "Georgia,serif", letterSpacing: "0.13em" }}
      >
        Color by
      </p>

      <div className="flex flex-col gap-1">
        {MODES.map((m) => (
          <button
            key={m.value}
            onClick={() => onColorModeChange(m.value)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-sm text-sm font-medium transition-all text-left"
            style={
              colorMode === m.value
                ? { background: "rgba(13,11,8,0.1)", color: "#0d0b08", border: "1px solid rgba(13,11,8,0.25)" }
                : { background: "transparent", color: "rgba(13,11,8,0.5)", border: "1px solid transparent" }
            }
          >
            <span>{m.emoji}</span>
            <span>{m.label}</span>
          </button>
        ))}
      </div>

      {colorMode === "brand" && distilleryColors ? (
        <BrandLegend distilleryColors={distilleryColors} />
      ) : colorMode !== "brand" ? (
        <GradientBar colorMode={colorMode} />
      ) : null}
    </div>
  );
}
