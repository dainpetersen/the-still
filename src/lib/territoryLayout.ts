import * as d3 from "d3";

/**
 * The layout behind the "Group By: Distillery" view.
 *
 * Every distillery gets a circular territory sized to hold its bottles, and
 * every bottle sits inside its own distillery's territory. Territories are
 * packed together by state — Kentucky's two dozen form one large cluster, the
 * other states sit around it — and, within a state, distilleries from the
 * same town are placed next to each other.
 *
 * It is plain geometry (circle packing, three levels deep), not a physics
 * simulation: the same catalog always produces the same picture, a bottle can
 * never end up outside its distillery, and there is nothing to wait for.
 */

export interface TerritoryItem {
  id: string;
  /** Bubble radius. */
  r: number;
  /** Distillery — the territory this bottle belongs to. */
  group: string;
}

export interface GroupPlace {
  /** State the distillery is in ("Kentucky"); "Other" when unknown. */
  state: string;
  /** Town, used only to seat same-town distilleries together. */
  city: string;
}

export interface Disc {
  key: string;
  x: number;
  y: number;
  r: number;
}

export interface TerritoryDisc extends Disc {
  state: string;
  /** Number of bottles inside. */
  count: number;
}

export interface StateDisc extends Disc {
  /** Number of distilleries inside. */
  count: number;
}

export interface TerritoryLayout {
  /** Bottle id → centre, relative to the middle of the whole picture. */
  bubbles: Map<string, { x: number; y: number }>;
  territories: TerritoryDisc[];
  states: StateDisc[];
  /** Radius of the circle that encloses everything. */
  radius: number;
}

/** Clear space between two bubbles. */
const BUBBLE_GAP = 1.5;
/** From the outermost bubble to its territory's edge. */
const TERRITORY_PAD = 5;
/** Between two territories of the same state. */
const TERRITORY_GAP = 5;
/** Between a state's territories and its outline, which also carries the state's name. */
const STATE_PAD = 16;
/** Between two states. */
const STATE_GAP = 12;

interface Packed {
  r: number;
  x: number;
  y: number;
}

/** Pack circles tightly around the origin; returns the radius that encloses them. */
function pack<T extends { r: number }>(circles: T[]): { placed: (T & Packed)[]; radius: number } {
  if (circles.length === 0) return { placed: [], radius: 0 };
  const placed = d3.packSiblings(circles.map((c) => ({ ...c, x: 0, y: 0 }))) as (T & Packed)[];
  const enclosing = d3.packEnclose(placed);
  // packSiblings centres its result on the origin, but be exact about it.
  for (const c of placed) {
    c.x -= enclosing.x;
    c.y -= enclosing.y;
  }
  return { placed, radius: enclosing.r };
}

export function layoutTerritories(items: TerritoryItem[], places: Map<string, GroupPlace>): TerritoryLayout {
  // ── 1. Each distillery: pack its bottles, largest in the middle ────────────
  const byGroup = d3.group(items, (d) => d.group);
  const territories = [...byGroup].map(([key, members]) => {
    const sorted = [...members].sort((a, b) => b.r - a.r || a.id.localeCompare(b.id));
    const { placed, radius } = pack(sorted.map((m) => ({ id: m.id, r: m.r + BUBBLE_GAP / 2 })));
    const place = places.get(key) ?? { state: "Other", city: "" };
    return { key, place, bubbles: placed, r: radius + TERRITORY_PAD, count: members.length };
  });

  // ── 2. Each state: pack its distilleries, same-town ones seated together ───
  const byState = d3.group(territories, (t) => t.place.state);
  const states = [...byState].map(([key, members]) => {
    // Towns with the most whiskey first; within a town, the biggest distillery first.
    const townWeight = d3.rollup(members, (v) => d3.sum(v, (t) => t.r * t.r), (t) => t.place.city);
    const sorted = [...members].sort(
      (a, b) =>
        (townWeight.get(b.place.city) ?? 0) - (townWeight.get(a.place.city) ?? 0) ||
        a.place.city.localeCompare(b.place.city) ||
        b.r - a.r ||
        a.key.localeCompare(b.key)
    );
    const { placed, radius } = pack(sorted.map((t) => ({ territory: t, r: t.r + TERRITORY_GAP / 2 })));
    const single = members.length === 1;
    return { key, members: placed, r: single ? radius : radius + STATE_PAD, count: members.length };
  });

  // ── 3. The whole picture: pack the states, the largest in the middle ───────
  const sortedStates = [...states].sort((a, b) => b.r - a.r || a.key.localeCompare(b.key));
  const { placed: placedStates, radius } = pack(sortedStates.map((s) => ({ state: s, r: s.r + STATE_GAP / 2 })));

  // ── Flatten to positions relative to the centre of the picture ─────────────
  const bubbles = new Map<string, { x: number; y: number }>();
  const territoryDiscs: TerritoryDisc[] = [];
  const stateDiscs: StateDisc[] = [];

  for (const ps of placedStates) {
    stateDiscs.push({ key: ps.state.key, x: ps.x, y: ps.y, r: ps.state.r, count: ps.state.count });
    for (const pt of ps.state.members) {
      const tx = ps.x + pt.x;
      const ty = ps.y + pt.y;
      const t = pt.territory;
      territoryDiscs.push({ key: t.key, x: tx, y: ty, r: t.r, state: ps.state.key, count: t.count });
      for (const b of t.bubbles) bubbles.set(b.id, { x: tx + b.x, y: ty + b.y });
    }
  }

  return { bubbles, territories: territoryDiscs, states: stateDiscs, radius };
}
