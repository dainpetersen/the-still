"use client";

import { useState } from "react";
import { submitCorrection } from "@/lib/supabase";
import { getSessionId } from "@/lib/session";

interface Props {
  bottle: { id: string; name: string };
  onClose: () => void;
}

export default function FlagModal({ bottle, onClose }: Props) {
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit() {
    if (!note.trim()) return;
    setSubmitting(true);
    try {
      await submitCorrection({
        bottleId: bottle.id,
        bottleName: bottle.name,
        note: note.trim(),
        sessionId: getSessionId(),
      });
      setSubmitted(true);
    } catch {
      // silently fail — report is best-effort
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "var(--scrim)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-xl p-5"
        style={{
          background: "var(--panel)",
          border: "1px solid rgb(var(--accent-rgb) / 0.3)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted hover:text-ink text-xl leading-none transition-colors"
        >
          ×
        </button>

        {submitted ? (
          <div className="text-center py-4">
            <div className="text-3xl mb-3" style={{ color: "rgb(var(--success-rgb))" }}>✓</div>
            <p className="text-accent font-semibold">Thanks for the report!</p>
            <p className="text-muted text-sm mt-1">We&apos;ll review and update it.</p>
            <button
              onClick={onClose}
              className="mt-4 text-xs text-muted underline hover:text-ink transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-sm font-bold text-accent mb-1">Report an Error</h2>
            <p className="text-xs text-muted mb-4 truncate pr-6">{bottle.name}</p>

            <label className="block text-xs text-muted mb-1.5">
              What&apos;s incorrect? (price, ABV, age, etc.)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Wrong price, incorrect ABV, wrong age statement…"
              rows={3}
              autoFocus
              className="w-full bg-panel border border-line-strong rounded px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-accent resize-none"
            />

            <div className="flex gap-2 mt-3">
              <button
                onClick={handleSubmit}
                disabled={!note.trim() || submitting}
                className="flex-1 py-2 rounded text-sm font-semibold transition-all"
                style={{
                  background:
                    note.trim() && !submitting ? "rgb(var(--accent-rgb) / 0.15)" : "transparent",
                  color:
                    note.trim() && !submitting ? "var(--accent)" : "rgb(var(--ink-rgb) / 0.2)",
                  border: "1px solid rgb(var(--accent-rgb) / 0.3)",
                }}
              >
                {submitting ? "Sending…" : "Send Report"}
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded text-sm text-muted hover:text-ink transition-colors"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
