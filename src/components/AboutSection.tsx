"use client";

interface Props {
  distilleryCount: number;
  bottleCount: number;
  ratingCount: number;
  communityCount: number;
}

export default function AboutSection({
  distilleryCount,
  bottleCount,
  ratingCount,
  communityCount,
}: Props) {
  return (
    <div
      className="px-8 py-8 md:px-14"
      style={{ borderBottom: "1px solid rgba(245,158,11,0.08)" }}
    >
      {/* Heading + inline stats */}
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 mb-3">
        <h2 className="text-lg font-bold text-white">What is Common Cask?</h2>
        <div className="flex items-center gap-3 flex-wrap">
          {[
            [distilleryCount, "distilleries"],
            [bottleCount, "bottles"],
            [ratingCount, "ratings"],
            ...(communityCount > 0 ? [[communityCount, "community"]] : []),
          ].map(([val, label]) => (
            <span key={String(label)} className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
              <span className="font-semibold" style={{ color: "rgba(245,158,11,0.75)" }}>{val}</span>
              {" "}{label}
            </span>
          ))}
        </div>
      </div>

      {/* Body — single compact paragraph */}
      <p className="text-sm leading-relaxed max-w-2xl" style={{ color: "rgba(255,255,255,0.45)" }}>
        A community-driven catalog of American whiskey — {distilleryCount} distilleries, {bottleCount} bottles,
        color-coded by price, rarity, or community rating. No sponsored placements, no paid rankings.
        Think something&apos;s missing?{" "}
        <span style={{ color: "rgba(245,158,11,0.75)" }}>Submit a Bottle</span> and we&apos;ll review it.
      </p>
    </div>
  );
}
