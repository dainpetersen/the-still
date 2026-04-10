"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { WHISKEY_DATA, buildGroupedData } from "@/data/whiskeys";
import {
  fetchAllAverageRatings,
  fetchApprovedSubmissions,
  fetchCatalog,
  getAuthClient,
  fetchProfile,
  signOut,
} from "@/lib/supabase";
import { mergeApprovedSubmissions } from "@/lib/mergeSubmissions";
import { buildDistilleryColors } from "@/lib/distilleryColors";
import { Brand, ColorMode, GroupMode, BubbleSizeMode, Profile, WhiskeyStyle } from "@/types/whiskey";

/**
 * When the Supabase catalog predates the style/state columns, fill in those
 * fields from the static WHISKEY_DATA so Group By modes work correctly.
 */
function enrichCatalogStyles(catalog: Brand[]): Brand[] {
  const styleMap = new Map<string, WhiskeyStyle>();
  const stateMap = new Map<string, string>();
  for (const brand of WHISKEY_DATA) {
    if (brand.state) stateMap.set(brand.id, brand.state);
    for (const sb of brand.subBrands) {
      for (const bt of sb.bottles) {
        if (bt.style) styleMap.set(bt.id, bt.style);
      }
    }
  }
  return catalog.map((brand) => ({
    ...brand,
    state: brand.state ?? stateMap.get(brand.id),
    subBrands: brand.subBrands.map((sb) => ({
      ...sb,
      bottles: sb.bottles.map((bt) => ({
        ...bt,
        style: bt.style ?? styleMap.get(bt.id),
      })),
    })),
  }));
}
import ColorLegend from "@/components/ColorLegend";
import GroupControl from "@/components/GroupControl";
import RatingModal from "@/components/RatingModal";
import SubmissionModal from "@/components/SubmissionModal";
import AuthModal from "@/components/AuthModal";
import FlagModal from "@/components/FlagModal";
import TopRatedLeaderboard from "@/components/TopRatedLeaderboard";
import AboutSection from "@/components/AboutSection";
import Logo from "@/components/Logo";

const BubbleChart = dynamic(() => import("@/components/BubbleChart"), { ssr: false });
const MobileStripChart = dynamic(() => import("@/components/MobileStripChart"), { ssr: false });

interface BottleNode {
  id?: string;
  name: string;
  brandId?: string;
  brandName?: string;
  price?: number;
  abv?: number;
  age?: number;
  rarity?: string;
  description?: string;
  type: string;
}

