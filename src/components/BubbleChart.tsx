"use client";

import { useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";
import {
  Brand,
  Bottle,
  ColorMode,
  GroupMode,
  BubbleSizeMode,
  WhiskeyStyle,
} from "@/types/whiskey";
import { getAgeTier, getPriceTier } from "@/data/whiskeys";
import { buildDistilleryColors } from "@/lib/distilleryColors";

// ── Types ─────────────────────────────────────────────────────────────────────

interface BubbleNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  brandName: string;
  subBrandName: string;
  price: number;
  abv: number;
  age?: number;
  rarity: string;
  rarityScore: number;
  style?: WhiskeyStyle;
  state?: string;
  description: string;
  source?: string;
  isNDP?: boolean;
  availability?: string;
  sourceDistillery?: string;
  avgRating?: number;
  ratingCount?: number;
  r: number;
  groupKey: string;
}

interface Props {
  brands: Brand[];
  colorMode: ColorMode;
  groupMode: GroupMode;
  sizeMode: BubbleSizeMode;
  onBottleClick: (node: BubbleNode) => void;
  onBottleFlag?: (id: string, name: string) => void;
  ratings: Record<string, { avg: number; count: number }>;
  searchQuery?: string;
  distilleryColors?: Map<string, string>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getGroupKey(bt: Bottle, brand: Brand, mode: GroupMode): string {
  switch (mode) {
    case "distillery": return brand.name;
    case "style":      return bt.style ?? "Unknown";
    case "state":      return brand.state ?? "Unknown";
    case "ageTier":    return getAgeTier(bt.age);
    case "priceTier":  return getPriceTier(bt.price);
  }
}

const STYLE_ORDER = [
  "Bourbon", "Wheated Bourbon", "High Rye Bourbon",
  "Rye Whiskey", "Wheat Whiskey", "Tennessee Whiskey", "Blended American",
];
const AGE_ORDER = ["NAS", "Young (1–7yr)", "Standard (8–12yr)", "Aged (13–17yr)", "Very Old (18+yr)"];
const PRICE_ORDER = ["Under $50", "$50–100", "$100–250", "$250+"];

function canonicalOrder(groups: string[], mode: GroupMode): string[] {
  let order: string[] = [];
  if (mode === "style")     order = STYLE_ORDER;
  if (mode === "ageTier")   order = AGE_ORDER;
  if (mode === "priceTier") order = PRICE_ORDER;
  if (order.length) {
    const sorted = order.filter((g) => groups.includes(g));
    const rest   = groups.filter((g) => !order.includes(g)).sort();
    return [...sorted, ...rest];
  }
  return [...groups].sort();
}

function computeRadius(node: BubbleNode, mode: BubbleSizeMode): number {
  if (mode === "uniform") return 12;
  if (mode === "rating") {
    const r = node.avgRating;
    if (!r) return 10;
    return d3.scaleSqrt().domain([0, 10]).range([6, 22]).clamp(true)(r);
  }
  // price
  return d3.scaleSqrt().domain([0, 3500]).range([6, 24]).clamp(true)(node.price);
}

function getColorFn(
  mode: ColorMode,
  ratings: Record<string, { avg: number; count: number }>
): (d: BubbleNode) => string {
  const priceScale = d3.scaleSequentialLog(d3.interpolate("#d1fae5", "#14532d")).domain([15, 3500]).clamp(true);
  const ratingScale = d3.scaleSequential(d3.interpolate("#374151", "#f59e0b")).domain([1, 10]);
  const rarityScale = d3.scaleSequential(d3.interpolate("#fef9c3", "#9f1239")).domain([0, 100]);

  return (d: BubbleNode) => {
    if (mode === "price")  return d.price ? priceScale(d.price) : "#1f2937";
    if (mode === "rarity") return rarityScale(d.rarityScore ?? 0);
    // rating
    const r = ratings[d.id] ?? (d.avgRating ? { avg: d.avgRating } : null);
    return r ? ratingScale(r.avg) : "#1f2937";
  };
}

function computeCentroids(
  groups: string[],
  w: number,
  h: number
): Map<string, { x: number; y: number }> {
  const n = groups.length;
  if (n === 0) return new Map();

  // Fit groups into a grid that respects the aspect ratio
  const cols = Math.max(1, Math.ceil(Math.sqrt(n * (w / h))));
  const rows = Math.ceil(n / cols);
  const cellW = w / cols;
  const cellH = h / rows;

  // Pad slightly from edges
  const padX = cellW * 0.08;
  const padY = cellH * 0.12;

  const map = new Map<string, { x: number; y: number }>();
  groups.forEach((g, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);

    // Center last row if it's not full
    const itemsInLastRow = n % cols || cols;
    const isLastRow = row === rows - 1;
    const colOffset = isLastRow ? (cols - itemsInLastRow) * cellW * 0.5 : 0;

    map.set(g, {
      x: colOffset + col * cellW + cellW / 2,
      y: padY + row * cellH + (cellH - padY) / 2,
    });
  });
  return map;
}

