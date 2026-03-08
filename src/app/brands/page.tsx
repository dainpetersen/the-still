import Link from "next/link";
import type { Metadata } from "next";
import { WHISKEY_DATA } from "@/data/whiskeys";
import type { WhiskeyStyle } from "@/types/whiskey";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://commoncask.com";

export const metadata: Metadata = {
  title: "All Distilleries",
  description: `Browse all ${WHISKEY_DATA.length} American whiskey distilleries and producers in the Common Cask catalog. Filter by state, style, and more.`,
  openGraph: {
    title: "All Distilleries | Common Cask",
    description: `Browse all ${WHISKEY_DATA.length} American whiskey distilleries and producers.`,
    url: `${SITE_URL}/brands`,
  },
  alternates: { canonical: `${SITE_URL}/brands` },
};

const STYLE_DOT: Record<WhiskeyStyle, string> = {
  Bourbon: "bg-amber-500",
  "Wheated Bourbon": "bg-yellow-500",
  "High Rye Bourbon": "bg-orange-500",
  "Rye Whiskey": "bg-emerald-500",
  "Wheat Whiskey": "bg-lime-500",
  "Tennessee Whiskey": "bg-sky-500",
  "Blended American": "bg-violet-500",
  "American Single Malt": "bg-teal-500",
};

export default function BrandsIndexPage() {
  // Group by state, sort states alphabetically; unknown last
  const byState = new Map<string, typeof WHISKEY_DATA>();
  for (const brand of WHISKEY_DATA) {
    const key = brand.state ?? brand.country ?? "Other";
    if (!byState.has(key)) byState.set(key, []);
    byState.get(key)!.push(brand);
  }
  const sortedStates = [...byState.keys()].sort((a, b) => {
    if (a === "Other") return 1;
    if (b === "Other") return -1;
    return a.localeCompare(b);
  });

  const totalBottles = WHISKEY_DATA.reduce(
    (sum, b) => sum + b.subBrands.reduce((s, sb) => s + sb.bottles.length, 0),
    0
  );

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        {/* Back */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-neutral-600 hover:text-neutral-300 text-[10px] font-mono uppercase tracking-widest transition-colors mb-10"
        >
          ← Explorer
        </Link>

        {/* Header */}
        <header className="mb-10 pb-7 border-b border-neutral-800">
          <h1 className="text-xl sm:text-2xl font-semibold text-neutral-100 tracking-tight">
            All Distilleries
          </h1>
          <p className="text-neutral-600 text-[10px] font-mono mt-3 tracking-wide">
            {WHISKEY_DATA.length} distilleries · {totalBottles} expressions
          </p>
        </header>

        {/* By state */}
        <div className="flex flex-col gap-10">
          {sortedStates.map((state) => {
            const brands = byState.get(state)!;
            return (
              <section key={state}>
                <h2 className="flex items-center gap-3 text-[10px] font-mono uppercase tracking-widest text-neutral-600 mb-4">
                  {state}
                  <span className="flex-1 h-px bg-neutral-800" />
                  <span className="text-neutral-800">{brands.length}</span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {brands.map((brand) => {
                    const bottleCount = brand.subBrands.reduce(
                      (s, sb) => s + sb.bottles.length,
                      0
                    );
                    // Collect unique styles
                    const styles = [
                      ...new Set(
                        brand.subBrands
                          .flatMap((sb) => sb.bottles.map((b) => b.style))
                          .filter((s): s is WhiskeyStyle => Boolean(s))
                      ),
                    ];

                    return (
                      <Link
                        key={brand.id}
                        href={`/brands/${brand.id}`}
                        className="group flex flex-col gap-2.5 bg-neutral-900 hover:bg-neutral-800/80 border border-neutral-800 hover:border-neutral-700 rounded-sm p-4 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-neutral-100 text-[13px] font-medium leading-snug group-hover:text-amber-400 transition-colors">
                            {brand.name}
                          </h3>
                          {brand.isNDP && (
                            <span className="text-[8px] font-mono uppercase tracking-widest px-1 py-0.5 border border-neutral-700 text-neutral-600 rounded-sm flex-shrink-0 mt-0.5">
                              NDP
                            </span>
                          )}
                        </div>

                        <p className="text-neutral-600 text-[11px]">
                          {brand.region}
                        </p>

                        <div className="flex items-center justify-between">
                          {/* Style dots */}
                          <div className="flex gap-1 items-center">
                            {styles.map((s) => (
                              <span
                                key={s}
                                title={s}
                                className={`w-[5px] h-[5px] rounded-full ${STYLE_DOT[s] ?? "bg-neutral-600"}`}
                              />
                            ))}
                          </div>
                          <span className="text-neutral-700 text-[10px] font-mono">
                            {bottleCount}{" "}
                            {bottleCount === 1 ? "expression" : "expressions"}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        {/* Footer */}
        <footer className="mt-16 pt-6 border-t border-neutral-900 flex items-center justify-between">
          <Link
            href="/"
            className="text-[10px] font-mono text-neutral-700 hover:text-neutral-500 transition-colors uppercase tracking-widest"
          >
            ← Explorer
          </Link>
          <span className="text-[10px] font-mono text-neutral-800">
            Common Cask
          </span>
        </footer>
      </div>
    </div>
  );
}
