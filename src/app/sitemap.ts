import type { MetadataRoute } from "next";
import { WHISKEY_DATA } from "@/data/whiskeys";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://commoncask.com").trim();

// Date each brand page was last meaningfully updated.
// Stable dates prevent Google from treating every deploy as a content change.
// Update this when a brand's bottles/data change significantly.
const BRAND_UPDATED: Record<string, string> = {
  // Initial launch — 2026-02-28
  "buffalo-trace-distillery": "2026-03-30", // E.H. Taylor + WLW BTAC added Mar 30
  "heaven-hill":              "2026-02-28",
  "wild-turkey":              "2026-02-28",
  "four-roses":               "2026-02-28",
  "brown-forman":             "2026-02-28",
  "beam-suntory":             "2026-03-23", // Old Overholt sub-brands added Mar 23
  "michters":                 "2026-02-28",
  "high-west":                "2026-03-23",
  "willett":                  "2026-02-28",
  "angels-envy":              "2026-02-28",
  // Added Mar 4
  "sagamore-spirit":          "2026-03-04",
  "holladay":                 "2026-03-04",
  // Added Mar 7
  "redwood-empire-whiskey":   "2026-03-07",
  "penelope-bourbon":         "2026-03-07",
  "kentucky-peerless":        "2026-03-07",
  "buckners":                 "2026-03-07",
  // Added Mar 8
  "four-gate":                "2026-03-08",
  // Added Mar 10
  "bombergers-declaration":   "2026-03-10",
  "leopold-bros":             "2026-03-10",
  // Added Mar 23
  "bardstown-bourbon":        "2026-03-23",
  "still-austin":             "2026-03-23",
  "makers-mark":              "2026-03-23",
  "templeton-rye":            "2026-03-23",
  "new-riff-distilling":      "2026-03-23",
  // Added Mar 30
  "bulleit":                  "2026-03-30",
  "smooth-ambler":            "2026-03-30",
  "barton-1792":              "2026-03-30",
  "jeffersons":               "2026-03-30",
  "barrell":                  "2026-03-30",
};

const LAUNCH_DATE = "2026-02-28";

export default function sitemap(): MetadataRoute.Sitemap {
  const brandUrls: MetadataRoute.Sitemap = WHISKEY_DATA.map((brand) => ({
    url: `${SITE_URL}/brands/${brand.id}`,
    lastModified: new Date(BRAND_UPDATED[brand.id] ?? LAUNCH_DATE),
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  return [
    {
      url: SITE_URL,
      lastModified: new Date("2026-03-30"),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/brands`,
      lastModified: new Date("2026-03-30"),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    ...brandUrls,
  ];
}
