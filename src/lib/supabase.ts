import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Brand, Bottle, SubBrand, Submission, SubmissionData, SubmissionType, Profile } from "@/types/whiskey";

// ── Browser (public anon) client ──────────────────────────────────────────────
let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient | null {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || url === "your-project-url" || key === "your-anon-key") return null;
  try {
    _client = createClient(url, key);
    return _client;
  } catch {
    return null;
  }
}

// ── Server (service role) client — only used in Server Components / Actions ───
export function getServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  try {
    return createClient(url, key, { auth: { persistSession: false } });
  } catch {
    return null;
  }
}

// ── Catalog ───────────────────────────────────────────────────────────────────
// Returns null if Supabase is not configured or tables are empty (caller falls back to static data)
export async function fetchCatalog(): Promise<Brand[] | null> {
  const client = getClient();
  if (!client) return null;

  const [{ data: brandsData, error: be }, { data: subData, error: se }, { data: bottleData, error: bte }] =
    await Promise.all([
      client.from("brands").select("*").order("name"),
      client.from("sub_brands").select("*"),
      client.from("bottles").select("*"),
    ]);

  if (be || se || bte || !brandsData?.length) return null;

  return brandsData.map((b): Brand => ({
    id: b.id,
    name: b.name,
    country: b.country ?? "USA",
    region: b.region ?? "",
    isNDP: b.is_ndp ?? false,
    subBrands: (subData ?? [])
      .filter((s) => s.brand_id === b.id)
      .map((s): SubBrand => ({
        id: s.id,
        name: s.name,
        brandId: s.brand_id,
        bottles: (bottleData ?? [])
          .filter((bt) => bt.sub_brand_id === s.id)
          .map((bt): Bottle => ({
            id: bt.id,
            name: bt.name,
            subBrandId: bt.sub_brand_id,
            price: bt.price ?? 0,
            abv: bt.abv ?? 0,
            age: bt.age ?? undefined,
            rarity: bt.rarity ?? "common",
            rarityScore: bt.rarity_score ?? 0,
            description: bt.description ?? "",
            sourceDistillery: bt.source_distillery ?? undefined,
            source: (bt.entry_source as "official" | "community") ?? "official",
            availability: (bt.availability as "current" | "limited_release" | "discontinued") ?? "current",
          })),
      })),
  }));
}

// ── Ratings ───────────────────────────────────────────────────────────────────

