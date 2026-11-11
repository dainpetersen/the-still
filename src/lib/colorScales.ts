import * as d3 from "d3";

/**
 * Colour encodings shared by the bubble chart and its legend.
 *
 * These are computed in JavaScript (a colour per bottle), so unlike the rest
 * of the UI they can't just read a CSS variable: each theme has its own
 * palette here, and the chart is told which theme is showing.
 */

export type ChartTheme = "light" | "dark";

interface ChartPalette {
  /** Cheapest → priciest. */
  price: string[];
  /** Lowest → highest rating. */
  rating: [string, string];
  /** Common → unicorn. */
  rarity: [string, string];
  /** Bubbles with no value in the current colour mode. */
  noData: string;
  /** The page colour behind the chart, for contrast checks. */
  ground: string;
}

/**
 * On paper "more" is darker: straw → amber → mahogany → near-black.
 * On the dark ground that would make the priciest bottles vanish, so the
 * ramps run the other way — dim bronze up to bright gold — and "more" is
 * brighter. Every stop keeps at least 3:1 against the dark ground.
 */
const PALETTES: Record<ChartTheme, ChartPalette> = {
  light: {
    price: ["#dcc27e", "#cf9440", "#8f3f14", "#2a0d02"],
    rating: ["#c8b880", "#6b1200"],
    rarity: ["#ddd0b0", "#5c0a0a"],
    noData: "#c8bca0",
    ground: "#f0e8d8",
  },
  dark: {
    price: ["#8a6238", "#b8752c", "#e6a53c", "#ffe2a0"],
    rating: ["#8a6238", "#ffc46b"],
    rarity: ["#8a7a62", "#ff8a66"],
    noData: "#4b4338",
    ground: "#15110c",
  },
};

export function chartPalette(theme: ChartTheme): ChartPalette {
  return PALETTES[theme];
}

export function priceRamp(theme: ChartTheme): (t: number) => string {
  return d3.interpolateRgbBasis(PALETTES[theme].price);
}

export function ratingScale(theme: ChartTheme): (rating: number) => string {
  const [low, high] = PALETTES[theme].rating;
  return d3.scaleSequential(d3.interpolate(low, high)).domain([1, 10]);
}

export function rarityScale(theme: ChartTheme): (score: number) => string {
  const [low, high] = PALETTES[theme].rarity;
  return d3.scaleSequential(d3.interpolate(low, high)).domain([0, 100]);
}

export interface PriceScale {
  color: (price: number) => string;
  /** Prices at the 0 / 25 / 50 / 75 / 100th percentiles, for the legend. */
  ticks: number[];
}

/**
 * Prices span $15 to $3,500 but most bottles sit between $30 and $100, so any
 * scale based on the dollar value — linear or log — paints nearly every bubble
 * the same shade. Colouring by rank instead (the cheapest fifth at one end of
 * the ramp, the priciest fifth at the other) spreads the catalog evenly.
 */
export function buildPriceScale(prices: number[], theme: ChartTheme): PriceScale {
  const noData = PALETTES[theme].noData;
  const sorted = prices.filter((p) => p > 0).sort((a, b) => a - b);
  if (sorted.length === 0) {
    return { color: () => noData, ticks: [] };
  }
  const scale = d3.scaleSequentialQuantile(priceRamp(theme)).domain(sorted);
  return {
    color: (price: number) => (price > 0 ? scale(price) : noData),
    ticks: [0, 0.25, 0.5, 0.75, 1].map((q) => Math.round(d3.quantileSorted(sorted, q) ?? 0)),
  };
}

// ── Readable label colours ───────────────────────────────────────────────────

function luminance(color: string): number {
  const { r, g, b } = d3.rgb(color);
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const labelCache = new Map<string, string>();

/**
 * A distillery's colour, adjusted until it is legible as text on the current
 * ground (4.5:1). The palette was picked for a dark background, where it
 * already passes; on paper every colour is too pale to read, so each is
 * deepened — same hue, less lightness — until it clears the bar.
 */
export function readableLabelColor(color: string, theme: ChartTheme): string {
  const key = theme + color;
  const cached = labelCache.get(key);
  if (cached) return cached;

  const ground = PALETTES[theme].ground;
  const hsl = d3.hsl(color);
  const step = theme === "light" ? -0.02 : 0.02;
  for (let i = 0; i < 40 && contrast(hsl.formatHex(), ground) < 4.5; i++) {
    hsl.l = Math.max(0, Math.min(1, hsl.l + step));
  }
  const result = hsl.formatHex();
  labelCache.set(key, result);
  return result;
}
