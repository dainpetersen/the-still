"use client";

import { useState, useTransition } from "react";
import { reviewReleases } from "./actions";

export interface ReleaseItem {
  id: string;
  name: string;
  producer?: string;
  line?: string;
  proof?: number;
  age?: number;
  price?: number;
  style?: string;
  rarity?: string;
  description?: string;
  source?: string;
  url?: string;
  listedAs?: string;
  month?: string;
}

/**
 * The weekly release review. Every bottle starts ticked; untick anything that
 * shouldn't go on the site, then one button adds the ticked ones and discards
 * the rest.
 */
export default function ReleaseReview({ items }: { items: ReleaseItem[] }) {
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const adding = items.filter((i) => !skipped.has(i.id));
  const discarding = items.filter((i) => skipped.has(i.id));

  function toggle(id: string) {
    setSkipped((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        await reviewReleases(
          adding.map((i) => i.id),
          discarding.map((i) => i.id)
        );
        setSkipped(new Set());
      } catch {
        setError("That didn't save. Nothing was changed; try again.");
      }
    });
  }

  const label =
    adding.length === 0
      ? `Discard ${discarding.length === 1 ? "it" : `all ${discarding.length}`}`
      : `Add ${adding.length} to the site` + (discarding.length > 0 ? ` · discard ${discarding.length}` : "");

  return (
    <div>
      <ul className="space-y-2">
        {items.map((item) => {
          const on = !skipped.has(item.id);
          const facts = [
            item.proof != null ? `${item.proof} proof` : null,
            item.age ? `${item.age} yr` : null,
            item.price != null ? `$${item.price.toLocaleString("en-US")}` : null,
            item.style ?? null,
            item.rarity ?? null,
          ].filter(Boolean);
          return (
            <li
              key={item.id}
              className="rounded-xl"
              style={{
                background: "rgba(10,10,20,0.85)",
                border: on ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(255,255,255,0.08)",
                opacity: on ? 1 : 0.55,
              }}
            >
              <label className="flex items-start gap-3 p-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(item.id)}
                  disabled={isPending}
                  className="mt-1 h-4 w-4 flex-shrink-0"
                  style={{ accentColor: "#4ade80" }}
                />
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold text-sm">{item.name}</span>
                  <span className="block text-xs text-gray-400 mt-0.5">
                    {[item.producer, item.line].filter(Boolean).join(" · ")}
                  </span>
                  <span className="block text-sm mt-1.5" style={{ color: "#e5e7eb" }}>
                    {facts.join(" · ")}
                  </span>
                  {item.description && <span className="block text-xs text-gray-400 mt-1.5">{item.description}</span>}
                  {(item.source || item.listedAs) && (
                    <span className="block text-xs text-gray-500 mt-1.5">
                      {item.source ? "From " : ""}
                      {item.url ? (
                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-300">
                          {item.source ?? "source"}
                        </a>
                      ) : (
                        item.source
                      )}
                      {item.month ? `, ${item.month}` : ""}
                      {item.listedAs ? ` — listed as “${item.listedAs}”` : ""}
                    </span>
                  )}
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={isPending}
          className="px-4 py-2.5 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-40"
          style={{
            background: adding.length > 0 ? "rgba(34,197,94,0.16)" : "rgba(220,38,38,0.12)",
            border: adding.length > 0 ? "1px solid rgba(34,197,94,0.45)" : "1px solid rgba(220,38,38,0.4)",
            color: adding.length > 0 ? "#4ade80" : "#f87171",
          }}
        >
          {isPending ? "Saving…" : label}
        </button>
        <span className="text-xs text-gray-500">
          Unticked bottles are discarded and won&apos;t be suggested again. New bottles appear on the site within the hour.
        </span>
      </div>
      {error && (
        <p className="mt-2 text-sm" style={{ color: "#fca5a5" }}>
          {error}
        </p>
      )}
    </div>
  );
}
