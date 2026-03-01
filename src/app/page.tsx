"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { WHISKEY_DATA, buildTreemapData } from "@/data/whiskeys";
import { fetchAllAverageRatings, fetchApprovedSubmissions, fetchCatalog } from "@/lib/supabase";
import { mergeApprovedSubmissions } from "@/lib/mergeSubmissions";
import { Brand, ColorMode } from "@/types/whiskey";
import ColorLegend from "@/components/ColorLegend";
import RatingModal from "@/components/RatingModal";
import SubmissionModal from "@/components/SubmissionModal";
import TopRatedSection from "@/components/TopRatedSection";
import AboutSection from "@/components/AboutSection";
import Logo from "@/components/Logo";

const WhiskeyTreemap = dynamic(() => import("@/components/WhiskeyTreemap"), { ssr: false });

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
  const [colorMode, setColorMode] = useState<ColorMode>("price");
  const [selectedBottle, setSelectedBottle] = useState<BottleNode | null>(null);
  const [showSubmit, setShowSubmit] = useState(false);
  const [ratings, setRatings] = useState<Record<string, { avg: number; count: number }>>({});
  const [mergedBrands, setMergedBrands] = useState<Brand[]>(WHISKEY_DATA);
  const [communityCount, setCommunityCount] = useState(0);

  // ── Filtering state ───────────────────────────────────────────────────────
  const [filterBrand, setFilterBrand] = useState<string | null>(null);
  const [filterSubBrand, setFilterSubBrand] = useState<string | null>(null);

  const handleBrandClick = useCallback((brandName: string) => {
    setFilterBrand(brandName);
    setFilterSubBrand(null);
  }, []);

  const handleSubBrandClick = useCallback((subBrandName: string, brandName: string) => {
    setFilterBrand(brandName);
    setFilterSubBrand(subBrandName);
  }, []);

  const clearFilter = useCallback(() => {
    setFilterBrand(null);
    setFilterSubBrand(null);
  }, []);

  const clearSubBrandFilter = useCallback(() => {
    setFilterSubBrand(null);
  }, []);

  // ── Derived display data ──────────────────────────────────────────────────
  const displayBrands = useMemo((): Brand[] => {
    if (!filterBrand) return mergedBrands;
    const brand = mergedBrands.find((b) => b.name === filterBrand);
    if (!brand) return mergedBrands;
    if (!filterSubBrand) return [brand];
    return [{ ...brand, subBrands: brand.subBrands.filter((sb) => sb.name === filterSubBrand) }];
  }, [mergedBrands, filterBrand, filterSubBrand]);

  const displayData = useMemo(() => buildTreemapData(displayBrands), [displayBrands]);

  // ── Stats for current view ────────────────────────────────────────────────
  const viewStats = useMemo(() => {
    const bottles = displayBrands.reduce(
      (s, b) => s + b.subBrands.reduce((ss, sb) => ss + sb.bottles.length, 0),
      0
    );
    const subBrands = displayBrands.reduce((s, b) => s + b.subBrands.length, 0);
    const distilleries = displayBrands.length;
    const activeBrand = filterBrand
      ? mergedBrands.find((b) => b.name === filterBrand)
      : null;
    return { bottles, subBrands, distilleries, activeBrand };
  }, [displayBrands, filterBrand, mergedBrands]);

  // ── Data loading ──────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      const [ratingsData, approvedSubs, catalogData] = await Promise.all([
        fetchAllAverageRatings(),
        fetchApprovedSubmissions(),
        fetchCatalog(),
      ]);
      setRatings(ratingsData);

      // Use Supabase catalog if available, otherwise fall back to static data
      const baseData = catalogData ?? WHISKEY_DATA;

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
    loadData();
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

        {/* Breadcrumb */}
        {filterBrand && (
          <div className="flex items-center gap-2 text-xs ml-2">
            <button
              onClick={clearFilter}
              className="transition-colors"
              style={{ color: "rgba(245,158,11,0.5)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#f59e0b")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(245,158,11,0.5)")}
            >
              ← All
            </button>
            <span style={{ color: "rgba(255,255,255,0.2)" }}>/</span>
            {filterSubBrand ? (
              <>
                <button
                  onClick={clearSubBrandFilter}
                  className="transition-colors"
                  style={{ color: "rgba(245,158,11,0.7)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#f59e0b")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(245,158,11,0.7)")}
                >
                  {filterBrand}
                </button>
                <span style={{ color: "rgba(255,255,255,0.2)" }}>/</span>
                <span style={{ color: "#f5f5f5" }}>{filterSubBrand}</span>
              </>
            ) : (
              <span style={{ color: "#f5f5f5" }}>{filterBrand}</span>
            )}
          </div>
        )}

        <div className="ml-auto text-xs text-gray-600 hidden md:block">
          {filterBrand ? "Click a sub-brand to drill in" : "Click any bottle to rate it"}
        </div>
      </header>

      {/* ── About / intro section at the top ───────────────────────── */}
      <AboutSection
        distilleryCount={mergedBrands.length}
        bottleCount={mergedBrands.reduce((s, b) => s + b.subBrands.reduce((ss, sb) => ss + sb.bottles.length, 0), 0)}
        ratingCount={Object.keys(ratings).length}
        communityCount={communityCount}
      />

      {/* Hero layout — fills viewport height */}
      <div className="flex" style={{ height: "100vh" }}>
        {/* Treemap */}
        <div className="flex-1 relative min-h-0">
          <WhiskeyTreemap
            data={displayData}
            colorMode={colorMode}
            onBottleClick={(node) => setSelectedBottle(node as BottleNode)}
            ratings={ratings}
            onBrandClick={handleBrandClick}
            onSubBrandClick={handleSubBrandClick}
          />
        </div>

        {/* Sidebar */}
        <aside
          className="w-56 flex-shrink-0 p-4 flex flex-col gap-4 overflow-y-auto"
          style={{ borderLeft: "1px solid rgba(245,158,11,0.15)" }}
        >
          <ColorLegend colorMode={colorMode} onColorModeChange={setColorMode} />

          {/* Stats / Filter panel */}
          <div
            className="rounded-xl p-4"
            style={{
              background: "rgba(10,10,20,0.85)",
              border: filterBrand
                ? "1px solid rgba(245,158,11,0.35)"
                : "1px solid rgba(245,158,11,0.15)",
            }}
          >
            {filterBrand ? (
              /* Filtered view */
              <>
                <div className="flex items-start justify-between mb-3 gap-1">
                  <p
                    className="text-xs font-bold leading-tight"
                    style={{ color: "#f59e0b" }}
                  >
                    {filterSubBrand ?? filterBrand}
                  </p>
                  <button
                    onClick={filterSubBrand ? clearSubBrandFilter : clearFilter}
                    className="text-gray-600 hover:text-gray-300 text-xs flex-shrink-0 transition-colors"
                    title="Clear filter"
                  >
                    ✕
                  </button>
                </div>

                {viewStats.activeBrand && (
                  <p className="text-xs text-gray-600 mb-3">
                    {viewStats.activeBrand.region}
                    {viewStats.activeBrand.isNDP && (
                      <span
                        className="ml-2 font-bold text-[10px] px-1 rounded"
                        style={{ background: "rgba(245,158,11,0.12)", color: "rgba(245,158,11,0.6)" }}
                      >
                        NDP
                      </span>
                    )}
                  </p>
                )}

                <div className="space-y-1.5 text-sm">
                  {!filterSubBrand && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Sub-brands</span>
                      <span className="text-amber-400 font-semibold">{viewStats.subBrands}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-500">Bottles</span>
                    <span className="text-amber-400 font-semibold">{viewStats.bottles}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Rated</span>
                    <span className="text-amber-400 font-semibold">
                      {Object.keys(ratings).length}
                    </span>
                  </div>
                </div>

                <button
                  onClick={clearFilter}
                  className="mt-3 w-full py-1.5 rounded-lg text-xs transition-colors"
                  style={{
                    border: "1px solid rgba(245,158,11,0.2)",
                    color: "rgba(245,158,11,0.6)",
                    background: "transparent",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(245,158,11,0.08)";
                    e.currentTarget.style.color = "#f59e0b";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "rgba(245,158,11,0.6)";
                  }}
                >
                  ← All Distilleries
                </button>
              </>
            ) : (
              /* Full collection view */
              <>
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
              </>
            )}
          </div>

          {/* Regions (only in full view) */}
          {!filterBrand && (
            <div
              className="rounded-xl p-4"
              style={{
                background: "rgba(10,10,20,0.85)",
                border: "1px solid rgba(245,158,11,0.15)",
              }}
            >
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Regions
              </p>
              <div className="space-y-1 text-xs text-gray-400">
                {[...new Set(WHISKEY_DATA.map((b) => b.region))].map((r) => (
                  <div key={r}>{r}</div>
                ))}
              </div>
            </div>
          )}

          {/* Hint */}
          <div
            className="rounded-xl p-3 text-xs text-gray-600"
            style={{ border: "1px solid rgba(255,255,255,0.05)" }}
          >
            <p className="font-semibold text-gray-500 mb-1">How to use</p>
            <p>
              {filterSubBrand
                ? "Click any bottle to rate it."
                : filterBrand
                ? "Click a sub-brand label to drill in, or a bottle to rate it."
                : "Click a brand label to filter. Click a bottle to rate it. Switch color modes to explore."}
            </p>
          </div>

          {/* Community submission CTA */}
          <button
            onClick={() => setShowSubmit(true)}
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

      {/* ── Scrollable sections below the treemap hero ───────────────── */}

      <TopRatedSection brands={mergedBrands} ratings={ratings} />

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
        />
      )}

      {/* Submission Modal */}
      {showSubmit && <SubmissionModal onClose={() => setShowSubmit(false)} />}
    </main>
  );
}
