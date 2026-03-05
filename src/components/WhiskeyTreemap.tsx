"use client";

import { useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";
import { ColorMode, GroupMode } from "@/types/whiskey";

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
  children?: TreemapNode[];
}

interface Props {
  data: TreemapNode;
  colorMode: ColorMode;
  groupMode: GroupMode;
  onBottleClick: (node: TreemapNode) => void;
  onBottleFlag?: (id: string, name: string) => void;
  ratings: Record<string, { avg: number; count: number }>;
  onBrandClick?: (brandName: string) => void;
  onSubBrandClick?: (subBrandName: string, brandName: string) => void;
}

type HRNode = d3.HierarchyRectangularNode<TreemapNode>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tooltip = d3.Selection<HTMLDivElement, null, any, any>;

// ── Color helpers ─────────────────────────────────────────────────────────────

function getColorScale(colorMode: ColorMode) {
  switch (colorMode) {
    case "price":
      return d3.scaleSequentialLog(d3.interpolate("#d1fae5", "#14532d")).domain([15, 3500]);
    case "rating":
      return d3.scaleSequential(d3.interpolate("#374151", "#f59e0b")).domain([1, 10]);
    case "rarity":
    default:
      return d3.scaleSequential(d3.interpolate("#fef9c3", "#9f1239")).domain([0, 100]);
  }
}

function getNodeValue(
  node: HRNode,
  colorMode: ColorMode,
  ratings: Record<string, { avg: number; count: number }>
): number | null {
  const d = node.data;
  if (d.type !== "bottle") return null;
  switch (colorMode) {
    case "price":   return d.price ?? null;
    case "rating":  return d.id ? (ratings[d.id]?.avg ?? null) : null;
    case "rarity":  return d.rarityScore ?? null;
    default:        return null;
  }
}

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

// ── Text helpers ──────────────────────────────────────────────────────────────

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

// ── Component ─────────────────────────────────────────────────────────────────

