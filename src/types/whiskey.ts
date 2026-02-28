export type RarityLevel = "common" | "limited" | "rare" | "allocated" | "unicorn";
export type ColorMode = "price" | "rating" | "rarity";
export type DataSource = "official" | "community";
export type SubmissionType = "brand" | "sub_brand" | "bottle";
export type SubmissionStatus = "pending" | "approved" | "rejected";

export interface Bottle {
  id: string;
  name: string;
  subBrandId: string;
  age?: number;             // years, undefined = NAS
  abv: number;             // percent
  price: number;           // USD retail
  rarity: RarityLevel;
  rarityScore: number;     // 1–100
  description: string;
  sourceDistillery?: string; // for NDP bottles, e.g. "MGP" or "Undisclosed"
  source?: DataSource;     // "official" | "community"
  // Populated from Supabase at runtime
  avgRating?: number;
  ratingCount?: number;
}

export interface SubBrand {
  id: string;
  name: string;
  brandId: string;
  bottles: Bottle[];
  source?: DataSource;
}

export interface Brand {
  id: string;
  name: string;
  country: string;
  region: string;
  subBrands: SubBrand[];
  isNDP?: boolean;         // Non-Distilling Producer
  source?: DataSource;
}

// D3 hierarchy node shapes
export interface TreemapDatum {
  name: string;
  type: "brand" | "subBrand" | "bottle";
  id?: string;
  value?: number;          // leaf value (drives rectangle size)
  price?: number;
  rarityScore?: number;
  rarity?: string;
  avgRating?: number;
  ratingCount?: number;
  abv?: number;
  age?: number;
  description?: string;
  isNDP?: boolean;
  source?: DataSource;
  sourceDistillery?: string;
  children?: TreemapDatum[];
}

export interface UserRating {
  bottleId: string;
  rating: number;          // 1–10
  nose?: string;
  palate?: string;
  finish?: string;
  createdAt: string;
}

// Submission types
export interface SubmissionData {
  // Brand fields
  brandName?: string;
  brandRegion?: string;
  brandIsNDP?: boolean;
  // Sub-brand fields
  subBrandName?: string;
  // Bottle fields
  bottleName?: string;
  bottleAbv?: number;
  bottlePrice?: number;
  bottleAge?: number;
  bottleRarity?: RarityLevel;
  bottleRarityScore?: number;
  bottleDescription?: string;
  bottleSourceDistillery?: string;
}

export interface Submission {
  id: string;
  type: SubmissionType;
  data: SubmissionData;
  parentId?: string;
  parentName?: string;
  sessionId: string;
  status: SubmissionStatus;
  adminNote?: string;
  submittedAt: string;
  reviewedAt?: string;
}
