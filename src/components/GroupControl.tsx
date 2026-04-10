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
        className="text-xs uppercase tracking-widest mb-1"
        style={{ color: "rgba(13,11,8,0.45)", fontFamily: "Georgia,serif", letterSpacing: "0.13em" }}
      >
        Group By
      </p>
      {GROUPS.map(({ mode, label, icon }) => {
        const active = groupMode === mode;
        return (
          <button
            key={mode}
            onClick={() => onChange(mode)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-sm text-sm font-medium transition-all text-left"
            style={{
              background: active ? "rgba(13,11,8,0.1)" : "transparent",
              border: active ? "1px solid rgba(13,11,8,0.25)" : "1px solid transparent",
              color: active ? "#0d0b08" : "rgba(13,11,8,0.5)",
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
