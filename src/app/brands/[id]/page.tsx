import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { WHISKEY_DATA } from "@/data/whiskeys";
import type { Bottle, WhiskeyStyle } from "@/types/whiskey";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://commoncask.com").trim();

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
    badge: "bg-amber-800/10 text-amber-900 border-amber-600/30",
    dot: "bg-amber-700",
    line: "bg-amber-700/20",
  },
  "Wheated Bourbon": {
    badge: "bg-yellow-800/10 text-yellow-900 border-yellow-600/30",
    dot: "bg-yellow-700",
    line: "bg-yellow-700/20",
  },
  "High Rye Bourbon": {
    badge: "bg-orange-800/10 text-orange-900 border-orange-600/30",
    dot: "bg-orange-700",
    line: "bg-orange-700/20",
  },
  "Rye Whiskey": {
    badge: "bg-emerald-800/10 text-emerald-900 border-emerald-600/30",
    dot: "bg-emerald-700",
    line: "bg-emerald-700/20",
  },
  "Wheat Whiskey": {
    badge: "bg-lime-800/10 text-lime-900 border-lime-600/30",
    dot: "bg-lime-700",
    line: "bg-lime-700/20",
  },
  "Tennessee Whiskey": {
    badge: "bg-sky-800/10 text-sky-900 border-sky-600/30",
    dot: "bg-sky-700",
    line: "bg-sky-700/20",
  },
  "Blended American": {
    badge: "bg-violet-800/10 text-violet-900 border-violet-600/30",
    dot: "bg-violet-700",
    line: "bg-violet-700/20",
  },
  "American Single Malt": {
    badge: "bg-teal-800/10 text-teal-900 border-teal-600/30",
    dot: "bg-teal-700",
    line: "bg-teal-700/20",
  },
};

const FALLBACK_STYLE = {
  badge: "bg-stone-400/10 text-stone-700 border-stone-400/30",
  dot: "bg-stone-500",
  line: "bg-stone-400/20",
};

const RARITY_DOTS: Record<string, number> = {
  common: 1,
  limited: 2,
  rare: 3,
  allocated: 4,
  unicorn: 5,
};

