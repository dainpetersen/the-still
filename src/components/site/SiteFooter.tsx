import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer
      className="mt-16"
      style={{ borderTop: "1px solid rgba(13,11,8,0.12)", color: "rgba(13,11,8,0.6)" }}
    >
      <div className="max-w-5xl mx-auto px-5 sm:px-8 py-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px]">
        <span className="cc-serif" style={{ fontStyle: "italic" }}>
          Common Cask — a community catalog of American whiskey. No paid rankings.
        </span>
        <nav aria-label="Footer" className="sm:ml-auto flex gap-5">
          <Link href="/" className="cc-link">Explorer</Link>
          <Link href="/brands" className="cc-link">All distilleries</Link>
        </nav>
      </div>
    </footer>
  );
}
