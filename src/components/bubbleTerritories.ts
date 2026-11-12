import * as d3 from "d3";
import { readableLabelColor, type ChartTheme } from "@/lib/colorScales";
import { CLAY_PAD, layoutTerritories, type GroupPlace, type Territory } from "@/lib/territoryLayout";

/**
 * Drawing for the "Group By: Distillery" view of the bubble chart.
 *
 * Each distillery is a tight cluster of bottles on a patch of clay in its own
 * colour, with a narrow channel between one distillery and the next.
 * Hovering a cluster or its label picks it out; selecting one flies the
 * camera into it and names the bottles.
 *
 * BubbleChart owns the <svg>, the data and the other Group By views (which
 * are physics simulations). It calls renderTerritories() whenever something
 * changes while this view is showing, and leaveTerritories() when another
 * view takes over. Both views share the same bubble elements, so bottles
 * glide between arrangements instead of being redrawn.
 */

// ── Shapes shared with BubbleChart ───────────────────────────────────────────

export interface TerritoryNode {
  id: string;
  name: string;
  brandName: string;
  subBrandName: string;
  style?: string;
  source?: string;
  r: number;
  x?: number;
  y?: number;
  groupKey: string;
}

export interface TerritoryContext<N extends TerritoryNode> {
  svg: SVGSVGElement;
  width: number;
  height: number;
  /** One per bottle, radius already set for the current Size By. Positions are written back onto these. */
  nodes: N[];
  /** Where each distillery is, for grouping by state and town. */
  places: Map<string, GroupPlace>;
  /** Fill colour of a bottle in the current Color By. */
  colorOf: (node: N) => string;
  /** A distillery's own colour. */
  groupColor: (key: string) => string | undefined;
  /** Bottles are already coloured by distillery, so the clay can sit back. */
  quietClay?: boolean;
  theme: ChartTheme;
  /** Distillery currently zoomed into, if any. */
  selected: string | null;
  /** Current search text. */
  query: string;
  onSelect: (key: string | null) => void;
  onBubbleClick: (node: N) => void;
  onBubbleOver: (event: MouseEvent, node: N) => void;
  onTerritoryOver: (event: MouseEvent, info: { key: string; count: number; state: string }) => void;
  onPointerMove: (event: MouseEvent) => void;
  onPointerOut: () => void;
}

export interface TerritoryController {
  /** Zoom to (or out of) a distillery and apply the search highlight. */
  setFocus: (selected: string | null, query: string) => void;
}

// ── Constants ────────────────────────────────────────────────────────────────

/** Kept clear at the top for the search box, Submit a Bottle and the zoom title. */
const TOP_CLEAR = 68;
const BOTTOM_PAD = 24;
/** On a roomy chart the picture may grow a little past the bottles' natural size. */
const MAX_SCALE = 1.15;
const FALLBACK_COLOR = "#8a7055";

type View = [number, number, number]; // centre x, centre y, visible width — in chart coordinates

/** The camera's position, and a token for the render that currently owns the view. */
type SvgWithView = SVGSVGElement & { __ccView?: View; __ccRender?: object };

