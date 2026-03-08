"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
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
import TopRatedSection from "@/components/TopRatedSection";
import AboutSection from "@/components/AboutSection";
import Logo from "@/components/Logo";

const BubbleChart = dynamic(() => import("@/components/BubbleChart"), { ssr: false });

interface BottleNode {
  id?: string;
  name: string;
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
      // then append any static brands not yet in the Supabase catalog so that
      // new entries in whiskeys.ts always appear in the chart.
      const baseData = (() => {
        if (!catalogData) return WHISKEY_DATA;
        const enriched = enrichCatalogStyles(catalogData);
        const catalogIds = new Set(enriched.map((b) => b.id));
        const staticOnly = WHISKEY_DATA.filter((b) => !catalogIds.has(b.id));
        return [...enriched, ...staticOnly];
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
      style={{
        background: "linear-gradient(160deg, #0a0608 0%, #0f0a18 50%, #080a0f 100%)",
        color: "#f5f5f5",
      }}
    >
      {/* Header — sticky so it stays visible when scrolling into sections */}
      <header
        className="sticky top-0 z-40 px-6 py-3 flex items-center gap-4 flex-shrink-0"
        style={{
          borderBottom: "1px solid rgba(245,158,11,0.2)",
          background: "rgba(10,6,8,0.92)",
          backdropFilter: "blur(8px)",
        }}
      >
        <Logo />
        <span className="text-xs hidden md:block" style={{ color: "rgba(245,158,11,0.4)" }}>
          Common Cask — Explore &amp; Rate
        </span>

        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-gray-600 hidden md:block">
            Click any bottle to rate it
          </span>

          {/* Auth control */}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setShowUserMenu((v) => !v)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all"
                style={{
                  background: (profile?.avatarUrl ?? user.user_metadata?.avatar_url) ? "transparent" : "rgba(245,158,11,0.2)",
                  border: "1px solid rgba(245,158,11,0.4)",
                  color: "#f59e0b",
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
                  className="absolute right-0 top-10 w-44 rounded-xl py-2 z-50"
                  style={{
                    background: "#0d0d18",
                    border: "1px solid rgba(245,158,11,0.2)",
                    boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
                  }}
                >
                  <div className="px-4 py-2 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                    <p className="text-xs font-semibold text-white truncate">
                      {profile?.displayName ?? user.email}
                    </p>
                    {profile?.displayName && (
                      <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.3)" }}>{user.email}</p>
                    )}
                  </div>
                  <button
                    onClick={() => { setShowUserMenu(false); setShowAuth(true); }}
                    className="w-full text-left px-4 py-2 text-sm transition-colors"
                    style={{ color: "rgba(255,255,255,0.55)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.55)")}
                  >
                    Edit Profile
                  </button>
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      // Clear local state immediately so the UI reacts instantly,
                      // then fire the network sign-out in the background.
                      setUser(null);
                      setProfile(null);
                      signOut().catch(() => {});
                    }}
                    className="w-full text-left px-4 py-2 text-sm transition-colors"
                    style={{ color: "rgba(239,68,68,0.7)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(239,68,68,1)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(239,68,68,0.7)")}
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setShowAuth(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                border: "1px solid rgba(245,158,11,0.4)",
                color: "rgba(245,158,11,0.85)",
                background: "transparent",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(245,158,11,0.08)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      {/* Hero layout — fills viewport height, first thing user sees */}
      <div className="flex" style={{ height: "calc(100vh - 49px)" }}>
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

          {/* Search — centered overlay at top of chart */}
          <div
            className="absolute top-5 left-1/2 -translate-x-1/2 z-10"
            style={{ width: "min(480px, 70%)" }}
          >
            <div className="relative">
              {/* Search icon */}
              <svg
                className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                width="14" height="14" viewBox="0 0 16 16" fill="none"
                style={{ color: searchQuery ? "rgba(245,158,11,0.7)" : "rgba(255,255,255,0.25)" }}
              >
                <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setSelectedGroup(null); }}
                placeholder="Search bottles, brands, styles…"
                className="search-input w-full rounded-full pl-9 pr-9 py-2.5 text-sm outline-none"
                style={{
                  background: "rgba(8,8,16,0.82)",
                  backdropFilter: "blur(12px)",
                  border: searchQuery
                    ? "1.5px solid rgba(245,158,11,0.7)"
                    : "1.5px solid rgba(245,158,11,0.35)",
                  color: "#f5f5f5",
                  boxShadow: searchQuery
                    ? "0 0 0 3px rgba(245,158,11,0.08), 0 4px 20px rgba(0,0,0,0.5)"
                    : "0 4px 20px rgba(0,0,0,0.4)",
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs leading-none"
                  style={{ color: "rgba(255,255,255,0.4)" }}
                >✕</button>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <aside
          className="w-56 flex-shrink-0 p-4 flex flex-col gap-4 overflow-y-auto"
          style={{ borderLeft: "1px solid rgba(245,158,11,0.15)" }}
        >
          <GroupControl groupMode={groupMode} onChange={handleGroupModeChange} />

          {/* Size By */}
          <div
            className="rounded-xl p-3"
            style={{
              background: "rgba(10,10,20,0.85)",
              border: "1px solid rgba(245,158,11,0.15)",
            }}
          >
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Size By
            </p>
            <div
              className="flex rounded-lg overflow-hidden text-xs"
              style={{ border: "1px solid rgba(245,158,11,0.2)" }}
            >
              {(["price", "rating", "uniform"] as BubbleSizeMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setSizeMode(m)}
                  className="flex-1 py-1.5 transition-colors"
                  style={{
                    background: sizeMode === m ? "rgba(245,158,11,0.18)" : "transparent",
                    color: sizeMode === m ? "#f59e0b" : "rgba(255,255,255,0.35)",
                    fontWeight: sizeMode === m ? "600" : "400",
                    borderRight: m !== "uniform" ? "1px solid rgba(245,158,11,0.2)" : undefined,
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
            className="rounded-xl p-4"
            style={{
              background: "rgba(10,10,20,0.85)",
              border: "1px solid rgba(245,158,11,0.15)",
            }}
          >
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
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
                  <span className="text-gray-500">{label}</span>
                  <span className="text-amber-400 font-semibold">{val}</span>
                </div>
              ))}
              {communityCount > 0 && (
                <div
                  className="flex justify-between pt-1"
                  style={{ borderTop: "1px solid rgba(139,92,246,0.2)" }}
                >
                  <span className="text-purple-400 text-xs">Community</span>
                  <span className="text-purple-400 font-semibold text-xs">+{communityCount}</span>
                </div>
              )}
            </div>
          </div>


          {/* Availability filter */}
          <div
            className="rounded-xl p-3"
            style={{ background: "rgba(10,10,20,0.85)", border: "1px solid rgba(245,158,11,0.15)" }}
          >
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Availability
            </p>
            <div className="flex rounded-lg overflow-hidden text-xs" style={{ border: "1px solid rgba(245,158,11,0.2)" }}>
              {[
                { label: "All", value: true },
                { label: "Current", value: false },
              ].map(({ label, value }) => (
                <button
                  key={label}
                  onClick={() => setShowDiscontinued(value)}
                  className="flex-1 py-1.5 transition-colors"
                  style={{
                    background: showDiscontinued === value ? "rgba(245,158,11,0.18)" : "transparent",
                    color: showDiscontinued === value ? "#f59e0b" : "rgba(255,255,255,0.35)",
                    fontWeight: showDiscontinued === value ? "600" : "400",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.25)" }}>
              {showDiscontinued ? "Includes discontinued bottles" : "Hiding discontinued bottles"}
            </p>
          </div>

          {/* Community submission CTA */}
          <button
            onClick={() => { if (!user) { setShowAuth(true); return; } setShowSubmit(true); }}
            className="w-full py-2.5 px-3 rounded-xl text-sm font-semibold transition-all"
            style={{
              border: "1px solid rgba(139,92,246,0.5)",
              background: "rgba(139,92,246,0.08)",
              color: "rgba(196,181,253,0.9)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(139,92,246,0.18)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(139,92,246,0.08)")}
          >
            + Submit a Bottle
          </button>

          {/* Top Rated — compact sidebar panel */}
          <TopRatedSection brands={mergedBrands} ratings={ratings} panel />

          {/* Legend key */}
          <div className="space-y-1.5 px-1">
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <svg width="16" height="10">
                <rect
                  x="0" y="0" width="16" height="10" rx="2"
                  fill="none" stroke="rgba(139,92,246,0.7)" strokeWidth="1.5" strokeDasharray="4,2"
                />
              </svg>
              <span>Community entry</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <span
                className="font-bold text-[10px] px-1 rounded"
                style={{ background: "rgba(245,158,11,0.15)", color: "rgba(245,158,11,0.7)" }}
              >
                NDP
              </span>
              <span>Non-Distilling Producer</span>
            </div>
          </div>
        </aside>
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
          borderTop: "1px solid rgba(245,158,11,0.08)",
          color: "rgba(255,255,255,0.18)",
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
