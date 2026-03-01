"use client";

import { useState } from "react";
import {
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  upsertProfile,
} from "@/lib/supabase";
import { Profile } from "@/types/whiskey";

interface Props {
  onSuccess: (profile?: Partial<Profile>) => void;
  onClose: () => void;
}

type View = "choose" | "email" | "profile";
type EmailMode = "signin" | "signup";

const STYLES = [
  "Bourbon",
  "Rye",
  "Tennessee Whiskey",
  "Single Malt",
  "Blended",
  "Single Barrel",
  "Small Batch",
  "Other",
];

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

export default function AuthModal({ onSuccess, onClose }: Props) {
  const [view, setView] = useState<View>("choose");
  const [emailMode, setEmailMode] = useState<EmailMode>("signin");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Email form fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  // Profile form fields (view === "profile")
  const [profileName, setProfileName] = useState("");
  const [location, setLocation] = useState("");
  const [favoriteStyle, setFavoriteStyle] = useState("");
  const [favoriteBrand, setFavoriteBrand] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  // ── Google ────────────────────────────────────────────────────────────────
  async function handleGoogle() {
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await signInWithGoogle();
      if (err) setError(err.message);
      // On success, browser will redirect — nothing more to do here
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  // ── Email sign-in / sign-up ───────────────────────────────────────────────
  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (emailMode === "signin") {
        const { error: err } = await signInWithEmail(email, password);
        if (err) { setError(err.message); return; }
        // Signed in — go straight to success (profile view optional via header)
        onSuccess();
      } else {
        // Sign up
        const { user, error: err } = await signUpWithEmail(email, password);
        if (err) { setError(err.message); return; }
        if (user) {
          // Pre-fill display name from email prefix
          setProfileName(displayName || email.split("@")[0]);
          setUserId(user.id);
          // Upsert name right away so it's saved even if user skips rest
          await upsertProfile(user.id, {
            displayName: displayName || email.split("@")[0],
          });
          setView("profile");
        } else {
          // Email confirmation required
          setError("Check your email to confirm your account, then sign in.");
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  // ── Profile save ─────────────────────────────────────────────────────────
  async function handleProfileSave(skip = false) {
    if (!userId) { onSuccess(); return; }
    setLoading(true);
    setError(null);
    try {
      if (!skip) {
        await upsertProfile(userId, {
          displayName: profileName || undefined,
          location: location || undefined,
          favoriteStyle: favoriteStyle || undefined,
          favoriteBrand: favoriteBrand || undefined,
        });
      }
      onSuccess();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not save profile");
    } finally {
      setLoading(false);
    }
  }

  // ── Shared overlay / card ─────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl p-8"
        style={{
          background: "linear-gradient(135deg,#0d0d18 0%,#0a0610 100%)",
          border: "1px solid rgba(245,158,11,0.2)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors"
        >
          ✕
        </button>

        {/* ── VIEW: choose ───────────────────────────────────────────────── */}
        {view === "choose" && (
          <>
            <p className="text-xs uppercase tracking-[0.2em] mb-1" style={{ color: "rgba(245,158,11,0.6)" }}>
              Common Cask
            </p>
            <h2 className="text-xl font-bold text-white mb-1">Sign in to continue</h2>
            <p className="text-sm mb-8" style={{ color: "rgba(255,255,255,0.35)" }}>
              Rate bottles and submit new entries.
            </p>

            {/* Google */}
            <button
              onClick={handleGoogle}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 rounded-xl py-3 px-4 font-semibold text-sm mb-4 transition-all"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.15)",
                color: "#fff",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>or</span>
              <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
            </div>

            {/* Email link */}
            <button
              onClick={() => { setEmailMode("signin"); setView("email"); }}
              className="w-full rounded-xl py-3 px-4 font-semibold text-sm transition-all"
              style={{
                background: "transparent",
                border: "1px solid rgba(245,158,11,0.25)",
                color: "rgba(245,158,11,0.85)",
              }}
            >
              Sign in with email
            </button>

            {error && (
              <p className="mt-4 text-xs text-center" style={{ color: "rgba(239,68,68,0.85)" }}>{error}</p>
            )}
          </>
        )}

        {/* ── VIEW: email ────────────────────────────────────────────────── */}
        {view === "email" && (
          <>
            {/* Back */}
            <button
              onClick={() => { setView("choose"); setError(null); }}
              className="flex items-center gap-1 text-xs mb-6 transition-colors"
              style={{ color: "rgba(255,255,255,0.35)" }}
            >
              ← Back
            </button>

            {/* Toggle */}
            <div
              className="flex rounded-xl p-1 mb-6"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              {(["signin", "signup"] as EmailMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => { setEmailMode(mode); setError(null); }}
                  className="flex-1 rounded-lg py-2 text-sm font-semibold transition-all"
                  style={{
                    background: emailMode === mode ? "rgba(245,158,11,0.15)" : "transparent",
                    color: emailMode === mode ? "rgba(245,158,11,0.9)" : "rgba(255,255,255,0.35)",
                    border: emailMode === mode ? "1px solid rgba(245,158,11,0.25)" : "1px solid transparent",
                  }}
                >
                  {mode === "signin" ? "Sign In" : "Create Account"}
                </button>
              ))}
            </div>

            <form onSubmit={handleEmail} className="space-y-3">
              {emailMode === "signup" && (
                <div>
                  <label className="block text-xs mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                    Display name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your name"
                    className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                  />
                </div>
              )}
              <div>
                <label className="block text-xs mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                />
              </div>

              {error && (
                <p className="text-xs pt-1" style={{ color: "rgba(239,68,68,0.85)" }}>{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl py-3 px-4 font-semibold text-sm mt-2 transition-all disabled:opacity-50"
                style={{
                  background: "linear-gradient(135deg,rgba(245,158,11,0.8) 0%,rgba(217,119,6,0.9) 100%)",
                  color: "#000",
                }}
              >
                {loading ? "Please wait…" : emailMode === "signin" ? "Sign In" : "Create Account"}
              </button>
            </form>
          </>
        )}

        {/* ── VIEW: profile ──────────────────────────────────────────────── */}
        {view === "profile" && (
          <>
            <p className="text-xs uppercase tracking-[0.2em] mb-1" style={{ color: "rgba(245,158,11,0.6)" }}>
              Optional
            </p>
            <h2 className="text-xl font-bold text-white mb-1">Complete your profile</h2>
            <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.35)" }}>
              Tell us a bit about yourself — you can skip this anytime.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                  Display name
                </label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="Your name"
                  className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                />
              </div>

              <div>
                <label className="block text-xs mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                  Location (state)
                </label>
                <select
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full rounded-xl px-4 py-3 text-sm text-white outline-none appearance-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  <option value="">Select state…</option>
                  {US_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                  Favorite style
                </label>
                <select
                  value={favoriteStyle}
                  onChange={(e) => setFavoriteStyle(e.target.value)}
                  className="w-full rounded-xl px-4 py-3 text-sm text-white outline-none appearance-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  <option value="">Select style…</option>
                  {STYLES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                  Favorite distiller / brand
                </label>
                <input
                  type="text"
                  value={favoriteBrand}
                  onChange={(e) => setFavoriteBrand(e.target.value)}
                  placeholder="e.g. Buffalo Trace"
                  className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                />
              </div>
            </div>

            {error && (
              <p className="mt-3 text-xs" style={{ color: "rgba(239,68,68,0.85)" }}>{error}</p>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => handleProfileSave(true)}
                disabled={loading}
                className="flex-1 rounded-xl py-3 px-4 text-sm font-medium transition-all disabled:opacity-50"
                style={{
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "rgba(255,255,255,0.4)",
                }}
              >
                Skip
              </button>
              <button
                onClick={() => handleProfileSave(false)}
                disabled={loading}
                className="flex-1 rounded-xl py-3 px-4 text-sm font-semibold transition-all disabled:opacity-50"
                style={{
                  background: "linear-gradient(135deg,rgba(245,158,11,0.8) 0%,rgba(217,119,6,0.9) 100%)",
                  color: "#000",
                }}
              >
                {loading ? "Saving…" : "Save & Continue"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
