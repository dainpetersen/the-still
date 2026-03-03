import { Brand, SubBrand, Bottle, Submission, RarityLevel, WhiskeyStyle, DataSource } from "@/types/whiskey";

/**
 * Merges admin-approved community submissions into the static brand data.
 * Returns a new Brand[] array — does not mutate the originals.
 * Community entries are tagged with source: "community".
 */
export function mergeApprovedSubmissions(
  staticBrands: Brand[],
  approved: Submission[]
): Brand[] {
  // Deep-copy so we don't mutate the module-level static array
  const brands: Brand[] = staticBrands.map((b) => ({
    ...b,
    subBrands: b.subBrands.map((sb) => ({
      ...sb,
      bottles: [...sb.bottles],
    })),
  }));

  for (const sub of approved) {
    try {
      if (sub.type === "brand") {
        const d = sub.data;
        if (!d.brandName) continue;
        // Dedup by id or name — but allow a bundled submission to replace an
        // empty brand-only stub (old format that was approved before bundling existed).
        const existingIdx = brands.findIndex(
          (b) => b.id === sub.id || b.name.toLowerCase() === d.brandName!.toLowerCase()
        );
        if (existingIdx >= 0) {
          if (brands[existingIdx].subBrands.length > 0) continue; // true duplicate — skip
          brands.splice(existingIdx, 1); // empty stub — remove so bundled version replaces it
        }
        const newBrand: Brand = {
          id: sub.id,
          name: d.brandName,
          country: "USA",
          region: d.brandRegion ?? "Unknown",
          isNDP: d.brandIsNDP ?? false,
          source: "community",
          subBrands: [],
        };

        // Unpack bundled sub-brands and bottles (new distillery submission path)
        if (d.bundledSubBrands?.length) {
          newBrand.subBrands = d.bundledSubBrands.map((sb) => {
            const sbId = `${sub.id}-${sb.name}`;
            const newSubBrand: SubBrand = {
              id: sbId,
              name: sb.name,
              brandId: sub.id,
              source: "community" as DataSource,
              bottles: sb.bottles.map((bt, i): Bottle => ({
                id: `${sbId}-${i}`,
                name: bt.name,
                subBrandId: sbId,
                abv: bt.abv,
                price: bt.price,
                age: bt.age,
                rarity: bt.rarity,
                rarityScore: rarityToScore(bt.rarity),
                description: bt.description ?? "",
                sourceDistillery: bt.sourceDistillery,
                style: bt.style ? (bt.style as WhiskeyStyle) : undefined,
                source: "community" as DataSource,
              })),
            };
            return newSubBrand;
          });
        }

        brands.push(newBrand);
      } else if (sub.type === "sub_brand") {
        const d = sub.data;
        if (!d.subBrandName || !sub.parentId) continue;
        const brand = brands.find((b) => b.id === sub.parentId) ??
          brands.find((b) => b.name.toLowerCase() === sub.parentName?.toLowerCase());
        if (!brand) {
          console.warn("[mergeSubmissions] parent brand not found for sub_brand", sub.id);
          continue;
        }
        const alreadyExists = brand.subBrands.some(
          (sb) => sb.id === sub.id || sb.name.toLowerCase() === d.subBrandName!.toLowerCase()
        );
        if (alreadyExists) continue;
        const newSubBrand: SubBrand = {
          id: sub.id,
          name: d.subBrandName,
          brandId: brand.id,
          source: "community",
          bottles: [],
        };
        brand.subBrands.push(newSubBrand);
      } else if (sub.type === "bottle") {
        const d = sub.data;
        if (!d.bottleName || !sub.parentId) continue;
        // Find parent sub-brand across all brands
        let parentSubBrand: SubBrand | undefined;
        for (const b of brands) {
          parentSubBrand = b.subBrands.find((sb) => sb.id === sub.parentId) ??
            b.subBrands.find((sb) => sb.name.toLowerCase() === sub.parentName?.toLowerCase());
          if (parentSubBrand) break;
        }
        if (!parentSubBrand) {
          console.warn("[mergeSubmissions] parent sub-brand not found for bottle", sub.id);
          continue;
        }
        const alreadyExists = parentSubBrand.bottles.some(
          (bt) => bt.id === sub.id || bt.name.toLowerCase() === d.bottleName!.toLowerCase()
        );
        if (alreadyExists) continue;
        const newBottle: Bottle = {
          id: sub.id,
          name: d.bottleName,
          subBrandId: parentSubBrand.id,
          abv: d.bottleAbv ?? 0,
          price: d.bottlePrice ?? 0,
          age: d.bottleAge,
          rarity: (d.bottleRarity as RarityLevel) ?? "limited",
          rarityScore: d.bottleRarityScore ?? rarityToScore(d.bottleRarity),
          description: d.bottleDescription ?? "",
          sourceDistillery: d.bottleSourceDistillery,
          style: d.bottleStyle ? (d.bottleStyle as WhiskeyStyle) : undefined,
          source: "community",
        };
        parentSubBrand.bottles.push(newBottle);
      }
    } catch (err) {
      console.warn("[mergeSubmissions] error processing submission", sub.id, err);
    }
  }

  return brands;
}

function rarityToScore(rarity?: string): number {
  switch (rarity) {
    case "common": return 10;
    case "limited": return 40;
    case "rare": return 65;
    case "allocated": return 82;
    case "unicorn": return 95;
    default: return 40;
  }
}
