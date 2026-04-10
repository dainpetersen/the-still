"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { submitRating, fetchBottleRatings } from "@/lib/supabase";
import { getSessionId } from "@/lib/session";

interface BottleInfo {
  id: string;
  name: string;
  brandId?: string;
  brandName?: string;
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
  onFlag?: () => void;
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

const RARITY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  common:    { bg: "rgba(13,11,8,0.05)",   text: "rgba(13,11,8,0.55)",  border: "rgba(13,11,8,0.15)" },
  limited:   { bg: "rgba(180,120,0,0.08)", text: "rgba(140,90,0,0.9)",  border: "rgba(180,120,0,0.25)" },
  rare:      { bg: "rgba(160,60,0,0.08)",  text: "rgba(130,50,0,0.9)",  border: "rgba(160,60,0,0.25)" },
  allocated: { bg: "rgba(139,21,21,0.08)", text: "#8b1515",             border: "rgba(139,21,21,0.25)" },
  unicorn:   { bg: "rgba(90,40,160,0.08)", text: "rgba(90,40,160,0.9)", border: "rgba(90,40,160,0.25)" },
};

export default function RatingModal({ bottle, onClose, onRatingSubmitted, onFlag, userId }: Props) {
  const [rating, setRating]       = useState(0);
  const [hovered, setHovered]     = useState(0);
  const [nose, setNose]           = useState("");
  const [palate, setPalate]       = useState("");
  const [finish, setFinish]       = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [reviews, setReviews]     = useState<ReviewEntry[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);

  useEffect(() => {
    if (!bottle) return;
    setRating(0); setHovered(0);
    setNose(""); setPalate(""); setFinish("");
    setSubmitted(false); setError(null);
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
      fetchBottleRatings(bottle!.id)
        .then((data) => setReviews(data as ReviewEntry[]))
        .catch(() => {});
    } catch {
      setError("Failed to submit rating. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const rarityStyle = bottle.rarity
    ? (RARITY_STYLES[bottle.rarity] ?? RARITY_STYLES.common)
    : null;

  const active = hovered || rating;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(13,11,8,0.45)", backdropFilter: "blur(3px)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-sm overflow-y-auto max-h-[90vh]"
        style={{
          background: "#f4eed8",
          border: "1px solid rgba(13,11,8,0.18)",
          boxShadow: "0 8px 40px rgba(0,0,0,0.22)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-6 pt-6 pb-4"
          style={{ borderBottom: "1px solid rgba(13,11,8,0.1)" }}
        >
          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-4 right-5 text-xl leading-none transition-opacity hover:opacity-60"
            style={{ color: "rgba(13,11,8,0.4)" }}
          >
            ×
          </button>

          {/* Bottle name */}
          <h2
            className="text-xl pr-8 leading-tight"
            style={{
              fontFamily: "Georgia,serif",
              fontWeight: 400,
              color: "#0d0b08",
            }}
          >
            {bottle.name}
          </h2>

          {/* Distillery link */}
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {bottle.brandId && (
              <Link
                href={`/brands/${bottle.brandId}`}
                className="text-xs transition-colors"
                style={{ color: "#8b1515", fontFamily: "Georgia,serif", fontStyle: "italic" }}
                onClick={onClose}
              >
                {bottle.brandName ?? "View distillery"} →
              </Link>
            )}
            {onFlag && (
              <button
                onClick={() => { onClose(); onFlag?.(); }}
                className="text-xs transition-opacity hover:opacity-70"
                style={{ color: "rgba(13,11,8,0.35)" }}
                title="Report incorrect information"
              >
                ⚑ Report error
              </button>
            )}
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap gap-2 mt-3">
            {bottle.price !== undefined && (
              <span
                className="text-xs font-mono px-2 py-0.5 rounded-sm"
                style={{ background: "rgba(13,11,8,0.06)", color: "rgba(13,11,8,0.7)", border: "1px solid rgba(13,11,8,0.1)" }}
              >
                ${bottle.price.toLocaleString()}
              </span>
            )}
            {bottle.abv !== undefined && (
              <span
                className="text-xs font-mono px-2 py-0.5 rounded-sm"
                style={{ background: "rgba(13,11,8,0.06)", color: "rgba(13,11,8,0.7)", border: "1px solid rgba(13,11,8,0.1)" }}
              >
                {bottle.abv}% ABV
              </span>
            )}
            {bottle.age !== undefined && (
              <span
                className="text-xs font-mono px-2 py-0.5 rounded-sm"
                style={{ background: "rgba(13,11,8,0.06)", color: "rgba(13,11,8,0.7)", border: "1px solid rgba(13,11,8,0.1)" }}
              >
                {bottle.age} yr
              </span>
            )}
            {bottle.rarity && rarityStyle && (
              <span
                className="text-xs font-mono px-2 py-0.5 rounded-sm capitalize"
                style={{
                  background: rarityStyle.bg,
                  color: rarityStyle.text,
                  border: `1px solid ${rarityStyle.border}`,
                }}
              >
                {bottle.rarity}
              </span>
            )}
          </div>

          {/* Description */}
          {bottle.description && (
            <p
              className="mt-2 text-xs leading-relaxed"
              style={{ color: "rgba(13,11,8,0.5)", fontFamily: "Georgia,serif", fontStyle: "italic" }}
            >
              {bottle.description}
            </p>
          )}

          {/* Community average */}
          {avgRating !== null && (
            <p
              className="mt-2 text-sm font-semibold"
              style={{ color: "#8b1515", fontFamily: "Georgia,serif" }}
            >
              ★ {avgRating} / 10
              <span
                className="font-normal ml-1.5"
                style={{ color: "rgba(13,11,8,0.4)", fontSize: "11px" }}
              >
                {reviews.length} review{reviews.length !== 1 ? "s" : ""}
              </span>
            </p>
          )}
        </div>

        {/* Rating form */}
        <div className="px-6 py-5">
          {submitted ? (
            <div className="text-center py-4">
              <div className="text-3xl mb-3">🥃</div>
              <p
                className="font-semibold text-lg"
                style={{ fontFamily: "Georgia,serif", color: "#0d0b08" }}
              >
                Rating submitted
              </p>
              <p className="text-sm mt-1" style={{ color: "rgba(13,11,8,0.5)" }}>
                You rated this{" "}
                <span style={{ fontWeight: 700, color: "#8b1515" }}>{rating}/10</span>
              </p>
              <button
                onClick={() => setSubmitted(false)}
                className="mt-4 text-xs underline transition-opacity hover:opacity-60"
                style={{ color: "rgba(13,11,8,0.4)" }}
              >
                Edit my rating
              </button>
            </div>
          ) : (
            <>
              <p
                className="text-xs mb-3 uppercase tracking-widest"
                style={{ color: "rgba(13,11,8,0.4)", fontFamily: "Georgia,serif", letterSpacing: "0.13em" }}
              >
                Your Rating
              </p>

              {/* 1–10 rating buttons */}
              <div className="flex gap-1 mb-5">
                {STARS.map((n) => {
                  const isActive = n <= active;
                  const isSelected = n === rating;
                  return (
                    <button
                      key={n}
                      className="flex-1 h-8 rounded-sm text-sm font-bold transition-all"
                      style={{
                        background: isActive ? "rgba(139,21,21,0.1)" : "rgba(13,11,8,0.04)",
                        border: isActive
                          ? `1px solid ${isSelected ? "#8b1515" : "rgba(139,21,21,0.4)"}`
                          : "1px solid rgba(13,11,8,0.12)",
                        color: isActive ? "#8b1515" : "rgba(13,11,8,0.35)",
                      }}
                      onMouseEnter={() => setHovered(n)}
                      onMouseLeave={() => setHovered(0)}
                      onClick={() => setRating(n)}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>

              {/* Tasting notes */}
              <div className="space-y-3">
                {[
                  { label: "Nose", value: nose, setter: setNose },
                  { label: "Palate", value: palate, setter: setPalate },
                  { label: "Finish", value: finish, setter: setFinish },
                ].map(({ label, value, setter }) => (
                  <div key={label}>
                    <label
                      className="block text-xs mb-1"
                      style={{ color: "rgba(13,11,8,0.45)", fontFamily: "Georgia,serif" }}
                    >
                      {label}{" "}
                      <span style={{ color: "rgba(13,11,8,0.28)" }}>(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => setter(e.target.value)}
                      placeholder={`Describe the ${label.toLowerCase()}…`}
                      className="w-full rounded-sm px-3 py-1.5 text-sm outline-none transition-all"
                      style={{
                        background: "rgba(255,255,255,0.6)",
                        border: "1px solid rgba(13,11,8,0.15)",
                        color: "#0d0b08",
                      }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(13,11,8,0.4)")}
                      onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(13,11,8,0.15)")}
                    />
                  </div>
                ))}
              </div>

              {error && (
                <p className="mt-3 text-xs" style={{ color: "#8b1515" }}>{error}</p>
              )}

              <button
                onClick={handleSubmit}
                disabled={rating === 0 || submitting}
                className="mt-5 w-full py-2 rounded-sm text-sm font-semibold transition-all"
                style={
                  rating === 0 || submitting
                    ? { background: "rgba(13,11,8,0.07)", color: "rgba(13,11,8,0.3)", cursor: "not-allowed" }
                    : { background: "#0d0b08", color: "#f4eed8", cursor: "pointer" }
                }
              >
                {submitting ? "Submitting…" : "Submit Rating"}
              </button>
            </>
          )}
        </div>

        {/* Community reviews */}
        {reviews.length > 0 && (
          <div
            className="px-6 pb-6"
            style={{ borderTop: "1px solid rgba(13,11,8,0.08)" }}
          >
            <p
              className="text-xs uppercase tracking-widest pt-4 mb-3"
              style={{ color: "rgba(13,11,8,0.35)", fontFamily: "Georgia,serif", letterSpacing: "0.13em" }}
            >
              Community Reviews
            </p>
            {loadingReviews ? (
              <p className="text-sm" style={{ color: "rgba(13,11,8,0.35)" }}>Loading…</p>
            ) : (
              <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
                {reviews.map((r, i) => (
                  <div
                    key={i}
                    className="rounded-sm p-3"
                    style={{
                      background: "rgba(13,11,8,0.03)",
                      border: "1px solid rgba(13,11,8,0.08)",
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className="font-semibold text-sm"
                        style={{ color: "#8b1515", fontFamily: "Georgia,serif" }}
                      >
                        ★ {r.rating}/10
                      </span>
                      <span
                        className="text-xs"
                        style={{ color: "rgba(13,11,8,0.3)" }}
                      >
                        {new Date(r.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                      </span>
                    </div>
                    {[
                      { key: "nose",   val: r.nose },
                      { key: "palate", val: r.palate },
                      { key: "finish", val: r.finish },
                    ].filter(({ val }) => val).map(({ key, val }) => (
                      <p key={key} className="text-xs leading-relaxed">
                        <span
                          className="capitalize"
                          style={{ color: "rgba(13,11,8,0.4)", fontFamily: "Georgia,serif", fontStyle: "italic" }}
                        >
                          {key}:{" "}
                        </span>
                        <span style={{ color: "rgba(13,11,8,0.7)" }}>{val}</span>
                      </p>
                    ))}
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
