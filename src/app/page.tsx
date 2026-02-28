"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { WHISKEY_DATA, buildTreemapData } from "@/data/whiskeys";
import { fetchAllAverageRatings, fetchApprovedSubmissions } from "@/lib/supabase";
import { mergeApprovedSubmissions } from "@/lib/mergeSubmissions";
import { ColorMode } from "@/types/whiskey";
import ColorLegend from "@/components/ColorLegend";
import RatingModal from "@/components/RatingModal";
import SubmissionModal from "@/components/SubmissionModal";
import Logo from "@/components/Logo";

// D3 must render client-side only
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
  const [mergedData, setMergedData] = useState(() => buildTreemapData(WHISKEY_DATA));
  const [communityCount, setCommunityCount] = useState(0);

  const loadData = useCallback(async () => {
    try {
      const [ratingsData, approvedSubs] = await Promise.all([
        fetchAllAverageRatings(),
        fetchApprovedSubmissions(),
      ]);
      setRatings(ratingsData);
      if (approvedSubs.length > 0) {
        const merged = mergeApprovedSubmissions(WHISKEY_DATA, approvedSubs);
        setMergedData(buildTreemapData(merged));
        const count = approvedSubs.filter((s) => s.type === "bottle").length;
        setCommunityCount(count);
      }
    } catch {
      // Gracefully degrade without Supabase
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const bottleCount = WHISKEY_DATA.reduce(
    (s, b) => s + b.subBrands.reduce((ss, sb) => ss + sb.bottles.length, 0),
    0
  );
  const subBrandCount = WHISKEY_DATA.reduce((s, b) => s + b.subBrands.length, 0);

  return (
    <main
      className="flex flex-col min-h-screen"
      style={{
        background: "linear-gradient(160deg, #0a0608 0%, #0f0a18 50%, #080a0f 100%)",
        color: "#f5f5f5",
      }}
    >
      {/* Header */}
      <header
        className="px-6 py-3 flex items-center gap-4 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(245,158,11,0.2)" }}
      >
        <Logo />
        <span className="text-xs hidden md:block" style={{ color: "rgba(245,158,11,0.4)" }}>
          American Whiskey — Explore &amp; Rate
        </span>
        <div className="ml-auto text-xs text-gray-600 hidden md:block">
          Click any bottle to rate it
        </div>
      </header>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Treemap */}
        <div
          className="flex-1 relative min-h-0"
          style={{ minHeight: "calc(100vh - 56px)" }}
        >
          <WhiskeyTreemap
            data={mergedData}
            colorMode={colorMode}
            onBottleClick={(node) => setSelectedBottle(node as BottleNode)}
            ratings={ratings}
          />
        </div>

        {/* Sidebar */}
        <aside
          className="w-56 flex-shrink-0 p-4 flex flex-col gap-4 overflow-y-auto"
          style={{ borderLeft: "1px solid rgba(245,158,11,0.15)" }}
        >
          <ColorLegend colorMode={colorMode} onColorModeChange={setColorMode} />

          {/* Stats */}
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
                ["Sub-brands", subBrandCount],
                ["Bottles", bottleCount],
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

          {/* Regions */}
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

          {/* Hint */}
          <div
            className="rounded-xl p-3 text-xs text-gray-600"
            style={{ border: "1px solid rgba(255,255,255,0.05)" }}
          >
            <p className="font-semibold text-gray-500 mb-1">How to use</p>
            <p>
              Hover a bottle for details. Click to rate with tasting notes. Switch color modes to
              explore by price, community rating, or rarity.
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
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(139,92,246,0.18)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(139,92,246,0.08)";
            }}
          >
            + Submit a Bottle
          </button>

          {/* Legend key */}
          <div className="space-y-1.5 px-1">
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <svg width="16" height="10">
                <rect x="0" y="0" width="16" height="10" rx="2" fill="none"
                  stroke="rgba(139,92,246,0.7)" strokeWidth="1.5" strokeDasharray="4,2" />
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
