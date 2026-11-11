import * as d3 from "d3";

/**
 * Colour encodings shared by the bubble chart and its legend.
 */

/** Straw → amber → mahogany → near-black: reads as "pricier = darker" on cream paper. */
export const PRICE_RAMP = d3.interpolateRgbBasis(["#e3cf98", "#cf9440", "#8f3f14", "#2a0d02"]);

/** Colour for bubbles with no value in the current colour mode. */
export const NO_DATA_COLOR = "#c8bca0";

export interface PriceScale {
  color: (price: number) => string;
  /** Prices at the 0 / 25 / 50 / 75 / 100th percentiles, for the legend. */
  ticks: number[];
}

/**
 * Prices span $15 to $3,500 but most bottles sit between $30 and $100, so any
 * scale based on the dollar value — linear or log — paints nearly every bubble
 * the same pale tan. Colouring by rank instead (the cheapest fifth palest, the
 * priciest fifth darkest) spreads the catalog evenly across the ramp.
 */
export function buildPriceScale(prices: number[]): PriceScale {
  const sorted = prices.filter((p) => p > 0).sort((a, b) => a - b);
  if (sorted.length === 0) {
    return { color: () => NO_DATA_COLOR, ticks: [] };
  }
  const scale = d3.scaleSequentialQuantile(PRICE_RAMP).domain(sorted);
  return {
    color: (price: number) => (price > 0 ? scale(price) : NO_DATA_COLOR),
    ticks: [0, 0.25, 0.5, 0.75, 1].map((q) => Math.round(d3.quantileSorted(sorted, q) ?? 0)),
  };
}
