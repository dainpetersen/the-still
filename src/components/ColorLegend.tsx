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
  const height = 12;

  let stops: { offset: string; color: string }[] = [];
  let minLabel = "";
  let maxLabel = "";

  if (colorMode === "price") {
    const scale = d3.scaleSequentialLog(d3.interpolate("#d1fae5", "#14532d")).domain([15, 3500]);
    stops = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
      offset: `${t * 100}%`,
      color: scale(15 * Math.pow(3500 / 15, t)),
    }));
    minLabel = "$15";
    maxLabel = "$3,500";
  } else if (colorMode === "rating") {
    const scale = d3.scaleSequential(d3.interpolate("#374151", "#f59e0b")).domain([1, 10]);
    stops = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
      offset: `${t * 100}%`,
      color: scale(1 + t * 9),
    }));
    minLabel = "1";
    maxLabel = "10";
  } else {
    const scale = d3.scaleSequential(d3.interpolate("#fef9c3", "#9f1239")).domain([0, 100]);
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
        <rect x={0} y={0} width={width} height={height} fill={`url(#${id})`} rx={3} ry={3} />
        <text x={0} y={height + 14} fill="#6b7280" fontSize={10} fontFamily="system-ui">
          {minLabel}
        </text>
        <text
          x={width}
          y={height + 14}
          fill="#6b7280"
          fontSize={10}
          fontFamily="system-ui"
          textAnchor="end"
        >
          {maxLabel}
        </text>
      </svg>
      <p className="text-xs text-gray-600 mt-1">
        Dark = unrated / no data
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
            style={{
              width: 10,
              height: 10,
              background: color,
              boxShadow: `0 0 5px 1px ${color}66`,
            }}
          />
          <span
            className="text-xs truncate"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
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
      className="rounded-xl p-4 select-none"
      style={{
        background: "rgba(10,10,20,0.85)",
        border: "1px solid rgba(245,158,11,0.25)",
        backdropFilter: "blur(8px)",
        minWidth: "200px",
      }}
    >
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
        Color by
      </p>

      {/* Mode toggles */}
      <div className="flex flex-col gap-1">
        {MODES.map((m) => (
          <button
            key={m.value}
            onClick={() => onColorModeChange(m.value)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-all text-left ${
              colorMode === m.value
                ? "bg-amber-500 text-black"
                : "text-gray-400 hover:text-white hover:bg-gray-800"
            }`}
          >
            <span>{m.emoji}</span>
            <span>{m.label}</span>
          </button>
        ))}
      </div>

      {/* Legend — gradient for price/rating/rarity; dot list for brand */}
      {colorMode === "brand" && distilleryColors ? (
        <BrandLegend distilleryColors={distilleryColors} />
      ) : colorMode !== "brand" ? (
        <GradientBar colorMode={colorMode} />
      ) : null}
    </div>
  );
}
