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
  availability?: "current" | "limited_release" | "discontinued";
  country?: string;
  region?: string;
  children?: TreemapNode[];
}

interface Props {
  data: TreemapNode;
  colorMode: ColorMode;
  onBottleClick: (node: TreemapNode) => void;
  ratings: Record<string, { avg: number; count: number }>;
  onBrandClick?: (brandName: string) => void;
  onSubBrandClick?: (subBrandName: string, brandName: string) => void;
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

/** WCAG relative luminance → dark or light text */
function getContrastColor(fill: string): string {
  const c = d3.color(fill);
  if (!c) return "#ffffff";
  const { r, g, b } = c.rgb();
  const lin = (v: number) => {
    const n = v / 255;
    return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.35 ? "#0f172a" : "#ffffff";
}

const CHAR_W = 0.57;

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
      current = word.length > charLimit ? word.slice(0, charLimit - 1) + "…" : word;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines.slice(0, maxLines);
}

export default function WhiskeyTreemap({
  data,
  colorMode,
  onBottleClick,
  ratings,
  onBrandClick,
  onSubBrandClick,
}: Props) {
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
      // Only count leaf nodes (bottles) so parent nodes don't consume space.
      // If we used () => 1, every brand/sub-brand node would claim 1 extra unit
      // of area, causing treemapSlice to leave a proportional gap at the bottom
      // of each sub-brand container.
      .sum((d) => (d.children && d.children.length > 0 ? 0 : 1))
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    const treemap = d3
      .treemap<TreemapNode>()
      .size([width, height])
      .paddingOuter(2)
      // Only brand level gets a reserved strip for its label.
      // Sub-brand labels float as overlay pills → zero wasted space.
      .paddingTop((d) => (d.depth === 1 ? 16 : 0))
      .paddingInner(1)
      // At the sub-brand level (depth=2), use treemapSlice so bottles always
      // stack top-to-bottom and fill 100% of the sub-brand area.  At every
      // other level keep the default squarify aesthetic.
      .tile((node, x0, y0, x1, y1) => {
        if (node.depth === 2) {
          d3.treemapSlice(node, x0, y0, x1, y1);
        } else {
          d3.treemapSquarify(node, x0, y0, x1, y1);
        }
      })
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

    // ── Node groups ───────────────────────────────────────────────────────────
    const nodes = svg
      .selectAll<SVGGElement, d3.HierarchyRectangularNode<TreemapNode>>("g.node")
      .data(root.descendants() as d3.HierarchyRectangularNode<TreemapNode>[])
      .join("g")
      .attr("class", "node")
      .attr("transform", (d) => `translate(${d.x0},${d.y0})`)
      // Dim discontinued bottles at the group level so both rect + text fade
      .style("opacity", (d) =>
        d.data.type === "bottle" && d.data.availability === "discontinued" ? 0.35 : 1
      );

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

    // ── Rectangles ────────────────────────────────────────────────────────────
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
        if (d.data.type === "subBrand") return "rgba(30,30,40,0.25)";
        if (d.data.type === "brand") return "rgba(15,15,25,0.85)";
        return "transparent";
      })
      .attr("stroke", (d) => {
        if (d.data.source === "community") return "rgba(139,92,246,0.75)";
        if (d.data.type === "brand") return "rgba(245,158,11,0.5)";
        if (d.data.type === "subBrand") return "rgba(245,158,11,0.2)";
        return "rgba(255,255,255,0.08)";
      })
      .attr("stroke-width", (d) => {
        if (d.data.source === "community") return 1.5;
        if (d.data.type === "brand") return 1.5;
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
        const availabilityBadge =
          d.data.availability === "discontinued"
            ? `<div style="margin-top:4px;font-size:10px;color:rgba(156,163,175,0.9);background:rgba(75,85,99,0.25);padding:2px 6px;border-radius:4px;display:inline-block">⛔ Discontinued</div>`
            : d.data.availability === "limited_release"
            ? `<div style="margin-top:4px;font-size:10px;color:rgba(245,158,11,0.9);background:rgba(245,158,11,0.1);padding:2px 6px;border-radius:4px;display:inline-block">⏳ Limited release</div>`
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
             ${communityBadge}${availabilityBadge}
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

    // ── Bottle labels: dynamic contrast + word-wrap ───────────────────────────
    const FONT = 10;
    const LINE = 13;
    const PAD  = 4;
    const SUB  = 9;

    nodes
      .filter((d) => d.data.type === "bottle")
      .each(function (d) {
        const g = d3.select<SVGGElement, d3.HierarchyRectangularNode<TreemapNode>>(this);
        const w = d.x1 - d.x0;
        const h = d.y1 - d.y0;
        if (w < 30 || h < 20) return;

        const val = getNodeValue(d, colorMode, ratings);
        const fillHex = val !== null ? colorScale(val) : unratedColor;
        const textColor = getContrastColor(fillHex);
        const mutedColor =
          textColor === "#0f172a" ? "rgba(15,23,42,0.55)" : "rgba(255,255,255,0.55)";

        const showSub = h >= 44;
        const subBlockH = showSub ? SUB + 3 : 0;
        const availH = h - PAD * 2 - subBlockH;
        const availW = w - PAD * 2;
        const maxLines = Math.max(1, Math.floor(availH / LINE));

        const lines = wrapTextToLines(d.data.name, availW, maxLines, FONT);
        const nameH = lines.length * LINE;
        const blockTop = (h - nameH - subBlockH) / 2;

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

    // ── Overlay label layer — rendered last so it sits above all cell content ─
    //
    // Brand labels live in their 16px paddingTop strip (no overlap with cells).
    // Sub-brand labels float as small pills over the top-left of their cell area.
    //
    const labelLayer = svg.append("g").attr("class", "label-overlay");

    // Brand labels (in the dedicated 16px strip)
    (root.descendants() as d3.HierarchyRectangularNode<TreemapNode>[])
      .filter((d) => d.data.type === "brand")
      .forEach((d) => {
        const x = d.x0;
        const y = d.y0;
        const w = d.x1 - d.x0;
        if (w < 24) return;

        const name = w > 90 ? d.data.name : d.data.name.substring(0, Math.floor(w / 8));
        if (!name) return;

        const isClickable = !!onBrandClick;

        const g = labelLayer
          .append("g")
          .style("cursor", isClickable ? "pointer" : "default");

        if (isClickable) {
          // Invisible hit-area covering the full brand strip
          g.append("rect")
            .attr("x", x)
            .attr("y", y)
            .attr("width", w)
            .attr("height", 16)
            .attr("fill", "transparent")
            .on("click", () => onBrandClick!(d.data.name))
            .on("mouseover", function () {
              labelText.attr("fill", "#fbbf24");
            })
            .on("mouseout", function () {
              labelText.attr("fill", "#f59e0b");
            });
        }

        const labelText = g
          .append("text")
          .attr("x", x + 6)
          .attr("y", y + 11)
          .attr("fill", "#f59e0b")
          .attr("font-size", "11px")
          .attr("font-weight", "700")
          .attr("font-family", "system-ui, sans-serif")
          .attr("text-anchor", "start")
          .style("pointer-events", "none")
          .text(name);

        if (d.data.isNDP && w > 70) {
          g.append("text")
            .attr("x", x + 6 + name.length * 6.8 + 5)
            .attr("y", y + 10)
            .attr("fill", "rgba(245,158,11,0.45)")
            .attr("font-size", "8px")
            .attr("font-weight", "700")
            .attr("font-family", "system-ui, sans-serif")
            .style("pointer-events", "none")
            .text("NDP");
        }

        // Chevron hint when clickable
        if (isClickable && w > 100) {
          g.append("text")
            .attr("x", x + w - 8)
            .attr("y", y + 11)
            .attr("fill", "rgba(245,158,11,0.3)")
            .attr("font-size", "9px")
            .attr("text-anchor", "end")
            .style("pointer-events", "none")
            .text("›");
        }
      });

    // Sub-brand labels (floating pill over top-left of sub-brand area)
    (root.descendants() as d3.HierarchyRectangularNode<TreemapNode>[])
      .filter((d) => d.data.type === "subBrand")
      .forEach((d) => {
        const x = d.x0;
        const y = d.y0;
        const w = d.x1 - d.x0;
        const h = d.y1 - d.y0;
        if (w < 40 || h < 16) return;

        const name = d.data.name;
        const isCommunity = d.data.source === "community";
        const isClickable = !!onSubBrandClick;

        const PILL_H = 14;
        const pillW = Math.min(name.length * 5.8 + 10, w - 4);

        const g = labelLayer
          .append("g")
          .style("cursor", isClickable ? "pointer" : "default");

        // Pill background
        const pill = g
          .append("rect")
          .attr("x", x + 2)
          .attr("y", y + 1)
          .attr("width", pillW)
          .attr("height", PILL_H)
          .attr("rx", 3)
          .attr("fill", "rgba(8,8,18,0.82)");

        g.append("text")
          .attr("x", x + 6)
          .attr("y", y + 10)
          .attr("fill", isCommunity ? "rgba(196,181,253,0.9)" : "rgba(245,158,11,0.8)")
          .attr("font-size", "10px")
          .attr("font-weight", "600")
          .attr("font-family", "system-ui, sans-serif")
          .style("pointer-events", "none")
          .text(name);

        if (isClickable) {
          const parentBrand = (d as d3.HierarchyRectangularNode<TreemapNode> & {
            parent?: d3.HierarchyNode<TreemapNode>;
          }).parent?.data.name ?? "";

          g.on("click", () => onSubBrandClick!(name, parentBrand))
            .on("mouseover", () =>
              pill.attr("fill", isCommunity ? "rgba(139,92,246,0.25)" : "rgba(245,158,11,0.18)")
            )
            .on("mouseout", () => pill.attr("fill", "rgba(8,8,18,0.82)"));
        }
      });
  }, [data, colorMode, onBottleClick, ratings, onBrandClick, onSubBrandClick]);

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
