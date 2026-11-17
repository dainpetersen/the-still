import { getCatalog } from "@/lib/catalog";

/**
 * The catalog as plain JSON: every producer, line and bottle with the few
 * facts needed to recognise it. Read by scripts/release-watch.mjs, which
 * checks new releases against what the site already lists.
 */
export const revalidate = 3600;

export async function GET() {
  const catalog = await getCatalog();
  return Response.json({
    generatedAt: new Date().toISOString(),
    brands: catalog.brands.map((brand) => ({
      id: brand.id,
      name: brand.name,
      region: brand.region,
      subBrands: brand.subBrands.map((sb) => ({
        id: sb.id,
        name: sb.name,
        bottles: sb.bottles.map((bt) => ({ id: bt.id, name: bt.name, abv: bt.abv, price: bt.price, age: bt.age ?? null })),
      })),
    })),
  });
}
