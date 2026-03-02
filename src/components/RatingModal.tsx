"use client";

import { useState, useEffect } from "react";
import { submitRating, fetchBottleRatings } from "@/lib/supabase";
import { getSessionId } from "@/lib/session";

interface BottleInfo {
  id: string;
  name: string;
  price?: number;
  abv?: number;
  age?: number;
  rarity?: string;
  description?: string;
}

interface Props {
  bottle: BottleInfo | null;
  onClose: () => void;
  onRatingSubmitted: () => void;
  userId?: string;
}

interface ReviewEntry {
  rating: number;
  nose: string | null;
  palate: string | null;
  finish: string | null;
  created_at: string;
}

const STARS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export default function RatingModal({ bottle, onClose, onRatingSubmitted, userId }: Props) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [nose, setNose] = useState("");
  const [palate, setPalate] = useState("");
  const [finish, setFinish] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [reviews, setReviews] = useState<ReviewEntry[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);

  useEffect(() => {
    if (!bottle) return;
    setRating(0);
    setHovered(0);
    setNose("");
    setPalate("");
    setFinish("");
    setSubmitted(false);
    setError(null);
    setLoadingReviews(true);

    fetchBottleRatings(bottle.id)
      .then((data) => setReviews(data as ReviewEntry[]))
      .catch(() => setReviews([]))
      .finally(() => setLoadingReviews(false));
  }, [bottle]);

  if (!bottle) return null;

  const avgRating =
    reviews.length > 0
      ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
      : null;

  async function handleSubmit() {
    if (rating === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitRating({
        bottleId: bottle!.id,
        rating,
        nose: nose || undefined,
        palate: palate || undefined,
        finish: finish || undefined,
        sessionId: getSessionId(),
        userId,
      });
      setSubmitted(true);
      onRatingSubmitted();
      // Refresh reviews
      fetchBottleRatings(bottle!.id)
        .then((data) => setReviews(data as ReviewEntry[]))
        .catch(() => {});
    } catch (e) {
      setError("Failed to submit rating. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const rarityColors: Record<string, string> = {
    common: "bg-gray-600 text-gray-200",
    limited: "bg-yellow-700 text-yellow-100",
    rare: "bg-orange-700 text-orange-100",
    allocated: "bg-red-800 text-red-100",
    unicorn: "bg-purple-800 text-purple-100",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-xl overflow-y-auto max-h-[90vh]"
        style={{
          background: "linear-gradient(135deg, #1a1209 0%, #0f0f1a 100%)",
          border: "1px solid rgba(245,158,11,0.4)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4" style={{ borderBottom: "1px solid rgba(245,158,11,0.2)" }}>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
          <h2 className="text-lg font-bold text-amber-400 pr-8 leading-tight">{bottle.name}</h2>
          <div className="flex flex-wrap gap-2 mt-2 text-sm">
            {bottle.price !== undefined && (
              <span className="text-gray-300">💰 ${bottle.price.toLocaleString()}</span>
            )}
            {bottle.abv !== undefined && (
              <span className="text-gray-300">🔥 {bottle.abv}% ABV</span>
            )}
            {bottle.age !== undefined && (
              <span className="text-gray-300">⏳ {bottle.age} Year</span>
            )}
            {bottle.rarity && (
              <span
                className={`px-2 py-0.5 rounded text-xs font-semibold ${
                  rarityColors[bottle.rarity] ?? "bg-gray-700 text-gray-300"
                }`}
              >
                {bottle.rarity.charAt(0).toUpperCase() + bottle.rarity.slice(1)}
              </span>
            )}
          </div>
          {bottle.description && (
            <p className="mt-2 text-xs text-gray-400 italic">{bottle.description}</p>
          )}
          {avgRating !== null && (
            <p className="mt-2 text-sm text-amber-300 font-semibold">
              ★ {avgRating} / 10 &nbsp;·&nbsp; {reviews.length} review{reviews.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        {/* Rating form */}
        <div className="px-6 py-4">
          {submitted ? (
            <div className="text-center py-4">
              <div className="text-4xl mb-2">🥃</div>
              <p className="text-amber-400 font-semibold text-lg">Rating submitted!</p>
              <p className="text-gray-400 text-sm mt-1">
                You rated this <span className="text-white font-bold">{rating}/10</span>
              </p>
              <button
                onClick={() => setSubmitted(false)}
                className="mt-4 text-xs text-gray-500 underline hover:text-gray-300"
              >
                Edit my rating
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-400 mb-3">Rate this bottle (1–10):</p>

              {/* Star-like numeric rating */}
              <div className="flex gap-1 mb-4">
                {STARS.map((n) => (
                  <button
                    key={n}
                    className={`w-8 h-8 rounded text-sm font-bold transition-all ${
                      n <= (hovered || rating)
                        ? "bg-amber-500 text-black"
                        : "bg-gray-800 text-gray-500 hover:bg-gray-700"
                    }`}
                    onMouseEnter={() => setHovered(n)}
                    onMouseLeave={() => setHovered(0)}
                    onClick={() => setRating(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>

              {/* Optional tasting notes */}
              <div className="space-y-2">
                {[
                  { label: "Nose", value: nose, setter: setNose },
                  { label: "Palate", value: palate, setter: setPalate },
                  { label: "Finish", value: finish, setter: setFinish },
                ].map(({ label, value, setter }) => (
                  <div key={label}>
                    <label className="block text-xs text-gray-500 mb-1">{label} (optional)</label>
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => setter(e.target.value)}
                      placeholder={`Describe the ${label.toLowerCase()}…`}
                      className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                ))}
              </div>

              {error && <p className="mt-2 text-red-400 text-xs">{error}</p>}

              <button
                onClick={handleSubmit}
                disabled={rating === 0 || submitting}
                className={`mt-4 w-full py-2 rounded font-semibold text-sm transition-all ${
                  rating === 0 || submitting
                    ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                    : "bg-amber-500 hover:bg-amber-400 text-black"
                }`}
              >
                {submitting ? "Submitting…" : "Submit Rating"}
              </button>
            </>
          )}
        </div>

        {/* Community reviews */}
        {reviews.length > 0 && (
          <div className="px-6 pb-6">
            <h3
              className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3"
              style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "12px" }}
            >
              Community Reviews
            </h3>
            {loadingReviews ? (
              <p className="text-gray-600 text-sm">Loading…</p>
            ) : (
              <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                {reviews.map((r, i) => (
                  <div key={i} className="bg-gray-900 rounded p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-amber-400 font-bold text-sm">★ {r.rating}/10</span>
                      <span className="text-gray-600 text-xs">
                        {new Date(r.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {r.nose && (
                      <p className="text-xs text-gray-400">
                        <span className="text-gray-500">Nose:</span> {r.nose}
                      </p>
                    )}
                    {r.palate && (
                      <p className="text-xs text-gray-400">
                        <span className="text-gray-500">Palate:</span> {r.palate}
                      </p>
                    )}
                    {r.finish && (
                      <p className="text-xs text-gray-400">
                        <span className="text-gray-500">Finish:</span> {r.finish}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