export default function WhiskeyTreemap({
  data,
  colorMode,
  groupMode,
  onBottleClick,
  onBottleFlag,
  ratings,
  onBrandClick,
  onSubBrandClick,
}: Props) {
  const svgRef      = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Track previous groupMode to decide whether to animate
  const prevGroupModeRef = useRef<GroupMode | null>(null);
  // Snapshot of bottle positions from last render (for FLIP)
  const prevPositionsRef = useRef<Map<string, { x0: number; y0: number; x1: number; y1: number }>>(new Map());

  // ── Build D3 treemap layout ──────────────────────────────────────────────
  function buildLayout(width: number, height: number): HRNode {
    const root = d3
      .hierarchy<TreemapNode>(data)
      .sum((d) => (d.children && d.children.length > 0 ? 0 : 1))
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    const laid = d3
      .treemap<TreemapNode>()
      .size([width, height])
      .paddingOuter(2)
      .paddingTop((d) => (d.depth === 1 ? 16 : 0))
      .paddingInner(1)
      .tile((node, x0, y0, x1, y1) => {
        if (node.depth === 2) {
          d3.treemapSlice(node, x0, y0, x1, y1);
        } else {
          d3.treemapSquarify(node, x0, y0, x1, y1);
        }
      })
      .round(true)(root);

    return laid as HRNode;
  }

  // ── Render a single bottle's rect + labels + events ──────────────────────
  function applyBottleContent(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    d: HRNode,
    w: number,
    h: number,
    colorScale: ReturnType<typeof getColorScale>,
    tooltip: Tooltip,
    showLabels: boolean
  ) {
    const unratedColor = "#1f2937";
    const val = getNodeValue(d, colorMode, ratings);
    const fillColor = val !== null ? colorScale(val) : unratedColor;
    const textColor = getContrastColor(fillColor);
    const mutedColor = textColor === "#0f172a" ? "rgba(15,23,42,0.55)" : "rgba(255,255,255,0.55)";
    const isCommunity = d.data.source === "community";

    g.append("rect")
      .attr("width", w)
      .attr("height", h)
      .attr("rx", 3)
      .attr("ry", 3)
      .attr("fill", fillColor)
      .attr("stroke", isCommunity ? "rgba(139,92,246,0.75)" : "rgba(255,255,255,0.08)")
      .attr("stroke-width", isCommunity ? 1.5 : 1)
      .attr("stroke-dasharray", isCommunity ? "5,3" : null)
      .style("cursor", "pointer")
      .on("mouseover", function (event: MouseEvent) {
        d3.select(this)
          .attr("stroke", "#f59e0b")
          .attr("stroke-width", 2)
          .attr("stroke-dasharray", null);

        const ratingInfo = d.data.id ? ratings[d.data.id] : null;
        const rarityLabel = d.data.rarity
          ? d.data.rarity.charAt(0).toUpperCase() + d.data.rarity.slice(1)
          : "Unknown";
        const communityBadge = isCommunity
          ? `<div style="margin-top:4px;font-size:10px;color:rgba(196,181,253,0.9);background:rgba(139,92,246,0.15);padding:2px 6px;border-radius:4px;display:inline-block">★ Community entry</div>`
          : "";
        const availBadge =
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
             ${ratingInfo
               ? `<div>⭐ ${ratingInfo.avg}/10 (${ratingInfo.count} rating${ratingInfo.count !== 1 ? "s" : ""})</div>`
               : "<div style='color:#6b7280'>No ratings yet</div>"
             }
             <div style="margin-top:6px;font-size:11px;color:#9ca3af;font-style:italic">${d.data.description ?? ""}</div>
             ${communityBadge}${availBadge}
             <div style="margin-top:6px;font-size:11px;color:#f59e0b">Click to rate</div>`
          )
          .style("opacity", "1");
      })
      .on("mousemove", function (event: MouseEvent) {
        const el = tooltip.node();
        if (!el) return;
        const tw = el.offsetWidth;
        const th = el.offsetHeight;
        tooltip
          .style("left", `${Math.min(event.clientX + 12, window.innerWidth - tw - 10)}px`)
          .style("top",  `${Math.min(event.clientY + 12, window.innerHeight - th - 10)}px`);
      })
      .on("mouseout", function () {
        d3.select(this)
          .attr("stroke", isCommunity ? "rgba(139,92,246,0.75)" : "rgba(255,255,255,0.08)")
          .attr("stroke-width", isCommunity ? 1.5 : 1)
          .attr("stroke-dasharray", isCommunity ? "5,3" : null);
        tooltip.style("opacity", "0");
      })
      .on("click", (event: MouseEvent) => {
        event.stopPropagation();
        onBottleClick(d.data);
      });

    // ── Flag icon (report error) — appears on tile hover ──────────────────
    if (onBottleFlag && d.data.id && w >= 22 && h >= 18) {
      const flagEl = g
        .append("text")
        .attr("x", w - 4)
        .attr("y", 12)
        .attr("fill", "rgba(255,255,255,0.4)")
        .attr("font-size", "11px")
        .attr("text-anchor", "end")
        .attr("font-family", "system-ui, sans-serif")
        .style("pointer-events", "all")
        .style("cursor", "pointer")
        .style("user-select", "none")
        .attr("opacity", 0)
        .text("⚑");

      g.on("mouseenter.flag", () => flagEl.attr("opacity", 0.7))
       .on("mouseleave.flag", () => flagEl.attr("opacity", 0));

      flagEl
        .on("click", (event: MouseEvent) => {
          event.stopPropagation();
          onBottleFlag(d.data.id!, d.data.name);
        })
        .on("mouseover", function () {
          d3.select(this).attr("fill", "#f59e0b").attr("opacity", 1);
        })
        .on("mouseout", function () {
          d3.select(this).attr("fill", "rgba(255,255,255,0.4)").attr("opacity", 0.7);
        });
    }

    if (!showLabels || w < 30 || h < 20) return;

    const FONT = 10, LINE = 13, PAD = 4, SUB = 9;
    const showSub = h >= 44;
    const subBlockH = showSub ? SUB + 3 : 0;
    const maxLines = Math.max(1, Math.floor((h - PAD * 2 - subBlockH) / LINE));
    const lines = wrapTextToLines(d.data.name, w - PAD * 2, maxLines, FONT);
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
      if (colorMode === "price")       sublabel = `$${d.data.price?.toLocaleString() ?? ""}`;
      else if (colorMode === "rating") sublabel = d.data.id && ratings[d.data.id] ? `★ ${ratings[d.data.id].avg}` : "unrated";
      else if (colorMode === "rarity") sublabel = d.data.rarity ?? "";
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
  }

  // ── Render container layer (brand/group/subBrand background rects) ────────
  function renderContainerLayer(
    layer: d3.Selection<SVGGElement, unknown, null, undefined>,
    containerNodes: HRNode[]
  ) {
    containerNodes.forEach((d) => {
      const w = d.x1 - d.x0;
      const h = d.y1 - d.y0;
      if (w <= 0 || h <= 0) return;

      // depth=1: brand (distillery) or group (other modes)
      // depth=2: subBrand (distillery) or brand-within-group (other modes)
      const isTopLevel = d.depth === 1;
      const isSubLevel = d.depth === 2;

      layer
        .append("g")
        .attr("transform", `translate(${d.x0},${d.y0})`)
        .append("rect")
        .attr("width", w)
        .attr("height", h)
        .attr("rx", 3)
        .attr("ry", 3)
        .attr("fill", isTopLevel ? "rgba(15,15,25,0.85)" : isSubLevel ? "rgba(30,30,40,0.25)" : "transparent")
        .attr("stroke", () => {
          if (d.data.source === "community") return "rgba(139,92,246,0.75)";
          if (isTopLevel) return "rgba(245,158,11,0.5)";
          if (isSubLevel) return "rgba(245,158,11,0.2)";
          return "none";
        })
        .attr("stroke-width", isTopLevel ? 1.5 : 1)
        .attr("stroke-dasharray", d.data.source === "community" ? "5,3" : null);
    });
  }

  // ── Render label overlay ──────────────────────────────────────────────────
  function renderLabelLayer(
    layer: d3.Selection<SVGGElement, unknown, null, undefined>,
    root: HRNode,
    currentGroupMode: GroupMode,
    brandClickFn?: (name: string) => void,
    subBrandClickFn?: (sub: string, brand: string) => void
  ) {
    const allNodes = root.descendants() as HRNode[];

    // Depth-1: amber strip labels (brand in distillery, group name otherwise)
    allNodes
      .filter((d) => d.depth === 1)
      .forEach((d) => {
        const x = d.x0, y = d.y0, w = d.x1 - d.x0;
        if (w < 24) return;

        const name = w > 90 ? d.data.name : d.data.name.substring(0, Math.floor(w / 8));
        if (!name) return;

        const isClickable = currentGroupMode === "distillery" && !!brandClickFn;
        const g = layer.append("g").style("cursor", isClickable ? "pointer" : "default");

        if (isClickable) {
          g.append("rect")
            .attr("x", x).attr("y", y)
            .attr("width", w).attr("height", 16)
            .attr("fill", "transparent")
            .on("click",     () => brandClickFn!(d.data.name))
            .on("mouseover", () => labelText.attr("fill", "#fbbf24"))
            .on("mouseout",  () => labelText.attr("fill", "#f59e0b"));
        }

        const labelText = g
          .append("text")
          .attr("x", x + 6).attr("y", y + 11)
          .attr("fill", "#f59e0b")
          .attr("font-size", "11px").attr("font-weight", "700")
          .attr("font-family", "system-ui, sans-serif")
          .attr("text-anchor", "start")
          .style("pointer-events", "none")
          .text(name);

        if (d.data.isNDP && w > 70) {
          g.append("text")
            .attr("x", x + 6 + name.length * 6.8 + 5).attr("y", y + 10)
            .attr("fill", "rgba(245,158,11,0.45)")
            .attr("font-size", "8px").attr("font-weight", "700")
            .attr("font-family", "system-ui, sans-serif")
            .style("pointer-events", "none")
            .text("NDP");
        }

        if (isClickable && w > 100) {
          g.append("text")
            .attr("x", x + w - 8).attr("y", y + 11)
            .attr("fill", "rgba(245,158,11,0.3)")
            .attr("font-size", "9px").attr("text-anchor", "end")
            .style("pointer-events", "none")
            .text("›");
        }
      });

    // Depth-2: floating pill labels (subBrand in distillery, brand-within-group otherwise)
    allNodes
      .filter((d) => d.depth === 2)
      .forEach((d) => {
        const x = d.x0, y = d.y0;
        const w = d.x1 - d.x0, h = d.y1 - d.y0;
        if (w < 40 || h < 16) return;

        const name = d.data.name;
        const isCommunity = d.data.source === "community";
        const isClickable =
          currentGroupMode === "distillery" && !!subBrandClickFn && d.data.type === "subBrand";

        const PILL_H = 14;
        const pillW = Math.min(name.length * 5.8 + 10, w - 4);

        const g = layer.append("g").style("cursor", isClickable ? "pointer" : "default");

        const pill = g
          .append("rect")
          .attr("x", x + 2).attr("y", y + 1)
          .attr("width", pillW).attr("height", PILL_H)
          .attr("rx", 3)
          .attr("fill", "rgba(8,8,18,0.82)");

        g.append("text")
          .attr("x", x + 6).attr("y", y + 10)
          .attr("fill", isCommunity ? "rgba(196,181,253,0.9)" : "rgba(245,158,11,0.8)")
          .attr("font-size", "10px").attr("font-weight", "600")
          .attr("font-family", "system-ui, sans-serif")
          .style("pointer-events", "none")
          .text(name);

        if (isClickable) {
          const parentName =
            (d as HRNode & { parent?: d3.HierarchyNode<TreemapNode> }).parent?.data.name ?? "";
          g.on("click",     () => subBrandClickFn!(name, parentName))
           .on("mouseover", () => pill.attr("fill", isCommunity ? "rgba(139,92,246,0.25)" : "rgba(245,158,11,0.18)"))
           .on("mouseout",  () => pill.attr("fill", "rgba(8,8,18,0.82)"));
        }
      });
  }

  // ── Main draw function ────────────────────────────────────────────────────
  const draw = useCallback(
    (animate: boolean) => {
      if (!svgRef.current || !containerRef.current) return;

      const width  = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      if (!width || !height) return;

      const svg = d3.select(svgRef.current);
      svg.attr("width", width).attr("height", height);

      // Shared tooltip (single DOM node, reused across renders)
      const tooltip = d3
        .select("body")
        .selectAll<HTMLDivElement, null>(".treemap-tooltip")
        .data([null])
        .join("div")
        .attr("class", "treemap-tooltip")
        .style("position",       "fixed")
        .style("pointer-events", "none")
        .style("background",     "rgba(15,15,20,0.95)")
        .style("border",         "1px solid rgba(245,158,11,0.4)")
        .style("border-radius",  "8px")
        .style("padding",        "10px 14px")
        .style("font-family",    "system-ui, sans-serif")
        .style("font-size",      "13px")
        .style("color",          "#f5f5f5")
        .style("max-width",      "230px")
        .style("line-height",    "1.5")
        .style("z-index",        "9999")
        .style("opacity",        "0")
        .style("transition",     "opacity 0.15s");

      const root         = buildLayout(width, height);
      const allNodes     = root.descendants() as HRNode[];
      const bottleNodes  = allNodes.filter((d) => d.data.type === "bottle");
      const containerNodes = allNodes.filter((d) => d.data.type !== "bottle");
      const colorScale   = getColorScale(colorMode);

      const hasExistingBottleLayer = !svg.select("g.bottle-layer").empty();

      if (animate && hasExistingBottleLayer) {
        // ══ FLIP ANIMATION ═══════════════════════════════════════════════════
        const prevPos = prevPositionsRef.current;

        // Fade out container + label layers
        svg.select("g.container-layer")
          .transition().duration(200).style("opacity", "0")
          .on("end", function () { d3.select(this).remove(); });
        svg.select("g.label-overlay")
          .transition().duration(200).style("opacity", "0")
          .on("end", function () { d3.select(this).remove(); });

        const bottleLayer = svg.select<SVGGElement>("g.bottle-layer");

        const join = bottleLayer
          .selectAll<SVGGElement, HRNode>("g.bottle-node")
          .data(bottleNodes, (d) => d.data.id ?? d.data.name);

        // EXIT: fade out removed bottles
        join.exit()
          .transition().duration(300)
          .style("opacity", "0")
          .remove();

        // ENTER: position at previous location (or fade in if new)
        const entered = join
          .enter()
          .append("g")
          .attr("class", "bottle-node")
          .each(function (d) {
            const prev = prevPos.get(d.data.id ?? "");
            const g = d3.select<SVGGElement, HRNode>(this);
            if (prev) {
              // Start at old position with old size; transition to new
              g.attr("transform", `translate(${prev.x0},${prev.y0})`);
              applyBottleContent(
                g as unknown as d3.Selection<SVGGElement, unknown, null, undefined>,
                d, prev.x1 - prev.x0, prev.y1 - prev.y0,
                colorScale, tooltip, false
              );
            } else {
              // New bottle: fade in at destination
              g.attr("transform", `translate(${d.x0},${d.y0})`).style("opacity", "0");
              applyBottleContent(
                g as unknown as d3.Selection<SVGGElement, unknown, null, undefined>,
                d, d.x1 - d.x0, d.y1 - d.y0,
                colorScale, tooltip, false
              );
            }
          });

        const allBottleGroups = entered.merge(
          join as d3.Selection<SVGGElement, HRNode, SVGGElement, unknown>
        );

        // Hide any existing text during motion (will be rebuilt after)
        allBottleGroups.selectAll("text").style("opacity", "0");

        // Transition all bottles to new positions + sizes
        allBottleGroups.each(function (d) {
          const g = d3.select<SVGGElement, HRNode>(this);
          g.transition()
            .duration(650)
            .ease(d3.easeCubicInOut)
            .attr("transform", `translate(${d.x0},${d.y0})`)
            .style("opacity", String(d.data.availability === "discontinued" ? 0.35 : 1));
          g.select("rect")
            .transition()
            .duration(650)
            .ease(d3.easeCubicInOut)
            .attr("width",  d.x1 - d.x0)
            .attr("height", d.y1 - d.y0);
        });

        // After transition: re-render fills + labels, rebuild container/label layers
        setTimeout(() => {
          bottleLayer
            .selectAll<SVGGElement, HRNode>("g.bottle-node")
            .each(function (d) {
              const g = d3.select<SVGGElement, HRNode>(this);
              g.selectAll("*").remove();
              applyBottleContent(
                g as unknown as d3.Selection<SVGGElement, unknown, null, undefined>,
                d, d.x1 - d.x0, d.y1 - d.y0,
                colorScale, tooltip, true
              );
            });

          // Insert container layer BEFORE bottle layer
          svg.select("g.container-layer").remove();
          const newCL = svg.insert("g", "g.bottle-layer")
            .attr("class", "container-layer")
            .style("opacity", "0");
          renderContainerLayer(newCL, containerNodes);
          newCL.transition().duration(250).style("opacity", "1");

          // Append label layer AFTER bottle layer
          svg.select("g.label-overlay").remove();
          const newLL = svg.append("g")
            .attr("class", "label-overlay")
            .style("opacity", "0");
          renderLabelLayer(newLL, root, groupMode, onBrandClick, onSubBrandClick);
          newLL.transition().duration(250).style("opacity", "1");
        }, 720); // slightly after the 650ms bottle transition

      } else {
        // ══ HARD REBUILD ═════════════════════════════════════════════════════
        svg.selectAll("*").remove();

        const containerLayer = svg.append("g").attr("class", "container-layer");
        const bottleLayer    = svg.append("g").attr("class", "bottle-layer");
        const labelOverlay   = svg.append("g").attr("class", "label-overlay");

        renderContainerLayer(containerLayer, containerNodes);

        bottleNodes.forEach((d) => {
          const g = bottleLayer
            .append("g")
            .attr("class", "bottle-node")
            .datum(d)
            .attr("transform", `translate(${d.x0},${d.y0})`)
            .style("opacity", d.data.availability === "discontinued" ? "0.35" : "1");

          applyBottleContent(
            g as unknown as d3.Selection<SVGGElement, unknown, null, undefined>,
            d, d.x1 - d.x0, d.y1 - d.y0,
            colorScale, tooltip, true
          );
        });

        renderLabelLayer(labelOverlay, root, groupMode, onBrandClick, onSubBrandClick);
      }

      // Save current bottle positions for next FLIP
      const newPos = new Map<string, { x0: number; y0: number; x1: number; y1: number }>();
      bottleNodes.forEach((d) => {
        if (d.data.id) {
          newPos.set(d.data.id, { x0: d.x0, y0: d.y0, x1: d.x1, y1: d.y1 });
        }
      });
      prevPositionsRef.current = newPos;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, colorMode, groupMode, onBottleClick, onBottleFlag, ratings, onBrandClick, onSubBrandClick]
  );

  useEffect(() => {
    const shouldAnimate =
      prevGroupModeRef.current !== null && prevGroupModeRef.current !== groupMode;
    prevGroupModeRef.current = groupMode;
    draw(shouldAnimate);

    const observer = new ResizeObserver(() => draw(false));
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [draw]);

  return (
    <div ref={containerRef} className="w-full h-full">
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
}
