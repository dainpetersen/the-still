import * as d3 from "d3";

/**
 * The layout behind the "Group By: Distillery" view.
 *
 * Every distillery's bottles form one tight cluster, and the clusters sit
 * close together with a narrow channel between them. Under each cluster is a
 * patch of "clay" in the distillery's colour, shaped to the bottles on top of
 * it. Kentucky's distilleries are neighbours in the middle; the other states
 * sit around them.
 *
 * How it is made:
 *   1. Seed — pack each distillery's bottles into a disc and each state's
 *      discs together, then put the biggest state in the middle with the
 *      others spaced around it. Everything is in the right neighbourhood,
 *      but discs leave wasted corners between them.
 *   2. Settle — let the clusters press together so they give a little and
 *      fill those corners. Bottles keep a small gap from their own
 *      distillery's bottles and a wider one from everybody else's.
 *   3. Clay — trace a smooth outline around each cluster.
 *
 * Nothing here is random, so the same catalog always gives the same picture.
 * A bottle can't end up away from its distillery: settling starts with every
 * cluster whole, any cluster that lets a bottle drift is gathered back in,
 * and if that ever failed the seed arrangement (always whole) is used.
 */

export interface TerritoryItem {
  id: string;
  /** Bubble radius. */
  r: number;
  /** Distillery — the cluster this bottle belongs to. */
  group: string;
}

export interface GroupPlace {
  /** State the distillery is in ("Kentucky"); "Other" when unknown. */
  state: string;
  /** Town, used only to seat same-town distilleries together. */
  city: string;
}

export interface Territory {
  key: string;
  state: string;
  /** Number of bottles. */
  count: number;
  /** Smallest circle around its bottles — what the camera frames. */
  x: number;
  y: number;
  r: number;
  /** Closed SVG path of the clay beneath the bottles, in layout coordinates. */
  outline: string;
}

export interface TerritoryLayout {
  /** Bottle id → centre, relative to the middle of the whole picture. */
  bubbles: Map<string, { x: number; y: number }>;
  territories: Territory[];
  /** Radius of the circle that encloses everything, clay included. */
  radius: number;
}

/** Clear space between two bottles of the same distillery. */
const BUBBLE_GAP = 1.5;
/** Between bottles of different distilleries in the same state. */
const GROUP_GAP = 9;
/** Between bottles of different states. */
const STATE_GAP = 13;
/** How far the clay reaches past the bottles on top of it. */
export const CLAY_PAD = 3;
/** How generously the clay fills the notches between neighbouring bottles. */
const CLAY_SOFT = 2.5;
/** Resolution the clay outline is traced at. */
const CLAY_CELL = 1.5;

const PRESS_TICKS = 220;
const EASE_TICKS = 160;
/** How firmly a bottle is drawn to the middle of its own cluster (distance per tick). */
const COHESION = 1.0;
/** How firmly every bottle is drawn to the middle of the picture (distance per tick). */
const GRAVITY = 0.2;
/** How fast a whole cluster travels toward the middle (distance per tick). */
const TRAVEL = 0.8;
/** The list of neighbouring pairs is rebuilt this often, and looks this far past each gap. */
const PAIR_REFRESH = 6;
const PAIR_SLACK = 8;
/** Stand-in for a bottle's influence on a point deep inside it. */
const INSIDE = Math.exp(4);

interface Packed {
  r: number;
  x: number;
  y: number;
}

interface Dot {
  id: string;
  r: number;
  x: number;
  y: number;
  index: number;
  group: number;
  state: number;
}

