import Link from "next/link";
import { absoluteUrl } from "@/lib/site";

export interface Crumb {
  name: string;
  /** Site-relative path. Omit for the current page. */
  path?: string;
}

/** Visible breadcrumb trail + matching BreadcrumbList structured data. */
export default function Breadcrumbs({ trail, currentPath }: { trail: Crumb[]; currentPath: string }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: absoluteUrl(c.path ?? currentPath),
    })),
  };
  return (
    <nav aria-label="Breadcrumb" className="mb-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 cc-mono-label">
        {trail.map((c, i) => (
          <li key={i} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden="true" style={{ color: "rgba(13,11,8,0.3)" }}>/</span>}
            {c.path ? (
              <Link href={c.path} className="cc-link" style={{ textDecoration: "none" }}>
                {c.name}
              </Link>
            ) : (
              <span aria-current="page" style={{ color: "rgba(13,11,8,0.8)" }}>{c.name}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
