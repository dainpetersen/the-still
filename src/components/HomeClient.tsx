"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { WHISKEY_DATA } from "@/data/whiskeys";
import {
  fetchAllAverageRatings,
  fetchApprovedSubmissions,
  fetchCatalog,
  getAuthClient,
  fetchProfile,
  signOut,
} from "@/lib/supabase";
import { mergeApprovedSubmissions } from "@/lib/mergeSubmissions";
import { mergeCatalog } from "@/lib/mergeCatalog";
import { buildDistilleryColors } from "@/lib/distilleryColors";
import { Brand, ColorMode, GroupMode, BubbleSizeMode, Profile } from "@/types/whiskey";

import ColorLegend from "@/components/ColorLegend";
import GroupControl from "@/components/GroupControl";
import RatingModal from "@/components/RatingModal";
import SubmissionModal from "@/components/SubmissionModal";
import AuthModal from "@/components/AuthModal";
import FlagModal from "@/components/FlagModal";
import TopRatedLeaderboard from "@/components/TopRatedLeaderboard";
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

export default function HomeClient({ children }: { children?: React.ReactNode }) {
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

  // ── Deep link: /?q=eagle+rare opens the explorer already filtered ─────────
  // (bottle pages link here so "Rate it in the Explorer" lands on the bottle).
  useEffect(() => {
    // The URL can only be read after hydration (the server render has no
    // query string to work from), so this has to be an effect.
    const q = new URLSearchParams(window.location.search).get("q");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (q) setSearchQuery(q.slice(0, 80));
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

      // Supabase catalog merged with the static catalog — see mergeCatalog().
      const baseData = mergeCatalog(catalogData);

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
                ["Distilleries", viewStats.distilleries],
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

      {/* Server-rendered catalog directory + footer (crawlable) */}
      {children}

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