// Estimated radius of a packed cluster (for label positioning)
function estimatedClusterRadius(count: number, avgR: number): number {
  return Math.sqrt(count * Math.PI * avgR * avgR) * 1.1;
}

// ── Halo helpers ──────────────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

type HaloDatum = { key: string; cx: number; cy: number; r: number };

function updateHalos(
  halosG: d3.Selection<SVGGElement, unknown, null, undefined>,
  nodes: BubbleNode[],
  showHalos: boolean,
  colorMap?: Map<string, string>
): void {
  if (!showHalos) {
    halosG.selectAll<SVGCircleElement, HaloDatum>("circle.halo")
      .transition().duration(300)
      .attr("opacity", 0)
      .remove();
    return;
  }

  // Compute centroid per groupKey from live node positions
  const sums = new Map<string, { sx: number; sy: number; count: number }>();
  for (const n of nodes) {
    if (n.x == null || n.y == null) continue;
    const s = sums.get(n.groupKey) ?? { sx: 0, sy: 0, count: 0 };
    s.sx += n.x; s.sy += n.y; s.count++;
    sums.set(n.groupKey, s);
  }
  const centroids = new Map<string, { cx: number; cy: number }>();
  for (const [g, s] of sums) {
    centroids.set(g, { cx: s.sx / s.count, cy: s.sy / s.count });
  }

  // Compute bounding radius per group (farthest node edge + 18px padding)
  const radii = new Map<string, number>();
  for (const n of nodes) {
    if (n.x == null || n.y == null) continue;
    const c = centroids.get(n.groupKey)!;
    const dist = Math.sqrt((n.x - c.cx) ** 2 + (n.y - c.cy) ** 2) + n.r + 18;
    radii.set(n.groupKey, Math.max(radii.get(n.groupKey) ?? 0, dist));
  }

  const data: HaloDatum[] = [...centroids.entries()].map(([key, c]) => ({
    key,
    cx: c.cx,
    cy: c.cy,
    r: radii.get(key) ?? 50,
  }));

  halosG
    .selectAll<SVGCircleElement, HaloDatum>("circle.halo")
    .data(data, (d) => d.key)
    .join(
      (enter) =>
        enter
          .append("circle")
          .attr("class", "halo")
          .attr("cx", (d) => d.cx)
          .attr("cy", (d) => d.cy)
          .attr("r",  (d) => d.r)
          .attr("fill",   (d) => {
            const base = colorMap?.get(d.key);
            return base ? hexToRgba(base, 0.06) : "rgba(245,158,11,0.055)";
          })
          .attr("stroke", (d) => {
            const base = colorMap?.get(d.key);
            return base ? hexToRgba(base, 0.18) : "rgba(245,158,11,0.13)";
          })
          .attr("stroke-width", 1)
          .attr("opacity", 0)
          .call((e) => e.transition().duration(400).attr("opacity", 1)),
      (update) =>
        update
          .attr("cx", (d) => d.cx)
          .attr("cy", (d) => d.cy)
          .attr("r",  (d) => d.r)
          .attr("fill",   (d) => {
            const base = colorMap?.get(d.key);
            return base ? hexToRgba(base, 0.06) : "rgba(245,158,11,0.055)";
          })
          .attr("stroke", (d) => {
            const base = colorMap?.get(d.key);
            return base ? hexToRgba(base, 0.18) : "rgba(245,158,11,0.13)";
          }),
      (exit) =>
        exit.transition().duration(250).attr("opacity", 0).remove()
    );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BubbleChart({
  brands,
  colorMode,
  groupMode,
  sizeMode,
  onBottleClick,
  onBottleFlag,
  ratings,
  searchQuery,
  distilleryColors,
}: Props) {
  const svgRef   = useRef<SVGSVGElement>(null);
  const wrapRef  = useRef<HTMLDivElement>(null);
  const simRef   = useRef<d3.Simulation<BubbleNode, undefined> | null>(null);
  const nodesRef = useRef<BubbleNode[]>([]);

  // Track previous values to know what changed
  const prevGroupModeRef = useRef<GroupMode | null>(null);
  const prevSizeModeRef  = useRef<BubbleSizeMode | null>(null);
  const prevColorModeRef = useRef<ColorMode | null>(null);

  // Keep stable refs for callbacks (avoid sim re-init on every render)
  const onBottleClickRef = useRef(onBottleClick);
  onBottleClickRef.current = onBottleClick;

  const onBottleFlagRef = useRef(onBottleFlag);
  onBottleFlagRef.current = onBottleFlag;

  const ratingsRef = useRef(ratings);
  ratingsRef.current = ratings;

  // ── Tooltip ────────────────────────────────────────────────────────────────
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  const showTooltip = useCallback((event: MouseEvent, d: BubbleNode) => {
    const tip = tooltipRef.current;
    if (!tip) return;
    const r = ratingsRef.current[d.id];
    const ratingLine = r
      ? `<div style="color:#f59e0b;margin-top:4px;">★ ${r.avg.toFixed(1)} <span style="color:rgba(255,255,255,0.35);font-size:10px;">(${r.count} rating${r.count !== 1 ? "s" : ""})</span></div>`
      : `<div style="color:rgba(255,255,255,0.3);margin-top:4px;font-size:10px;">Not yet rated</div>`;
    const ageStr = d.age ? `${d.age}yr` : "NAS";
    const badges = [
      d.source === "community" ? `<span style="color:#a78bfa;font-size:10px;border:1px solid rgba(139,92,246,0.4);padding:1px 5px;border-radius:4px;">Community</span>` : "",
      d.isNDP ? `<span style="color:rgba(245,158,11,0.7);font-size:10px;border:1px solid rgba(245,158,11,0.3);padding:1px 5px;border-radius:4px;">NDP</span>` : "",
    ].filter(Boolean).join(" ");

    tip.innerHTML = `
      <div style="font-weight:700;font-size:13px;color:#f5f5f5;margin-bottom:2px;">${d.name}</div>
      <div style="font-size:11px;color:rgba(255,255,255,0.45);margin-bottom:4px;">${d.brandName} · ${d.subBrandName}</div>
      <div style="font-size:11px;color:rgba(255,255,255,0.6);">$${d.price} · ${d.abv}% ABV · ${ageStr}</div>
      <div style="font-size:11px;color:rgba(255,255,255,0.45);text-transform:capitalize;">${d.rarity}</div>
      ${ratingLine}
      ${d.sourceDistillery ? `<div style="font-size:10px;color:rgba(255,255,255,0.35);margin-top:3px;">Source: ${d.sourceDistillery}</div>` : ""}
      ${d.description ? `<div style="font-size:10px;color:rgba(255,255,255,0.4);margin-top:5px;max-width:220px;line-height:1.4;">${d.description.slice(0, 120)}${d.description.length > 120 ? "…" : ""}</div>` : ""}
      ${badges ? `<div style="margin-top:5px;display:flex;gap:4px;">${badges}</div>` : ""}
    `;
    tip.style.display = "block";
    tip.style.opacity = "1";
    moveTooltip(event);
  }, []);

  const moveTooltip = useCallback((event: MouseEvent) => {
    const tip = tooltipRef.current;
    if (!tip) return;
    const margin = 12;
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    let x = event.clientX + margin;
    let y = event.clientY - th / 2;
    if (x + tw > window.innerWidth - margin) x = event.clientX - tw - margin;
    if (y < margin) y = margin;
    if (y + th > window.innerHeight - margin) y = window.innerHeight - th - margin;
    tip.style.left = `${x}px`;
    tip.style.top  = `${y}px`;
  }, []);

  const hideTooltip = useCallback(() => {
    const tip = tooltipRef.current;
    if (!tip) return;
    tip.style.opacity = "0";
    tip.style.display = "none";
  }, []);

  // ── Build flat node list from brands[] ─────────────────────────────────────
  const buildNodes = useCallback(
    (brandList: Brand[], gMode: GroupMode, sMode: BubbleSizeMode): BubbleNode[] => {
      const nodes: BubbleNode[] = [];
      for (const brand of brandList) {
        for (const sb of brand.subBrands) {
          for (const bt of sb.bottles) {
            const r = ratingsRef.current[bt.id];
            const avgRating = r?.avg ?? bt.avgRating;
            const ratingCount = r?.count ?? bt.ratingCount;
            nodes.push({
              id: bt.id,
              name: bt.name,
              brandName: brand.name,
              subBrandName: sb.name,
              price: bt.price,
              abv: bt.abv,
              age: bt.age,
              rarity: bt.rarity,
              rarityScore: bt.rarityScore,
              style: bt.style,
              state: brand.state,
              description: bt.description,
              source: bt.source,
              isNDP: brand.isNDP,
              availability: bt.availability,
              sourceDistillery: bt.sourceDistillery,
              avgRating,
              ratingCount,
              r: 12, // will be set below
              groupKey: getGroupKey(bt, brand, gMode),
            });
          }
        }
      }
      // Compute radii
      for (const n of nodes) {
        n.r = computeRadius(n, sMode);
      }
      return nodes;
    },
    []
  );

  // ── Main draw / update ─────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const svg   = svgRef.current;
    const wrap  = wrapRef.current;
    if (!svg || !wrap) return;

    const W = wrap.clientWidth;
    const H = wrap.clientHeight;
    if (W === 0 || H === 0) return;

    d3.select(svg).attr("width", W).attr("height", H);

    const newNodes = buildNodes(brands, groupMode, sizeMode);
    const groups   = canonicalOrder([...new Set(newNodes.map((n) => n.groupKey))], groupMode);
    const centroids = computeCentroids(groups, W, H);

    const isDistilleryMode = groupMode === "distillery";
    const distColors = distilleryColors ?? buildDistilleryColors(brands);
    const glowOpacity = isDistilleryMode ? 0.35 : 0;

    // In distillery mode, pull all cluster centers 65% closer to chart center
    // so all bubbles form one big central cloud with gentle per-distillery drift
    if (isDistilleryMode) {
      for (const [key, pos] of centroids) {
        centroids.set(key, {
          x: W / 2 + (pos.x - W / 2) * 0.35,
          y: H / 2 + (pos.y - H / 2) * 0.35,
        });
      }
    }

    const colorFn = getColorFn(colorMode, ratingsRef.current);

    const prevGroupMode = prevGroupModeRef.current;
    const prevSizeMode  = prevSizeModeRef.current;
    const prevColorMode = prevColorModeRef.current;

    const groupChanged = prevGroupMode !== null && prevGroupMode !== groupMode;
    const sizeChanged  = prevSizeMode  !== null && prevSizeMode  !== sizeMode;
    const colorChanged = prevColorMode !== null && prevColorMode !== colorMode;
    const isFirstRender = prevGroupMode === null;

    prevGroupModeRef.current = groupMode;
    prevSizeModeRef.current  = sizeMode;
    prevColorModeRef.current = colorMode;

    const root = d3.select(svg);

    // ── Labels layer ─────────────────────────────────────────────────────────
    const updateLabels = (animated: boolean) => {
      // Compute per-group average radius for label offset
      const groupCounts = new Map<string, number>();
      const groupRs     = new Map<string, number[]>();
      for (const n of newNodes) {
        groupCounts.set(n.groupKey, (groupCounts.get(n.groupKey) ?? 0) + 1);
        const arr = groupRs.get(n.groupKey) ?? [];
        arr.push(n.r);
        groupRs.set(n.groupKey, arr);
      }

      let labelsG = root.select<SVGGElement>("g.labels-layer");
      if (labelsG.empty()) {
        labelsG = root.append("g").attr("class", "labels-layer");
      }

      const labelData = groups.map((g) => {
        const c   = centroids.get(g)!;
        const cnt = groupCounts.get(g) ?? 0;
        const rs  = groupRs.get(g) ?? [12];
        const avgR = rs.reduce((a, b) => a + b, 0) / rs.length;
        const clusterR = estimatedClusterRadius(cnt, avgR);
        return { key: g, x: c.x, y: c.y - clusterR - 14 };
      });

      const sel = labelsG
        .selectAll<SVGTextElement, { key: string; x: number; y: number }>("text.group-label")
        .data(labelData, (d) => d.key);

      if (animated) {
        // Fade out existing labels, then fade in new ones
        labelsG.selectAll("text.group-label")
          .transition().duration(180)
          .attr("opacity", 0)
          .remove();

        // Re-select after remove (they're gone)
        setTimeout(() => {
          const labelsG2 = root.select<SVGGElement>("g.labels-layer");
          labelsG2
            .selectAll<SVGTextElement, { key: string; x: number; y: number }>("text.group-label")
            .data(labelData, (d) => d.key)
            .join("text")
            .attr("class", "group-label")
            .attr("x", (d) => d.x)
            .attr("y", (d) => d.y)
            .attr("text-anchor", "middle")
            .attr("fill", "#f59e0b")
            .attr("opacity", 0)
            .attr("font-size", "11px")
            .attr("font-weight", "700")
            .attr("letter-spacing", "0.08em")
            .text((d) => d.key.toUpperCase())
            .transition().duration(220)
            .attr("opacity", 0.85);
        }, 250);
      } else {
        sel.join(
          (enter) =>
            enter
              .append("text")
              .attr("class", "group-label")
              .attr("x", (d) => d.x)
              .attr("y", (d) => d.y)
              .attr("text-anchor", "middle")
              .attr("fill", "#f59e0b")
              .attr("opacity", 0)
              .attr("font-size", "11px")
              .attr("font-weight", "700")
              .attr("letter-spacing", "0.08em")
              .text((d) => d.key.toUpperCase())
              .call((e) => e.transition().duration(300).attr("opacity", 0.85)),
          (update) =>
            update
              .text((d) => d.key.toUpperCase())
              .attr("x", (d) => d.x)
              .attr("y", (d) => d.y)
              .attr("opacity", 0.85),
          (exit) => exit.remove()
        );
      }
    };

    // ── If only color changed, re-fill circles and return ────────────────────
    if (colorChanged && !groupChanged && !sizeChanged && !isFirstRender) {
      root.selectAll<SVGCircleElement, BubbleNode>("circle.bubble")
        .transition().duration(400)
        .attr("fill", colorFn);
      return;
    }

    // ── If only size changed, update radii + restart sim ─────────────────────
    if (sizeChanged && !groupChanged && !isFirstRender) {
      const sim = simRef.current;
      if (sim) {
        const existingNodes = nodesRef.current;
        // Update radii on existing nodes
        for (const node of existingNodes) {
          node.r = computeRadius(node, sizeMode);
        }
        // Update circles
        root.selectAll<SVGCircleElement, BubbleNode>("circle.bubble")
          .data(existingNodes, (d) => d.id)
          .transition().duration(300)
          .attr("r", (d) => d.r)
          .attr("fill", colorFn);
        // Update collision force + reheat
        (sim.force("collide") as d3.ForceCollide<BubbleNode>).radius((d) => d.r + 1.5);
        sim.alpha(0.5).restart();
      }
      return;
    }

    // ── Full build or groupMode change ────────────────────────────────────────
    // Stop previous sim
    if (simRef.current) simRef.current.stop();

    // Transfer positions from old nodes if this is a groupMode change (not first render)
    if (groupChanged && nodesRef.current.length > 0) {
      const prevById = new Map(nodesRef.current.map((n) => [n.id, n]));
      for (const n of newNodes) {
        const prev = prevById.get(n.id);
        if (prev) {
          n.x = prev.x; n.y = prev.y;
          n.vx = (prev.vx ?? 0) * 0.3;
          n.vy = (prev.vy ?? 0) * 0.3;
        }
      }
    } else if (isFirstRender) {
      // Burst from center
      const cx = W / 2, cy = H / 2;
      for (const n of newNodes) {
        n.x  = cx + (Math.random() - 0.5) * 20;
        n.y  = cy + (Math.random() - 0.5) * 20;
        n.vx = 0; n.vy = 0;
      }
    }

    nodesRef.current = newNodes;

    // ── D3 simulation ─────────────────────────────────────────────────────────
    const simulation = d3.forceSimulation<BubbleNode>(newNodes)
      .force("collide",
        d3.forceCollide<BubbleNode>((d) => d.r + 1.5).iterations(3)
      )
      .force("charge", d3.forceManyBody<BubbleNode>().strength(-3))
      .force("x",
        d3.forceX<BubbleNode>((d) => centroids.get(d.groupKey)?.x ?? W / 2).strength(0.07)
      )
      .force("y",
        d3.forceY<BubbleNode>((d) => centroids.get(d.groupKey)?.y ?? H / 2).strength(0.07)
      )
      .alphaDecay(0.015)
      .velocityDecay(0.3);

    simRef.current = simulation;

    // ── Halos layer (behind everything else) ──────────────────────────────────
    let halosG = root.select<SVGGElement>("g.halos-layer");
    if (halosG.empty()) {
      const bl = root.select("g.bubbles-layer");
      halosG = bl.empty()
        ? root.append("g").attr("class", "halos-layer")
        : root.insert("g", "g.bubbles-layer").attr("class", "halos-layer");
    }

    // ── Glow layer (per-bubble colored glow, behind bubbles) ──────────────────
    let glowG = root.select<SVGGElement>("g.glow-layer");
    if (glowG.empty()) {
      glowG = root.append("g").attr("class", "glow-layer");
    }

    // ── Bubbles layer ─────────────────────────────────────────────────────────
    let bubblesG = root.select<SVGGElement>("g.bubbles-layer");
    if (bubblesG.empty()) {
      bubblesG = root.append("g").attr("class", "bubbles-layer");
    }

    // ── Flags layer (report-error icons shown on bubble hover) ───────────────
    let flagsG = root.select<SVGGElement>("g.flags-layer");
    if (flagsG.empty()) {
      flagsG = root.append("g").attr("class", "flags-layer");
    }

    const circles = bubblesG
      .selectAll<SVGCircleElement, BubbleNode>("circle.bubble")
      .data(newNodes, (d) => d.id)
      .join(
        (enter) =>
          enter
            .append("circle")
            .attr("class", "bubble")
            .attr("r", (d) => d.r)
            .attr("cx", (d) => d.x ?? W / 2)
            .attr("cy", (d) => d.y ?? H / 2)
            .attr("fill", colorFn)
            .attr("stroke", (d) =>
              d.source === "community" ? "rgba(139,92,246,0.8)" : "rgba(255,255,255,0.08)"
            )
            .attr("stroke-width", (d) => (d.source === "community" ? 1.5 : 0.5))
            .attr("stroke-dasharray", (d) => (d.source === "community" ? "4,2" : "none"))
            .style("cursor", "pointer")
            .attr("opacity", 0)
            .call((e) => e.transition().duration(400).attr("opacity", 1)),
        (update) =>
          update
            .attr("r", (d) => d.r)
            .attr("fill", colorFn)
            .attr("opacity", 1),
        (exit) =>
          exit
            .transition().duration(300)
            .attr("opacity", 0)
            .attr("r", 0)
            .remove()
      );

    // ── Glow circles (blurred, per-bubble, distillery color) ──────────────────
    glowG
      .selectAll<SVGCircleElement, BubbleNode>("circle.glow-bubble")
      .data(newNodes, (d) => d.id)
      .join(
        (enter) =>
          enter
            .append("circle")
            .attr("class", "glow-bubble")
            .attr("cx", (d) => d.x ?? W / 2)
            .attr("cy", (d) => d.y ?? H / 2)
            .attr("r",  (d) => d.r * 1.6)
            .attr("fill", (d) => distColors.get(d.groupKey) ?? "rgba(255,255,255,0.2)")
            .attr("opacity", 0)
            .style("filter", "blur(10px)")
            .style("pointer-events", "none")
            .call((e) => e.transition().duration(400).attr("opacity", glowOpacity)),
        (update) =>
          update
            .attr("r",  (d) => d.r * 1.6)
            .attr("fill", (d) => distColors.get(d.groupKey) ?? "rgba(255,255,255,0.2)")
            .call((u) => u.transition().duration(300).attr("opacity", glowOpacity)),
        (exit) =>
          exit
            .call((e) => e.transition().duration(200).attr("opacity", 0).remove())
      );

    // Flag icons (one per bubble, shown on hover)
    let flagHideTimeout: ReturnType<typeof setTimeout> | null = null;

    flagsG
      .selectAll<SVGTextElement, BubbleNode>("text.flag-btn")
      .data(newNodes, (d) => d.id)
      .join(
        (enter) =>
          enter
            .append("text")
            .attr("class", "flag-btn")
            .attr("text-anchor", "middle")
            .attr("fill", "rgba(255,255,255,0.45)")
            .attr("font-size", "10px")
            .attr("font-family", "system-ui, sans-serif")
            .style("pointer-events", "all")
            .style("cursor", "pointer")
            .style("user-select", "none")
            .attr("opacity", 0)
            .attr("x", (d) => (d.x ?? W / 2) + d.r * 0.45)
            .attr("y", (d) => (d.y ?? H / 2) - d.r * 0.5)
            .text("⚑"),
        (update) => update,
        (exit) => exit.remove()
      )
      .on("click", (event: MouseEvent, d) => {
        event.stopPropagation();
        if (flagHideTimeout) clearTimeout(flagHideTimeout);
        onBottleFlagRef.current?.(d.id, d.name);
      })
      .on("mouseover", function (this: SVGTextElement) {
        if (flagHideTimeout) clearTimeout(flagHideTimeout);
        d3.select(this).attr("fill", "#f59e0b").attr("opacity", 1);
      })
      .on("mouseout", function (this: SVGTextElement, _event: MouseEvent, d: BubbleNode) {
        flagHideTimeout = setTimeout(() => {
          flagsG
            .selectAll<SVGTextElement, BubbleNode>("text.flag-btn")
            .filter((fd) => fd.id === d.id)
            .attr("opacity", 0)
            .attr("fill", "rgba(255,255,255,0.45)");
        }, 120);
      });

    // Events
    circles
      .on("mouseover", (event: MouseEvent, d) => {
        showTooltip(event, d);
        if (flagHideTimeout) clearTimeout(flagHideTimeout);
        flagsG
          .selectAll<SVGTextElement, BubbleNode>("text.flag-btn")
          .filter((fd) => fd.id === d.id)
          .attr("opacity", 0.7);
      })
      .on("mousemove", (event: MouseEvent) => moveTooltip(event))
      .on("mouseout",  (_event: MouseEvent, d: BubbleNode) => {
        hideTooltip();
        flagHideTimeout = setTimeout(() => {
          flagsG
            .selectAll<SVGTextElement, BubbleNode>("text.flag-btn")
            .filter((fd) => fd.id === d.id)
            .attr("opacity", 0);
        }, 120);
      })
      .on("click",     (event: MouseEvent, d) => {
        event.stopPropagation();
        onBottleClickRef.current(d);
      });

    // Enforce layer order: halos (back) → glow → bubbles → flags → labels (front)
    root.select("g.halos-layer").lower();
    root.select("g.glow-layer").raise();
    root.select("g.bubbles-layer").raise();
    root.select("g.flags-layer").raise();
    root.select("g.labels-layer").raise();

    // Render labels
    updateLabels(groupChanged);

    // ── Tick ─────────────────────────────────────────────────────────────────
    let tickN = 0;
    simulation.on("tick", () => {
      bubblesG
        .selectAll<SVGCircleElement, BubbleNode>("circle.bubble")
        .attr("cx", (d) => d.x ?? 0)
        .attr("cy", (d) => d.y ?? 0);
      glowG
        .selectAll<SVGCircleElement, BubbleNode>("circle.glow-bubble")
        .attr("cx", (d) => d.x ?? 0)
        .attr("cy", (d) => d.y ?? 0);
      flagsG
        .selectAll<SVGTextElement, BubbleNode>("text.flag-btn")
        .attr("x", (d) => (d.x ?? 0) + d.r * 0.45)
        .attr("y", (d) => (d.y ?? 0) - d.r * 0.5);
      // Update halos every 5 ticks (distillery mode only)
      if (++tickN % 5 === 0) {
        updateHalos(halosG, newNodes, isDistilleryMode, distColors);
      }
    });

    // When sim settles, update halos + label positions (more accurate centroid)
    simulation.on("end", () => {
      // Final halo update with settled positions
      updateHalos(halosG, newNodes, isDistilleryMode, distColors);

      // Recompute label Y positions from actual node positions
      const groupMinY = new Map<string, number>();
      for (const n of newNodes) {
        const curr = groupMinY.get(n.groupKey) ?? Infinity;
        const top  = (n.y ?? 0) - n.r;
        if (top < curr) groupMinY.set(n.groupKey, top);
      }
      root.select<SVGGElement>("g.labels-layer")
        .selectAll<SVGTextElement, { key: string; x: number; y: number }>("text.group-label")
        .attr("y", (d) => (groupMinY.get(d.key) ?? d.y) - 8);
    });

    if (groupChanged) {
      simulation.alpha(0.7).restart();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brands, colorMode, groupMode, sizeMode, buildNodes, showTooltip, moveTooltip, hideTooltip]);

  // ── Resize observer ────────────────────────────────────────────────────────
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => {
      const sim = simRef.current;
      const W   = wrap.clientWidth;
      const H   = wrap.clientHeight;
      if (W === 0 || H === 0) return;
      d3.select(svgRef.current).attr("width", W).attr("height", H);

      // Recompute centroids and update force targets
      if (sim && nodesRef.current.length > 0) {
        const groups    = canonicalOrder([...new Set(nodesRef.current.map((n) => n.groupKey))], groupMode);
        const centroids = computeCentroids(groups, W, H);
        if (groupMode === "distillery") {
          for (const [key, pos] of centroids) {
            centroids.set(key, {
              x: W / 2 + (pos.x - W / 2) * 0.35,
              y: H / 2 + (pos.y - H / 2) * 0.35,
            });
          }
        }
        (sim.force("x") as d3.ForceX<BubbleNode>)
          .x((d) => centroids.get(d.groupKey)?.x ?? W / 2);
        (sim.force("y") as d3.ForceY<BubbleNode>)
          .y((d) => centroids.get(d.groupKey)?.y ?? H / 2);
        sim.alpha(0.3).restart();
      }
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [groupMode]);

  // ── Run draw on relevant prop changes ─────────────────────────────────────
  useEffect(() => {
    draw();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brands, groupMode, sizeMode, colorMode, ratings]);

  // ── Search: dim/shrink non-matching bubbles (no sim rebuild) ───────────────
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const q = (searchQuery ?? "").toLowerCase().trim();
    const bubbles = d3
      .select(svg)
      .selectAll<SVGCircleElement, BubbleNode>("circle.bubble");
    if (!bubbles.size()) return;

    if (!q) {
      bubbles
        .transition().duration(250)
        .attr("opacity", 1)
        .attr("r", (d) => d.r);
    } else {
      const matches = (d: BubbleNode) =>
        d.name.toLowerCase().includes(q) ||
        d.brandName.toLowerCase().includes(q) ||
        d.subBrandName.toLowerCase().includes(q) ||
        (d.style ?? "").toLowerCase().includes(q);
      bubbles
        .transition().duration(250)
        .attr("opacity", (d) => (matches(d) ? 1 : 0.1))
        .attr("r",       (d) => (matches(d) ? d.r : d.r * 0.4));
    }
  }, [searchQuery]);

  // ── Tooltip DOM element ────────────────────────────────────────────────────
  useEffect(() => {
    const tip = document.createElement("div");
    tip.style.cssText = `
      position: fixed; pointer-events: none; display: none; opacity: 0;
      z-index: 9999; padding: 10px 13px; border-radius: 10px;
      background: rgba(8,6,12,0.96); border: 1px solid rgba(245,158,11,0.25);
      box-shadow: 0 8px 32px rgba(0,0,0,0.6);
      font-family: inherit; font-size: 12px; color: #f5f5f5;
      transition: opacity 0.12s ease;
      max-width: 260px;
    `;
    document.body.appendChild(tip);
    tooltipRef.current = tip;
    return () => {
      tip.remove();
      tooltipRef.current = null;
    };
  }, []);

  // ── Cleanup simulation on unmount ─────────────────────────────────────────
  useEffect(() => {
    return () => { simRef.current?.stop(); };
  }, []);

  return (
    <div ref={wrapRef} style={{ width: "100%", height: "100%", position: "relative" }}>
      <svg
        ref={svgRef}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </div>
  );
}
