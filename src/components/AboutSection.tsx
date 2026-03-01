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
      className="px-6 py-20 md:px-12 lg:px-20"
      style={{
        background: "linear-gradient(180deg, #0a0610 0%, #0f0a18 100%)",
        borderTop: "1px solid rgba(245,158,11,0.1)",
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
        <h2 className="text-3xl font-bold text-white mb-8">What is Common Cask?</h2>

        {/* Body */}
        <div className="space-y-5 text-base leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
          <p>
            Common Cask is a community-driven catalog of American whiskey — built to map the landscape
            of domestic distilleries, sub-brands, and bottles in one interactive view. The treemap
            above lets you navigate from distillery down to individual bottles, color-coded by price,
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
          className="mt-12 py-8 rounded-2xl flex flex-wrap justify-around gap-8"
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

        {/* CTA */}
        <div
          className="mt-8 p-6 rounded-2xl"
          style={{ border: "1px dashed rgba(245,158,11,0.25)", background: "rgba(245,158,11,0.03)" }}
        >
          <p className="text-sm font-semibold text-white mb-1">Want to improve the catalog?</p>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
            Submit new brands, sub-brands, or bottles using the button in the sidebar. You can also
            rate any bottle you&apos;ve tried — scores update live across the site.
          </p>
        </div>
      </div>
    </section>
  );
}
