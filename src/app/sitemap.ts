import type { MetadataRoute } from "next";
import { WHISKEY_DATA } from "@/data/whiskeys";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://commoncask.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const brandUrls: MetadataRoute.Sitemap = WHISKEY_DATA.map((brand) => ({
    url: `${SITE_URL}/brands/${brand.id}`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    ...brandUrls,
  ];
}
