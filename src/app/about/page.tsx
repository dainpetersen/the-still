import Link from "next/link";
import type { Metadata } from "next";
import { MIN_RATINGS_TO_RANK, getCatalog } from "@/lib/catalog";
import { OG_IMAGES, absoluteUrl } from "@/lib/site";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";

export const revalidate = 3600;

const DESCRIPTION =
  "What Common Cask is, where its bottle data and ratings come from — including scores from public Reddit whiskey reviews — and how bottles are ranked.";

export const metadata: Metadata = {
  title: "About Common Cask & How Ratings Work",
  description: DESCRIPTION,
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About Common Cask & How Ratings Work",
    description: DESCRIPTION,
    url: absoluteUrl("/about"),
    images: OG_IMAGES,
  },
};

function Section({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-12 scroll-mt-6">
      <h2 className="cc-serif text-[26px]" style={{ fontWeight: 400 }}>
        {title}
      </h2>
      <div
        className="cc-serif mt-3 space-y-4 text-[17px] leading-[1.7]"
        style={{ color: "rgb(var(--ink-rgb) / 0.82)" }}
      >
        {children}
      </div>
    </section>
  );
}

export default async function AboutPage() {
  const { brands, bottles, ranked, ratingSources } = await getCatalog();
  const members = ratingSources ? ratingSources.total - ratingSources.imported : null;
  const n = (value: number) => value.toLocaleString("en-US");

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)", color: "var(--ink)" }}>
      <SiteHeader />

      <main className="max-w-3xl mx-auto px-5 sm:px-8 pt-10">
        <header className="pb-8" style={{ borderBottom: "1px solid rgb(var(--ink-rgb) / 0.15)" }}>
          <h1
            className="cc-serif leading-[1.05] tracking-tight"
            style={{ fontSize: "clamp(2.2rem, 5vw, 3.4rem)", fontWeight: 400, textWrap: "balance" }}
          >
            About Common Cask
          </h1>
          <p className="cc-serif mt-4 text-[18px] leading-[1.65]" style={{ color: "rgb(var(--ink-rgb) / 0.82)" }}>
            Common Cask is an independent catalog of American whiskey: {n(bottles.length)} bottles from{" "}
            {n(brands.length)} distilleries and independent bottlers, each with its proof, age, suggested retail
            price, rarity and a community rating. Nobody pays to be listed, ranked or featured.
          </p>
        </header>

        <Section id="ratings" title="Where the ratings come from">
          <p>
            A bottle&apos;s community rating is the plain average of every score held for it, on a 10-point scale,
            shown alongside the number of scores behind it.
          </p>
          <p>
            Most of those scores were not entered on this site. They come from public whiskey reviews posted on
            Reddit, in communities such as r/bourbon and r/whiskey, matched to the bottles in this catalog and
            rounded to the nearest whole point. The reviewers are not affiliated with Common Cask, and their
            scores are not tied to accounts here. The remaining scores are entered directly by Common Cask
            members.
          </p>
          {ratingSources && members !== null && (
            <p>
              As of the latest count there are <strong>{n(ratingSources.total)}</strong> ratings:{" "}
              <strong>{n(ratingSources.imported)}</strong> from public Reddit reviews and{" "}
              <strong>{n(members)}</strong> from members.
            </p>
          )}
          <p>
            A single enthusiastic score shouldn&apos;t top a chart, so a bottle needs at least{" "}
            {MIN_RATINGS_TO_RANK} ratings before it appears in any ranking or &ldquo;top rated&rdquo; list.{" "}
            {n(ranked.length)} bottles currently qualify. Bottles with fewer ratings still show their average,
            marked as unranked.
          </p>
          <p>
            To add your own score, open any bottle in the <Link href="/" className="cc-link">explorer</Link>,
            sign in, and rate it from 1 to 10. You can add nose, palate and finish notes if you like.
          </p>
        </Section>

        <Section id="data" title="Where the bottle data comes from">
          <p>
            Proof, age statements and styles are compiled by hand, mainly from what producers publish about
            their own bottles. Prices are suggested retail prices, not what a bottle sells for on a shelf near you or on
            the secondary market — for allocated bottles the gap can be large.
          </p>
          <p>
            Rarity (common, limited, rare, allocated, unicorn) is our own estimate of how hard a bottle is to
            find at retail. Treat it as a guide rather than a measurement.
          </p>
          <p>
            Entries marked as community entries were submitted by members and reviewed before going live.
            Producers labelled NDP are non-distilling producers: they bottle whiskey distilled elsewhere, and
            the source distillery is listed where it is known.
          </p>
        </Section>

        <Section id="corrections" title="Corrections and additions">
          <p>
            Catalogs like this are never finished. If a bottle is missing, sign in and use{" "}
            <em>Submit a Bottle</em> in the explorer. If something is wrong, open the bottle and choose{" "}
            <em>Report incorrect information</em>. Both go to a review queue before anything changes.
          </p>
          <p>
            <Link href="/brands" className="cc-link">Browse all distilleries</Link> or{" "}
            <Link href="/" className="cc-link">open the explorer</Link>.
          </p>
        </Section>
      </main>

      <SiteFooter />
    </div>
  );
}
