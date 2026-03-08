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
  brandId: string;
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
  ratings: Record<string, { avg: number; count: number }>;
  searchQuery?: string;
  distilleryColors?: Map<string, string>;
  /** Key of the currently-selected group label (distillery/style/etc) */
  selectedGroup?: string | null;
  /** Called when user clicks a label; null means "clear selection" */
  onLabelClick?: (key: string | null) => void;
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
  ratings: Record<string, { avg: number; count: number }>,
  distColors?: Map<string, string>
): (d: BubbleNode) => string {
  const priceScale = d3.scaleSequentialLog(d3.interpolate("#d1fae5", "#14532d")).domain([15, 3500]).clamp(true);
  const ratingScale = d3.scaleSequential(d3.interpolate("#374151", "#f59e0b")).domain([1, 10]);
  const rarityScale = d3.scaleSequential(d3.interpolate("#fef9c3", "#9f1239")).domain([0, 100]);

  return (d: BubbleNode) => {
    if (mode === "brand")  return distColors?.get(d.brandName) ?? "#6b7280";
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

// ── Gradient helpers ──────────────────────────────────────────────────────────

// Sanitize a bottle ID for use as an SVG element id (community IDs can have
// spaces or special chars when the sub-brand name is embedded in the slug).
function rgId(id: string): string {
  return `rg-${id.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
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
  ratings,
  searchQuery,
  distilleryColors,
  selectedGroup,
  onLabelClick,
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

  const onLabelClickRef = useRef(onLabelClick);
  onLabelClickRef.current = onLabelClick;

  const selectedGroupRef = useRef(selectedGroup);
  selectedGroupRef.current = selectedGroup;

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
              brandId: brand.id,
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
    const isBrandMode = colorMode === "brand";
    const distColors = distilleryColors ?? buildDistilleryColors(brands);
    const glowOpacity = isDistilleryMode ? 0.35 : 0;

    // In distillery mode, pull all cluster centers close to chart center so all
    // bubbles form one circular cloud. 0.20 (vs 0.10) gives each distillery a
    // slightly more distinct home-base, which the custom cluster force below
    // reinforces so same-brand bubbles end up touching.
    if (isDistilleryMode) {
      for (const [key, pos] of centroids) {
        centroids.set(key, {
          x: W / 2 + (pos.x - W / 2) * 0.20,
          y: H / 2 + (pos.y - H / 2) * 0.20,
        });
      }
    }

    const colorFn = getColorFn(colorMode, ratingsRef.current, distColors);

    const prevGroupMode = prevGroupModeRef.current;
    const prevSizeMode  = prevSizeModeRef.current;
    const prevColorMode = prevColorModeRef.current;

    const groupChanged = prevGroupMode !== null && prevGroupMode !== groupMode;
    const sizeChanged  = prevSizeMode  !== null && prevSizeMode  !== sizeMode;
    const colorChanged = prevColorMode !== null && prevColorMode !== colorMode;

    prevGroupModeRef.current = groupMode;
    prevSizeModeRef.current  = sizeMode;
    prevColorModeRef.current = colorMode;

    const root = d3.select(svg);

    // Clicking empty SVG space clears any active label filter
    root.on("click.clearGroup", () => {
      onLabelClickRef.current?.(null);
    });

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
            .attr("fill", (d) => isDistilleryMode ? (distColors.get(d.key) ?? "#f59e0b") : "#f59e0b")
            .attr("opacity", 0)
            .attr("font-size", "11px")
            .attr("font-weight", "700")
            .attr("letter-spacing", "0.08em")
            .text((d) => d.key.toUpperCase())
            .call((e) => {
              // In distillery mode the end handler positions + reveals labels
              if (!isDistilleryMode) e.transition().duration(220).attr("opacity", 0.9);
            });
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
              .attr("fill", (d) => isDistilleryMode ? (distColors.get(d.key) ?? "#f59e0b") : "#f59e0b")
              .attr("opacity", 0)
              .attr("font-size", "11px")
              .attr("font-weight", "700")
              .attr("letter-spacing", "0.08em")
              .text((d) => d.key.toUpperCase())
              .call((e) => {
                if (!isDistilleryMode) e.transition().duration(300).attr("opacity", 0.9);
              }),
          (update) =>
            update
              .text((d) => d.key.toUpperCase())
              .attr("fill", (d) => isDistilleryMode ? (distColors.get(d.key) ?? "#f59e0b") : "#f59e0b")
              .attr("x", (d) => d.x)
              .attr("y", (d) => d.y)
              .attr("opacity", isDistilleryMode ? 0 : 0.9),
          (exit) => exit.remove()
        );
      }
    };

    // ── If only color changed, update gradient stop-colours and return ────────
    // Bubble fill attributes stay as url(#rg-…); we just retune the gradient stops.
    if (colorChanged && !groupChanged && !sizeChanged && prevGroupMode !== null) {
      const defsEl = root.select<SVGDefsElement>("defs");
      for (const n of nodesRef.current) {
        const c = colorFn(n);
        defsEl
          .select<SVGRadialGradientElement>(`[id="${rgId(n.id)}"]`)
          .selectAll<SVGStopElement, unknown>("stop")
          .transition().duration(400)
          .attr("stop-color", c);
      }
      // Clay opacity also changes when crossing the brand/non-brand boundary
      // in distillery group mode (brand mode disables the gooey clay blobs).
      const newClayOpacity = (isDistilleryMode && !isBrandMode) ? 0.72 : 0;
      root.select("g.glow-layer")
        .selectAll("g.clay-group")
        .transition().duration(400)
        .attr("opacity", newClayOpacity);
      return;
    }

    // ── If only size changed, update radii + restart sim ─────────────────────
    if (sizeChanged && !groupChanged && prevGroupMode !== null) {
      const sim = simRef.current;
      if (sim) {
        const existingNodes = nodesRef.current;
        // Update radii on existing nodes
        for (const node of existingNodes) {
          node.r = computeRadius(node, sizeMode);
        }
        // Update circles + clay
        root.selectAll<SVGCircleElement, BubbleNode>("circle.bubble")
          .data(existingNodes, (d) => d.id)
          .transition().duration(300)
          .attr("r", (d) => d.r);
        // Gradient uses objectBoundingBox units → auto-scales; no fill update needed.
        root.select("g.glow-layer")
          .selectAll<SVGGElement, string>("g.clay-group")
          .each(function () {
            d3.select(this)
              .selectAll<SVGCircleElement, BubbleNode>("circle.clay-bubble")
              .data(existingNodes, (d) => d.id)
              .transition().duration(300)
              .attr("r", (d) => d.r);
          });
        // Update collision force + reheat
        (sim.force("collide") as d3.ForceCollide<BubbleNode>).radius((d) => d.r + 0.5);
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
    }
    // Initialize any node that still lacks a position (first render, Strict Mode remount,
    // or new nodes added after a groupMode transfer). Burst from center so bubbles
    // animate outward rather than flying in from the D3 golden-angle spiral near (0,0).
    const cx = W / 2, cy = H / 2;
    for (const n of newNodes) {
      if (n.x == null || n.y == null) {
        n.x  = cx + (Math.random() - 0.5) * 20;
        n.y  = cy + (Math.random() - 0.5) * 20;
        n.vx = 0; n.vy = 0;
      }
    }

    nodesRef.current = newNodes;

    // ── D3 simulation ─────────────────────────────────────────────────────────
    // In distillery mode: stronger centroid pull + no charge so same-distillery
    // bubbles pack tight enough for the gooey filter to merge them into clay blobs.
    const forceStrength  = isDistilleryMode ? 0.40 : 0.07;
    const chargeStrength = isDistilleryMode ?  0   : -3;

    // ── Custom dynamic cluster force ──────────────────────────────────────────
    // On every tick, compute the live average position of each group and pull
    // each bubble toward it.  This is O(n) and guarantees same-brand bubbles
    // converge on each other (rather than just a static map point), so they
    // end up touching regardless of how many other distilleries share the cloud.
    const clusterStrength = isDistilleryMode ? 0.45 : 0.10;
    const clusteringForce = (alpha: number) => {
      const sums = new Map<string, { sx: number; sy: number; count: number }>();
      for (const n of newNodes) {
        if (n.x == null || n.y == null) continue;
        const s = sums.get(n.groupKey) ?? { sx: 0, sy: 0, count: 0 };
        s.sx += n.x; s.sy += n.y; s.count++;
        sums.set(n.groupKey, s);
      }
      for (const n of newNodes) {
        if (n.x == null || n.y == null) continue;
        const s = sums.get(n.groupKey);
        if (!s || s.count <= 1) continue;
        const cx = s.sx / s.count;
        const cy = s.sy / s.count;
        n.vx = (n.vx ?? 0) + (cx - n.x) * clusterStrength * alpha;
        n.vy = (n.vy ?? 0) + (cy - n.y) * clusterStrength * alpha;
      }
    };

    const simulation = d3.forceSimulation<BubbleNode>(newNodes)
      .force("collide",
        d3.forceCollide<BubbleNode>((d) => d.r + 0.5).iterations(5)
      )
      .force("charge", d3.forceManyBody<BubbleNode>().strength(chargeStrength))
      .force("x",
        d3.forceX<BubbleNode>((d) => centroids.get(d.groupKey)?.x ?? W / 2).strength(forceStrength)
      )
      .force("y",
        d3.forceY<BubbleNode>((d) => centroids.get(d.groupKey)?.y ?? H / 2).strength(forceStrength)
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .force("cluster", clusteringForce as any)
      .alphaDecay(0.022)   // ~30% fewer ticks vs 0.015; final positions equivalent
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

    // ── Lines layer (leader lines from labels to clusters, distillery mode) ───
    let linesG = root.select<SVGGElement>("g.lines-layer");
    if (linesG.empty()) {
      linesG = root.append("g").attr("class", "lines-layer");
    }
    // Clear lines immediately when leaving distillery mode
    if (!isDistilleryMode) {
      linesG.selectAll("line.leader").remove();
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
            .attr("fill", (d) => `url(#${rgId(d.id)})`)
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
            .attr("fill", (d) => `url(#${rgId(d.id)})`)
            .attr("opacity", 1),
        (exit) =>
          exit
            .transition().duration(300)
            .attr("opacity", 0)
            .attr("r", 0)
            .remove()
      );

    // ── SVG <defs> + shared gooey "clay" filter ───────────────────────────────
    // Classic blur+threshold metaball trick: circles close enough to touch
    // merge visually into a single blob that deforms as they approach / separate.
    let defsEl = root.select<SVGDefsElement>("defs");
    if (defsEl.empty()) defsEl = root.insert<SVGDefsElement>("defs", ":first-child");
    if (defsEl.select("#gooey-clay").empty()) {
      const flt = defsEl.append("filter")
        .attr("id", "gooey-clay")
        .attr("x", "-30%").attr("y", "-30%")
        .attr("width", "160%").attr("height", "160%");
      flt.append("feGaussianBlur")
        .attr("in", "SourceGraphic").attr("stdDeviation", 6).attr("result", "blur");
      // Amplify alpha to create sharp merged edges (clay-like surface tension)
      flt.append("feColorMatrix")
        .attr("in", "blur").attr("mode", "matrix")
        .attr("values", "1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -8");
    }

    // ── Per-bubble radial gradients ────────────────────────────────────────────
    // Each bubble gets a <radialGradient> that fades from full colour at the
    // centre (100% opacity) to ~60% at the perimeter. This lets the coloured
    // clay blobs underneath bleed through visually at the bubble edges,
    // giving the "meatball" cloud a more organic, merged look.
    // gradientUnits="objectBoundingBox" means the gradient auto-scales with
    // each circle's radius — no update needed when bubble sizes change.
    defsEl.selectAll<SVGRadialGradientElement, unknown>("radialGradient.bubble-rg").remove();
    for (const n of newNodes) {
      const c = colorFn(n);
      const rg = defsEl.append("radialGradient")
        .attr("class", "bubble-rg")
        .attr("id",    rgId(n.id))
        .attr("gradientUnits", "objectBoundingBox")
        .attr("cx", "50%").attr("cy", "50%").attr("r", "50%");
      rg.append("stop").attr("offset",   "0%").attr("stop-color", c).attr("stop-opacity", "1");
      rg.append("stop").attr("offset",  "72%").attr("stop-color", c).attr("stop-opacity", "0.88");
      rg.append("stop").attr("offset", "100%").attr("stop-color", c).attr("stop-opacity", "0.60");
    }

    // ── Per-distillery clay groups (one <g> per distillery, gooey filter) ─────
    // Circles within the same group merge into coloured clay when touching.
    // Clay is suppressed in brand color mode — bubble color already encodes
    // distillery identity, so the gooey blobs would be redundant noise.
    const distGroupKeys = [...new Set(newNodes.map((n) => n.groupKey))];
    const clayOpacity = (isDistilleryMode && !isBrandMode) ? 0.72 : 0;

    glowG
      .selectAll<SVGGElement, string>("g.clay-group")
      .data(distGroupKeys, (g) => g)
      .join(
        (enter) =>
          enter.append("g").attr("class", "clay-group")
            .attr("filter", "url(#gooey-clay)")
            .attr("fill", (g) => distColors.get(g) ?? "#ffffff")
            .style("pointer-events", "none")
            .attr("opacity", 0)
            .call((e) => e.transition().duration(400).attr("opacity", clayOpacity)),
        (update) =>
          update
            .attr("fill", (g) => distColors.get(g) ?? "#ffffff")
            .call((u) => u.transition().duration(300).attr("opacity", clayOpacity)),
        (exit) =>
          exit.call((e) => e.transition().duration(200).attr("opacity", 0).remove())
      )
      .each(function (distKey) {
        const distNodes = newNodes.filter((n) => n.groupKey === distKey);
        d3.select(this)
          .selectAll<SVGCircleElement, BubbleNode>("circle.clay-bubble")
          .data(distNodes, (d) => d.id)
          .join(
            (enter) =>
              enter.append("circle").attr("class", "clay-bubble")
                .attr("cx", (d) => d.x ?? W / 2)
                .attr("cy", (d) => d.y ?? H / 2)
                .attr("r",  (d) => d.r),
            (update) => update.attr("r", (d) => d.r),
            (exit)   => exit.attr("r", 0).remove()
          );
      });

    // Events
    circles
      .on("mouseover", (event: MouseEvent, d) => { showTooltip(event, d); })
      .on("mousemove", (event: MouseEvent) => moveTooltip(event))
      .on("mouseout",  () => { hideTooltip(); })
      .on("click",     (event: MouseEvent, d) => {
        event.stopPropagation();
        onBottleClickRef.current(d);
      });

    // Enforce layer order: halos (back) → glow → bubbles → lines → labels (front)
    root.select("g.halos-layer").lower();
    root.select("g.glow-layer").raise();
    root.select("g.bubbles-layer").raise();
    root.select("g.lines-layer").raise();
    root.select("g.labels-layer").raise();

    // Render labels
    updateLabels(groupChanged);

    // ── Tick (rAF-throttled for Safari/WebKit performance) ────────────────────
    // D3 may fire ticks faster than 60 fps. Coalescing DOM mutations to at most
    // one per animation frame cuts setAttribute calls by 3–5× on slow engines
    // with zero visual change (node positions are still computed every tick).
    let tickN = 0;
    let rafId: ReturnType<typeof requestAnimationFrame> | null = null;
    simulation.on("tick", () => {
      tickN++;
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        bubblesG
          .selectAll<SVGCircleElement, BubbleNode>("circle.bubble")
          .attr("cx", (d) => d.x ?? 0)
          .attr("cy", (d) => d.y ?? 0);
        glowG.selectAll<SVGGElement, string>("g.clay-group").each(function () {
          d3.select(this)
            .selectAll<SVGCircleElement, BubbleNode>("circle.clay-bubble")
            .attr("cx", (d) => d.x ?? 0)
            .attr("cy", (d) => d.y ?? 0);
        });
        if (tickN % 5 === 0) {
          updateHalos(halosG, newNodes, false);
        }
      });
    });

    // When sim settles, position labels + draw leader lines
    simulation.on("end", () => {
      updateHalos(halosG, newNodes, false);

      const labelsLayer = root.select<SVGGElement>("g.labels-layer");

      // ── Non-distillery: simple above-cluster label nudge ──────────────────
      if (!isDistilleryMode) {
        const groupMinY = new Map<string, number>();
        for (const n of newNodes) {
          const curr = groupMinY.get(n.groupKey) ?? Infinity;
          const top  = (n.y ?? 0) - n.r;
          if (top < curr) groupMinY.set(n.groupKey, top);
        }
        labelsLayer
          .selectAll<SVGTextElement, { key: string; x: number; y: number }>("text.group-label")
          .attr("y", (d) => (groupMinY.get(d.key) ?? d.y) - 8);
        return;
      }

      // ── Distillery: radial edge labels + cluster-edge leader lines ────────
      // Re-read live dimensions — the container may have been resized by the
      // ResizeObserver between when draw() captured W/H and when this fires.
      const liveW = svgRef.current?.clientWidth  ?? W;
      const liveH = svgRef.current?.clientHeight ?? H;
      const cX = liveW / 2;
      const cY = liveH / 2;

      // Actual centroid of each distillery's settled bubbles
      const sums = new Map<string, { sx: number; sy: number; count: number }>();
      for (const n of newNodes) {
        if (n.x == null || n.y == null) continue;
        const s = sums.get(n.groupKey) ?? { sx: 0, sy: 0, count: 0 };
        s.sx += n.x; s.sy += n.y; s.count++;
        sums.set(n.groupKey, s);
      }
      const actualCentroids = new Map<string, { cx: number; cy: number }>();
      for (const [g, s] of sums) {
        actualCentroids.set(g, { cx: s.sx / s.count, cy: s.sy / s.count });
      }

      // Overall cluster bounding radius (farthest bubble edge from chart center)
      let overallR = 0;
      for (const n of newNodes) {
        if (n.x == null || n.y == null) continue;
        const dist = Math.sqrt((n.x - cX) ** 2 + (n.y - cY) ** 2) + n.r;
        if (dist > overallR) overallR = dist;
      }

      type LineDatum = { key: string; x1: number; y1: number; x2: number; y2: number };
      const lineData: LineDatum[] = [];

      // ── Pass 1: compute angle for each distillery ──────────────────────────
      const angleMap = new Map<string, number>();
      labelsLayer
        .selectAll<SVGTextElement, { key: string; x: number; y: number }>("text.group-label")
        .each(function (d) {
          const c = actualCentroids.get(d.key);
          if (!c) return;
          angleMap.set(d.key, Math.atan2(c.cy - cY, c.cx - cX));
        });

      // ── Pass 2: bounding-box collision avoidance across multiple rings ────
      // Sort labels by angle, then greedily assign each to the innermost
      // radial ring where its measured text box doesn't overlap any already-
      // placed label.  Prefer rings that keep the box within SVG bounds.
      const BASE_PAD  = 28;        // px from cluster edge to ring 0
      const RING_STEP = 18;        // px between ring centres
      const LABEL_H   = 15;        // estimated label line-height in px
      const BOX_GAP   = 5;         // minimum clear space between boxes
      const SVG_MARG  = 4;         // minimum margin from SVG edge

      // Measure actual rendered text widths via SVG getComputedTextLength().
      // Labels are already in the DOM at opacity 0 from the join above.
      const textWidthMap = new Map<string, number>();
      labelsLayer
        .selectAll<SVGTextElement, { key: string }>("text.group-label")
        .each(function (d) {
          textWidthMap.set(d.key, this.getComputedTextLength());
        });

      type LabelBox = { x1: number; y1: number; x2: number; y2: number };
      const placed: LabelBox[] = [];

      function labelBox(θ: number, pad: number, tw: number): LabelBox {
        const lx   = cX + (overallR + pad) * Math.cos(θ);
        const ly   = cY + (overallR + pad) * Math.sin(θ) + 4;
        const cosθ = Math.cos(θ);
        const x1   = cosθ > 0.2 ? lx : cosθ < -0.2 ? lx - tw : lx - tw / 2;
        return { x1, y1: ly - LABEL_H / 2, x2: x1 + tw, y2: ly + LABEL_H / 2 };
      }

      function overlaps(a: LabelBox, b: LabelBox): boolean {
        return (
          a.x1 - BOX_GAP < b.x2 + BOX_GAP &&
          a.x2 + BOX_GAP > b.x1 - BOX_GAP &&
          a.y1 - BOX_GAP < b.y2 + BOX_GAP &&
          a.y2 + BOX_GAP > b.y1 - BOX_GAP
        );
      }

      function inBounds(box: LabelBox): boolean {
        return box.x1 >= SVG_MARG && box.x2 <= liveW - SVG_MARG &&
               box.y1 >= SVG_MARG && box.y2 <= liveH - SVG_MARG;
      }

      const sortedByAngle = [...angleMap.entries()].sort(([, a], [, b]) => a - b);
      const padMap = new Map<string, number>();
      for (const [key, θ] of sortedByAngle) {
        const tw = textWidthMap.get(key) ?? key.length * 8;
        let bestPad = BASE_PAD;
        let bestInBounds = false;
        for (let ring = 0; ring < 12; ring++) {
          const pad = BASE_PAD + ring * RING_STEP;
          const box = labelBox(θ, pad, tw);
          const noOverlap = !placed.some((b) => overlaps(box, b));
          const fits = inBounds(box);
          if (noOverlap) {
            // Prefer in-bounds; accept out-of-bounds only if no in-bounds slot found yet
            if (fits || !bestInBounds) {
              bestPad = pad;
              bestInBounds = fits;
            }
            if (fits) break; // in-bounds non-overlapping slot found — done
          }
        }
        padMap.set(key, bestPad);
        placed.push(labelBox(θ, bestPad, tw));
      }

      // ── Pass 3: apply positions, clamping to SVG bounds ───────────────────
      // After ring assignment, clamp the final (lx, ly) so every label's
      // text box stays visible regardless of how tight the chart area is.
      labelsLayer
        .selectAll<SVGTextElement, { key: string; x: number; y: number }>("text.group-label")
        .each(function (d) {
          const c = actualCentroids.get(d.key);
          if (!c) return;

          const θ    = angleMap.get(d.key) ?? 0;
          const pad  = padMap.get(d.key) ?? BASE_PAD;
          const cosθ = Math.cos(θ);
          const anchor = cosθ > 0.2 ? "start" : cosθ < -0.2 ? "end" : "middle";

          let lx = cX + (overallR + pad) * Math.cos(θ);
          let ly = cY + (overallR + pad) * Math.sin(θ);

          // Clamp so the text box stays within SVG bounds (use measured width)
          const tw = textWidthMap.get(d.key) ?? d.key.length * 8;
          if (anchor === "start")       { lx = Math.max(SVG_MARG, Math.min(liveW - SVG_MARG - tw, lx)); }
          else if (anchor === "end")    { lx = Math.max(SVG_MARG + tw, Math.min(liveW - SVG_MARG, lx)); }
          else /* "middle" */           { lx = Math.max(SVG_MARG + tw / 2, Math.min(liveW - SVG_MARG - tw / 2, lx)); }
          ly = Math.max(SVG_MARG + LABEL_H / 2, Math.min(liveH - SVG_MARG - LABEL_H / 2, ly));

          const sel = selectedGroupRef.current;
          const targetOpacity = sel ? (sel === d.key ? 1.0 : 0.2) : 0.92;

          d3.select(this)
            .attr("text-anchor", anchor)
            .style("cursor", "pointer")
            .on("click.labelFilter", (event: MouseEvent) => {
              event.stopPropagation(); // don't bubble to SVG background handler
              const current = selectedGroupRef.current;
              onLabelClickRef.current?.(current === d.key ? null : d.key);
            })
            .transition().duration(350)
            .attr("x", lx)
            .attr("y", ly + 4)
            .attr("opacity", targetOpacity);

          // Leader line: cluster outer edge → label anchor
          const ex = cX + overallR * Math.cos(θ);
          const ey = cY + overallR * Math.sin(θ);
          lineData.push({ key: d.key, x1: ex, y1: ey, x2: lx, y2: ly });
        });

      linesG
        .selectAll<SVGLineElement, LineDatum>("line.leader")
        .data(lineData, (d) => d.key)
        .join(
          (enter) =>
            enter.append("line").attr("class", "leader")
              .attr("x1", (d) => d.x1).attr("y1", (d) => d.y1)
              .attr("x2", (d) => d.x2).attr("y2", (d) => d.y2)
              .attr("stroke", (d) => distColors.get(d.key) ?? "rgba(255,255,255,0.3)")
              .attr("stroke-width", 0.75)
              .attr("stroke-dasharray", "3,3")
              .attr("opacity", 0)
              .style("pointer-events", "none")
              .call((e) => e.transition().duration(300).attr("opacity", 0.45)),
          (update) =>
            update
              .attr("x1", (d) => d.x1).attr("y1", (d) => d.y1)
              .attr("x2", (d) => d.x2).attr("y2", (d) => d.y2),
          (exit) => exit.transition().duration(200).attr("opacity", 0).remove()
        );
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
              x: W / 2 + (pos.x - W / 2) * 0.12,
              y: H / 2 + (pos.y - H / 2) * 0.12,
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

  // ── Search + group filter: dim/shrink non-matching bubbles (no sim rebuild) ─
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const q   = (searchQuery ?? "").toLowerCase().trim();
    const sel = selectedGroup ?? null;

    const bubbles = d3
      .select(svg)
      .selectAll<SVGCircleElement, BubbleNode>("circle.bubble");
    if (!bubbles.size()) return;

    const labels = d3
      .select(svg)
      .selectAll<SVGTextElement, { key: string }>("text.group-label");

    const clayLayer = d3.select(svg).select("g.glow-layer");

    const updateClay = (matchFn: ((d: BubbleNode) => boolean) | null) => {
      clayLayer.selectAll<SVGGElement, string>("g.clay-group").each(function () {
        d3.select(this)
          .selectAll<SVGCircleElement, BubbleNode>("circle.clay-bubble")
          .transition().duration(250)
          .attr("r", (d) => (matchFn === null || matchFn(d)) ? d.r : 0);
      });
    };

    const matchesSearch = (d: BubbleNode) =>
      !q ||
      d.name.toLowerCase().includes(q) ||
      d.brandName.toLowerCase().includes(q) ||
      d.subBrandName.toLowerCase().includes(q) ||
      (d.style ?? "").toLowerCase().includes(q);

    const matchesGroup = (d: BubbleNode) => !sel || d.groupKey === sel;
    const highlight    = (d: BubbleNode) => matchesSearch(d) && matchesGroup(d);

    if (!q && !sel) {
      bubbles.transition().duration(250).attr("opacity", 1).attr("r", (d) => d.r);
      labels.transition().duration(200).attr("opacity", 0.92);
      updateClay(null);
    } else {
      bubbles
        .transition().duration(250)
        .attr("opacity", (d) => (highlight(d) ? 1 : 0.08))
        .attr("r",       (d) => (highlight(d) ? d.r : d.r * 0.35));
      updateClay(highlight);
      // Dim labels that aren't the active group filter
      labels.transition().duration(200).attr("opacity", (d) =>
        sel ? (d.key === sel ? 1.0 : 0.2) : 0.92
      );
    }
  }, [searchQuery, selectedGroup]);

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