export default function Home() {
  const [colorMode, setColorMode]   = useState<ColorMode>("price");
  const [groupMode, setGroupMode]   = useState<GroupMode>("distillery");
  const [sizeMode,  setSizeMode]    = useState<BubbleSizeMode>("price");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [selectedBottle, setSelectedBottle] = useState<BottleNode | null>(null);
  const [flaggedBottle, setFlaggedBottle] = useState<{ id: string; name: string } | null>(null);
  const [showSubmit, setShowSubmit] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [ratings, setRatings] = useState<Record<string, { avg: number; count: number }>>({});
  const [mergedBrands, setMergedBrands] = useState<Brand[]>(WHISKEY_DATA);
  const [communityCount, setCommunityCount] = useState(0);

  // ── Auth state ────────────────────────────────────────────────────────────
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // ── Filtering state ───────────────────────────────────────────────────────
  const [showDiscontinued, setShowDiscontinued] = useState(true);

  // ── Mobile detection ──────────────────────────────────────────────────────
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const fn = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);

  const handleGroupModeChange = useCallback((mode: GroupMode) => {
    setGroupMode(mode);
  }, []);

  // ── Derived display data ──────────────────────────────────────────────────
  const displayBrands = useMemo((): Brand[] => {
    // Strip discontinued bottles if the toggle is off
    const base = showDiscontinued
      ? mergedBrands
      : mergedBrands.map((b) => ({
          ...b,
          subBrands: b.subBrands.map((sb) => ({
            ...sb,
            bottles: sb.bottles.filter((bt) => bt.availability !== "discontinued"),
          })),
        }));

    return base;
  }, [mergedBrands, showDiscontinued]);

  // ── Stats for current view ────────────────────────────────────────────────
  const viewStats = useMemo(() => {
    const bottles = displayBrands.reduce(
      (s, b) => s + b.subBrands.reduce((ss, sb) => ss + sb.bottles.length, 0),
      0
    );
    const subBrands = displayBrands.reduce((s, b) => s + b.subBrands.length, 0);
    const distilleries = displayBrands.length;
    return { bottles, subBrands, distilleries };
  }, [displayBrands]);

  // ── Distillery color map (stable, alphabetically sorted) ──────────────────
  const distilleryColors = useMemo(
    () => buildDistilleryColors(displayBrands),
    [displayBrands]
  );

  // ── Data loading ──────────────────────────────────────────────────────────
  // Public reads now go through a dedicated anonymous Supabase client that
  // never carries a session token.  This sidesteps the PostgREST 401 that
  // occurred when an expired JWT was sent on a table with `using (true)` RLS.
  const loadData = useCallback(async () => {
    try {
      const [ratingsData, approvedSubs, catalogData] = await Promise.all([
        fetchAllAverageRatings(),
        fetchApprovedSubmissions(),
        fetchCatalog(),
      ]);

      setRatings(ratingsData);

      // Use Supabase catalog as the base (enriched with static style/state),
      // then merge in any static sub-brands/bottles not yet in Supabase so that
      // new entries in whiskeys.ts always appear in the chart even for brands
      // that already exist in the catalog.
      // Supabase brand IDs that are duplicates/typos consolidated into static data
      const DEPRECATED_CATALOG_IDS = new Set(["new-rifff", "new-riff"]);

      const baseData = (() => {
        if (!catalogData) return WHISKEY_DATA;
        const enriched = enrichCatalogStyles(catalogData).filter(
          (b) => !DEPRECATED_CATALOG_IDS.has(b.id)
        );
        const catalogBrandMap = new Map(enriched.map((b) => [b.id, b]));
        // IDs of static top-level brands — used to skip Supabase sub-brands whose
        // ID collides with a standalone static brand (e.g. Supabase "makers-mark"
        // sub-brand under beam-suntory vs static "makers-mark" top-level brand).
        const staticTopLevelBrandIds = new Set(WHISKEY_DATA.map((b) => b.id));

        const merged = WHISKEY_DATA.map((staticBrand) => {
          const catalogBrand = catalogBrandMap.get(staticBrand.id);
          if (!catalogBrand) return staticBrand; // brand only in static data, use as-is

          // Brand exists in both — merge sub-brands: use catalog version but add
          // any static sub-brands/bottles not present in the catalog.
          // Two-pass to prevent duplicates when static/Supabase use different sub-brand IDs
          // for the same bottles (e.g. static "stagg-jr-sub" vs Supabase "stagg").
          const catalogSubMap = new Map(catalogBrand.subBrands.map((sb) => [sb.id, sb]));

          // Pass 1: merge sub-brands that have a catalog match (catalog wins for metadata)
          const matchedSubBrands = staticBrand.subBrands
            .filter((staticSub) => catalogSubMap.has(staticSub.id))
            .map((staticSub) => {
              const catalogSub = catalogSubMap.get(staticSub.id)!;
              const catalogBottleIds = new Set(catalogSub.bottles.map((b) => b.id));
              const staticOnlyBottles = staticSub.bottles.filter((b) => !catalogBottleIds.has(b.id));
              return { ...catalogSub, bottles: [...catalogSub.bottles, ...staticOnlyBottles] };
            });

          // Pass 2: add static-only sub-brands, excluding bottles already merged above
          const matchedBottleIds = new Set(matchedSubBrands.flatMap((sb) => sb.bottles.map((b) => b.id)));
          const staticOnlySubBrands = staticBrand.subBrands
            .filter((staticSub) => !catalogSubMap.has(staticSub.id))
            .map((staticSub) => ({
              ...staticSub,
              bottles: staticSub.bottles.filter((b) => !matchedBottleIds.has(b.id)),
            }))
            .filter((sb) => sb.bottles.length > 0);

          const mergedSubBrands = [...matchedSubBrands, ...staticOnlySubBrands];

          // Add catalog-only sub-brands, excluding bottles already covered
          const staticSubIds = new Set(staticBrand.subBrands.map((sb) => sb.id));
          const mergedBottleIds = new Set(mergedSubBrands.flatMap((sb) => sb.bottles.map((b) => b.id)));
          const catalogOnlySubs = catalogBrand.subBrands
            .filter((sb) => !staticSubIds.has(sb.id) && !staticTopLevelBrandIds.has(sb.id))
            .map((sb) => ({ ...sb, bottles: sb.bottles.filter((b) => !mergedBottleIds.has(b.id)) }))
            .filter((sb) => sb.bottles.length > 0);

          return { ...catalogBrand, subBrands: [...mergedSubBrands, ...catalogOnlySubs] };
        });

        // Also include any catalog brands not in static data
        const staticBrandIds = new Set(WHISKEY_DATA.map((b) => b.id));
        const catalogOnlyBrands = enriched.filter((b) => !staticBrandIds.has(b.id));
        const allBrands = [...merged, ...catalogOnlyBrands];

        // Global deduplication: ensure no bottle ID appears more than once across all brands.
        // This catches any edge cases the per-brand merge logic didn't handle.
        const seenBottleIds = new Set<string>();
        return allBrands.map((brand) => ({
          ...brand,
          subBrands: brand.subBrands.map((sub) => ({
            ...sub,
            bottles: sub.bottles.filter((b) => {
              if (seenBottleIds.has(b.id)) return false;
              seenBottleIds.add(b.id);
              return true;
            }),
          })).filter((sub) => sub.bottles.length > 0),
        })).filter((brand) => brand.subBrands.length > 0);
      })();

      if (approvedSubs.length > 0) {
        const merged = mergeApprovedSubmissions(baseData, approvedSubs);
        setMergedBrands(merged);
        setCommunityCount(approvedSubs.filter((s) => s.type === "bottle").length);
      } else {
        setMergedBrands(baseData);
      }
    } catch {
      // Gracefully degrade without Supabase
    }
  }, []);

  useEffect(() => {
    // Load data immediately — the anon client never sends a JWT, so
    // this always succeeds regardless of auth state.
    loadData();

    const supabase = getAuthClient();
    if (!supabase) return;

    // onAuthStateChange tracks who is signed in — it does NOT drive data loading
    // (that's handled by the loadData() call above and the SIGNED_IN / TOKEN_REFRESHED
    // cases below). Keeping INITIAL_SESSION out of here avoids a duplicate
    // loadData() call that could race with the one above.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        const p = await fetchProfile(u.id);
        setProfile(p);
      } else {
        setProfile(null);
      }
      // Reload data after an explicit sign-in or a token refresh so the
      // freshly-authenticated requests pick up any user-specific data.
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        loadData();
      }
    });

    return () => subscription.unsubscribe();
  }, [loadData]);

  return (
    <main
      className="flex flex-col"
      style={{ background: "#f0e8d8", color: "#0d0b08" }}
    >
      {/* Header — sticky so it stays visible when scrolling into sections */}
      <header
        className="sticky top-0 z-40 px-6 py-3 flex items-center gap-4 flex-shrink-0"
        style={{
          borderBottom: "1px solid rgba(0,0,0,0.12)",
          background: "rgba(240,232,216,0.94)",
          backdropFilter: "blur(8px)",
        }}
      >
        <Logo />

        {/* Live stats + one-liner — desktop only */}
        <div className="hidden md:flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2 text-xs flex-shrink-0">
            <Link href="/brands" style={{ color: "rgba(13,11,8,0.55)" }} className="hover:opacity-80 transition-opacity">
              <span className="font-semibold" style={{ color: "#0d0b08" }}>{viewStats.distilleries}</span>
              {" "}distilleries
            </Link>
            <span style={{ color: "rgba(13,11,8,0.2)" }}>·</span>
            <span style={{ color: "rgba(13,11,8,0.55)" }}>
              <span className="font-semibold" style={{ color: "#0d0b08" }}>{viewStats.bottles}</span>
              {" "}bottles
            </span>
            {Object.keys(ratings).length > 0 && (
              <>
                <span style={{ color: "rgba(13,11,8,0.2)" }}>·</span>
                <span style={{ color: "rgba(13,11,8,0.55)" }}>
                  <span className="font-semibold" style={{ color: "#0d0b08" }}>{Object.keys(ratings).length}</span>
                  {" "}rated
                </span>
              </>
            )}
          </div>
          <span className="text-xs hidden lg:block truncate" style={{ color: "rgba(13,11,8,0.3)", fontStyle: "italic" }}>
            Community-driven American whiskey catalog · No paid rankings
          </span>
        </div>

        <div className="ml-auto flex items-center gap-3">

          {/* Auth control */}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setShowUserMenu((v) => !v)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all"
                style={{
                  background: (profile?.avatarUrl ?? user.user_metadata?.avatar_url) ? "transparent" : "rgba(13,11,8,0.08)",
                  border: "1px solid rgba(13,11,8,0.25)",
                  color: "#0d0b08",
                  overflow: "hidden",
                }}
                title={profile?.displayName ?? user.email ?? "Account"}
              >
                {(profile?.avatarUrl ?? (user.user_metadata?.avatar_url as string | undefined)) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile?.avatarUrl ?? (user.user_metadata?.avatar_url as string)}
                    alt="avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  (profile?.displayName ?? user.email ?? "?")[0].toUpperCase()
                )}
              </button>
              {showUserMenu && (
                <div
                  className="absolute right-0 top-10 w-44 rounded-sm py-2 z-50"
                  style={{
                    background: "rgba(244,238,224,0.97)",
                    border: "1px solid rgba(0,0,0,0.15)",
                    boxShadow: "2px 4px 16px rgba(0,0,0,0.12)",
                  }}
                >
                  <div className="px-4 py-2 border-b" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
                    <p className="text-xs font-semibold truncate" style={{ color: "#0d0b08" }}>
                      {profile?.displayName ?? user.email}
                    </p>
                    {profile?.displayName && (
                      <p className="text-xs truncate" style={{ color: "rgba(13,11,8,0.4)" }}>{user.email}</p>
                    )}
                  </div>
                  <button
                    onClick={() => { setShowUserMenu(false); setShowAuth(true); }}
                    className="w-full text-left px-4 py-2 text-sm transition-colors"
                    style={{ color: "rgba(13,11,8,0.6)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#0d0b08")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(13,11,8,0.6)")}
                  >
                    Edit Profile
                  </button>
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      setUser(null);
                      setProfile(null);
                      signOut().catch(() => {});
                    }}
                    className="w-full text-left px-4 py-2 text-sm transition-colors"
                    style={{ color: "rgba(160,40,40,0.7)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(160,40,40,1)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(160,40,40,0.7)")}
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setShowAuth(true)}
              className="px-3 py-1.5 rounded-sm text-xs font-semibold transition-all"
              style={{
                border: "1px solid rgba(13,11,8,0.3)",
                color: "rgba(13,11,8,0.7)",
                background: "transparent",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(13,11,8,0.06)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      {/* Hero layout — fills viewport height, first thing user sees */}
      <div className="flex" style={{ height: "calc(100vh - 49px)" }}>

        {/* ── Mobile: full-width strip chart ── */}
        {isMobile ? (
          <div className="flex-1 min-h-0 overflow-hidden">
            <MobileStripChart
              brands={displayBrands}
              ratings={ratings}
              onBottleClick={(bottle) => {
                if (!user) { setShowAuth(true); return; }
                setSelectedBottle(bottle as unknown as BottleNode);
              }}
              searchQuery={searchQuery}
              onSearchChange={(q) => { setSearchQuery(q); setSelectedGroup(null); }}
            />
          </div>
        ) : (
          <>
            {/* ── Desktop: leaderboard + bubble chart + sidebar ── */}

            {/* Left leaderboard panel */}
            <div className="w-44 flex-shrink-0 hidden lg:block">
              <TopRatedLeaderboard
                brands={displayBrands}
                ratings={ratings}
                searchQuery={searchQuery}
                groupMode={groupMode}
                selectedGroup={selectedGroup}
              />
            </div>

            {/* Visualization */}
            <div className="flex-1 relative min-h-0">
              <BubbleChart
                brands={displayBrands}
                colorMode={colorMode}
                groupMode={groupMode}
                sizeMode={sizeMode}
                onBottleClick={(node) => {
                  if (!user) { setShowAuth(true); return; }
                  setSelectedBottle(node as unknown as BottleNode);
                }}
                ratings={ratings}
                searchQuery={searchQuery}
                distilleryColors={distilleryColors}
                selectedGroup={selectedGroup}
                onLabelClick={(key) => {
                  setSelectedGroup(key);
                  // Clear text search when a label filter is activated
                  if (key) setSearchQuery("");
                }}
              />

              {/* Submit a Bottle — top-right overlay */}
              <button
                onClick={() => { if (!user) { setShowAuth(true); return; } setShowSubmit(true); }}
                className="absolute top-4 right-4 z-10 px-3 py-1.5 rounded-sm text-xs font-medium transition-all"
                style={{
                  background: "rgba(244,238,224,0.92)",
                  border: "1px solid rgba(90,40,160,0.3)",
                  color: "rgba(90,40,160,0.75)",
                  backdropFilter: "blur(8px)",
                  fontFamily: "Georgia,serif",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(90,40,160,0.08)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(244,238,224,0.92)")}
              >
                + Submit a Bottle
              </button>

              {/* Availability toggle — bottom-left overlay */}
              <div
                className="absolute bottom-4 left-5 z-10 flex items-center gap-2"
              >
                <span
                  className="text-[9px] uppercase tracking-widest flex-shrink-0"
                  style={{ color: "rgba(13,11,8,0.35)", fontFamily: "Georgia,serif" }}
                >
                  Show
                </span>
                <div
                  className="flex rounded-sm overflow-hidden text-[11px]"
                  style={{
                    background: "rgba(244,238,224,0.92)",
                    border: "1px solid rgba(13,11,8,0.15)",
                    backdropFilter: "blur(8px)",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
                  }}
                >
                  {([{ label: "All", value: true }, { label: "Current", value: false }]).map(({ label, value }, i) => (
                    <button
                      key={label}
                      onClick={() => setShowDiscontinued(value)}
                      className="px-3 py-1 transition-colors"
                      style={{
                        background: showDiscontinued === value ? "rgba(13,11,8,0.1)" : "transparent",
                        color: showDiscontinued === value ? "#0d0b08" : "rgba(13,11,8,0.4)",
                        fontWeight: showDiscontinued === value ? "600" : "400",
                        borderRight: i === 0 ? "1px solid rgba(13,11,8,0.15)" : undefined,
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search — top-left overlay */}
              <div
                className="absolute top-4 left-5 z-10"
                style={{ width: "220px" }}
              >
                <div className="relative">
                  {/* Search icon */}
                  <svg
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    width="14" height="14" viewBox="0 0 16 16" fill="none"
                    style={{ color: searchQuery ? "rgba(13,11,8,0.6)" : "rgba(13,11,8,0.28)" }}
                  >
                    <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setSelectedGroup(null); }}
                    placeholder="Search bottles, brands…"
                    className="search-input w-full rounded-full pl-9 pr-9 py-2.5 text-sm outline-none"
                    style={{
                      background: "rgba(244,238,224,0.94)",
                      backdropFilter: "blur(12px)",
                      border: searchQuery
                        ? "1.5px solid rgba(13,11,8,0.4)"
                        : "1.5px solid rgba(13,11,8,0.18)",
                      color: "#0d0b08",
                      boxShadow: searchQuery
                        ? "0 0 0 3px rgba(13,11,8,0.05), 0 4px 16px rgba(0,0,0,0.1)"
                        : "0 4px 16px rgba(0,0,0,0.08)",
                    }}
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs leading-none"
                      style={{ color: "rgba(13,11,8,0.4)" }}
                    >✕</button>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <aside
              className="w-56 flex-shrink-0 p-4 flex flex-col gap-4 overflow-y-auto"
              style={{ borderLeft: "1px solid rgba(13,11,8,0.1)" }}
            >
          <GroupControl groupMode={groupMode} onChange={handleGroupModeChange} />

          {/* Size By */}
          <div
            className="rounded-sm p-3"
            style={{
              background: "rgba(244,238,224,0.92)",
              border: "1px solid rgba(0,0,0,0.14)",
            }}
          >
            <p
              className="text-xs uppercase tracking-widest mb-2"
              style={{ color: "rgba(13,11,8,0.45)", fontFamily: "Georgia,serif", letterSpacing: "0.13em" }}
            >
              Size By
            </p>
            <div
              className="flex rounded-sm overflow-hidden text-xs"
              style={{ border: "1px solid rgba(13,11,8,0.15)" }}
            >
              {(["price", "rating", "uniform"] as BubbleSizeMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setSizeMode(m)}
                  className="flex-1 py-1.5 transition-colors"
                  style={{
                    background: sizeMode === m ? "rgba(13,11,8,0.1)" : "transparent",
                    color: sizeMode === m ? "#0d0b08" : "rgba(13,11,8,0.4)",
                    fontWeight: sizeMode === m ? "600" : "400",
                    borderRight: m !== "uniform" ? "1px solid rgba(13,11,8,0.15)" : undefined,
                  }}
                >
                  {m === "price" ? "Price" : m === "rating" ? "Rating" : "Equal"}
                </button>
              ))}
            </div>
          </div>

          <ColorLegend
            colorMode={colorMode}
            onColorModeChange={setColorMode}
            distilleryColors={distilleryColors}
          />

          {/* Stats panel */}
          <div
            className="rounded-sm p-4"
            style={{
              background: "rgba(244,238,224,0.92)",
              border: "1px solid rgba(0,0,0,0.14)",
            }}
          >
            <p
              className="text-xs uppercase tracking-widest mb-3"
              style={{ color: "rgba(13,11,8,0.45)", fontFamily: "Georgia,serif", letterSpacing: "0.13em" }}
            >
              Collection
            </p>
            <div className="space-y-1.5 text-sm">
              {[
                ["Distilleries", WHISKEY_DATA.length],
                ["Sub-brands", viewStats.subBrands],
                ["Bottles", viewStats.bottles],
                ["Rated", Object.keys(ratings).length],
              ].map(([label, val]) => (
                <div key={String(label)} className="flex justify-between">
                  <span style={{ color: "rgba(13,11,8,0.45)" }}>{label}</span>
                  <span className="font-semibold" style={{ color: "#0d0b08" }}>{val}</span>
                </div>
              ))}
              {communityCount > 0 && (
                <div
                  className="flex justify-between pt-1"
                  style={{ borderTop: "1px solid rgba(90,40,160,0.15)" }}
                >
                  <span className="text-xs" style={{ color: "rgba(90,40,160,0.7)" }}>Community</span>
                  <span className="font-semibold text-xs" style={{ color: "rgba(90,40,160,0.7)" }}>+{communityCount}</span>
                </div>
              )}
            </div>
          </div>


          {/* Legend key */}
          <div className="space-y-1.5 px-1">
            <div className="flex items-center gap-2 text-xs" style={{ color: "rgba(13,11,8,0.45)" }}>
              <svg width="16" height="10" className="flex-shrink-0">
                <rect
                  x="0" y="0" width="16" height="10" rx="1"
                  fill="none" stroke="rgba(90,40,160,0.5)" strokeWidth="1.5" strokeDasharray="4,2"
                />
              </svg>
              <span>Community entry</span>
            </div>
            <div className="flex items-center gap-2 text-xs" style={{ color: "rgba(13,11,8,0.45)" }}>
              <span
                className="font-mono text-[9px] px-1 rounded-sm flex-shrink-0"
                style={{ background: "rgba(13,11,8,0.07)", color: "rgba(13,11,8,0.5)", border: "1px solid rgba(13,11,8,0.15)" }}
              >
                NDP
              </span>
              <span>Non-Distilling Producer</span>
            </div>
          </div>
        </aside>
          </>
        )}
      </div>

      {/* ── About strip — below the fold ────────────────────────────── */}
      <AboutSection
        distilleryCount={mergedBrands.length}
        bottleCount={mergedBrands.reduce((s, b) => s + b.subBrands.reduce((ss, sb) => ss + sb.bottles.length, 0), 0)}
        ratingCount={Object.keys(ratings).length}
        communityCount={communityCount}
      />

      {/* Footer */}
      <footer
        className="px-6 py-6 text-center text-xs"
        style={{
          borderTop: "1px solid rgba(13,11,8,0.1)",
          color: "rgba(13,11,8,0.3)",
          fontFamily: "Georgia,serif",
          fontStyle: "italic",
        }}
      >
        Common Cask · Community-driven American whiskey catalog · Suggestions welcome
      </footer>

      {/* Rating Modal */}
      {selectedBottle && selectedBottle.id && (
        <RatingModal
          bottle={{
            id: selectedBottle.id,
            name: selectedBottle.name,
            brandId: selectedBottle.brandId,
            brandName: selectedBottle.brandName,
            price: selectedBottle.price,
            abv: selectedBottle.abv,
            age: selectedBottle.age,
            rarity: selectedBottle.rarity,
            description: selectedBottle.description,
          }}
          onClose={() => setSelectedBottle(null)}
          onRatingSubmitted={loadData}
          onFlag={() => {
            if (selectedBottle?.id) setFlaggedBottle({ id: selectedBottle.id, name: selectedBottle.name });
            setSelectedBottle(null);
          }}
          userId={user?.id}
        />
      )}

      {/* Submission Modal */}
      {showSubmit && <SubmissionModal onClose={() => setShowSubmit(false)} userId={user?.id} />}

      {/* Auth Modal */}
      {showAuth && (
        <AuthModal
          onSuccess={() => { setShowAuth(false); }}
          onClose={() => setShowAuth(false)}
        />
      )}

      {/* Flag / Report Error Modal */}
      {flaggedBottle && (
        <FlagModal
          bottle={flaggedBottle}
          onClose={() => setFlaggedBottle(null)}
        />
      )}
    </main>
  );
}
