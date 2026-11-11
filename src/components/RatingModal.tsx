"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { submitRating, fetchBottleRatings } from "@/lib/supabase";
import { getSessionId } from "@/lib/session";
import { MIN_RATINGS_TO_RANK } from "@/lib/ratings";

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
  /** Signed-in user, if any. Anyone can read the panel; rating needs an account. */
  userId?: string;
  /** Ask the visitor to sign in (the panel stays open behind the sign-in dialog). */
  onSignIn: () => void;
}

interface ReviewEntry {
  rating: number;
  nose: string | null;
  palate: string | null;
  finish: string | null;
  created_at: string;
}

const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const MUTED = "rgba(13,11,8,0.6)";
const MAX_NOTES_SHOWN = 30;

const RARITY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  common:    { bg: "rgba(13,11,8,0.05)",   text: "rgba(13,11,8,0.65)",  border: "rgba(13,11,8,0.15)" },
  limited:   { bg: "rgba(180,120,0,0.08)", text: "rgba(140,90,0,0.95)", border: "rgba(180,120,0,0.25)" },
  rare:      { bg: "rgba(160,60,0,0.08)",  text: "rgba(130,50,0,0.95)", border: "rgba(160,60,0,0.25)" },
  allocated: { bg: "rgba(139,21,21,0.08)", text: "#8b1515",             border: "rgba(139,21,21,0.25)" },
  unicorn:   { bg: "rgba(90,40,160,0.08)", text: "rgba(90,40,160,0.95)", border: "rgba(90,40,160,0.25)" },
};

const chip = {
  background: "rgba(13,11,8,0.06)",
  color: "rgba(13,11,8,0.8)",
  border: "1px solid rgba(13,11,8,0.1)",
};

/**
 * Bottle details, open to everyone: specs, tasting note, community rating and
 * notes, with a link to the bottle's full page. Signed-in visitors also get
 * the rating form; everyone else gets a prompt to sign in.
 */
