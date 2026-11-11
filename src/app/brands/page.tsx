import Link from "next/link";
import type { Metadata } from "next";
import { bottleCount, getCatalog } from "@/lib/catalog";
import { stateFromRegion } from "@/lib/mergeCatalog";
import { OG_IMAGES, absoluteUrl } from "@/lib/site";
import type { Brand } from "@/types/whiskey";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const { brands, bottles } = await getCatalog();
  const description = `All ${brands.length} American whiskey distilleries and producers in the Common Cask catalog, grouped by state — ${bottles.length} bourbons, ryes and single malts with prices, proof and community ratings.`;
  return {
    title: "American Whiskey Distilleries by State",
    description,
    alternates: { canonical: "/brands" },
    openGraph: {
      title: "American Whiskey Distilleries by State | Common Cask",
      description,
      url: absoluteUrl("/brands"),
      images: OG_IMAGES,
    },
  };
}

export default async function BrandsIndexPage() {
  const catalog = await getCatalog();
  const brands = catalog.brands.filter((b) => catalog.brandPaths.has(b.id));

  const stateOf = (b: Brand) => b.state ?? stateFromRegion(b.region) ?? "Elsewhere";
  const byState = new Map<string, Brand[]>();
  for (const brand of brands) {
    const key = stateOf(brand);
    if (!byState.has(key)) byState.set(key, []);
    byState.get(key)!.push(brand);
  }
  // Biggest states first — Kentucky leads, single-distillery states follow A–Z.
  const states = [...byState.keys()].sort((a, b) => {
    if (a === "Elsewhere") return 1;
    if (b === "Elsewhere") return -1;
    return byState.get(b)!.length - byState.get(a)!.length || a.localeCompare(b);
  });

  const ratingsFor = (b: Brand) =>
    (catalog.brandBottles.get(b.id) ?? []).reduce((sum, e) => sum + (e.rating?.count ?? 0), 0);

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)", color: "var(--ink)" }}>
      <SiteHeader />

      <main className="max-w-5xl mx-auto px-5 sm:px-8 pt-10">
        <header className="pb-8" style={{ borderBottom: "1px solid rgb(var(--ink-rgb) / 0.15)" }}>
          <h1
            className="cc-serif leading-[1.05] tracking-tight"
            style={{ fontSize: "clamp(2.2rem, 5vw, 3.4rem)", fontWeight: 400, textWrap: "balance" }}
          >
            American whiskey distilleries
          </h1>
          <p className="cc-serif mt-4 max-w-2xl text-[17px] leading-[1.65]" style={{ color: "rgb(var(--ink-rgb) / 0.8)" }}>
            {brands.length} distilleries and independent bottlers across {states.filter((s) => s !== "Elsewhere").length}{" "}
            states, covering {catalog.bottles.length} bottles. Pick a producer to see its full lineup with proof, age,
            suggested retail price and community ratings.
          </p>
        </header>

        <div className="flex flex-col gap-10 mt-8">
          {states.map((state) => {
            const list = byState.get(state)!.sort((a, b) => bottleCount(catalog, b) - bottleCount(catalog, a));
            return (
              <section key={state}>
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="cc-serif text-[22px]" style={{ fontWeight: 400 }}>{state}</h2>
                  <span aria-hidden="true" className="flex-1 h-px" style={{ background: "rgb(var(--ink-rgb) / 0.12)" }} />
                  <span className="cc-mono-label" aria-label={`${list.length} producers`}>{list.length}</span>
                </div>
                <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {list.map((brand) => {
                    const count = bottleCount(catalog, brand);
                    const ratings = ratingsFor(brand);
                    return (
                      <li key={brand.id}>
                        <Link
                          href={catalog.brandPaths.get(brand.id)!}
                          className="cc-card flex flex-col gap-1.5 rounded-sm p-4 h-full"
                        >
                          <span className="flex items-start justify-between gap-2">
                            <h3 className="text-[16px] font-medium leading-snug">{brand.name}</h3>
                            {brand.isNDP && (
                              <span
                                className="cc-mono-label px-1 rounded-sm flex-shrink-0"
                                style={{ border: "1px solid rgb(var(--ink-rgb) / 0.25)" }}
                                title="Non-distilling producer"
                              >
                                NDP
                              </span>
                            )}
                          </span>
                          {brand.region && (
                            <span className="cc-serif text-[14px]" style={{ fontStyle: "italic", color: "rgb(var(--ink-rgb) / 0.6)" }}>
                              {brand.region}
                            </span>
                          )}
                          <span className="font-mono text-[12px] mt-auto pt-1" style={{ color: "rgb(var(--ink-rgb) / 0.6)" }}>
                            {count} {count === 1 ? "bottle" : "bottles"}
                            {ratings > 0 ? ` · ${ratings.toLocaleString("en-US")} ratings` : ""}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
