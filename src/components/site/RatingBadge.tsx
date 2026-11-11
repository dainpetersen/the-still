import type { Rating } from "@/lib/catalog";

/** Compact "8.4 · 143" community rating, or a dash when unrated. */
export default function RatingBadge({ rating }: { rating?: Rating }) {
  if (!rating || rating.count === 0) {
    return (
      <span className="font-mono text-[12px]" style={{ color: "rgb(var(--ink-rgb) / 0.3)" }} aria-label="Not yet rated">
        —
      </span>
    );
  }
  return (
    <span
      className="font-mono tabular-nums text-[12px] whitespace-nowrap"
      aria-label={`Rated ${rating.avg.toFixed(1)} out of 10 from ${rating.count} ${rating.count === 1 ? "rating" : "ratings"}`}
    >
      <span className="font-semibold" style={{ color: "var(--accent)" }}>{rating.avg.toFixed(1)}</span>
      <span style={{ color: "var(--ink-muted)" }}> · {rating.count}</span>
    </span>
  );
}
