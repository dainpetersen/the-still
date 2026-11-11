import Link from "next/link";
import Logo from "@/components/Logo";

/** Header for the catalog pages (the explorer on "/" has its own). */
export default function SiteHeader() {
  return (
    <header style={{ borderBottom: "1px solid rgba(13,11,8,0.12)" }}>
      <div className="max-w-5xl mx-auto px-5 sm:px-8 py-3 flex items-center gap-6">
        <Link href="/" aria-label="Common Cask — home">
          <Logo />
        </Link>
        <nav aria-label="Primary" className="ml-auto flex items-center gap-5 text-[13px]">
          <Link href="/" className="cc-link" style={{ textDecoration: "none" }}>
            Explorer
          </Link>
          <Link href="/brands" className="cc-link" style={{ textDecoration: "none" }}>
            Distilleries
          </Link>
        </nav>
      </div>
    </header>
  );
}
