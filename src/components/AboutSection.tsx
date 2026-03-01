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
    <div className="flex-1 min-w-0 px-6 py-10 md:px-10 lg:px-14">
      {/* Label */}
      <p
        className="text-xs uppercase tracking-[0.25em] mb-2"
        style={{ color: "rgba(245,158,11,0.6)" }}
      >
        About
      </p>

      {/* Heading + inline stats */}
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2 mb-6">
        <h2 className="text-2xl font-bold text-white">What is Common Cask?</h2>
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

      {/* Body */}
      <div className="space-y-3 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
        <p>
          Common Cask is a community-driven catalog of American whiskey — built to map the landscape
          of domestic distilleries, sub-brands, and bottles in one interactive view. The treemap
          below lets you navigate from distillery down to individual bottles, color-coded by price,
          rarity, or community rating.
        </p>
        <p>
          Every rating comes from real people who have tried the bottle. No sponsored placements,
          no paid rankings — just honest community scores. Think something is missing or mislabeled?
          Hit <span style={{ color: "rgba(245,158,11,0.85)" }}>Submit a Bottle</span> to suggest
          an addition. We&apos;re building this together.
        </p>
      </div>
    </div>
  );
}