/** Pack circles tightly around the origin; returns the radius that encloses them. */
function pack<T extends { r: number }>(circles: T[]): { placed: (T & Packed)[]; radius: number } {
  if (circles.length === 0) return { placed: [], radius: 0 };
  const placed = d3.packSiblings(circles.map((c) => ({ ...c, x: 0, y: 0 }))) as (T & Packed)[];
  const enclosing = d3.packEnclose(placed);
  for (const c of placed) {
    c.x -= enclosing.x;
    c.y -= enclosing.y;
  }
  return { placed, radius: enclosing.r };
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function gapBetween(a: Dot, b: Dot): number {
  return a.group === b.group ? BUBBLE_GAP : a.state === b.state ? GROUP_GAP : STATE_GAP;
}

/**
 * Every pair of bottles near enough to matter over the next few ticks, as a
 * flat list of index pairs. Rebuilt every few ticks, which is far cheaper
 * than searching for neighbours on every pass.
 */
function nearbyPairs(dots: Dot[], slack: number): Int32Array {
  const pairs: number[] = [];
  for (let i = 0; i < dots.length; i++) {
    const a = dots[i];
    for (let j = i + 1; j < dots.length; j++) {
      const b = dots[j];
      const reach = a.r + b.r + gapBetween(a, b) + slack;
      const dx = a.x - b.x;
      if (dx > reach || dx < -reach) continue;
      const dy = a.y - b.y;
      if (dy > reach || dy < -reach) continue;
      if (dx * dx + dy * dy < reach * reach) pairs.push(i, j);
    }
  }
  return Int32Array.from(pairs);
}

/** Push apart every listed pair that is closer than its gap allows. Bigger bottles give less. */
function separate(dots: Dot[], pairs: Int32Array, strength: number): void {
  for (let p = 0; p < pairs.length; p += 2) {
    const a = dots[pairs[p]];
    const b = dots[pairs[p + 1]];
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const want = a.r + b.r + gapBetween(a, b);
    const d2 = dx * dx + dy * dy;
    if (d2 >= want * want || d2 < 1e-9) continue;
    const dist = Math.sqrt(d2);
    const push = ((want - dist) / dist) * strength;
    const aShare = (b.r * b.r) / (a.r * a.r + b.r * b.r);
    a.x += dx * push * aShare;
    a.y += dy * push * aShare;
    b.x -= dx * push * (1 - aShare);
    b.y -= dy * push * (1 - aShare);
  }
}

/** Draw the bottles of the chosen clusters (all of them by default) toward the middle of their own cluster. */
function gather(dots: Dot[], groupCount: number, step: number, only?: Set<number>): Float64Array[] {
  const cx = new Float64Array(groupCount);
  const cy = new Float64Array(groupCount);
  const weight = new Float64Array(groupCount);
  for (const d of dots) {
    const w = d.r * d.r;
    cx[d.group] += d.x * w;
    cy[d.group] += d.y * w;
    weight[d.group] += w;
  }
  for (let g = 0; g < groupCount; g++) {
    cx[g] /= weight[g] || 1;
    cy[g] /= weight[g] || 1;
  }
  for (const d of dots) {
    if (only && !only.has(d.group)) continue;
    const ox = cx[d.group] - d.x;
    const oy = cy[d.group] - d.y;
    const off = Math.hypot(ox, oy);
    if (off > 1) {
      const pull = Math.min(off, step) / off;
      d.x += ox * pull;
      d.y += oy * pull;
    }
  }
  return [cx, cy];
}

/** Let the seeded clusters press together into the space between them. */
function settle(dots: Dot[], groupCount: number): void {
  let pairs = nearbyPairs(dots, PAIR_SLACK);

  // ── Press: clusters are drawn together and give at the edges ───────────────
  for (let tick = 0; tick < PRESS_TICKS; tick++) {
    if (tick % PAIR_REFRESH === 0 && tick > 0) pairs = nearbyPairs(dots, PAIR_SLACK);
    // Full strength at first, easing off to nothing.
    const heat = Math.min(1, (2 * (PRESS_TICKS - tick)) / PRESS_TICKS);

    // Toward the middle of its own cluster, which keeps the cluster compact…
    const [cx, cy] = gather(dots, groupCount, COHESION * Math.max(heat, 0.3));
    for (const d of dots) {
      // …and toward the middle of the picture, which presses the clusters
      // together and lets their edges give into the spaces between them.
      const far = Math.hypot(d.x, d.y);
      if (far > 1) {
        const pull = Math.min(far, GRAVITY * heat) / far;
        d.x -= d.x * pull;
        d.y -= d.y * pull;
      }
      // The cluster as a whole travels inward too, without being smeared on the way.
      const gx = cx[d.group];
      const gy = cy[d.group];
      const out = Math.hypot(gx, gy);
      if (out > 1) {
        const pull = Math.min(out, TRAVEL * heat) / out;
        d.x -= gx * pull;
        d.y -= gy * pull;
      }
    }
    separate(dots, pairs, 0.6);
    separate(dots, pairs, 0.6);
  }

  // ── Ease: nothing pressing any more; restore every gap, clusters still holding together ──
  ease(dots, groupCount, EASE_TICKS);
}

function ease(dots: Dot[], groupCount: number, ticks: number, only?: Set<number>): void {
  let pairs = nearbyPairs(dots, PAIR_SLACK);
  for (let tick = 0; tick < ticks; tick++) {
    if (tick % PAIR_REFRESH === 0 && tick > 0) pairs = nearbyPairs(dots, PAIR_SLACK);
    // Hold the clusters together for the first two thirds, then let the gaps come out exact.
    if (tick < (ticks * 2) / 3) gather(dots, groupCount, only ? COHESION : COHESION * 0.3, only);
    separate(dots, pairs, 0.8);
    separate(dots, pairs, 0.8);
  }
}

/** True when the bottles form a single connected cluster (near enough for their clay to join). */
function inOnePiece(members: Dot[]): boolean {
  if (members.length < 2) return true;
  const seen = new Set<Dot>([members[0]]);
  const queue = [members[0]];
  while (queue.length) {
    const a = queue.pop()!;
    for (const b of members) {
      if (seen.has(b)) continue;
      if (Math.hypot(a.x - b.x, a.y - b.y) <= a.r + b.r + CLAY_PAD * 2) {
        seen.add(b);
        queue.push(b);
      }
    }
  }
  return seen.size === members.length;
}

/**
 * The clay under a cluster: everything within CLAY_PAD of a bottle, with the
 * notches between neighbouring bottles smoothed over. Traced on a fine grid
 * from a blended distance-to-nearest-bottle field, so it always covers every
 * bottle with room to spare.
 */
function clayOutline(members: Dot[]): string {
  // Past this distance a bottle no longer affects the outline.
  const fade = CLAY_PAD + CLAY_SOFT * 4;
  const reach = fade + CLAY_CELL * 2;
  const x0 = (d3.min(members, (m) => m.x - m.r) ?? 0) - reach;
  const y0 = (d3.min(members, (m) => m.y - m.r) ?? 0) - reach;
  const x1 = (d3.max(members, (m) => m.x + m.r) ?? 0) + reach;
  const y1 = (d3.max(members, (m) => m.y + m.r) ?? 0) + reach;
  const cols = Math.ceil((x1 - x0) / CLAY_CELL) + 1;
  const rows = Math.ceil((y1 - y0) / CLAY_CELL) + 1;

  // Add each bottle's influence to the cells around it, then turn the totals
  // into a blended distance to the nearest bottle's edge.
  const sums = new Float64Array(cols * rows);
  for (const m of members) {
    const span = m.r + fade;
    const i0 = Math.max(0, Math.floor((m.x - span - x0) / CLAY_CELL));
    const i1 = Math.min(cols - 1, Math.ceil((m.x + span - x0) / CLAY_CELL));
    const j0 = Math.max(0, Math.floor((m.y - span - y0) / CLAY_CELL));
    const j1 = Math.min(rows - 1, Math.ceil((m.y + span - y0) / CLAY_CELL));
    for (let j = j0; j <= j1; j++) {
      const dy = y0 + j * CLAY_CELL - m.y;
      for (let i = i0; i <= i1; i++) {
        const dx = x0 + i * CLAY_CELL - m.x;
        const outside = Math.sqrt(dx * dx + dy * dy) - m.r;
        // Deep inside a bottle the exact figure doesn't matter; "well inside" will do.
        sums[j * cols + i] += outside < -CLAY_SOFT * 4 ? INSIDE : Math.exp(-outside / CLAY_SOFT);
      }
    }
  }
  const values = new Array<number>(cols * rows);
  for (let c = 0; c < values.length; c++) {
    // Never more than the true distance, so the clay always covers every bottle with room to spare.
    const distance = sums[c] > 0 ? -Math.log(sums[c]) * CLAY_SOFT : 99;
    values[c] = Math.max(-4, Math.min(4, CLAY_PAD - distance));
  }

  const shape = d3.contours().size([cols, rows]).contour(values, 0);
  const curve = d3.line().curve(d3.curveBasisClosed);
  let path = "";
  for (const polygon of shape.coordinates) {
    // Outer ring only: a hole in the middle of a cluster would just be a speck.
    const ring = polygon[0];
    if (!ring || ring.length < 4) continue;
    const points = ring.slice(0, -1).map(([gx, gy]): [number, number] => [x0 + (gx - 0.5) * CLAY_CELL, y0 + (gy - 0.5) * CLAY_CELL]);
    path += curve(points) ?? "";
  }
  return path;
}

function build(items: TerritoryItem[], places: Map<string, GroupPlace>): TerritoryLayout {
  if (items.length === 0) return { bubbles: new Map(), territories: [], radius: 0 };
  // ── 1. Seed: bottles into distilleries, distilleries into states, states into one picture ──
  const byGroup = d3.group(items, (d) => d.group);
  const groups = [...byGroup].map(([key, members]) => {
    const sorted = [...members].sort((a, b) => b.r - a.r || a.id.localeCompare(b.id));
    const { placed, radius } = pack(sorted.map((m) => ({ id: m.id, r: m.r + BUBBLE_GAP / 2 })));
    const place = places.get(key) ?? { state: "Other", city: "" };
    return { key, place, bubbles: placed, r: radius, count: members.length };
  });

  const byState = d3.group(groups, (g) => g.place.state);
  const states = [...byState].map(([key, members]) => {
    // Towns with the most whiskey first; within a town, the biggest distillery first.
    const townWeight = d3.rollup(members, (v) => d3.sum(v, (g) => g.r * g.r), (g) => g.place.city);
    const sorted = [...members].sort(
      (a, b) =>
        (townWeight.get(b.place.city) ?? 0) - (townWeight.get(a.place.city) ?? 0) ||
        a.place.city.localeCompare(b.place.city) ||
        b.r - a.r ||
        a.key.localeCompare(b.key)
    );
    const { placed, radius } = pack(sorted.map((g) => ({ group: g, r: g.r + GROUP_GAP / 2 })));
    return { key, members: placed, r: radius };
  });

  // The biggest state in the middle, the rest spaced evenly around it. Taking
  // every few seats in turn spreads the larger ones around the ring rather
  // than bunching them on one side.
  const sortedStates = [...states].sort((a, b) => b.r - a.r || a.key.localeCompare(b.key));
  const [home, ...others] = sortedStates;
  const seats = others.length;
  let stride = Math.max(1, Math.round(seats * 0.382));
  while (seats > 1 && gcd(stride, seats) !== 1) stride++;
  const roomNeeded = d3.sum(others, (s) => s.r * 2 + STATE_GAP) / (2 * Math.PI);
  const placedStates = [
    { state: home, x: 0, y: 0 },
    ...others.map((s, i) => {
      const angle = -Math.PI / 2 + (((i * stride) % seats) / seats) * 2 * Math.PI;
      const out = Math.max(home.r + STATE_GAP + s.r, roomNeeded);
      return { state: s, x: out * Math.cos(angle), y: out * Math.sin(angle) };
    }),
  ];

  const dots: Dot[] = [];
  const groupInfo: { key: string; state: string; count: number }[] = [];
  placedStates.forEach((ps, stateIndex) => {
    for (const pg of ps.state.members) {
      const groupIndex = groupInfo.length;
      groupInfo.push({ key: pg.group.key, state: ps.state.key, count: pg.group.count });
      for (const b of pg.group.bubbles) {
        dots.push({
          id: b.id,
          r: b.r - BUBBLE_GAP / 2,
          x: ps.x + pg.x + b.x,
          y: ps.y + pg.y + b.y,
          index: dots.length,
          group: groupIndex,
          state: stateIndex,
        });
      }
    }
  });
  const seed = dots.map((d) => ({ x: d.x, y: d.y }));

  // ── 2. Settle: press the clusters together ─────────────────────────────────
  settle(dots, groupInfo.length);
  // A cluster that has let a bottle drift loose is gathered back in.
  for (let attempt = 0; attempt < 4; attempt++) {
    const loose = new Set([...d3.group(dots, (d) => d.group)].filter(([, m]) => !inOnePiece(m)).map(([g]) => g));
    if (loose.size === 0) break;
    ease(dots, groupInfo.length, 90, loose);
  }
  let members = d3.group(dots, (d) => d.group);
  // Still loose after all that? Use the seed arrangement, where no cluster can be.
  if (![...members.values()].every(inOnePiece)) {
    dots.forEach((d, i) => {
      d.x = seed[i].x;
      d.y = seed[i].y;
    });
    members = d3.group(dots, (d) => d.group);
  }

  // Centre the picture on the origin.
  const whole = d3.packEnclose(dots);
  for (const d of dots) {
    d.x -= whole.x;
    d.y -= whole.y;
  }

  // ── 3. Clay, and the circle the camera frames, for each cluster ────────────
  const territories: Territory[] = groupInfo.map((info, g) => {
    const cluster = members.get(g) ?? [];
    const around = d3.packEnclose(cluster);
    return { ...info, x: around.x, y: around.y, r: around.r, outline: clayOutline(cluster) };
  });

  const bubbles = new Map(dots.map((d) => [d.id, { x: d.x, y: d.y }]));
  return { bubbles, territories, radius: whole.r + CLAY_PAD + CLAY_SOFT };
}

// The layout only depends on which bottles there are and how big they are, so
// a redraw for a new colour, theme or window size reuses the last one.
let last: { signature: string; layout: TerritoryLayout } | null = null;

export function layoutTerritories(items: TerritoryItem[], places: Map<string, GroupPlace>): TerritoryLayout {
  const signature =
    items.map((d) => `${d.id}:${d.r.toFixed(2)}:${d.group}`).join("|") +
    "#" +
    [...places].map(([key, p]) => `${key}:${p.state}:${p.city}`).join("|");
  if (last?.signature === signature) return last.layout;
  const layout = build(items, places);
  last = { signature, layout };
  return layout;
}
