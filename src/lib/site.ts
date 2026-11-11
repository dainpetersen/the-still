/**
 * The one canonical origin for the site.
 *
 * This must be the host that actually answers 200. Vercel redirects the apex
 * (commoncask.com) to www, so canonical tags, the sitemap, robots.txt, Open
 * Graph URLs and JSON-LD all have to say www — otherwise every URL we hand
 * Google is a redirect, and every page's canonical points at a URL that
 * redirects straight back to it.
 *
 * Deliberately a constant rather than NEXT_PUBLIC_SITE_URL: that env var held
 * a leading tab and the apex host in production, which put "\thttps://…" in
 * every sitemap <loc>. Preview deployments should point their canonicals at
 * production anyway, so there is nothing for an env var to vary.
 */
export const SITE_URL = "https://www.commoncask.com";
export const SITE_NAME = "Common Cask";

/** Absolute URL for a site-relative path ("/brands/four-roses"). */
export function absoluteUrl(path = "/"): string {
  if (path === "/" || path === "") return SITE_URL;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * The share card from app/opengraph-image.tsx. A page that sets its own
 * `openGraph` replaces the root one wholesale — image included — so every
 * page spreads this in explicitly.
 */
export const OG_IMAGES = [
  { url: "/opengraph-image", width: 1200, height: 630, alt: "Common Cask — American Whiskey Explorer" },
];
