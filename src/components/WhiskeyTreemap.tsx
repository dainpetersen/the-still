"use client";

import { useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";
import { ColorMode } from "@/types/whiskey";

interface TreemapNode {
  name: string;
  type: string;
  id?: string;
  value?: number;
  price?: number;
  rarityScore?: number;
  rarity?: string;
  avgRating?: number;
  ratingCount?: number;
  abv?: number;
  age?: number;
  description?: string;
  isNDP?: boolean;
  source?: "official" | "community";
  sourceDistillery?: string;
  country?: string;
  region?: string;
  children?: TreemapNode[];
}

interface Props {
  data: TreemapNode;
  colorMode: ColorMode;
  onBottleClick: (node: TreemapNode) => void;
  ratings: Record<string, { avg: number; count: number }>;
}

function getColorScale(colorMode: ColorMode) {
  switch (colorMode) {
    case "price":
      return d3.scaleSequentialLog(d3.interpolate("#d1fae5", "#14532d")).domain([15, 3500]);
    case "rating":
      return d3.scaleSequential(d3.interpolate("#374151", "#f59e0b")).domain([1, 10]);
    case "rarity":
      return d3.scaleSequential(d3.interpolate("#fef9c3", "#9f1239")).domain([0, 100]);
  }
}

function getNodeValue(
  node: d3.HierarchyRectangularNode<TreemapNode>,
  colorMode: ColorMode,
  ratings: Record<string, { avg: number; count: number }>
): number | null {
  const d = node.data;
  if (d.type !== "bottle") return null;
  switch (colorMode) {
    case "price": return d.price ?? null;
    case "rating": {
      const r = d.id ? ratings[d.id] : null;
      return r ? r.avg : null;
    }
    case "rarity": return d.rarityScore ?? null;
  }
}

/**
 * Returns a contrast-safe text color (#0f172a or #ffffff) for the given
 * background fill, based on WCAG relative luminance.
 */
function getContrastColor(fill: string): string {
  const c = d3.color(fill);
  if (!c) return "#ffffff";
  const { r, g, b } = c.rgb();
  const lin = (v: number) => {
    const n = v / 255;
    return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  // Use dark text when background is light (threshold calibrated for our palette)
  return L > 0.35 ? "#0f172a" : "#ffffff";
}

/**
 * Wraps `text` into lines that fit within `maxWidth` (using character-width
 * estimation) up to `maxLines` lines. Returns an array of line strings.
 */
const CHAR_W = 0.57; // empirical: avg char width / font size for system-ui

function wrapTextToLines(
  text: string,
  maxWidth: number,
  maxLines: number,
  fontSize: number
): string[] {
  const charLimit = Math.max(3, Math.floor(maxWidth / (fontSize * CHAR_W)));
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= charLimit) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      if (lines.length >= maxLines) break;
      // If a single word is too long, hard-truncate it
      current =
        word.length > charLimit ? word.slice(0, charLimit - 1) + "…" : word;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines.slice(0, maxLines);
}

export default function WhiskeyTreemap({ data, colorMode, onBottleClick, ratings }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const draw = useCallback(() => {
    if (!svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", height);

    const defs = svg.append("defs");
    const colorScale = getColorScale(colorMode);
    const unratedColor = "#1f2937";

    const root = d3
      .hierarchy<TreemapNode>(data)
      .sum(() => 1)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    const treemap = d3
      .treemap<TreemapNode>()
      .size([width, height])
      .paddingOuter(3)
      // Give each level only as much top-padding as its label needs
      .paddingTop((d) => {
        if (d.depth === 0) return 0;   // root — no label
        if (d.depth === 1) return 18;  // brand label (12px font + 6px gap)
        return 14;                     // sub-brand label (10px font + 4px gap)
      })
      .paddingInner(1)
      .round(true);

    treemap(root);

    // ── Tooltip ───────────────────────────────────────────────────────────────
    const tooltip = d3
      .select("body")
      .selectAll<HTMLDivElement, null>(".treemap-tooltip")
      .data([null])
      .join("div")
      .attr("class", "treemap-tooltip")
      .style("position", "fixed")
      .style("pointer-events", "none")
      .style("background", "rgba(15,15,20,0.95)")
      .style("border", "1px solid rgba(245,158,11,0.4)")
      .style("border-radius", "8px")
      .style("padding", "10px 14px")
      .style("font-family", "system-ui, sans-serif")
      .style("font-size", "13px")
      .style("color", "#f5f5f5")
      .style("max-width", "230px")
      .style("line-height", "1.5")
      .style("z-index", "9999")
      .style("opacity", "0")
      .style("transition", "opacity 0.15s");

    // ── Draw nodes ────────────────────────────────────────────────────────────
    const nodes = svg
      .selectAll<SVGGElement, d3.HierarchyRectangularNode<TreemapNode>>("g.node")
      .data(root.descendants() as d3.HierarchyRectangularNode<TreemapNode>[])
      .join("g")
      .attr("class", "node")
      .attr("transform", (d) => `translate(${d.x0},${d.y0})`);

    nodes.each(function (d, i) {
      const clipId = `clip-${i}`;
      defs
        .append("clipPath")
        .attr("id", clipId)
        .append("rect")
        .attr("width", Math.max(0, d.x1 - d.x0))
        .attr("height", Math.max(0, d.y1 - d.y0));
      d3.select(this).attr("clip-path", `url(#${clipId})`);
    });

    // Rectangles
    nodes
      .append("rect")
      .attr("width", (d) => Math.max(0, d.x1 - d.x0))
      .attr("height", (d) => Math.max(0, d.y1 - d.y0))
      .attr("rx", 3)
      .attr("ry", 3)
      .attr("fill", (d) => {
        if (d.data.type === "bottle") {
          const val = getNodeValue(d, colorMode, ratings);
          return val !== null ? colorScale(val) : unratedColor;
        }
        if (d.data.type === "subBrand") return "rgba(30,30,40,0.6)";
        if (d.data.type === "brand") return "rgba(15,15,25,0.8)";
        return "transparent";
      })
      .attr("stroke", (d) => {
        if (d.data.source === "community") return "rgba(139,92,246,0.75)";
        if (d.data.type === "brand") return "rgba(245,158,11,0.6)";
        if (d.data.type === "subBrand") return "rgba(245,158,11,0.25)";
        return "rgba(255,255,255,0.08)";
      })
      .attr("stroke-width", (d) => {
        if (d.data.source === "community") return 1.5;
        if (d.data.type === "brand") return 2;
        return 1;
      })
      .attr("stroke-dasharray", (d) => (d.data.source === "community" ? "5,3" : null))
      .style("cursor", (d) => (d.data.type === "bottle" ? "pointer" : "default"))
      .on("mouseover", function (event, d) {
        if (d.data.type !== "bottle") return;
        d3.select(this).attr("stroke", "#f59e0b").attr("stroke-width", 2).attr("stroke-dasharray", null);

        const ratingInfo = d.data.id ? ratings[d.data.id] : null;
        const rarityLabel = d.data.rarity
          ? d.data.rarity.charAt(0).toUpperCase() + d.data.rarity.slice(1)
          : "Unknown";
        const communityBadge =
          d.data.source === "community"
            ? `<div style="margin-top:4px;font-size:10px;color:rgba(196,181,253,0.9);background:rgba(139,92,246,0.15);padding:2px 6px;border-radius:4px;display:inline-block">★ Community entry</div>`
            : "";
        const sourceLine = d.data.sourceDistillery
          ? `<div style="font-size:11px;color:#6b7280">Source: ${d.data.sourceDistillery}</div>`
          : "";

        tooltip
          .html(
            `<div style="font-weight:600;margin-bottom:4px;color:#f59e0b">${d.data.name}</div>
             <div>💰 $${d.data.price?.toLocaleString()}</div>
             <div>🔥 ${d.data.abv}% ABV${d.data.age ? ` · ${d.data.age} Year` : " · NAS"}</div>
             <div>⚗️ Rarity: ${rarityLabel}</div>
             ${sourceLine}
             ${ratingInfo ? `<div>⭐ ${ratingInfo.avg}/10 (${ratingInfo.count} rating${ratingInfo.count !== 1 ? "s" : ""})</div>` : "<div style='color:#6b7280'>No ratings yet</div>"}
             <div style="margin-top:6px;font-size:11px;color:#9ca3af;font-style:italic">${d.data.description ?? ""}</div>
             ${communityBadge}
             <div style="margin-top:6px;font-size:11px;color:#f59e0b">Click to rate</div>`
          )
          .style("opacity", "1");
      })
      .on("mousemove", function (event) {
        const tooltipEl = tooltip.node();
        if (!tooltipEl) return;
        const tw = tooltipEl.offsetWidth;
        const th = tooltipEl.offsetHeight;
        tooltip
          .style("left", `${Math.min(event.clientX + 12, window.innerWidth - tw - 10)}px`)
          .style("top", `${Math.min(event.clientY + 12, window.innerHeight - th - 10)}px`);
      })
      .on("mouseout", function (event, d) {
        if (d.data.type !== "bottle") return;
        const isCommunity = d.data.source === "community";
        d3.select(this)
          .attr("stroke", isCommunity ? "rgba(139,92,246,0.75)" : "rgba(255,255,255,0.08)")
          .attr("stroke-width", isCommunity ? 1.5 : 1)
          .attr("stroke-dasharray", isCommunity ? "5,3" : null);
        tooltip.style("opacity", "0");
      })
      .on("click", (event, d) => {
        if (d.data.type === "bottle") {
          event.stopPropagation();
          onBottleClick(d.data);
        }
      });

    // ── Labels ────────────────────────────────────────────────────────────────

    // Brand labels
    const brandNodes = nodes.filter((d) => d.data.type === "brand");

    brandNodes
      .append("text")
      .attr("x", 6)
      .attr("y", 13)
      .attr("fill", "#f59e0b")
      .attr("font-size", "12px")
      .attr("font-weight", "700")
      .attr("font-family", "system-ui, sans-serif")
      .attr("text-anchor", "start")
      .text((d) => {
        const w = d.x1 - d.x0;
        const name = d.data.name;
        return w > 80 ? name : name.substring(0, Math.floor(w / 8));
      });

    // NDP badge — small second line below brand name
    brandNodes
      .filter((d) => !!d.data.isNDP)
      .append("text")
      .attr("x", 6)
      .attr("y", 13)
      .attr("fill", "rgba(245,158,11,0.55)")
      .attr("font-size", "8px")
      .attr("font-weight", "700")
      .attr("font-family", "system-ui, sans-serif")
      .attr("text-anchor", "start")
      .attr("dy", "13px")
      .text((d) => ((d.x1 - d.x0) > 60 ? "NDP" : ""));

    // Sub-brand labels
    nodes
      .filter((d) => d.data.type === "subBrand")
      .append("text")
      .attr("x", 4)
      .attr("y", 11)
      .attr("fill", (d) =>
        d.data.source === "community" ? "rgba(196,181,253,0.75)" : "rgba(245,158,11,0.7)"
      )
      .attr("font-size", "10px")
      .attr("font-weight", "600")
      .attr("font-family", "system-ui, sans-serif")
      .text((d) => {
        const w = d.x1 - d.x0;
        return w > 60 ? d.data.name : "";
      });

    // ── Bottle labels: dynamic contrast + word-wrap ───────────────────────────
    const FONT = 10;   // px — bottle name font size
    const LINE = 13;   // px — line height
    const PAD  = 4;    // px — inner cell padding
    const SUB  = 9;    // px — sub-label font size

    nodes
      .filter((d) => d.data.type === "bottle")
      .each(function (d) {
        const g = d3.select<SVGGElement, d3.HierarchyRectangularNode<TreemapNode>>(this);
        const w = d.x1 - d.x0;
        const h = d.y1 - d.y0;
        if (w < 30 || h < 20) return;

        // Determine background color for this cell → pick contrasting text color
        const val = getNodeValue(d, colorMode, ratings);
        const fillHex = val !== null ? colorScale(val) : unratedColor;
        const textColor = getContrastColor(fillHex);
        const mutedColor =
          textColor === "#0f172a" ? "rgba(15,23,42,0.55)" : "rgba(255,255,255,0.55)";

        // How much height is available for the name block?
        const showSub = h >= 44;
        const subBlockH = showSub ? SUB + 3 : 0;   // sub-label height + gap
        const availH = h - PAD * 2 - subBlockH;
        const availW = w - PAD * 2;
        const maxLines = Math.max(1, Math.floor(availH / LINE));

        const lines = wrapTextToLines(d.data.name, availW, maxLines, FONT);
        const nameH = lines.length * LINE;

        // Vertically center the name+sub block
        const blockTop = (h - nameH - subBlockH) / 2;

        // Name tspans
        const nameEl = g
          .append("text")
          .attr("fill", textColor)
          .attr("font-size", `${FONT}px`)
          .attr("font-weight", "500")
          .attr("font-family", "system-ui, sans-serif")
          .attr("text-anchor", "middle")
          .style("pointer-events", "none");

        lines.forEach((line, i) => {
          nameEl
            .append("tspan")
            .attr("x", w / 2)
            .attr("y", blockTop + i * LINE + FONT)
            .text(line);
        });

        // Sub-label (price / rating / rarity)
        if (showSub) {
          let sublabel = "";
          if (colorMode === "price")
            sublabel = `$${d.data.price?.toLocaleString() ?? ""}`;
          else if (colorMode === "rating") {
            const r = d.data.id ? ratings[d.data.id] : null;
            sublabel = r ? `★ ${r.avg}` : "unrated";
          } else if (colorMode === "rarity") {
            sublabel = d.data.rarity ?? "";
          }

          if (sublabel) {
            g.append("text")
              .attr("x", w / 2)
              .attr("y", blockTop + nameH + SUB + 1)
              .attr("fill", mutedColor)
              .attr("font-size", `${SUB}px`)
              .attr("text-anchor", "middle")
              .style("pointer-events", "none")
              .text(sublabel);
          }
        }
      });
  }, [data, colorMode, onBottleClick, ratings]);

  useEffect(() => {
    draw();
    const observer = new ResizeObserver(draw);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [draw]);

  return (
    <div ref={containerRef} className="w-full h-full">
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
}
