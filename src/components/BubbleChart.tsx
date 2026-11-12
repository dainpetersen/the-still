"use client";

import { useEffect, useMemo, useRef, useCallback } from "react";
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
import { stateFromRegion } from "@/lib/mergeCatalog";
import {
  ensureLayers,
  leaveTerritories,
  renderTerritories,
  rgId,
  type TerritoryController,
} from "@/components/bubbleTerritories";
import {
  buildPriceScale,
  chartPalette,
  rarityScale as buildRarityScale,
  ratingScale as buildRatingScale,
  readableLabelColor,
  type ChartTheme,
  type PriceScale,
} from "@/lib/colorScales";

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
  /** Which theme is showing — the bubble colours are computed per theme. */
  theme: ChartTheme;
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
  priceScale: PriceScale,
  theme: ChartTheme,
  distColors?: Map<string, string>
): (d: BubbleNode) => string {
  const ratingScale = buildRatingScale(theme);
  const rarityScale = buildRarityScale(theme);
  const noData = chartPalette(theme).noData;

  return (d: BubbleNode) => {
    if (mode === "brand")  return distColors?.get(d.brandName) ?? "#8a7055";
    if (mode === "price")  return priceScale.color(d.price);
    if (mode === "rarity") return rarityScale(d.rarityScore ?? 0);
    // rating
    const r = ratings[d.id] ?? (d.avgRating ? { avg: d.avgRating } : null);
    return r ? ratingScale(r.avg) : noData;
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

/**
 * Space the chart keeps clear of bubbles in the grouped views: the search box
 * and "Submit a Bottle" sit along the top, the availability toggle along the
 * bottom, and each cluster's label needs a line above it.
 */
const INSET = { top: 80, right: 16, bottom: 52, left: 16 };

type Cell = { key?: string; children?: Cell[] };

/**
 * Where each group's cluster should settle.
 *
 * Distillery view: one cloud — every group is pulled close to the centre.
 *
 * Other views: the chart area is divided in proportion to how much room each
 * group's bubbles need (a treemap), and each cluster heads for the middle of
 * its own cell. An even grid gave three single malts the same space as 380
 * bourbons, so the big clusters spilled over their neighbours and labels
 * ended up sitting on the wrong group.
 */
function layoutCentroids(
  groups: string[],
  nodes: BubbleNode[],
  w: number,
  h: number,
  mode: GroupMode
): Map<string, { x: number; y: number }> {
  if (mode === "distillery") {
    const grid = computeCentroids(groups, w, h);
    for (const [key, pos] of grid) {
      grid.set(key, { x: w / 2 + (pos.x - w / 2) * 0.2, y: h / 2 + (pos.y - h / 2) * 0.2 });
    }
    return grid;
  }

  const weight = new Map<string, number>();
  for (const n of nodes) weight.set(n.groupKey, (weight.get(n.groupKey) ?? 0) + n.r * n.r);
  const total = d3.sum(weight.values());
  const floor = total * 0.035; // even a one-bottle group gets room for its label

  // Age and price tiers read in their natural order; the rest go largest first.
  const ordered =
    mode === "ageTier" || mode === "priceTier"
      ? groups
      : [...groups].sort((a, b) => (weight.get(b) ?? 0) - (weight.get(a) ?? 0));

  const root = d3
    .hierarchy<Cell>({ children: ordered.map((key) => ({ key })) })
    .sum((d) => (d.key ? Math.max(weight.get(d.key) ?? 0, floor) : 0));
  const innerW = Math.max(1, w - INSET.left - INSET.right);
  const innerH = Math.max(1, h - INSET.top - INSET.bottom);
  const laidOut = d3.treemap<Cell>().tile(d3.treemapSquarify.ratio(1)).size([innerW, innerH])(root);

  const map = new Map<string, { x: number; y: number }>();
  for (const leaf of laidOut.leaves()) {
    if (!leaf.data.key) continue;
    map.set(leaf.data.key, {
      x: INSET.left + (leaf.x0 + leaf.x1) / 2,
      y: INSET.top + (leaf.y0 + leaf.y1) / 2 + 8, // a little low: the label sits above
    });
  }
  return map;
}

/** Escape text before it goes into the tooltip's HTML. */
function esc(text: string | number | undefined | null): string {
  return String(text ?? "").replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;"
  );
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
            return base ? hexToRgba(base, 0.09) : "rgb(var(--ink-rgb) / 0.035)";
          })
          .attr("stroke", (d) => {
            const base = colorMap?.get(d.key);
            return base ? hexToRgba(base, 0.25) : "rgb(var(--ink-rgb) / 0.10)";
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
            return base ? hexToRgba(base, 0.09) : "rgb(var(--ink-rgb) / 0.035)";
          })
          .attr("stroke", (d) => {
            const base = colorMap?.get(d.key);
            return base ? hexToRgba(base, 0.25) : "rgb(var(--ink-rgb) / 0.10)";
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
  theme,
  searchQuery,
  distilleryColors,
  selectedGroup,
  onLabelClick,
}: Props) {
  const svgRef   = useRef<SVGSVGElement>(null);
  const wrapRef  = useRef<HTMLDivElement>(null);
  const simRef   = useRef<d3.Simulation<BubbleNode, undefined> | null>(null);
  const nodesRef = useRef<BubbleNode[]>([]);
  /** Size the chart was last laid out for — lets the resize observer ignore no-op callbacks. */
  const lastSizeRef = useRef<{ w: number; h: number } | null>(null);

  // Track previous values to know what changed
  const prevGroupModeRef = useRef<GroupMode | null>(null);
  const prevSizeModeRef  = useRef<BubbleSizeMode | null>(null);
  const prevColorModeRef = useRef<ColorMode | null>(null);
  const prevThemeRef     = useRef<ChartTheme | null>(null);

  // Keep stable refs for callbacks (avoid sim re-init on every render)
  const onBottleClickRef = useRef(onBottleClick);
  onBottleClickRef.current = onBottleClick;

  const onLabelClickRef = useRef(onLabelClick);
  onLabelClickRef.current = onLabelClick;

  const selectedGroupRef = useRef(selectedGroup);
  selectedGroupRef.current = selectedGroup;

  const ratingsRef = useRef(ratings);
  ratingsRef.current = ratings;

  const searchQueryRef = useRef(searchQuery);
  searchQueryRef.current = searchQuery;

  /** The distillery view's controller while that view is showing. */
  const territoryRef = useRef<TerritoryController | null>(null);
  /** Latest draw(), for the resize observer. */
  const drawRef = useRef<() => void>(() => {});

  // ── Tooltip ────────────────────────────────────────────────────────────────
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  const showTooltip = useCallback((event: MouseEvent, d: BubbleNode) => {
    const tip = tooltipRef.current;
    if (!tip) return;
    const r = ratingsRef.current[d.id];
    const ratingLine = r
      ? `<div style="color:var(--accent);margin-top:5px;font-family:Georgia,serif;font-size:13px;">★ ${r.avg.toFixed(1)} <span style="color:rgb(var(--ink-rgb) / 0.6);font-size:12px;">(${r.count} rating${r.count !== 1 ? "s" : ""})</span></div>`
      : `<div style="color:var(--ink-muted);margin-top:5px;font-size:12px;">Not yet rated</div>`;
    const ageStr = d.age ? `${d.age}yr` : "NAS";
    const badges = [
      d.source === "community" ? `<span style="color:rgb(var(--community-rgb));font-size:11px;border:1px solid rgb(var(--community-rgb) / 0.4);padding:1px 5px;border-radius:2px;">Community</span>` : "",
      d.isNDP ? `<span style="color:rgb(var(--brown-rgb) / 0.85);font-size:11px;border:1px solid rgb(var(--brown-rgb) / 0.3);padding:1px 5px;border-radius:2px;">NDP</span>` : "",
    ].filter(Boolean).join(" ");

    tip.innerHTML = `
      <div style="font-weight:700;font-size:14px;color:var(--ink);margin-bottom:2px;font-family:Georgia,serif;">${esc(d.name)}</div>
      <div style="font-size:12px;color:rgb(var(--ink-rgb) / 0.6);margin-bottom:4px;">${esc(d.brandName)} · ${esc(d.subBrandName)}</div>
      <div style="font-size:12.5px;color:rgb(var(--ink-rgb) / 0.8);">$${esc(d.price)} · ${esc(d.abv)}% ABV · ${esc(ageStr)}</div>
      <div style="font-size:12px;color:rgb(var(--ink-rgb) / 0.6);text-transform:capitalize;">${esc(d.rarity)}</div>
      ${ratingLine}
      ${d.sourceDistillery ? `<div style="font-size:12px;color:var(--ink-muted);margin-top:3px;">Source: ${esc(d.sourceDistillery)}</div>` : ""}
      ${d.description ? `<div style="font-size:12px;color:rgb(var(--ink-rgb) / 0.65);margin-top:6px;max-width:240px;line-height:1.45;">${esc(d.description.slice(0, 120))}${d.description.length > 120 ? "…" : ""}</div>` : ""}
      ${badges ? `<div style="margin-top:6px;display:flex;gap:4px;">${badges}</div>` : ""}
      <div style="font-size:11px;color:var(--ink-muted);margin-top:6px;">Click for details</div>
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

  const showTerritoryTooltip = useCallback(
    (event: MouseEvent, info: { key: string; count: number; state: string }) => {
      const tip = tooltipRef.current;
      if (!tip) return;
      tip.innerHTML = `
        <div style="font-weight:700;font-size:14px;color:var(--ink);font-family:Georgia,serif;">${esc(info.key)}</div>
        <div style="font-size:12px;color:var(--ink-muted);margin-top:2px;">${info.count} bottle${info.count !== 1 ? "s" : ""}${info.state !== "Other" ? ` · ${esc(info.state)}` : ""}</div>
        <div style="font-size:11px;color:var(--ink-muted);margin-top:6px;">Click to zoom in</div>
      `;
      tip.style.display = "block";
      tip.style.opacity = "1";
      moveTooltip(event);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

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
    const centroids = layoutCentroids(groups, newNodes, W, H, groupMode);
    lastSizeRef.current = { w: W, h: H };

    const isDistilleryMode = groupMode === "distillery";
    const isBrandMode = colorMode === "brand";
    const distColors = distilleryColors ?? buildDistilleryColors(brands);
    const glowOpacity = isDistilleryMode ? 0.35 : 0;

    const priceScale = buildPriceScale(newNodes.map((n) => n.price), theme);
    const colorFn = getColorFn(colorMode, ratingsRef.current, priceScale, theme, distColors);
    // Group labels: a distillery's own colour (made legible on this ground) or plain ink.
    const labelFill = (key: string) =>
      isDistilleryMode && distColors.has(key) ? readableLabelColor(distColors.get(key)!, theme) : "var(--ink)";

    const prevGroupMode = prevGroupModeRef.current;
    const prevSizeMode  = prevSizeModeRef.current;
    const prevColorMode = prevColorModeRef.current;

    const groupChanged = prevGroupMode !== null && prevGroupMode !== groupMode;
    const sizeChanged  = prevSizeMode  !== null && prevSizeMode  !== sizeMode;
    const themeChanged = prevThemeRef.current !== null && prevThemeRef.current !== theme;
    prevThemeRef.current = theme;
    const colorChanged = (prevColorMode !== null && prevColorMode !== colorMode) || themeChanged;

    prevGroupModeRef.current = groupMode;
    prevSizeModeRef.current  = sizeMode;
    prevColorModeRef.current = colorMode;

    const root = d3.select(svg);

    // Clicking empty SVG space clears any active label filter
    root.on("click.clearGroup", () => {
      onLabelClickRef.current?.(null);
    });

    // ── Distillery view: territories, drawn by bubbleTerritories.ts ──────────
    // Plain geometry rather than a simulation: every bottle has a fixed place
    // inside its own distillery's territory.
    if (isDistilleryMode) {
      simRef.current?.stop();
      simRef.current = null;
      nodesRef.current = newNodes;
      const places = new Map(
        brands.map((b) => [
          b.name,
          {
            state: b.state ?? stateFromRegion(b.region) ?? "Other",
            city: (b.region ?? "").split(",")[0].trim(),
          },
        ])
      );
      territoryRef.current = renderTerritories<BubbleNode>({
        svg,
        width: W,
        height: H,
        nodes: newNodes,
        places,
        colorOf: colorFn,
        groupColor: (key) => distColors.get(key),
        quietClay: isBrandMode,
        theme,
        selected: selectedGroupRef.current ?? null,
        query: searchQueryRef.current ?? "",
        onSelect: (key) => onLabelClickRef.current?.(key),
        onBubbleClick: (d) => onBottleClickRef.current(d),
        onBubbleOver: showTooltip,
        onTerritoryOver: showTerritoryTooltip,
        onPointerMove: moveTooltip,
        onPointerOut: hideTooltip,
      });
      return;
    }
    // Another view: clear the territories away and make sure the layers exist.
    if (territoryRef.current) {
      leaveTerritories(svg);
      territoryRef.current = null;
    }
    ensureLayers(svg);

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
            .style("fill", (d) => labelFill(d.key))
            .attr("opacity", 0)
            .attr("font-size", "12px")
            .attr("font-weight", "700")
            .attr("letter-spacing", "0.08em")
            .attr("paint-order", "stroke")
            .style("stroke", "var(--bg)")
            .attr("stroke-width", 3)
            .attr("stroke-linejoin", "round")
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
              .style("fill", (d) => labelFill(d.key))
              .attr("opacity", 0)
              .attr("font-size", "12px")
              .attr("font-weight", "700")
              .attr("letter-spacing", "0.08em")
              .attr("paint-order", "stroke")
              .style("stroke", "var(--bg)")
              .attr("stroke-width", 3)
              .attr("stroke-linejoin", "round")
              .text((d) => d.key.toUpperCase())
              .call((e) => {
                if (!isDistilleryMode) e.transition().duration(300).attr("opacity", 0.9);
              }),
          (update) =>
            update
              .text((d) => d.key.toUpperCase())
              .style("fill", (d) => labelFill(d.key))
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
      root
        .selectAll<SVGTextElement, { key: string }>("text.group-label")
        .style("fill", (d) => labelFill(d.key));
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
      const newClayOpacity = (isDistilleryMode && !isBrandMode) ? 0.52 : 0;
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

    // Carry positions over from the previous layout wherever a bottle was
    // already on screen, whatever caused the rebuild. (They used to be kept
    // only on a Group By change, so each data refresh during page load threw
    // every bubble back to the centre and replayed the whole burst.)
    const hadLayout = nodesRef.current.length > 0;
    const prevById = new Map(nodesRef.current.map((n) => [n.id, n]));
    for (const n of newNodes) {
      const prev = prevById.get(n.id);
      if (prev && prev.x != null && prev.y != null) {
        n.x = prev.x;
        n.y = prev.y;
        n.vx = groupChanged ? (prev.vx ?? 0) * 0.3 : 0;
        n.vy = groupChanged ? (prev.vy ?? 0) * 0.3 : 0;
      }
    }
    // Bottles new to the chart start scattered around their own group's target
    // instead of stacked on one point, so they have little distance to travel.
    const groupSize = new Map<string, number>();
    for (const n of newNodes) groupSize.set(n.groupKey, (groupSize.get(n.groupKey) ?? 0) + 1);
    for (const n of newNodes) {
      if (n.x != null && n.y != null) continue;
      const target = centroids.get(n.groupKey) ?? { x: W / 2, y: H / 2 };
      // The distillery view squeezes every target toward the centre; fan the
      // starting points back out so the cloud doesn't begin as one dense knot.
      const fan = isDistilleryMode ? 3 : 1;
      const cx = W / 2 + (target.x - W / 2) * fan;
      const cy = H / 2 + (target.y - H / 2) * fan;
      const spread = estimatedClusterRadius(groupSize.get(n.groupKey) ?? 1, 9);
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.sqrt(Math.random()) * spread;
      n.x = cx + Math.cos(angle) * dist;
      n.y = cy + Math.sin(angle) * dist;
      n.vx = 0;
      n.vy = 0;
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
      .velocityDecay(0.3);

    // Grouped views keep every bubble inside the area the overlays leave free.
    if (!isDistilleryMode) {
      simulation.force("bounds", () => {
        const { w, h } = lastSizeRef.current ?? { w: W, h: H };
        for (const n of newNodes) {
          if (n.x == null || n.y == null) continue;
          n.x = Math.max(INSET.left + n.r, Math.min(w - INSET.right - n.r, n.x));
          n.y = Math.max(INSET.top + n.r, Math.min(h - INSET.bottom - n.r, n.y));
        }
      });
    }

    // ── Settle before painting, unless this is a Group By change ─────────────
    // A Group By change is worth watching: the bubbles travel from one
    // arrangement to another. A first load or a data refresh is not, so there
    // the simulation is run to rest right here and the chart appears settled.
    const animate = groupChanged;
    if (animate) {
      simulation.alphaDecay(0.045); // about 2.5 s of motion
    } else {
      simulation.stop();
      simulation.alpha(hadLayout ? 0.3 : 1).alphaDecay(0.035);
      const ticks = Math.ceil(
        Math.log(simulation.alphaMin() / simulation.alpha()) / Math.log(1 - simulation.alphaDecay())
      );
      simulation.tick(ticks);
    }

    simRef.current = simulation;

    // ── Halos layer (behind everything else) ──────────────────────────────────
    let halosG = root.select<SVGGElement>("g.halos-layer");
    if (halosG.empty()) {
      const bl = root.select("g.bubbles-layer");
      halosG = bl.empty()
        ? root.append("g").attr("class", "halos-layer")
        : root.insert("g", "g.viewport").attr("class", "halos-layer");
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
            .style("stroke", (d) =>
              d.source === "community" ? "rgb(var(--community-rgb) / 0.8)" : "var(--bubble-line)"
            )
            .attr("stroke-width", (d) => (d.source === "community" ? 1.5 : 0.8))
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
    const distGroupKeys: string[] = []; // the blurred backing was only ever shown in the old distillery view
    // Moderate opacity so coloured blobs are visible on cream paper
    const clayOpacity = (isDistilleryMode && !isBrandMode) ? 0.52 : 0;

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
    // ── Grouped views: keep each label centred just above its own cluster ────
    // Positions come from where the bubbles actually are, not from where the
    // layout aimed them, so a label can't end up over a neighbouring group.
    const placeGroupLabels = () => {
      const liveW = svgRef.current?.clientWidth ?? W;
      const extent = new Map<string, { sx: number; n: number; top: number }>();
      for (const n of newNodes) {
        if (n.x == null || n.y == null) continue;
        const e = extent.get(n.groupKey) ?? { sx: 0, n: 0, top: Infinity };
        e.sx += n.x;
        e.n++;
        e.top = Math.min(e.top, n.y - n.r);
        extent.set(n.groupKey, e);
      }

      const placed: { el: SVGTextElement; x: number; y: number; w: number }[] = [];
      root
        .select<SVGGElement>("g.labels-layer")
        .selectAll<SVGTextElement, { key: string }>("text.group-label")
        .each(function (d) {
          const e = extent.get(d.key);
          if (!e) return;
          placed.push({ el: this, x: e.sx / e.n, y: Math.max(16, e.top - 9), w: this.getComputedTextLength() });
        });

      // Two labels on the same line that would collide are nudged apart.
      for (let pass = 0; pass < 3; pass++) {
        for (let i = 0; i < placed.length; i++) {
          for (let j = i + 1; j < placed.length; j++) {
            const a = placed[i];
            const b = placed[j];
            if (Math.abs(a.y - b.y) > 15) continue;
            const overlap = (a.w + b.w) / 2 + 10 - Math.abs(a.x - b.x);
            if (overlap <= 0) continue;
            const dir = a.x <= b.x ? -1 : 1;
            a.x += (dir * overlap) / 2;
            b.x -= (dir * overlap) / 2;
          }
        }
      }

      for (const l of placed) {
        const x = Math.max(INSET.left + l.w / 2, Math.min(liveW - INSET.right - l.w / 2, l.x));
        d3.select(l.el).attr("text-anchor", "middle").attr("x", x).attr("y", l.y);
      }
    };

    const paint = () => {
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
    };

    let tickN = 0;
    let rafId: ReturnType<typeof requestAnimationFrame> | null = null;
    simulation.on("tick", () => {
      tickN++;
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        paint();
        if (tickN % 5 === 0) {
          updateHalos(halosG, newNodes, false);
          if (!isDistilleryMode) placeGroupLabels();
        }
      });
    });

    // When sim settles, position labels + draw leader lines
    const onSettled = () => {
      updateHalos(halosG, newNodes, false);

      placeGroupLabels();
    };
    simulation.on("end", onSettled);

    if (animate) {
      simulation.alpha(0.7).restart();
    } else {
      // Already at rest: draw the final positions and labels straight away.
      paint();
      onSettled();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brands, colorMode, groupMode, sizeMode, theme, buildNodes, showTooltip, showTerritoryTooltip, moveTooltip, hideTooltip]);
  drawRef.current = draw;

  // ── Resize observer ────────────────────────────────────────────────────────
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => {
      const sim = simRef.current;
      const W   = wrap.clientWidth;
      const H   = wrap.clientHeight;
      if (W === 0 || H === 0) return;
      // The observer also fires once when it is attached; nothing changed then.
      const last = lastSizeRef.current;
      if (last && last.w === W && last.h === H) return;
      if (groupMode === "distillery") {
        drawRef.current();
        return;
      }
      lastSizeRef.current = { w: W, h: H };
      d3.select(svgRef.current).attr("width", W).attr("height", H);

      // Recompute centroids and update force targets
      if (sim && nodesRef.current.length > 0) {
        const groups    = canonicalOrder([...new Set(nodesRef.current.map((n) => n.groupKey))], groupMode);
        const centroids = layoutCentroids(groups, nodesRef.current, W, H, groupMode);
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
  }, [brands, groupMode, sizeMode, colorMode, ratings, theme]);

  // ── Search + group filter: fade non-matching bubbles out entirely ────────────
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    if (groupMode === "distillery") {
      territoryRef.current?.setFocus(selectedGroup ?? null, searchQuery ?? "");
      return;
    }
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

    // Fade entire clay group in/out based on whether any bubble in it matches
    const updateClay = (matchFn: ((d: BubbleNode) => boolean) | null) => {
      clayLayer.selectAll<SVGGElement, string>("g.clay-group").each(function () {
        const grp = d3.select(this);
        if (matchFn === null) {
          grp.transition().duration(200).attr("opacity", 0.52);
        } else {
          const nodes = grp
            .selectAll<SVGCircleElement, BubbleNode>("circle.clay-bubble")
            .data();
          const anyMatch = nodes.some(matchFn);
          grp.transition().duration(200).attr("opacity", anyMatch ? 0.52 : 0);
        }
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
      // Restore everything
      bubbles.transition().duration(250).attr("opacity", 1);
      labels.transition().duration(200).attr("opacity", 0.92);
      updateClay(null);
    } else {
      // Matching bubbles stay visible; non-matching fade to invisible
      bubbles
        .transition().duration(200)
        .attr("opacity", (d) => (highlight(d) ? 1 : 0));
      updateClay(highlight);
      labels.transition().duration(200).attr("opacity", (d) =>
        sel ? (d.key === sel ? 1.0 : 0.15) : 0.92
      );
    }
  }, [searchQuery, selectedGroup, groupMode]);

  // ── Tooltip DOM element ────────────────────────────────────────────────────
  useEffect(() => {
    const tip = document.createElement("div");
    tip.style.cssText = `
      position: fixed; pointer-events: none; display: none; opacity: 0;
      z-index: 9999; padding: 10px 13px; border-radius: 2px;
      background: rgb(var(--panel-rgb) / 0.97); border: 1px solid rgb(var(--ink-rgb) / 0.18);
      box-shadow: 2px 3px 12px rgba(0,0,0,0.12);
      font-family: inherit; font-size: 12px; color: var(--ink);
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

  // ── Zoomed into a distillery: its title, and Escape to come back out ───────
  const zoomed = groupMode === "distillery" && selectedGroup ? selectedGroup : null;
  const zoomedInfo = useMemo(() => {
    if (!zoomed) return null;
    const brand = brands.find((b) => b.name === zoomed);
    if (!brand) return null;
    const count = brand.subBrands.reduce((sum, sb) => sum + sb.bottles.length, 0);
    return { count, region: brand.region };
  }, [zoomed, brands]);

  useEffect(() => {
    if (!zoomed) return;
    const onKey = (e: KeyboardEvent) => {
      // A dialog on top (bottle details, sign-in) gets Escape first.
      if (e.key === "Escape" && !document.querySelector('[role="dialog"]')) onLabelClickRef.current?.(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomed]);

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
      {zoomed && (
        <div
          className="absolute left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 rounded-sm pl-1.5 pr-4 py-1.5 max-w-[calc(100%-24px)]"
          style={{
            top: 64,
            background: "rgb(var(--panel-rgb) / 0.95)",
            border: "1px solid var(--line-strong)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            backdropFilter: "blur(8px)",
          }}
        >
          <button
            type="button"
            onClick={() => onLabelClick?.(null)}
            className="flex-shrink-0 rounded-sm px-2.5 py-1.5 text-[13px] font-semibold transition-colors hover:bg-ink/10"
            style={{ color: "var(--ink)" }}
          >
            ← All distilleries
          </button>
          <span
            className="truncate text-[16px]"
            style={{ fontFamily: "Georgia,serif", color: "var(--ink)" }}
          >
            {zoomed}
          </span>
          {zoomedInfo && (
            <span className="flex-shrink-0 text-[13px] hidden sm:inline" style={{ color: "var(--ink-muted)" }}>
              {zoomedInfo.count} {zoomedInfo.count === 1 ? "bottle" : "bottles"}
              {zoomedInfo.region ? ` · ${zoomedInfo.region}` : ""}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