export async function fetchBottleRatings(bottleId: string) {
  const client = getClient();
  if (!client) return [];
  const { data, error } = await client
    .from("ratings")
    .select("rating, nose, palate, finish, created_at")
    .eq("bottle_id", bottleId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchAllAverageRatings(): Promise<
  Record<string, { avg: number; count: number }>
> {
  const client = getClient();
  if (!client) return {};
  const { data, error } = await client.from("ratings").select("bottle_id, rating");
  if (error) throw error;

  const map: Record<string, { sum: number; count: number }> = {};
  for (const row of data ?? []) {
    if (!map[row.bottle_id]) map[row.bottle_id] = { sum: 0, count: 0 };
    map[row.bottle_id].sum += row.rating;
    map[row.bottle_id].count += 1;
  }
  return Object.fromEntries(
    Object.entries(map).map(([id, { sum, count }]) => [
      id,
      { avg: Math.round((sum / count) * 10) / 10, count },
    ])
  );
}

export async function submitRating(payload: {
  bottleId: string;
  rating: number;
  nose?: string;
  palate?: string;
  finish?: string;
  sessionId: string;
  userId?: string;
}) {
  const client = getClient();
  if (!client) throw new Error("Supabase is not configured. Add credentials to .env.local");
  const { error } = await client.from("ratings").upsert(
    {
      bottle_id: payload.bottleId,
      rating: payload.rating,
      nose: payload.nose ?? null,
      palate: payload.palate ?? null,
      finish: payload.finish ?? null,
      session_id: payload.sessionId,
      user_id: payload.userId ?? null,
    },
    { onConflict: "bottle_id,session_id" }
  );
  if (error) throw error;
}

// ── Community Submissions ─────────────────────────────────────────────────────

export async function submitEntry(payload: {
  type: SubmissionType;
  data: SubmissionData;
  parentId?: string;
  parentName?: string;
  sessionId: string;
  userId?: string;
}) {
  const client = getClient();
  if (!client) throw new Error("Supabase is not configured. Add credentials to .env.local");
  const { error } = await client.from("submissions").insert({
    type: payload.type,
    data: payload.data,
    parent_id: payload.parentId ?? null,
    parent_name: payload.parentName ?? null,
    session_id: payload.sessionId,
    user_id: payload.userId ?? null,
  });
  if (error) throw error;
}

export async function fetchApprovedSubmissions(): Promise<Submission[]> {
  const client = getClient();
  if (!client) return [];
  const { data, error } = await client
    .from("submissions")
    .select("*")
    .eq("status", "approved")
    .order("reviewed_at", { ascending: true });
  if (error) {
    console.warn("Could not load community submissions:", error.message);
    return [];
  }
  return (data ?? []).map(rowToSubmission);
}

// ── Admin functions (use service role client) ─────────────────────────────────

export async function fetchPendingSubmissions(): Promise<Submission[]> {
  const client = getServiceClient();
  if (!client) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  const { data, error } = await client
    .from("submissions")
    .select("*")
    .eq("status", "pending")
    .order("submitted_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(rowToSubmission);
}

export async function fetchReviewedSubmissions(): Promise<Submission[]> {
  const client = getServiceClient();
  if (!client) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  const { data, error } = await client
    .from("submissions")
    .select("*")
    .neq("status", "pending")
    .order("reviewed_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map(rowToSubmission);
}

export async function reviewSubmission(
  id: string,
  status: "approved" | "rejected",
  adminNote?: string
) {
  const client = getServiceClient();
  if (!client) throw new Error("Service role key not configured");
  const { error } = await client
    .from("submissions")
    .update({
      status,
      admin_note: adminNote ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function signInWithGoogle() {
  const client = getClient();
  if (!client) throw new Error("Supabase is not configured");
  return client.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback`,
    },
  });
}

export async function signInWithEmail(email: string, password: string) {
  const client = getClient();
  if (!client) throw new Error("Supabase is not configured");
  const { error } = await client.auth.signInWithPassword({ email, password });
  return { error };
}

export async function signUpWithEmail(email: string, password: string) {
  const client = getClient();
  if (!client) throw new Error("Supabase is not configured");
  const { data, error } = await client.auth.signUp({ email, password });
  return { user: data.user, error };
}

export async function signOut() {
  const client = getClient();
  if (!client) return;
  await client.auth.signOut();
}

export function getAuthClient() {
  return getClient();
}

// ── Profiles ──────────────────────────────────────────────────────────────────

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const client = getClient();
  if (!client) return null;
  const { data, error } = await client
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error || !data) return null;
  return rowToProfile(data);
}

export async function upsertProfile(userId: string, fields: Partial<Omit<Profile, "id">>) {
  const client = getClient();
  if (!client) throw new Error("Supabase is not configured");
  const { error } = await client.from("profiles").upsert({
    id: userId,
    display_name: fields.displayName,
    location: fields.location,
    favorite_style: fields.favoriteStyle,
    favorite_brand: fields.favoriteBrand,
    avatar_url: fields.avatarUrl,
  });
  if (error) throw error;
}

function rowToProfile(row: Record<string, unknown>): Profile {
  return {
    id: row.id as string,
    displayName: (row.display_name as string | null) ?? null,
    location: (row.location as string | null) ?? null,
    favoriteStyle: (row.favorite_style as string | null) ?? null,
    favoriteBrand: (row.favorite_brand as string | null) ?? null,
    avatarUrl: (row.avatar_url as string | null) ?? null,
  };
}

// ── Helper ────────────────────────────────────────────────────────────────────

function rowToSubmission(row: Record<string, unknown>): Submission {
  return {
    id: row.id as string,
    type: row.type as Submission["type"],
    data: row.data as SubmissionData,
    parentId: (row.parent_id as string | null) ?? undefined,
    parentName: (row.parent_name as string | null) ?? undefined,
    sessionId: row.session_id as string,
    status: row.status as Submission["status"],
    adminNote: (row.admin_note as string | null) ?? undefined,
    submittedAt: row.submitted_at as string,
    reviewedAt: (row.reviewed_at as string | null) ?? undefined,
  };
}
