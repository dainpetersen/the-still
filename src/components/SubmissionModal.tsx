"use client";

import { useState } from "react";
import { WHISKEY_DATA } from "@/data/whiskeys";
import { submitEntry } from "@/lib/supabase";
import { getSessionId } from "@/lib/session";
import { RarityLevel, SubmissionType, WhiskeyStyle } from "@/types/whiskey";

interface Props {
  onClose: () => void;
  userId?: string;
}

type Step = "type" | "fields" | "confirm";

const RARITY_OPTIONS: { value: RarityLevel; label: string }[] = [
  { value: "common", label: "Common — widely available" },
  { value: "limited", label: "Limited — harder to find" },
  { value: "rare", label: "Rare — regional/allocated" },
  { value: "allocated", label: "Allocated — lottery/waitlist" },
  { value: "unicorn", label: "Unicorn — near impossible" },
];

export default function SubmissionModal({ onClose, userId }: Props) {
  const [step, setStep] = useState<Step>("type");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1
  const [entryType, setEntryType] = useState<SubmissionType>("bottle");
  const [isNDP, setIsNDP] = useState(false);

  // Brand fields
  const [brandName, setBrandName] = useState("");
  const [brandRegion, setBrandRegion] = useState("");

  // Sub-brand fields
  const [subBrandName, setSubBrandName] = useState("");
  const [parentBrandId, setParentBrandId] = useState("");
  const [parentBrandName, setParentBrandName] = useState("");

  // Bottle fields
  const [bottleName, setBottleName] = useState("");
  const [bottleAbv, setBottleAbv] = useState("");
  const [bottlePrice, setBottlePrice] = useState("");
  const [bottleAge, setBottleAge] = useState("");
  const [bottleRarity, setBottleRarity]   = useState<RarityLevel>("limited");
  const [bottleStyle, setBottleStyle]     = useState<WhiskeyStyle | "">("");
  const [bottleDesc, setBottleDesc]       = useState("");
  const [bottleSource, setBottleSource]   = useState("");
  const [parentSubBrandId, setParentSubBrandId] = useState("");
  const [parentSubBrandName, setParentSubBrandName] = useState("");

  const allBrands = WHISKEY_DATA;
  const allSubBrands = allBrands.flatMap((b) =>
    b.subBrands.map((sb) => ({ id: sb.id, name: sb.name, brandName: b.name }))
  );

  function isStepValid(): boolean {
    if (step === "type") return true;
    if (entryType === "brand") return brandName.trim().length > 0 && brandRegion.trim().length > 0;
    if (entryType === "sub_brand") return subBrandName.trim().length > 0 && (parentBrandId || parentBrandName).length > 0;
    if (entryType === "bottle")
      return (
        bottleName.trim().length > 0 &&
        bottleAbv.trim().length > 0 &&
        bottlePrice.trim().length > 0 &&
        (parentSubBrandId || parentSubBrandName).length > 0
      );
    return false;
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const sessionId = getSessionId();
      if (entryType === "brand") {
        await submitEntry({
          type: "brand",
          data: { brandName, brandRegion, brandIsNDP: isNDP },
          sessionId,
          userId,
        });
      } else if (entryType === "sub_brand") {
        const brand = allBrands.find((b) => b.id === parentBrandId);
        await submitEntry({
          type: "sub_brand",
          data: { subBrandName },
          parentId: parentBrandId || undefined,
          parentName: brand?.name ?? parentBrandName,
          sessionId,
          userId,
        });
      } else {
        const subBrand = allSubBrands.find((sb) => sb.id === parentSubBrandId);
        await submitEntry({
          type: "bottle",
          data: {
            bottleName,
            bottleAbv: parseFloat(bottleAbv),
            bottlePrice: parseFloat(bottlePrice),
            bottleAge: bottleAge ? parseInt(bottleAge) : undefined,
            bottleRarity,
            bottleStyle: bottleStyle || undefined,
            bottleDescription: bottleDesc,
            bottleSourceDistillery: bottleSource || undefined,
          },
          parentId: parentSubBrandId || undefined,
          parentName: subBrand ? `${subBrand.brandName} / ${subBrand.name}` : parentSubBrandName,
          sessionId,
          userId,
        });
      }
      setSubmitted(true);
    } catch {
      setError("Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls =
    "w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-amber-500";
  const labelCls = "block text-xs text-gray-500 mb-1";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.8)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-xl overflow-y-auto max-h-[90vh]"
        style={{
          background: "linear-gradient(135deg, #0f0d1a 0%, #0a0f0d 100%)",
          border: "1px solid rgba(245,158,11,0.35)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.9)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-6 pt-5 pb-4 flex items-start justify-between"
          style={{ borderBottom: "1px solid rgba(245,158,11,0.15)" }}
        >
          <div>
            <h2 className="text-base font-bold text-amber-400">Submit an Entry</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {step === "type" && "What are you adding?"}
              {step === "fields" && `Enter details for the ${entryType.replace("_", "-")}`}
              {step === "confirm" && "Review your submission"}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none ml-4">×</button>
        </div>

        <div className="px-6 py-5">
          {/* ── Step 1: Type ── */}
          {step === "type" && (
            <div className="space-y-3">
              {(["bottle", "sub_brand", "brand"] as SubmissionType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setEntryType(t)}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${
                    entryType === t
                      ? "border-amber-500 bg-amber-500/10 text-amber-300"
                      : "border-gray-700 text-gray-400 hover:border-gray-500"
                  }`}
                >
                  <div className="font-semibold text-sm capitalize">
                    {t === "bottle" && "🍾 Bottle / Expression"}
                    {t === "sub_brand" && "🏷️ Sub-Brand / Line"}
                    {t === "brand" && "🏭 Brand / Distillery"}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {t === "bottle" && "A specific release, e.g. \"Eagle Rare 17 Year\""}
                    {t === "sub_brand" && "A product line under a brand, e.g. \"Russell's Reserve\""}
                    {t === "brand" && "A new distillery or NDP producer"}
                  </div>
                </button>
              ))}

              {entryType === "brand" && (
                <label className="flex items-center gap-2 mt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isNDP}
                    onChange={(e) => setIsNDP(e.target.checked)}
                    className="accent-amber-500"
                  />
                  <span className="text-sm text-gray-400">This is a Non-Distilling Producer (NDP)</span>
                </label>
              )}
            </div>
          )}

          {/* ── Step 2: Fields ── */}
          {step === "fields" && (
            <div className="space-y-3">
              {entryType === "brand" && (
                <>
                  <div>
                    <label className={labelCls}>Brand / Distillery Name *</label>
                    <input className={inputCls} value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="e.g. Rabbit Hole Distillery" />
                  </div>
                  <div>
                    <label className={labelCls}>Region (State) *</label>
                    <input className={inputCls} value={brandRegion} onChange={(e) => setBrandRegion(e.target.value)} placeholder="e.g. Louisville, KY" />
                  </div>
                  {isNDP && (
                    <p className="text-xs text-purple-400 bg-purple-900/20 rounded px-3 py-2 border border-purple-800/40">
                      This will be marked as an NDP in the visualization.
                    </p>
                  )}
                </>
              )}

              {entryType === "sub_brand" && (
                <>
                  <div>
                    <label className={labelCls}>Parent Brand *</label>
                    <select
                      className={inputCls}
                      value={parentBrandId}
                      onChange={(e) => {
                        setParentBrandId(e.target.value);
                        setParentBrandName("");
                      }}
                    >
                      <option value="">— select existing brand —</option>
                      {allBrands.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                      <option value="__new__">Other (new brand)</option>
                    </select>
                    {parentBrandId === "__new__" && (
                      <input
                        className={`${inputCls} mt-2`}
                        placeholder="Brand name (new)"
                        value={parentBrandName}
                        onChange={(e) => setParentBrandName(e.target.value)}
                      />
                    )}
                  </div>
                  <div>
                    <label className={labelCls}>Sub-Brand / Line Name *</label>
                    <input className={inputCls} value={subBrandName} onChange={(e) => setSubBrandName(e.target.value)} placeholder="e.g. Rabbit Hole Dareringer" />
                  </div>
                </>
              )}

              {entryType === "bottle" && (
                <>
                  <div>
                    <label className={labelCls}>Parent Sub-Brand *</label>
                    <select
                      className={inputCls}
                      value={parentSubBrandId}
                      onChange={(e) => {
                        setParentSubBrandId(e.target.value);
                        setParentSubBrandName("");
                      }}
                    >
                      <option value="">— select existing sub-brand —</option>
                      {allSubBrands.map((sb) => (
                        <option key={sb.id} value={sb.id}>{sb.brandName} / {sb.name}</option>
                      ))}
                      <option value="__new__">Other (new sub-brand)</option>
                    </select>
                    {parentSubBrandId === "__new__" && (
                      <input
                        className={`${inputCls} mt-2`}
                        placeholder="Sub-brand name (new)"
                        value={parentSubBrandName}
                        onChange={(e) => setParentSubBrandName(e.target.value)}
                      />
                    )}
                  </div>
                  <div>
                    <label className={labelCls}>Bottle / Expression Name *</label>
                    <input className={inputCls} value={bottleName} onChange={(e) => setBottleName(e.target.value)} placeholder="e.g. Rabbit Hole Dareringer Sherry Cask" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelCls}>ABV % *</label>
                      <input className={inputCls} type="number" step="0.1" value={bottleAbv} onChange={(e) => setBottleAbv(e.target.value)} placeholder="e.g. 47.5" />
                    </div>
                    <div>
                      <label className={labelCls}>Retail Price (USD) *</label>
                      <input className={inputCls} type="number" value={bottlePrice} onChange={(e) => setBottlePrice(e.target.value)} placeholder="e.g. 75" />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Age Statement (years, optional)</label>
                    <input className={inputCls} type="number" value={bottleAge} onChange={(e) => setBottleAge(e.target.value)} placeholder="Leave blank for NAS" />
                  </div>
                  <div>
                    <label className={labelCls}>Whiskey Style</label>
                    <select className={inputCls} value={bottleStyle} onChange={(e) => setBottleStyle(e.target.value as WhiskeyStyle | "")}>
                      <option value="">— select style (optional) —</option>
                      {(["Bourbon","Wheated Bourbon","High Rye Bourbon","Rye Whiskey","Wheat Whiskey","Tennessee Whiskey","Blended American"] as WhiskeyStyle[]).map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Rarity</label>
                    <select className={inputCls} value={bottleRarity} onChange={(e) => setBottleRarity(e.target.value as RarityLevel)}>
                      {RARITY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Description</label>
                    <textarea className={`${inputCls} resize-none`} rows={2} value={bottleDesc} onChange={(e) => setBottleDesc(e.target.value)} placeholder="Brief tasting notes or background…" />
                  </div>
                  <div>
                    <label className={labelCls}>Source Distillery (if NDP / sourced)</label>
                    <input className={inputCls} value={bottleSource} onChange={(e) => setBottleSource(e.target.value)} placeholder="e.g. MGP, LDI, Undisclosed" />
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Step 3: Confirm ── */}
          {step === "confirm" && !submitted && (
            <div className="space-y-3">
              <div className="bg-gray-900 rounded-lg p-4 text-sm space-y-1.5">
                <div className="text-gray-500 text-xs uppercase tracking-wider mb-2">Summary</div>
                {entryType === "brand" && (
                  <>
                    <Row label="Type" value="Brand / Distillery" />
                    <Row label="Name" value={brandName} />
                    <Row label="Region" value={brandRegion} />
                    {isNDP && <Row label="NDP" value="Yes" />}
                  </>
                )}
                {entryType === "sub_brand" && (
                  <>
                    <Row label="Type" value="Sub-Brand" />
                    <Row label="Name" value={subBrandName} />
                    <Row label="Parent Brand" value={allBrands.find((b) => b.id === parentBrandId)?.name ?? parentBrandName} />
                  </>
                )}
                {entryType === "bottle" && (
                  <>
                    <Row label="Type" value="Bottle" />
                    <Row label="Name" value={bottleName} />
                    <Row label="Sub-Brand" value={allSubBrands.find((sb) => sb.id === parentSubBrandId)?.name ?? parentSubBrandName} />
                    <Row label="ABV" value={`${bottleAbv}%`} />
                    <Row label="Price" value={`$${bottlePrice}`} />
                    {bottleAge && <Row label="Age" value={`${bottleAge} Year`} />}
                    {bottleStyle && <Row label="Style" value={bottleStyle} />}
                    <Row label="Rarity" value={bottleRarity} />
                    {bottleSource && <Row label="Source" value={bottleSource} />}
                  </>
                )}
              </div>
              <p className="text-xs text-gray-600">
                Your submission will be reviewed before appearing on the map.
              </p>
              {error && <p className="text-red-400 text-xs">{error}</p>}
            </div>
          )}

          {submitted && (
            <div className="text-center py-6">
              <div className="text-3xl mb-3">🥃</div>
              <p className="text-amber-400 font-semibold">Submission received!</p>
              <p className="text-gray-500 text-sm mt-1">It will appear on the map once reviewed.</p>
            </div>
          )}
        </div>

        {/* Footer buttons */}
        {!submitted && (
          <div
            className="px-6 pb-5 flex justify-between gap-3"
            style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "16px" }}
          >
            {step === "type" && (
              <>
                <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-300">Cancel</button>
                <button
                  onClick={() => setStep("fields")}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold rounded"
                >
                  Next →
                </button>
              </>
            )}
            {step === "fields" && (
              <>
                <button onClick={() => setStep("type")} className="text-sm text-gray-500 hover:text-gray-300">← Back</button>
                <button
                  onClick={() => setStep("confirm")}
                  disabled={!isStepValid()}
                  className={`px-4 py-2 text-sm font-semibold rounded transition-all ${
                    isStepValid()
                      ? "bg-amber-500 hover:bg-amber-400 text-black"
                      : "bg-gray-700 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  Review →
                </button>
              </>
            )}
            {step === "confirm" && (
              <>
                <button onClick={() => setStep("fields")} className="text-sm text-gray-500 hover:text-gray-300">← Edit</button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className={`px-4 py-2 text-sm font-semibold rounded transition-all ${
                    submitting
                      ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                      : "bg-amber-500 hover:bg-amber-400 text-black"
                  }`}
                >
                  {submitting ? "Submitting…" : "Submit for Review"}
                </button>
              </>
            )}
          </div>
        )}
        {submitted && (
          <div className="px-6 pb-5">
            <button onClick={onClose} className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded">
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-200 text-right max-w-[60%] truncate">{value}</span>
    </div>
  );
}
