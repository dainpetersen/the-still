"use client";

import { GroupMode } from "@/types/whiskey";

const GROUPS: { mode: GroupMode; label: string; icon: string }[] = [
  { mode: "distillery", label: "Distillery", icon: "🏭" },
  { mode: "style",      label: "Style",      icon: "🥃" },
  { mode: "state",      label: "State",      icon: "📍" },
  { mode: "ageTier",    label: "Age Tier",   icon: "📅" },
  { mode: "priceTier",  label: "Price Tier", icon: "💵" },
];

interface GroupControlProps {
  groupMode: GroupMode;
  onChange: (mode: GroupMode) => void;
}

export default function GroupControl({ groupMode, onChange }: GroupControlProps) {
  return (
    <div className="flex flex-col gap-1">
      <p
        className="text-xs font-semibold uppercase tracking-widest mb-1"
        style={{ color: "rgba(245,158,11,0.6)" }}
      >
        Group By
      </p>
      {GROUPS.map(({ mode, label, icon }) => {
        const active = groupMode === mode;
        return (
          <button
            key={mode}
            onClick={() => onChange(mode)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all text-left"
            style={{
              background: active
                ? "rgba(245,158,11,0.18)"
                : "rgba(255,255,255,0.03)",
              border: active
                ? "1px solid rgba(245,158,11,0.5)"
                : "1px solid rgba(255,255,255,0.07)",
              color: active ? "#f59e0b" : "rgba(245,245,245,0.55)",
            }}
          >
            <span style={{ fontSize: "13px" }}>{icon}</span>
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
