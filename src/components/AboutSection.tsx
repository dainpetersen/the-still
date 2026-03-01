"use client";

interface StatProps {
  value: string | number;
  label: string;
}

function Stat({ value, label }: StatProps) {
  return (
    <div className="text-center px-6">
      <p className="text-4xl font-bold" style={{ color: "#f59e0b" }}>
        {value}
      </p>
      <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
        {label}
      </p>
    </div>
  );
}

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
    <section
      className="px-6 py-14 md:px-12 lg:px-20"
      style={{
        background: "linear-gradient(180deg, #0a0610 0%, #0f0a18 100%)",
        borderBottom: "1px solid rgba(245,158,11,0.1)",
      }}
    >
      <div className="max-w-4xl">
        {/* Heading */}
        <p
          className="text-xs uppercase tracking-[0.25em] mb-1"
          style={{ color: "rgba(245,158,11,0.6)" }}
        >
          About
        </p>
        <h2 className="text-3xl font-bold text-white mb-6">What is Common Cask?</h2>

        {/* Body */}
        <div className="space-y-4 text-base leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
          <p>
            Common Cask is a community-driven catalog of American whiskey — built to map the landscape
            of domestic distilleries, sub-brands, and bottles in one interactive view. The treemap
            below lets you navigate from distillery down to individual bottles, color-coded by price,
            rarity, or community rating.
          </p>
          <p>
            Every rating on this site comes from real people who have tried the bottle. There are no
            sponsored placements and no paid rankings — just honest community scores. Our goal is to
            build the most reliable, editable reference for American whiskey that anyone can contribute to.
          </p>
          <p>
            Think something is missing, mispriced, or mislabeled? Use the{" "}
            <span style={{ color: "rgba(245,158,11,0.9)" }}>Submit a Bottle</span> button to suggest
            an addition. Every submission is reviewed before it appears on the site. We&apos;re building
            this together.
          </p>
        </div>

        {/* Stats */}
        <div
          className="mt-10 py-7 rounded-2xl flex flex-wrap justify-around gap-8"
          style={{
            background: "rgba(10,10,20,0.7)",
            border: "1px solid rgba(245,158,11,0.12)",
          }}
        >
          <Stat value={distilleryCount} label="Distilleries" />
          <Stat value={bottleCount} label="Bottles" />
          <Stat value={ratingCount} label="Community Ratings" />
          {communityCount > 0 && <Stat value={communityCount} label="Community Additions" />}
        </div>

        {/* Scroll nudge */}
        <div className="mt-8 flex flex-col items-center gap-1">
          <span className="text-xs uppercase tracking-widest" style={{ color: "rgba(245,158,11,0.35)" }}>
            Explore the catalog below
          </span>
          <svg width="16" height="10" viewBox="0 0 16 10" fill="none">
            <path d="M2 2L8 8L14 2" stroke="rgba(245,158,11,0.35)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    </section>
  );
}
