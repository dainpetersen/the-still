import type { MetadataRoute } from "next";
import { getCatalog } from "@/lib/catalog";
import { absoluteUrl } from "@/lib/site";

export const revalidate = 3600;

// Every URL here must be the final, canonical URL (www, no redirect) and must
// match the page's own <link rel="canonical">.
//
// lastModified is deliberately omitted: the catalog has no per-row "updated"
// timestamp we can trust, and Google ignores lastmod once it catches a site
// reporting dates that don't match real content changes.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const catalog = await getCatalog();

  return [
    { url: absoluteUrl("/"), changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/brands"), changeFrequency: "weekly", priority: 0.9 },
    ...[...catalog.brandBySlug.keys()].map((slug) => ({
      url: absoluteUrl(`/brands/${slug}`),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...catalog.bottles.map((entry) => ({
      url: absoluteUrl(entry.path),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