/** Sanitise a bottle id for use as an SVG element id. */
export function rgId(id: string): string {
  return `rg-${id.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// ── Layers ───────────────────────────────────────────────────────────────────

type G = d3.Selection<SVGGElement, unknown, null, undefined>;

interface Layers {
  /** Everything that zooms: the clay and the bottles on it. */
  viewport: G;
  territories: G;
  bubbles: G;
  /** Drawn in screen space, over the zooming content. */
  lines: G;
  labels: G;
  names: G;
}

/**
 * The chart's layers, created on first use. The bubbles layer may already
 * exist at the top level (made by another view); it is moved into the
 * viewport so both views draw the same bottle elements.
 */
export function ensureLayers(svg: SVGSVGElement): Layers {
  const root = d3.select(svg) as d3.Selection<SVGSVGElement, unknown, null, undefined>;

  let viewport = root.select<SVGGElement>("g.viewport");
  if (viewport.empty()) viewport = root.insert("g", ":first-child").attr("class", "viewport");

  const within = (cls: string): G => {
    let g = viewport.select<SVGGElement>(`:scope > g.${cls}`);
    if (!g.empty()) return g;
    const stray = root.select<SVGGElement>(`g.${cls}`);
    g = stray.empty()
      ? viewport.append("g").attr("class", cls)
      : (viewport.append(() => stray.node()!) as unknown as G);
    return g;
  };
  const territories = within("territories-layer");
  const bubbles = within("bubbles-layer");

  const top = (cls: string): G => {
    let g = root.select<SVGGElement>(`:scope > g.${cls}`);
    if (g.empty()) g = root.append("g").attr("class", cls);
    return g;
  };
  const lines = top("lines-layer");
  const labels = top("labels-layer");
  const names = top("names-layer").style("pointer-events", "none");

  // Back to front: viewport (clay, bottles), lines, labels, names.
  territories.lower();
  bubbles.raise();
  lines.raise();
  labels.raise();
  names.raise();

  return { viewport, territories, bubbles, lines, labels, names };
}

/** One radial gradient per bottle: solid in the middle, a little translucent at the rim. */
export function syncGradients<N extends TerritoryNode>(svg: SVGSVGElement, nodes: N[], colorOf: (n: N) => string): void {
  const root = d3.select(svg);
  let defs = root.select<SVGDefsElement>("defs");
  if (defs.empty()) defs = root.insert<SVGDefsElement>("defs", ":first-child");
  defs.selectAll("radialGradient.bubble-rg").remove();
  for (const n of nodes) {
    const c = colorOf(n);
    const rg = defs
      .append("radialGradient")
      .attr("class", "bubble-rg")
      .attr("id", rgId(n.id))
      .attr("gradientUnits", "objectBoundingBox")
      .attr("cx", "50%")
      .attr("cy", "50%")
      .attr("r", "50%");
    rg.append("stop").attr("offset", "0%").attr("stop-color", c).attr("stop-opacity", "1");
    rg.append("stop").attr("offset", "72%").attr("stop-color", c).attr("stop-opacity", "0.9");
    rg.append("stop").attr("offset", "100%").attr("stop-color", c).attr("stop-opacity", "0.66");
  }
}

// ── Leaving this view ────────────────────────────────────────────────────────

/** Another Group By view is taking over: put the camera back and clear this view's furniture. */
export function leaveTerritories(svg: SVGSVGElement): void {
  const root = d3.select(svg);
  const viewport = root.select<SVGGElement>("g.viewport");
  if (viewport.empty()) return;

  // Stop any glide still in flight, or it would fight the simulation for the bottles.
  root.selectAll("circle.bubble").interrupt("move").interrupt("fade").attr("opacity", 1);
  viewport.interrupt("zoom").attr("transform", null);
  (svg as SvgWithView).__ccView = undefined;
  // Disown the view, so a hover timer still pending from it can't redraw anything.
  (svg as SvgWithView).__ccRender = undefined;

  const gone = reducedMotion() ? 0 : 220;
  root
    .selectAll("g.territory")
    .interrupt("fade")
    .transition()
    .duration(gone)
    .attr("opacity", 0)
    .on("end interrupt", function () {
      (this as SVGGElement).remove();
    });
  root.selectAll("text.bottle-name, line.hover-link").remove();
}

// ── Text fitting for bottle names ────────────────────────────────────────────

function luminance(color: string): number {
  const { r, g, b } = d3.rgb(color);
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Break a name into at most `maxLines` lines of about `perLine` characters, ending "…" if it doesn't fit. */
function wrapName(name: string, perLine: number, maxLines: number): string[] {
  const words = name.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= perLine || !line) {
      line = next;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);

  const clipped = lines.slice(0, maxLines).map((l) => (l.length > perLine ? `${l.slice(0, Math.max(1, perLine - 1))}…` : l));
  if (lines.length > maxLines) {
    const last = clipped[maxLines - 1];
    clipped[maxLines - 1] = `${last.slice(0, Math.max(1, Math.min(last.length, perLine - 1)))}…`;
  }
  return clipped;
}

/**
 * Words every name in the list starts with ("Still Austin" for Still Austin's
 * bottles). Inside that distillery's territory they are noise, so the bottle
 * labels leave them off. Empty when the names share nothing, or when dropping
 * the words would leave some bottle with no name at all.
 */
function sharedLeadingWords(names: string[]): number {
  if (names.length < 2) return 0;
  const words = names.map((n) => n.split(/\s+/));
  let shared = 0;
  while (words.every((w) => w.length > shared + 1 && w[shared].toLowerCase() === words[0][shared].toLowerCase())) shared++;
  return shared;
}

// ── The view ─────────────────────────────────────────────────────────────────

export function renderTerritories<N extends TerritoryNode>(ctx: TerritoryContext<N>): TerritoryController {
  const { svg, width: W, height: H, nodes, theme } = ctx;
  const L = ensureLayers(svg);
  // Only the latest render may touch the chart; timers and callbacks left over
  // from an earlier one (or from before another view took over) do nothing.
  const holder = svg as SvgWithView;
  const token = {};
  holder.__ccRender = token;
  const live = () => holder.__ccRender === token;
  const still = reducedMotion();
  const ms = (n: number) => (still ? 0 : n);

  // Arriving from another view (or loading for the first time) gets a fuller entrance.
  const arriving = L.territories.select("g.territory").empty();

  // ── Layout, scaled to fit beside the label columns ─────────────────────────
  const layout = layoutTerritories(
    nodes.map((n) => ({ id: n.id, r: n.r, group: n.groupKey })),
    ctx.places
  );
  const labelSpace = Math.max(84, Math.min(190, W * 0.17));
  const availW = W - labelSpace * 2;
  const availH = H - TOP_CLEAR - BOTTOM_PAD;
  const k = layout.radius > 0 ? Math.max(0.5, Math.min(MAX_SCALE, Math.min(availW, availH) / (layout.radius * 2))) : 1;
  const cX = W / 2;
  const cY = TOP_CLEAR + availH / 2;
  const cloudR = layout.radius * k;

  for (const n of nodes) {
    const p = layout.bubbles.get(n.id);
    n.r = n.r * k;
    n.x = cX + (p?.x ?? 0) * k;
    n.y = cY + (p?.y ?? 0) * k;
  }
  // Chart coordinates for the camera and labels; the clay outline stays in
  // layout coordinates and is drawn through the same scale and shift.
  const territories: Territory[] = layout.territories.map((t) => ({ ...t, x: cX + t.x * k, y: cY + t.y * k, r: t.r * k }));
  const territoryOf = new Map(territories.map((t) => [t.key, t]));
  const membersOf = d3.group(nodes, (n) => n.groupKey);
  const clayTransform = `translate(${cX},${cY}) scale(${k})`;

  // Entrance order: territories nearest the middle first.
  const rank = new Map(
    [...territories]
      .sort((a, b) => Math.hypot(a.x - cX, a.y - cY) - Math.hypot(b.x - cX, b.y - cY))
      .map((t, i) => [t.key, i])
  );
  const stagger = (key: string) => (still ? 0 : (rank.get(key) ?? 0) * 9);

  const ringColor = (key: string) => readableLabelColor(ctx.groupColor(key) ?? FALLBACK_COLOR, theme);
  const clayAlpha = (theme === "dark" ? 0.44 : 0.5) * (ctx.quietClay ? 0.55 : 1);

  // ── What is being pointed at, zoomed into, searched for ────────────────────
  const state = { selected: ctx.selected && territoryOf.has(ctx.selected) ? ctx.selected : null, query: ctx.query, hover: null as string | null };
  let hoverTimer: ReturnType<typeof setTimeout> | null = null;

  const matches = (d: N): boolean => {
    const q = state.query.toLowerCase().trim();
    return (
      !q ||
      d.name.toLowerCase().includes(q) ||
      d.brandName.toLowerCase().includes(q) ||
      d.subBrandName.toLowerCase().includes(q) ||
      (d.style ?? "").toLowerCase().includes(q)
    );
  };

  // ── Bottles ────────────────────────────────────────────────────────────────
  syncGradients(svg, nodes, ctx.colorOf);

  const bubbles = L.bubbles
    .selectAll<SVGCircleElement, N>("circle.bubble")
    .data(nodes, (d) => d.id)
    .join(
      (enter) =>
        enter
          .append("circle")
          .attr("class", "bubble")
          .attr("cx", (d) => territoryOf.get(d.groupKey)?.x ?? d.x ?? cX)
          .attr("cy", (d) => territoryOf.get(d.groupKey)?.y ?? d.y ?? cY)
          .attr("r", 0)
          .attr("opacity", 0)
          .style("cursor", "pointer"),
      (update) => update,
      (exit) => exit.interrupt("move").transition().duration(ms(220)).attr("opacity", 0).attr("r", 0).remove()
    )
    .attr("fill", (d) => `url(#${rgId(d.id)})`)
    .attr("vector-effect", "non-scaling-stroke")
    .style("stroke", (d) => (d.source === "community" ? "rgb(var(--community-rgb) / 0.8)" : "var(--bubble-line)"))
    .attr("stroke-width", (d) => (d.source === "community" ? 1.5 : 0.8))
    .attr("stroke-dasharray", (d) => (d.source === "community" ? "4,2" : "none"));

  // Glide every bottle to its place. A fuller, staggered move when arriving.
  bubbles
    .transition("move")
    .delay((d) => (arriving ? stagger(d.groupKey) : 0))
    .duration(ms(arriving ? 780 : 520))
    .ease(d3.easeCubicInOut)
    .attr("cx", (d) => d.x ?? cX)
    .attr("cy", (d) => d.y ?? cY)
    .attr("r", (d) => d.r);

  bubbles
    .on("mouseover", (event: MouseEvent, d) => {
      ctx.onBubbleOver(event, d);
      setHover(d.groupKey);
    })
    .on("mousemove", (event: MouseEvent) => ctx.onPointerMove(event))
    .on("mouseout", () => {
      ctx.onPointerOut();
      clearHover();
    })
    .on("click", (event: MouseEvent, d) => {
      event.stopPropagation();
      ctx.onBubbleClick(d);
    });

  // ── Clay: one patch under each distillery's bottles ────────────────────────
  const patches = L.territories
    .selectAll<SVGGElement, Territory>("g.territory")
    .data(territories, (d) => d.key)
    .join(
      (enter) => {
        const g = enter.append("g").attr("class", "territory").attr("opacity", 0).style("cursor", "pointer");
        g.append("path")
          .attr("class", "clay")
          .attr("vector-effect", "non-scaling-stroke")
          .attr("stroke-linejoin", "round")
          .attr("stroke-width", 1.5)
          .attr("stroke-opacity", 0)
          .attr("fill-opacity", clayAlpha);
        return g;
      },
      (update) => update,
      (exit) => exit.interrupt("fade").transition().duration(ms(200)).attr("opacity", 0).remove()
    );

  const clay = patches
    .select<SVGPathElement>("path.clay")
    .attr("fill", (d) => ctx.groupColor(d.key) ?? FALLBACK_COLOR)
    .style("stroke", (d) => ringColor(d.key));

  clay.each(function (d) {
    const path = d3.select(this);
    const had = path.attr("d");
    if (!had || still) {
      // New (or no animation wanted): lay it down, letting the bottles land first.
      path.interrupt("shape").attr("d", d.outline).attr("transform", clayTransform).attr("opacity", !had && !still ? 0 : 1);
      if (!had && !still) {
        path
          .transition("shape")
          .delay(stagger(d.key) + (arriving ? 420 : 0))
          .duration(460)
          .attr("opacity", 1);
      }
    } else if (had === d.outline) {
      // Same shape, perhaps a new size: move in step with the bottles.
      path
        .interrupt("shape")
        .transition("shape")
        .duration(520)
        .ease(d3.easeCubicInOut)
        .attr("transform", clayTransform)
        .attr("opacity", 1);
    } else {
      // The bottles are regrouping: lift the clay, lay the new shape once they land.
      path
        .interrupt("shape")
        .transition("shape")
        .duration(120)
        .attr("opacity", 0)
        .on("end", function () {
          d3.select(this)
            .attr("d", d.outline)
            .attr("transform", clayTransform)
            .transition("shape")
            .delay(320)
            .duration(360)
            .attr("opacity", 1);
        });
    }
  });

  patches
    .on("mouseover", (event: MouseEvent, d) => {
      ctx.onTerritoryOver(event, { key: d.key, count: d.count, state: d.state });
      setHover(d.key);
    })
    .on("mousemove", (event: MouseEvent) => ctx.onPointerMove(event))
    .on("mouseout", () => {
      ctx.onPointerOut();
      clearHover();
    })
    .on("click", (event: MouseEvent, d) => {
      event.stopPropagation();
      ctx.onPointerOut();
      if (state.selected !== d.key) ctx.onSelect(d.key);
    });

  // ── Labels: a column down each side, each beside its own distillery ────────
  const labels = L.labels
    .selectAll<SVGTextElement, Territory>("text.group-label")
    .data(territories, (d) => d.key)
    .join(
      (enter) =>
        enter
          .append("text")
          .attr("class", "group-label")
          .attr("x", (d) => d.x)
          .attr("y", (d) => d.y)
          .attr("opacity", 0)
          .attr("font-size", "12px")
          .attr("font-weight", "700")
          .attr("letter-spacing", "0.08em")
          .attr("paint-order", "stroke")
          .attr("stroke-width", 3)
          .attr("stroke-linejoin", "round"),
      (update) => update,
      (exit) => exit.remove()
    )
    .text((d) => d.key.toUpperCase())
    .style("fill", (d) => ringColor(d.key))
    .style("stroke", "var(--bg)")
    .style("cursor", "pointer");

  const PAD = 26;
  const LINE = 15 + 3;
  const MARGIN = 4;
  const reach = cloudR + PAD;
  const widths = new Map<string, number>();
  labels.each(function (d) {
    widths.set(d.key, this.getComputedTextLength());
  });

  interface Spot {
    lx: number;
    ly: number;
    anchor: "start" | "end";
    angle: number;
  }
  const spots = new Map<string, Spot>();
  for (const side of ["left", "right"] as const) {
    const column = territories
      .map((t) => ({ key: t.key, angle: Math.atan2(t.y - cY, t.x - cX), far: Math.hypot(t.x - cX, t.y - cY) }))
      .filter((c) => (side === "right" ? Math.cos(c.angle) >= 0 : Math.cos(c.angle) < 0))
      .map((c) => ({ ...c, y: cY + reach * Math.sin(c.angle) }))
      .sort((a, b) => a.y - b.y);
    if (column.length === 0) continue;

    const top = TOP_CLEAR;
    const bottom = H - (side === "left" ? 56 : 14);
    const spacing = Math.min(LINE, (bottom - top) / Math.max(1, column.length - 1));
    for (let i = 0; i < column.length; i++) {
      column[i].y = Math.max(column[i].y, i === 0 ? top : column[i - 1].y + spacing);
    }
    for (let i = column.length - 1; i >= 0; i--) {
      column[i].y = Math.min(column[i].y, i === column.length - 1 ? bottom : column[i + 1].y - spacing);
    }
    for (const c of column) {
      const tw = widths.get(c.key) ?? c.key.length * 8;
      const dy = c.y - cY;
      const out = Math.max(10, Math.abs(dy) < reach ? Math.sqrt(reach * reach - dy * dy) : 0);
      const lx =
        side === "right"
          ? Math.max(MARGIN, Math.min(W - MARGIN - tw, cX + out))
          : Math.max(MARGIN + tw, Math.min(W - MARGIN, cX - out));
      spots.set(c.key, { lx, ly: c.y, anchor: side === "right" ? "start" : "end", angle: c.angle });
    }
  }

  labels
    .attr("text-anchor", (d) => spots.get(d.key)?.anchor ?? "start")
    .transition("move")
    .duration(ms(arriving ? 0 : 400))
    .attr("x", (d) => spots.get(d.key)?.lx ?? d.x)
    .attr("y", (d) => (spots.get(d.key)?.ly ?? d.y) + 4);

  labels
    .on("mouseover", (_event: MouseEvent, d) => setHover(d.key))
    .on("mouseout", () => clearHover())
    .on("click", (event: MouseEvent, d) => {
      event.stopPropagation();
      ctx.onPointerOut();
      ctx.onSelect(state.selected === d.key ? null : d.key);
    });

  // Short stubs from the edge of the cloud toward each label.
  const stubs = L.lines
    .selectAll<SVGLineElement, Territory>("line.leader")
    .data(territories, (d) => d.key)
    .join((enter) => enter.append("line").attr("class", "leader").attr("opacity", 0).style("pointer-events", "none"))
    .attr("stroke-width", 0.75)
    .attr("stroke-dasharray", "3,3")
    .style("stroke", (d) => ringColor(d.key))
    .attr("x1", (d) => cX + cloudR * Math.cos(spots.get(d.key)?.angle ?? 0))
    .attr("y1", (d) => cY + cloudR * Math.sin(spots.get(d.key)?.angle ?? 0))
    .attr("x2", (d) => spots.get(d.key)?.lx ?? d.x)
    .attr("y2", (d) => spots.get(d.key)?.ly ?? d.y);

  // The full connection, shown only for the distillery being pointed at.
  let link = L.lines.select<SVGLineElement>("line.hover-link");
  if (link.empty()) {
    link = L.lines.append("line").attr("class", "hover-link").attr("stroke-width", 1.5).attr("opacity", 0).style("pointer-events", "none");
  }

  // ── Camera ─────────────────────────────────────────────────────────────────
  const home: View = [W / 2, H / 2, W];
  const scaleFor = (t: Territory) => Math.max(1, Math.min(8, (0.76 * Math.min(W, H - 110)) / (t.r * 2)));
  const viewFor = (key: string | null): View => {
    const t = key ? territoryOf.get(key) : undefined;
    if (!t) return home;
    const s = scaleFor(t);
    // A little low, leaving room for the title above it.
    return [t.x, t.y - 26 / s, W / s];
  };
  const toTransform = (v: View) => `translate(${W / 2},${H / 2}) scale(${W / v[2]}) translate(${-v[0]},${-v[1]})`;
  const sameView = (a: View, b: View) => Math.abs(a[0] - b[0]) < 0.5 && Math.abs(a[1] - b[1]) < 0.5 && Math.abs(a[2] - b[2]) < 0.5;

  function drawNames(): void {
    L.names.selectAll("text.bottle-name").remove();
    const t = state.selected ? territoryOf.get(state.selected) : undefined;
    if (!t) return;
    const v = viewFor(t.key);
    const s = W / v[2];

    const members = nodes.filter((n) => n.groupKey === t.key);
    const skip = sharedLeadingWords(members.map((n) => n.name));
    const shortName = (n: N) => n.name.split(/\s+/).slice(skip).join(" ");
    const inside = members.filter((n) => n.r * s >= 15);
    const name = L.names
      .selectAll<SVGTextElement, N>("text.bottle-name")
      .data(inside, (d) => d.id)
      .join("text")
      .attr("class", "bottle-name")
      .attr("text-anchor", "middle")
      .attr("font-weight", "600")
      .attr("opacity", 0)
      .style("fill", (d) => (luminance(ctx.colorOf(d)) > 0.36 ? "#15110c" : "#f4eee0"))
      .each(function (d) {
        const radius = d.r * s;
        const size = Math.max(8, Math.min(13, radius / 3));
        const perLine = Math.max(4, Math.floor((radius * 2 * 0.84) / (size * 0.56)));
        const maxLines = Math.max(1, Math.min(4, Math.floor((radius * 2 * 0.72) / (size * 1.14))));
        const lines = wrapName(shortName(d), perLine, maxLines);
        const x = W / 2 + ((d.x ?? 0) - v[0]) * s;
        const y = H / 2 + ((d.y ?? 0) - v[1]) * s;
        const text = d3.select(this).attr("font-size", `${size}px`);
        text.selectAll("tspan").remove();
        lines.forEach((line, i) => {
          text
            .append("tspan")
            .attr("x", x)
            .attr("y", y + (i - (lines.length - 1) / 2) * size * 1.14 + size * 0.35)
            .text(line);
        });
      });
    // Names arrive from the middle of the territory outward.
    name
      .transition()
      .delay((d) => (still ? 0 : Math.hypot((d.x ?? 0) - t.x, (d.y ?? 0) - t.y) * s * 0.9))
      .duration(ms(260))
      .attr("opacity", (d) => (matches(d) ? 1 : 0.25));
  }

  function zoomTo(key: string | null, animated: boolean): void {
    const target = viewFor(key);
    const from = holder.__ccView ?? home;
    if (sameView(from, target)) {
      holder.__ccView = target;
      L.viewport.attr("transform", key ? toTransform(target) : null);
      if (key) drawNames();
      return;
    }
    L.names.selectAll("text.bottle-name").interrupt().remove();
    if (!animated || still) {
      holder.__ccView = target;
      L.viewport.interrupt("zoom").attr("transform", key ? toTransform(target) : null);
      drawNames();
      return;
    }
    // A smooth flight: pulls back, travels, then closes in on the target.
    const flight = d3.interpolateZoom(from, target);
    L.viewport
      .interrupt("zoom")
      .transition("zoom")
      .duration(Math.max(520, Math.min(1150, flight.duration * 0.95)))
      .attrTween("transform", () => (t) => {
        const v = flight(t) as View;
        holder.__ccView = v;
        return toTransform(v);
      })
      .on("end", () => {
        if (!live()) return;
        holder.__ccView = target;
        if (!key) L.viewport.attr("transform", null);
        drawNames();
      });
  }

  // ── Emphasis: one place decides how strongly everything is drawn ───────────
  function applyEmphasis(duration: number): void {
    if (!live()) return;
    const sel = state.selected;
    const hov = sel ? null : state.hover;
    const q = state.query.trim();
    const hasMatch = new Set<string>();
    if (q) for (const n of nodes) if (matches(n)) hasMatch.add(n.groupKey);

    bubbles
      .interrupt("fade")
      .transition("fade")
      .duration(duration)
      .attr("opacity", (d) => {
        const hit = matches(d);
        if (sel) return d.groupKey === sel ? (hit ? 1 : 0.14) : 0.06;
        if (hov) return d.groupKey === hov ? (hit ? 1 : 0.3) : 0.28;
        return hit ? 1 : 0.07;
      });

    patches
      .interrupt("fade")
      .transition("fade")
      .duration(duration)
      .attr("opacity", (d) => {
        if (sel) return d.key === sel ? 1 : 0.16;
        if (hov) return d.key === hov ? 1 : 0.4;
        return q && !hasMatch.has(d.key) ? 0.25 : 1;
      });
    clay
      .interrupt("fade")
      .transition("fade")
      .duration(duration)
      .attr("fill-opacity", (d) => (d.key === hov ? Math.min(0.8, clayAlpha * 1.4) : clayAlpha))
      .attr("stroke-opacity", (d) => (d.key === hov ? 0.9 : 0));

    labels
      .style("pointer-events", sel ? "none" : "auto")
      .interrupt("fade")
      .transition("fade")
      .duration(duration)
      .attr("opacity", (d) => {
        if (sel) return 0;
        if (hov) return d.key === hov ? 1 : 0.28;
        return q && !hasMatch.has(d.key) ? 0.3 : 0.92;
      });

    stubs
      .interrupt("fade")
      .transition("fade")
      .duration(duration)
      .attr("opacity", sel ? 0 : hov ? 0.12 : 0.45);

    const hovered = hov ? territoryOf.get(hov) : undefined;
    const spot = hov ? spots.get(hov) : undefined;
    if (hovered && spot) {
      // From the label to the edge of the clay around the nearest of its bottles.
      let near: N | undefined;
      let nearest = Infinity;
      for (const n of membersOf.get(hovered.key) ?? []) {
        const gap = Math.hypot(spot.lx - (n.x ?? 0), spot.ly - (n.y ?? 0)) - n.r;
        if (gap < nearest) {
          nearest = gap;
          near = n;
        }
      }
      const fromX = near?.x ?? hovered.x;
      const fromY = near?.y ?? hovered.y;
      const fromR = (near?.r ?? hovered.r) + CLAY_PAD * k;
      const a = Math.atan2(spot.ly - fromY, spot.lx - fromX);
      link
        .style("stroke", ringColor(hovered.key))
        .attr("x1", fromX + fromR * Math.cos(a))
        .attr("y1", fromY + fromR * Math.sin(a))
        .attr("x2", spot.lx)
        .attr("y2", spot.ly)
        .interrupt()
        .transition()
        .duration(duration)
        .attr("opacity", 0.85);
    } else {
      link.interrupt().transition().duration(duration).attr("opacity", 0);
    }

    L.names.selectAll<SVGTextElement, N>("text.bottle-name").attr("opacity", (d) => (matches(d) ? 1 : 0.25));
  }

  function setHover(key: string): void {
    if (hoverTimer) clearTimeout(hoverTimer);
    hoverTimer = null;
    if (state.hover === key) return;
    state.hover = key;
    applyEmphasis(ms(130));
  }
  function clearHover(): void {
    if (hoverTimer) clearTimeout(hoverTimer);
    // Brief grace period, so crossing from one bottle to the next doesn't flash.
    hoverTimer = setTimeout(() => {
      hoverTimer = null;
      if (state.hover === null) return;
      state.hover = null;
      applyEmphasis(ms(180));
    }, 70);
  }

  // ── First paint for this render ────────────────────────────────────────────
  zoomTo(state.selected, false);
  applyEmphasis(ms(arriving ? 520 : 260));

  return {
    setFocus(selected, query) {
      if (!live()) return;
      const next = selected && territoryOf.has(selected) ? selected : null;
      const moved = next !== state.selected;
      state.selected = next;
      state.query = query;
      if (next) state.hover = null;
      if (moved) zoomTo(next, true);
      applyEmphasis(ms(moved ? 420 : 220));
    },
  };
}