export default function RatingModal({ bottle, onClose, onRatingSubmitted, onFlag, userId, onSignIn }: Props) {
  const [rating, setRating]       = useState(0);
  const [hovered, setHovered]     = useState(0);
  const [nose, setNose]           = useState("");
  const [palate, setPalate]       = useState("");
  const [finish, setFinish]       = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [reviews, setReviews]     = useState<ReviewEntry[]>([]);

  useEffect(() => {
    if (!bottle) return;
    setRating(0); setHovered(0);
    setNose(""); setPalate(""); setFinish("");
    setSubmitted(false); setError(null);
    setReviews([]);
    let cancelled = false;
    fetchBottleRatings(bottle.id)
      .then((data) => { if (!cancelled) setReviews(data as ReviewEntry[]); })
      .catch(() => { if (!cancelled) setReviews([]); });
    return () => { cancelled = true; };
  }, [bottle]);

  // Escape closes the panel.
  useEffect(() => {
    if (!bottle) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bottle, onClose]);

  if (!bottle) return null;

  const avgRating =
    reviews.length > 0
      ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
      : null;
  const withNotes = reviews.filter((r) => r.nose || r.palate || r.finish);

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

  const rarityStyle = bottle.rarity ? (RARITY_STYLES[bottle.rarity] ?? RARITY_STYLES.common) : null;
  const active = hovered || rating;
  const titleId = `bottle-title-${bottle.id}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      style={{ background: "rgba(13,11,8,0.45)", backdropFilter: "blur(3px)" }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full sm:max-w-lg rounded-t-md sm:rounded-sm overflow-y-auto max-h-[92vh]"
        style={{
          background: "#f4eed8",
          border: "1px solid rgba(13,11,8,0.18)",
          boxShadow: "0 8px 40px rgba(0,0,0,0.22)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-5" style={{ borderBottom: "1px solid rgba(13,11,8,0.1)" }}>
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3 right-3 w-10 h-10 flex items-center justify-center text-2xl leading-none transition-opacity hover:opacity-60"
            style={{ color: MUTED }}
          >
            ×
          </button>

          <h2
            id={titleId}
            className="text-[22px] pr-10 leading-tight"
            style={{ fontFamily: "Georgia,serif", fontWeight: 400, color: "#0d0b08" }}
          >
            {bottle.name}
          </h2>

          <div className="flex items-center gap-x-4 gap-y-1 mt-1.5 flex-wrap text-[14px]">
            {bottle.brandId && (
              <Link
                href={`/brands/${encodeURIComponent(bottle.brandId)}`}
                style={{ color: "#8b1515", fontFamily: "Georgia,serif", fontStyle: "italic" }}
                className="hover:underline"
              >
                {bottle.brandName ?? "View distillery"}
              </Link>
            )}
            <Link
              href={`/bottles/${encodeURIComponent(bottle.id)}`}
              className="underline underline-offset-2"
              style={{ color: "rgba(13,11,8,0.75)" }}
            >
              Full page →
            </Link>
          </div>

          {/* Specs */}
          <div className="flex flex-wrap gap-2 mt-3">
            {!!bottle.price && (
              <span className="text-[13px] font-mono px-2 py-0.5 rounded-sm" style={chip}>
                ${bottle.price.toLocaleString("en-US")}
              </span>
            )}
            {!!bottle.abv && (
              <span className="text-[13px] font-mono px-2 py-0.5 rounded-sm" style={chip}>
                {Math.round(bottle.abv * 20) / 10} proof · {bottle.abv}% ABV
              </span>
            )}
            <span className="text-[13px] font-mono px-2 py-0.5 rounded-sm" style={chip}>
              {bottle.age ? `${bottle.age} yr` : "No age statement"}
            </span>
            {bottle.rarity && rarityStyle && (
              <span
                className="text-[13px] font-mono px-2 py-0.5 rounded-sm capitalize"
                style={{ background: rarityStyle.bg, color: rarityStyle.text, border: `1px solid ${rarityStyle.border}` }}
              >
                {bottle.rarity}
              </span>
            )}
          </div>

          {bottle.description && (
            <p
              className="mt-3 text-[15px] leading-relaxed"
              style={{ color: "rgba(13,11,8,0.75)", fontFamily: "Georgia,serif", fontStyle: "italic" }}
            >
              {bottle.description}
            </p>
          )}

          {/* Community rating */}
          <div className="mt-4">
            {avgRating !== null ? (
              <p className="flex items-baseline gap-2 flex-wrap">
                <span className="text-[26px] leading-none" style={{ color: "#8b1515", fontFamily: "Georgia,serif" }}>
                  {avgRating.toFixed(1)}
                </span>
                <span className="text-[14px]" style={{ color: MUTED }}>
                  / 10 · {reviews.length.toLocaleString("en-US")} rating{reviews.length !== 1 ? "s" : ""}
                  {reviews.length < MIN_RATINGS_TO_RANK ? ` (needs ${MIN_RATINGS_TO_RANK} to be ranked)` : ""}
                </span>
              </p>
            ) : (
              <p className="text-[14px]" style={{ color: MUTED }}>Not yet rated.</p>
            )}
            <p className="text-[12px] mt-1.5 leading-snug" style={{ color: MUTED }}>
              Ratings combine scores from public Reddit whiskey reviews with ratings from Common Cask members.{" "}
              <Link href="/about#ratings" className="underline underline-offset-2">
                How ratings work
              </Link>
            </p>
          </div>
        </div>

        {/* Your rating */}
        <div className="px-6 py-5">
          {!userId ? (
            <div
              className="rounded-sm p-4 flex items-center justify-between gap-4 flex-wrap"
              style={{ background: "rgba(13,11,8,0.04)", border: "1px solid rgba(13,11,8,0.1)" }}
            >
              <p className="text-[14px]" style={{ color: "rgba(13,11,8,0.75)" }}>
                Tried it? Sign in to add your rating.
              </p>
              <button
                onClick={onSignIn}
                className="px-4 py-2 rounded-sm text-[14px] font-semibold"
                style={{ background: "#0d0b08", color: "#f4eed8" }}
              >
                Sign in to rate
              </button>
            </div>
          ) : submitted ? (
            <div className="text-center py-4">
              <p className="font-semibold text-lg" style={{ fontFamily: "Georgia,serif", color: "#0d0b08" }}>
                Rating submitted
              </p>
              <p className="text-[14px] mt-1" style={{ color: MUTED }}>
                You rated this <span style={{ fontWeight: 700, color: "#8b1515" }}>{rating}/10</span>
              </p>
              <button
                onClick={() => setSubmitted(false)}
                className="mt-4 text-[13px] underline transition-opacity hover:opacity-60"
                style={{ color: MUTED }}
              >
                Edit my rating
              </button>
            </div>
          ) : (
            <>
              <p
                className="text-xs mb-3 uppercase"
                style={{ color: MUTED, fontFamily: "Georgia,serif", letterSpacing: "0.13em" }}
              >
                Your rating
              </p>

              <div className="flex gap-1 mb-5">
                {SCORES.map((n) => {
                  const isActive = n <= active;
                  const isSelected = n === rating;
                  return (
                    <button
                      key={n}
                      aria-label={`Rate ${n} out of 10`}
                      aria-pressed={isSelected}
                      className="flex-1 h-10 rounded-sm text-sm font-bold transition-all"
                      style={{
                        background: isActive ? "rgba(139,21,21,0.1)" : "rgba(13,11,8,0.04)",
                        border: isActive
                          ? `1px solid ${isSelected ? "#8b1515" : "rgba(139,21,21,0.4)"}`
                          : "1px solid rgba(13,11,8,0.12)",
                        color: isActive ? "#8b1515" : "rgba(13,11,8,0.55)",
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

              <div className="space-y-3">
                {[
                  { label: "Nose", value: nose, setter: setNose },
                  { label: "Palate", value: palate, setter: setPalate },
                  { label: "Finish", value: finish, setter: setFinish },
                ].map(({ label, value, setter }) => (
                  <div key={label}>
                    <label className="block text-[13px] mb-1" style={{ color: MUTED, fontFamily: "Georgia,serif" }}>
                      {label} <span style={{ color: "rgba(13,11,8,0.45)" }}>(optional)</span>
                      <input
                        type="text"
                        value={value}
                        onChange={(e) => setter(e.target.value)}
                        placeholder={`Describe the ${label.toLowerCase()}…`}
                        className="mt-1 block w-full rounded-sm px-3 py-2 text-[15px] outline-none transition-all"
                        style={{
                          background: "rgba(255,255,255,0.6)",
                          border: "1px solid rgba(13,11,8,0.15)",
                          color: "#0d0b08",
                          fontFamily: "system-ui, -apple-system, sans-serif",
                        }}
                        onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(13,11,8,0.4)")}
                        onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(13,11,8,0.15)")}
                      />
                    </label>
                  </div>
                ))}
              </div>

              {error && (
                <p className="mt-3 text-[13px]" role="alert" style={{ color: "#8b1515" }}>{error}</p>
              )}

              <button
                onClick={handleSubmit}
                disabled={rating === 0 || submitting}
                className="mt-5 w-full py-2.5 rounded-sm text-[15px] font-semibold transition-all"
                style={
                  rating === 0 || submitting
                    ? { background: "rgba(13,11,8,0.07)", color: "rgba(13,11,8,0.45)", cursor: "not-allowed" }
                    : { background: "#0d0b08", color: "#f4eed8", cursor: "pointer" }
                }
              >
                {submitting ? "Submitting…" : "Submit rating"}
              </button>
            </>
          )}

          {onFlag && (
            <button
              onClick={() => { onClose(); onFlag(); }}
              className="mt-4 text-[13px] underline underline-offset-2 transition-opacity hover:opacity-70"
              style={{ color: MUTED }}
            >
              Report incorrect information
            </button>
          )}
        </div>

        {/* Tasting notes people left with their ratings */}
        {withNotes.length > 0 && (
          <div className="px-6 pb-6" style={{ borderTop: "1px solid rgba(13,11,8,0.08)" }}>
            <p
              className="text-xs uppercase pt-4 mb-3"
              style={{ color: MUTED, fontFamily: "Georgia,serif", letterSpacing: "0.13em" }}
            >
              Tasting notes
            </p>
            <div className="space-y-2.5">
              {withNotes.slice(0, MAX_NOTES_SHOWN).map((r, i) => (
                <div
                  key={i}
                  className="rounded-sm p-3"
                  style={{ background: "rgba(13,11,8,0.03)", border: "1px solid rgba(13,11,8,0.08)" }}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="font-semibold text-[14px]" style={{ color: "#8b1515", fontFamily: "Georgia,serif" }}>
                      {r.rating}/10
                    </span>
                    <span className="text-[12px]" style={{ color: MUTED }}>
                      {new Date(r.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                    </span>
                  </div>
                  {[
                    { key: "nose",   val: r.nose },
                    { key: "palate", val: r.palate },
                    { key: "finish", val: r.finish },
                  ].filter(({ val }) => val).map(({ key, val }) => (
                    <p key={key} className="text-[14px] leading-relaxed">
                      <span className="capitalize" style={{ color: MUTED, fontFamily: "Georgia,serif", fontStyle: "italic" }}>
                        {key}:{" "}
                      </span>
                      <span style={{ color: "rgba(13,11,8,0.8)" }}>{val}</span>
                    </p>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
