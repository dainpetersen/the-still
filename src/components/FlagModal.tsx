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
      style={{ background: "rgba(0,0,0,0.72)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-xl p-5"
        style={{
          background: "linear-gradient(135deg, #1a1209 0%, #0f0f1a 100%)",
          border: "1px solid rgba(245,158,11,0.3)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white text-xl leading-none transition-colors"
        >
          ×
        </button>

        {submitted ? (
          <div className="text-center py-4">
            <div className="text-3xl mb-3" style={{ color: "#4ade80" }}>✓</div>
            <p className="text-amber-400 font-semibold">Thanks for the report!</p>
            <p className="text-gray-400 text-sm mt-1">We&apos;ll review and update it.</p>
            <button
              onClick={onClose}
              className="mt-4 text-xs text-gray-500 underline hover:text-gray-300 transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-sm font-bold text-amber-400 mb-1">Report an Error</h2>
            <p className="text-xs text-gray-500 mb-4 truncate pr-6">{bottle.name}</p>

            <label className="block text-xs text-gray-500 mb-1.5">
              What&apos;s incorrect? (price, ABV, age, etc.)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Wrong price, incorrect ABV, wrong age statement…"
              rows={3}
              autoFocus
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-amber-500 resize-none"
            />

            <div className="flex gap-2 mt-3">
              <button
                onClick={handleSubmit}
                disabled={!note.trim() || submitting}
                className="flex-1 py-2 rounded text-sm font-semibold transition-all"
                style={{
                  background:
                    note.trim() && !submitting ? "rgba(245,158,11,0.15)" : "transparent",
                  color:
                    note.trim() && !submitting ? "#f59e0b" : "rgba(255,255,255,0.2)",
                  border: "1px solid rgba(245,158,11,0.3)",
                }}
              >
                {submitting ? "Sending…" : "Send Report"}
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded text-sm text-gray-600 hover:text-gray-400 transition-colors"
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
