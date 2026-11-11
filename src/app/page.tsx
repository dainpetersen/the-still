import type { Metadata } from "next";
import { getCatalog } from "@/lib/catalog";
import HomeClient from "@/components/HomeClient";
import HomeDirectory from "@/components/site/HomeDirectory";
import SiteFooter from "@/components/site/SiteFooter";

// Regenerate at most hourly so the server-rendered rankings stay current.
export const revalidate = 3600;

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default async function Home() {
  const catalog = await getCatalog();
  return (
    <HomeClient initialRatings={catalog.ratings}>
      <HomeDirectory catalog={catalog} />
      <SiteFooter />
    </HomeClient>
  );
}
