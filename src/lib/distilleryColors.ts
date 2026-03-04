import { Brand } from "@/types/whiskey";

export const DISTILLERY_PALETTE = [
  "#e07b39", // warm amber
  "#4e9ee8", // sky blue
  "#8abe5c", // lime green
  "#c96dd8", // purple
  "#e8c44b", // golden
  "#5dc4b8", // teal
  "#e85c7a", // rose
  "#7485e8", // periwinkle
  "#d4665a", // coral
  "#52c27a", // mint
  "#c4a44b", // ochre
  "#e87e5c", // salmon
  "#5cb0e8", // powder blue
  "#c2e85c", // yellow-green
];

/**
 * Assigns a stable color from DISTILLERY_PALETTE to each unique brand name.
 * Brands are sorted alphabetically so the mapping is deterministic across renders.
 */
export function buildDistilleryColors(brands: Brand[]): Map<string, string> {
  const names = [...new Set(brands.map((b) => b.name))].sort();
  return new Map(
    names.map((name, i) => [name, DISTILLERY_PALETTE[i % DISTILLERY_PALETTE.length]])
  );
}
