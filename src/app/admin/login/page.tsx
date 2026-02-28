"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

function getBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || url === "your-project-url") return null;
  return createClient(url, key);
}

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchParams = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search)
    : null;
  const urlError = searchParams?.get("error");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = getBrowserClient();
    if (!supabase) {
      setError("Supabase is not configured. Add credentials to .env.local");
      setLoading(false);
      return;
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${siteUrl}/admin/callback`,
      },
    });

    if (authError) {
      setError(authError.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center"
      style={{
        background: "linear-gradient(160deg, #0a0608 0%, #0f0a18 50%, #080a0f 100%)",
        color: "#f5f5f5",
      }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8"
        style={{
          background: "rgba(10,10,20,0.9)",
          border: "1px solid rgba(245,158,11,0.2)",
        }}
      >
        {/* Logo */}
        <div className="flex flex-col leading-none select-none mb-8 items-center">
          <span style={{ fontSize: "9px", color: "rgba(245,158,11,0.7)", letterSpacing: "0.25em" }}>
            THE
          </span>
          <div style={{ height: "1px", background: "rgba(245,158,11,0.4)", margin: "2px 0", width: "100%" }} />
          <span
            className="font-bold uppercase"
            style={{ fontSize: "22px", color: "#f5f5f5", letterSpacing: "0.12em" }}
          >
            STILL
          </span>
          <span className="text-xs mt-2" style={{ color: "rgba(245,158,11,0.5)" }}>
            Admin
          </span>
        </div>

        {urlError === "unauthorized" && (
          <div
            className="mb-4 rounded-lg p-3 text-sm"
            style={{ background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.3)", color: "#fca5a5" }}
          >
            Access denied. Only the authorized admin email can log in.
          </div>
        )}
        {urlError === "auth_failed" && (
          <div
            className="mb-4 rounded-lg p-3 text-sm"
            style={{ background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.3)", color: "#fca5a5" }}
          >
            Authentication failed. Please try again.
          </div>
        )}

        {sent ? (
          <div className="text-center space-y-3">
            <div className="text-4xl">✉️</div>
            <p className="font-semibold text-amber-400">Check your email</p>
            <p className="text-sm text-gray-400">
              A magic link has been sent to <strong className="text-gray-200">{email}</strong>.
              Click it to sign in.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 font-medium uppercase tracking-wider">
                Admin Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-amber-500"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#f5f5f5",
                }}
              />
            </div>

            {error && (
              <p className="text-sm" style={{ color: "#fca5a5" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-50"
              style={{
                background: "rgba(245,158,11,0.15)",
                border: "1px solid rgba(245,158,11,0.5)",
                color: "#f59e0b",
              }}
            >
              {loading ? "Sending…" : "Send Magic Link"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
