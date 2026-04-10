import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { WHISKEY_DATA } from "@/data/whiskeys";
import type { Bottle, WhiskeyStyle } from "@/types/whiskey";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://commoncask.com";

export async function generateStaticParams() {
  return WHISKEY_DATA.map((brand) => ({ id: brand.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const brand = WHISKEY_DATA.find((b) => b.id === id);
  if (!brand) return {};

  const bottleCount = brand.subBrands.reduce(
    (sum, sb) => sum + sb.bottles.length,
    0
  );
  const styles = [
    ...new Set(
      brand.subBrands.flatMap((sb) =>
        sb.bottles.map((b) => b.style).filter(Boolean)
      )
    ),
  ].join(", ");

  const description = `Explore ${bottleCount} expressions from ${brand.name} in ${brand.region}. ${styles ? `Includes ${styles}. ` : ""}Browse ABV, proof, pricing, tasting notes, and more.`;

  return {
    title: brand.name,
    description,
    openGraph: {
      title: `${brand.name} | Common Cask`,
      description,
      url: `${SITE_URL}/brands/${id}`,
      type: "website",
    },
    alternates: { canonical: `${SITE_URL}/brands/${id}` },
  };
}

// ── Style color map ────────────────────────────────────────────────────────────
const STYLE_COLORS: Record<
  WhiskeyStyle,
  { badge: string; dot: string; line: string }
> = {
  Bourbon: {
    badge: "bg-amber-900/30 text-amber-400 border-amber-700/40",
    dot: "bg-amber-500",
    line: "bg-amber-700/30",
  },
  "Wheated Bourbon": {
    badge: "bg-yellow-900/30 text-yellow-400 border-yellow-700/40",
    dot: "bg-yellow-500",
    line: "bg-yellow-700/30",
  },
  "High Rye Bourbon": {
    badge: "bg-orange-900/30 text-orange-400 border-orange-700/40",
    dot: "bg-orange-500",
    line: "bg-orange-700/30",
  },
  "Rye Whiskey": {
    badge: "bg-emerald-900/30 text-emerald-400 border-emerald-700/40",
    dot: "bg-emerald-500",
    line: "bg-emerald-700/30",
  },
  "Wheat Whiskey": {
    badge: "bg-lime-900/30 text-lime-400 border-lime-700/40",
    dot: "bg-lime-500",
    line: "bg-lime-700/30",
  },
  "Tennessee Whiskey": {
    badge: "bg-sky-900/30 text-sky-400 border-sky-700/40",
    dot: "bg-sky-500",
    line: "bg-sky-700/30",
  },
  "Blended American": {
    badge: "bg-violet-900/30 text-violet-400 border-violet-700/40",
    dot: "bg-violet-500",
    line: "bg-violet-700/30",
  },
  "American Single Malt": {
    badge: "bg-teal-900/30 text-teal-400 border-teal-700/40",
    dot: "bg-teal-500",
    line: "bg-teal-700/30",
  },
};

const FALLBACK_STYLE = {
  badge: "bg-neutral-800 text-neutral-400 border-neutral-700",
  dot: "bg-neutral-500",
  line: "bg-neutral-700/30",
};

const RARITY_DOTS: Record<string, number> = {
  common: 1,
  limited: 2,
  rare: 3,
  allocated: 4,
  unicorn: 5,
};

const AVAILABILITY: Record<string, { label: string; cls: string }> = {
  current: { label: "In Production", cls: "text-emerald-500" },
  limited_release: { label: "Limited", cls: "text-amber-400" },
  discontinued: { label: "Discontinued", cls: "text-neutral-600" },
};

// ── Bottle row (editorial list layout) ────────────────────────────────────────
function BottleCard({
  bottle,
  subBrandName,
}: {
  bottle: Bottle;
  subBrandName: string;
}) {
  const colors = bottle.style
    ? (STYLE_COLORS[bottle.style] ?? FALLBACK_STYLE)
    : FALLBACK_STYLE;
  const dots = RARITY_DOTS[bottle.rarity] ?? 1;
  const proof = Math.round(bottle.abv * 2);
  const avail = bottle.availability
    ? (AVAILABILITY[bottle.availability] ?? AVAILABILITY.current)
    : AVAILABILITY.current;

  return (
    <article className="group flex items-center gap-4 py-4 border-b border-neutral-800/50 hover:bg-white/[0.018] transition-colors -mx-2 px-2">
      {/* Left accent bar */}
      <div className={`w-[2px] h-6 flex-shrink-0 rounded-full opacity-60 ${colors.dot}`} />

      {/* Name + description */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-neutral-100 font-medium text-[13.5px] leading-snug">
            {bottle.name}
          </h3>
          {bottle.style && (
            <span className={`text-[8.5px] uppercase tracking-[0.11em] font-mono px-1.5 py-[3px] rounded-sm border ${colors.badge}`}>
              {bottle.style}
            </span>
          )}
          {bottle.sourceDistillery && (
            <span className="text-neutral-700 text-[9px] font-mono hidden sm:inline">
              via {bottle.sourceDistillery}
            </span>
          )}
        </div>
        {bottle.description && (
          <p className="text-neutral-600 text-[11px] mt-0.5 line-clamp-1 leading-relaxed pr-4">
            {bottle.description}
          </p>
        )}
      </div>

      {/* Stats — right-aligned */}
      <div className="flex items-center gap-5 flex-shrink-0">
        {/* ABV / Proof */}
        <div className="text-[11px] font-mono tabular-nums hidden sm:block">
          <span className="text-neutral-300">{bottle.abv}%</span>
          <span className="text-neutral-700"> · {proof}pf</span>
        </div>

        {/* Price */}
        <span className="text-[12px] font-mono tabular-nums font-semibold text-neutral-200 w-14 text-right">
          ${bottle.price}
        </span>

        {/* Age */}
        <span className="text-[11px] font-mono tabular-nums text-neutral-500 w-9 text-right">
          {bottle.age ? `${bottle.age}yr` : "—"}
        </span>

        {/* Rarity dots */}
        <div className="flex gap-[3px] items-center">
          {Array.from({ length: 5 }).map((_, i) => (
            <span
              key={i}
              className={`w-[4px] h-[4px] rounded-full ${i < dots ? colors.dot : "bg-neutral-800"}`}
            />
          ))}
        </div>

        {/* Availability — hidden on small screens */}
        <span className={`text-[9px] font-mono hidden lg:block w-20 text-right ${avail.cls}`}>
          {avail.label}
        </span>
      </div>
    </article>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default async function BrandPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const brand = WHISKEY_DATA.find((b) => b.id === id);
  if (!brand) notFound();

  const totalBottles = brand.subBrands.reduce(
    (sum, sb) => sum + sb.bottles.length,
    0
  );
  const showSubBrandHeaders = brand.subBrands.length > 1;

  // JSON-LD for this brand
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": brand.isNDP ? "Organization" : "LocalBusiness",
    name: brand.name,
    description: `American whiskey producer based in ${brand.region}.`,
    address: {
      "@type": "PostalAddress",
      addressLocality: brand.region,
      addressCountry: brand.country,
      ...(brand.state ? { addressRegion: brand.state } : {}),
    },
    url: `${SITE_URL}/brands/${id}`,
  };

  return (
    <div className="min-h-screen text-neutral-100" style={{ background: "#0d0a07" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="max-w-4xl mx-auto px-6 sm:px-10 py-10">
        {/* Back */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-neutral-600 hover:text-neutral-400 text-[10px] font-mono uppercase tracking-widest transition-colors mb-12"
        >
          ← Explorer
        </Link>

        {/* Brand header */}
        <header className="mb-12 pb-8 border-b border-neutral-800/60">
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1">
              <h1
                className="text-neutral-100 leading-[1.05] tracking-tight"
                style={{
                  fontFamily: "'Georgia', 'Times New Roman', serif",
                  fontSize: "clamp(2.2rem, 5vw, 3.6rem)",
                  fontWeight: 400,
                }}
              >
                {brand.name}
              </h1>
              <div className="flex items-center gap-3 mt-3">
                <p className="text-neutral-500 text-sm">{brand.region}</p>
                {brand.isNDP && (
                  <span className="text-[9px] font-mono uppercase tracking-widest px-1.5 py-0.5 border border-neutral-800 text-neutral-600 rounded-sm">
                    NDP
                  </span>
                )}
                {brand.state && (
                  <span className="text-[9px] font-mono uppercase tracking-widest px-1.5 py-0.5 border border-amber-900/40 text-amber-700/70 rounded-sm">
                    {brand.state}
                  </span>
                )}
              </div>
            </div>
          </div>
          {/* Column headers */}
          <div className="flex items-center gap-4 mt-8 -mx-2 px-2">
            <div className="w-[2px] flex-shrink-0" />
            <div className="flex-1" />
            <div className="flex items-center gap-5 flex-shrink-0 text-[9px] font-mono uppercase tracking-widest text-neutral-700">
              <span className="hidden sm:block w-20 text-right">ABV · Proof</span>
              <span className="w-14 text-right">Price</span>
              <span className="w-9 text-right">Age</span>
              <span className="w-[34px] text-right">Rarity</span>
              <span className="hidden lg:block w-20 text-right">Status</span>
            </div>
          </div>
        </header>

        {/* Sub-brands + bottles */}
        <div className="flex flex-col gap-10">
          {brand.subBrands.map((subBrand) => (
            <section key={subBrand.id}>
              {showSubBrandHeaders && (
                <h2 className="flex items-center gap-3 text-[11px] font-mono uppercase tracking-[0.15em] text-neutral-500 mb-1">
                  {subBrand.name}
                  <span className="flex-1 h-px bg-neutral-800/60" />
                  <span className="text-neutral-700">
                    {subBrand.bottles.length}
                  </span>
                </h2>
              )}
              <div className="flex flex-col">
                {subBrand.bottles.map((bottle) => (
                  <BottleCard
                    key={bottle.id}
                    bottle={bottle}
                    subBrandName={subBrand.name}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Footer */}
        <footer className="mt-16 pt-6 border-t border-neutral-900 flex items-center justify-between">
          <Link
            href="/"
            className="text-[10px] font-mono text-neutral-700 hover:text-neutral-500 transition-colors uppercase tracking-widest"
          >
            ← All Distilleries
          </Link>
          <span className="text-[10px] font-mono text-neutral-800">
            Common Cask
          </span>
        </footer>
      </div>
    </div>
  );
}
