/**
 * The Common Cask logo: two open rings, one inside the other. They read as
 * "CC" and as the hoops of a cask seen end-on.
 *
 * Colours come from the theme variables, so the same markup is right on the
 * paper and the dark ground: the outer ring is ink, the inner ring the accent.
 *
 * The same two arcs are used for the tab icon (app/icon.svg), the home-screen
 * icon and the share image — keep MARK_OUTER / MARK_INNER in step with those
 * files if the shape ever changes.
 */

export const MARK_OUTER = "M51.9 15.3A26 26 0 1 0 51.9 48.7";
export const MARK_INNER = "M42.7 23A14 14 0 1 0 42.7 41";

interface MarkProps {
  /** Rendered width and height in px. */
  size?: number;
  /** Ring thickness in the 64-unit drawing; use a heavier ring at small sizes. */
  weight?: number;
}

/** The symbol on its own. Decorative: pair it with the name, or label the link around it. */
export function LogoMark({ size = 28, weight = 8 }: MarkProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      fill="none"
      strokeLinecap="round"
      strokeWidth={weight}
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path d={MARK_OUTER} style={{ stroke: "var(--ink)" }} />
      <path d={MARK_INNER} style={{ stroke: "var(--accent)" }} />
    </svg>
  );
}

/** Symbol + name, sized for the site header. */
export default function Logo() {
  return (
    <span className="flex items-center gap-2 select-none">
      <LogoMark />
      <span
        style={{
          fontFamily: "var(--font-fraunces), Georgia, 'Times New Roman', serif",
          fontSize: "20px",
          fontWeight: 600,
          letterSpacing: "-0.01em",
          lineHeight: 1,
          whiteSpace: "nowrap",
          color: "var(--ink)",
        }}
      >
        Common Cask
      </span>
    </span>
  );
}
