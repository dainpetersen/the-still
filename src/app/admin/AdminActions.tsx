"use client";

import { useState, useTransition } from "react";
import { approveSubmission, rejectSubmission } from "./actions";

export default function AdminActions({ id }: { id: string }) {
  const [showReject, setShowReject] = useState(false);
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleApprove() {
    startTransition(async () => {
      await approveSubmission(id);
    });
  }

  function handleReject() {
    if (!showReject) {
      setShowReject(true);
      return;
    }
    startTransition(async () => {
      await rejectSubmission(id, note.trim() || undefined);
      setShowReject(false);
      setNote("");
    });
  }

  return (
    <div className="flex flex-col gap-2 flex-shrink-0">
      <div className="flex gap-2">
        <button
          onClick={handleApprove}
          disabled={isPending}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity disabled:opacity-40"
          style={{
            background: "rgba(34,197,94,0.12)",
            border: "1px solid rgba(34,197,94,0.35)",
            color: "#4ade80",
          }}
        >
          {isPending ? "…" : "✓ Approve"}
        </button>
        <button
          onClick={handleReject}
          disabled={isPending}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity disabled:opacity-40"
          style={{
            background: showReject ? "rgba(220,38,38,0.2)" : "rgba(220,38,38,0.08)",
            border: "1px solid rgba(220,38,38,0.35)",
            color: "#f87171",
          }}
        >
          {showReject ? "Confirm Reject" : "✕ Reject"}
        </button>
      </div>

      {showReject && (
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="flex-1 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-red-500"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#f5f5f5",
              minWidth: 0,
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleReject();
              if (e.key === "Escape") { setShowReject(false); setNote(""); }
            }}
            autoFocus
          />
          <button
            onClick={() => { setShowReject(false); setNote(""); }}
            className="text-xs text-gray-500 hover:text-gray-300 px-1"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
