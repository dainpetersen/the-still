import Link from "next/link";
import type { Metadata } from "next";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)", color: "var(--ink)" }}>
      <SiteHeader />
      <main className="flex-1 max-w-5xl w-full mx-auto px-5 sm:px-8 pt-16">
        <p className="cc-mono-label">404</p>
        <h1 className="cc-serif mt-2" style={{ fontSize: "clamp(2rem, 5vw, 3rem)", fontWeight: 400 }}>
          That page isn&apos;t in the catalog
        </h1>
        <p className="cc-serif mt-4 max-w-xl text-[17px] leading-[1.65]" style={{ color: "rgb(var(--ink-rgb) / 0.8)" }}>
          The bottle or distillery may have been renamed or merged with another entry. Try the{" "}
          <Link href="/" className="cc-link">explorer</Link> to search every bottle, or browse{" "}
          <Link href="/brands" className="cc-link">all distilleries</Link>.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
