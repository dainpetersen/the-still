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

// ── Bottle card ────────────────────────────────────────────────────────────────
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
    <article className="flex flex-col bg-neutral-900 border border-neutral-800 rounded-sm overflow-hidden">
      {/* Color accent bar */}
      <div className={`h-px w-full ${colors.line}`} />

      {/* Bottle image */}
      {bottle.imageUrl && (
        <div className="relative h-48 bg-neutral-950 flex items-center justify-center px-8 pt-4">
          <Image
            src={bottle.imageUrl}
            alt={bottle.name}
            fill
            className="object-contain p-4"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        </div>
      )}

      <div className="flex flex-col gap-3 p-4">
        {/* Style badge + availability */}
        <div className="flex items-center justify-between gap-2 min-h-[20px]">
          {bottle.style ? (
            <span
              className={`text-[9px] uppercase tracking-[0.12em] font-mono px-1.5 py-0.5 rounded-sm border ${colors.badge}`}
            >
              {bottle.style}
            </span>
          ) : (
            <span />
          )}
          <span className={`text-[9px] font-mono ${avail.cls}`}>
            {avail.label}
          </span>
        </div>

        {/* Name */}
        <div>
          <h3 className="text-neutral-100 font-medium text-[13px] leading-snug">
            {bottle.name}
          </h3>
          <p className="text-neutral-600 text-[11px] mt-0.5">{subBrandName}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 divide-x divide-neutral-800 border border-neutral-800 rounded-sm bg-neutral-950/60">
          {[
            { label: "ABV", value: `${bottle.abv}%` },
            { label: "PROOF", value: String(proof) },
            { label: "PRICE", value: `$${bottle.price}` },
            { label: "AGE", value: bottle.age ? `${bottle.age}yr` : "NAS" },
          ].map(({ label, value }) => (
            <div key={label} className="flex flex-col items-center py-2">
              <span className="text-neutral-100 font-mono text-[11px] font-semibold tabular-nums">
                {value}
              </span>
              <span className="text-neutral-700 text-[8px] uppercase tracking-wider mt-0.5">
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* Rarity dots + label */}
        <div className="flex items-center gap-2">
          <div className="flex gap-[3px] items-center">
            {Array.from({ length: 5 }).map((_, i) => (
              <span
                key={i}
                className={`w-[5px] h-[5px] rounded-full ${i < dots ? colors.dot : "bg-neutral-800"}`}
              />
            ))}
          </div>
          <span className="text-neutral-600 text-[9px] capitalize font-mono">
            {bottle.rarity}
          </span>
          {bottle.sourceDistillery && (
            <span className="text-neutral-700 text-[9px] ml-auto font-mono">
              via {bottle.sourceDistillery}
            </span>
          )}
        </div>

        {/* Description */}
        <p className="text-neutral-500 text-[11px] leading-relaxed line-clamp-4">
          {bottle.description}
        </p>
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
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        {/* Back */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-neutral-600 hover:text-neutral-300 text-[10px] font-mono uppercase tracking-widest transition-colors mb-10"
        >
          ← Explorer
        </Link>

        {/* Brand header */}
        <header className="mb-10 pb-7 border-b border-neutral-800">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-neutral-100 tracking-tight leading-tight">
                {brand.name}
              </h1>
              <p className="text-neutral-500 text-sm mt-1">{brand.region}</p>
            </div>
            <div className="flex gap-1.5 mt-0.5 flex-shrink-0">
              {brand.isNDP && (
                <span className="text-[9px] font-mono uppercase tracking-widest px-1.5 py-0.5 border border-neutral-800 text-neutral-600 rounded-sm">
                  NDP
                </span>
              )}
              {brand.state && (
                <span className="text-[9px] font-mono uppercase tracking-widest px-1.5 py-0.5 border border-neutral-800 text-neutral-600 rounded-sm">
                  {brand.state}
                </span>
              )}
            </div>
          </div>
          <p className="text-neutral-700 text-[10px] font-mono mt-5 tracking-wide">
            {brand.subBrands.length}{" "}
            {brand.subBrands.length === 1 ? "line" : "lines"} ·{" "}
            {totalBottles}{" "}
            {totalBottles === 1 ? "expression" : "expressions"}
          </p>
        </header>

        {/* Sub-brands + bottles */}
        <div className="flex flex-col gap-12">
          {brand.subBrands.map((subBrand) => (
            <section key={subBrand.id}>
              {showSubBrandHeaders && (
                <h2 className="flex items-center gap-3 text-sm font-semibold text-neutral-200 mb-5">
                  {subBrand.name}
                  <span className="flex-1 h-px bg-neutral-800" />
                  <span className="text-neutral-600 text-xs font-normal font-mono">
                    {subBrand.bottles.length}
                  </span>
                </h2>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