const AVAILABILITY: Record<string, { label: string; cls: string }> = {
  current: { label: "In Production", cls: "text-emerald-700" },
  limited_release: { label: "Limited", cls: "text-amber-700" },
  discontinued: { label: "Discontinued", cls: "text-stone-500" },
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
    <article
      className="group flex items-center gap-4 py-4 -mx-2 px-2 transition-colors hover:bg-black/[0.025]"
      style={{
        borderBottom: "1px solid rgba(13,11,8,0.1)",
      }}
    >
      {/* Left accent bar */}
      <div className={`w-[2px] h-6 flex-shrink-0 rounded-full opacity-50 ${colors.dot}`} />

      {/* Name + description */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3
            className="font-medium text-[13.5px] leading-snug"
            style={{ color: "#0d0b08" }}
          >
            {bottle.name}
          </h3>
          {bottle.style && (
            <span className={`text-[8.5px] uppercase tracking-[0.11em] font-mono px-1.5 py-[3px] rounded-sm border ${colors.badge}`}>
              {bottle.style}
            </span>
          )}
          {bottle.sourceDistillery && (
            <span
              className="text-[9px] font-mono hidden sm:inline"
              style={{ color: "rgba(13,11,8,0.35)" }}
            >
              via {bottle.sourceDistillery}
            </span>
          )}
        </div>
        {bottle.description && (
          <p
            className="text-[11px] mt-0.5 line-clamp-1 leading-relaxed pr-4"
            style={{ color: "rgba(13,11,8,0.45)", fontFamily: "Georgia,serif", fontStyle: "italic" }}
          >
            {bottle.description}
          </p>
        )}
      </div>

      {/* Stats — right-aligned */}
      <div className="flex items-center gap-5 flex-shrink-0">
        {/* ABV / Proof */}
        <div className="text-[11px] font-mono tabular-nums hidden sm:block">
          <span style={{ color: "rgba(13,11,8,0.75)" }}>{bottle.abv}%</span>
          <span style={{ color: "rgba(13,11,8,0.35)" }}> · {proof}pf</span>
        </div>

        {/* Price */}
        <span
          className="text-[12px] font-mono tabular-nums font-semibold w-14 text-right"
          style={{ color: "#0d0b08" }}
        >
          ${bottle.price}
        </span>

        {/* Age */}
        <span
          className="text-[11px] font-mono tabular-nums w-9 text-right"
          style={{ color: "rgba(13,11,8,0.4)" }}
        >
          {bottle.age ? `${bottle.age}yr` : "—"}
        </span>

        {/* Rarity dots */}
        <div className="flex gap-[3px] items-center">
          {Array.from({ length: 5 }).map((_, i) => (
            <span
              key={i}
              className={`w-[4px] h-[4px] rounded-full ${i < dots ? colors.dot : ""}`}
              style={i >= dots ? { background: "rgba(13,11,8,0.12)" } : undefined}
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
    description: brand.description ?? `American whiskey producer based in ${brand.region}.`,
    address: {
      "@type": "PostalAddress",
      addressLocality: brand.region,
      addressCountry: brand.country,
      ...(brand.state ? { addressRegion: brand.state } : {}),
    },
    url: `${SITE_URL}/brands/${id}`,
  };

  return (
    <div className="min-h-screen" style={{ background: "#f0e8d8", color: "#0d0b08" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="max-w-4xl mx-auto px-6 sm:px-10 py-10">
        {/* Back */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest transition-colors mb-12"
          style={{ color: "rgba(13,11,8,0.4)" }}
        >
          ← Explorer
        </Link>

        {/* Brand header */}
        <header
          className="mb-12 pb-8"
          style={{ borderBottom: "1px solid rgba(13,11,8,0.15)" }}
        >
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1">
              <h1
                className="leading-[1.05] tracking-tight"
                style={{
                  fontFamily: "'Georgia', 'Times New Roman', serif",
                  fontSize: "clamp(2.2rem, 5vw, 3.6rem)",
                  fontWeight: 400,
                  color: "#0d0b08",
                }}
              >
                {brand.name}
              </h1>
              <div className="flex items-center gap-3 mt-3">
                <p
                  className="text-sm"
                  style={{ color: "rgba(13,11,8,0.5)", fontFamily: "Georgia,serif", fontStyle: "italic" }}
                >
                  {brand.region}
                </p>
                {brand.isNDP && (
                  <span
                    className="text-[9px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded-sm"
                    style={{ border: "1px solid rgba(13,11,8,0.2)", color: "rgba(13,11,8,0.4)" }}
                  >
                    NDP
                  </span>
                )}
                {brand.state && (
                  <span
                    className="text-[9px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded-sm"
                    style={{ border: "1px solid rgba(90,60,20,0.3)", color: "rgba(90,60,20,0.7)" }}
                  >
                    {brand.state}
                  </span>
                )}
              </div>
              {brand.description && (
                <p
                  className="mt-6 max-w-2xl leading-relaxed"
                  style={{
                    fontFamily: "'Georgia', 'Times New Roman', serif",
                    fontSize: "15px",
                    color: "rgba(13,11,8,0.72)",
                  }}
                >
                  {brand.description}
                </p>
              )}
            </div>
          </div>
          {/* Column headers */}
          <div className="flex items-center gap-4 mt-8 -mx-2 px-2">
            <div className="w-[2px] flex-shrink-0" />
            <div className="flex-1" />
            <div
              className="flex items-center gap-5 flex-shrink-0 text-[9px] font-mono uppercase tracking-widest"
              style={{ color: "rgba(13,11,8,0.3)" }}
            >
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
                <div className="flex items-center gap-3 mb-1">
                  <h2
                    className="text-[11px] font-mono uppercase tracking-[0.15em]"
                    style={{ color: "rgba(13,11,8,0.4)" }}
                  >
                    {subBrand.name}
                  </h2>
                  <span
                    aria-hidden="true"
                    className="flex-1 h-px"
                    style={{ background: "rgba(13,11,8,0.12)" }}
                  />
                  <span
                    aria-label={`${subBrand.bottles.length} bottles`}
                    className="text-[11px] font-mono"
                    style={{ color: "rgba(13,11,8,0.25)" }}
                  >
                    {subBrand.bottles.length}
                  </span>
                </div>
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
        <footer
          className="mt-16 pt-6 flex items-center justify-between"
          style={{ borderTop: "1px solid rgba(13,11,8,0.1)" }}
        >
          <Link
            href="/"
            className="text-[10px] font-mono uppercase tracking-widest transition-colors"
            style={{ color: "rgba(13,11,8,0.35)" }}
          >
            ← All Distilleries
          </Link>
          <span
            className="text-[10px] font-mono"
            style={{ color: "rgba(13,11,8,0.2)", fontFamily: "Georgia,serif" }}
          >
            Common Cask
          </span>
        </footer>
      </div>
    </div>
  );
}
