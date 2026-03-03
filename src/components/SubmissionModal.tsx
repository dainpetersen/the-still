"use client";

import { useState } from "react";
import { WHISKEY_DATA } from "@/data/whiskeys";
import { submitEntry } from "@/lib/supabase";
import { getSessionId } from "@/lib/session";
import { RarityLevel, WhiskeyStyle, BundledBottleData } from "@/types/whiskey";

interface Props {
  onClose: () => void;
  userId?: string;
}

type EntryPath = "distillery" | "bottle";
type Step =
  | "path"           // choose path
  | "brand"          // distillery path: brand info
  | "subbrand"       // distillery path: sub-brand + bottles
  | "dist_confirm"   // distillery path: review
  | "bottle_details" // bottle path: fields
  | "bottle_confirm";// bottle path: review

const RARITY_OPTIONS: { value: RarityLevel; label: string }[] = [
  { value: "common",    label: "Common — widely available" },
  { value: "limited",   label: "Limited — harder to find" },
  { value: "rare",      label: "Rare — regional/allocated" },
  { value: "allocated", label: "Allocated — lottery/waitlist" },
  { value: "unicorn",   label: "Unicorn — near impossible" },
];

const STYLE_OPTIONS: WhiskeyStyle[] = [
  "Bourbon", "Wheated Bourbon", "High Rye Bourbon",
  "Rye Whiskey", "Wheat Whiskey", "Tennessee Whiskey", "Blended American",
];

function emptyBottle(): BundledBottleData {
  return { name: "", abv: 0, price: 0, rarity: "limited" };
}

export default function SubmissionModal({ onClose, userId }: Props) {
  const [path, setPath]           = useState<EntryPath>("distillery");
  const [step, setStep]           = useState<Step>("path");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  // ── Distillery path state ─────────────────────────────────────────
  const [brandName, setBrandName]   = useState("");
  const [brandRegion, setBrandRegion] = useState("");
  const [isNDP, setIsNDP]           = useState(false);
  const [subBrandName, setSubBrandName] = useState("");
  const [bottles, setBottles]       = useState<BundledBottleData[]>([emptyBottle()]);

  // ── Bottle path state ─────────────────────────────────────────────
  const allBrands   = WHISKEY_DATA;
  const allSubBrands = allBrands.flatMap((b) =>
    b.subBrands.map((sb) => ({ id: sb.id, name: sb.name, brandName: b.name }))
  );
  const [parentBrandId, setParentBrandId]         = useState("");
  const [parentBrandNameFree, setParentBrandNameFree] = useState("");
  const [parentSubBrandId, setParentSubBrandId]   = useState("");
  const [parentSubBrandNameFree, setParentSubBrandNameFree] = useState("");
  const [bottleName, setBottleName]               = useState("");
  const [bottleAbv, setBottleAbv]                 = useState("");
  const [bottlePrice, setBottlePrice]             = useState("");
  const [bottleAge, setBottleAge]                 = useState("");
  const [bottleRarity, setBottleRarity]           = useState<RarityLevel>("limited");
  const [bottleStyle, setBottleStyle]             = useState<WhiskeyStyle | "">("");
  const [bottleDesc, setBottleDesc]               = useState("");
  const [bottleSource, setBottleSource]           = useState("");

  // ── Bottle helpers ────────────────────────────────────────────────
  function updateBottle<K extends keyof BundledBottleData>(
    i: number, key: K, val: BundledBottleData[K]
  ) {
    setBottles((prev) => prev.map((b, idx) => idx === i ? { ...b, [key]: val } : b));
  }
  function addBottle()       { setBottles((prev) => [...prev, emptyBottle()]); }
  function removeBottle(i: number) {
    setBottles((prev) => prev.filter((_, idx) => idx !== i));
  }

  // ── Validation ────────────────────────────────────────────────────
  function distBrandValid() {
    return brandName.trim().length > 0 && brandRegion.trim().length > 0;
  }
  function distSubBrandValid() {
    if (!subBrandName.trim()) return false;
    return bottles.every(
      (bt) => bt.name.trim().length > 0 && bt.abv > 0 && bt.price > 0
    );
  }
  function bottleDetailsValid() {
    return (
      bottleName.trim().length > 0 &&
      bottleAbv.trim().length > 0 &&
      bottlePrice.trim().length > 0 &&
      (parentSubBrandId || parentSubBrandNameFree.trim()).length > 0
    );
  }

  // ── Submit ────────────────────────────────────────────────────────
  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const sessionId = getSessionId();
      if (path === "distillery") {
        await submitEntry({
          type: "brand",
          data: {
            brandName: brandName.trim(),
            brandRegion: brandRegion.trim(),
            brandIsNDP: isNDP,
            bundledSubBrands: [{
              name: subBrandName.trim(),
              bottles: bottles.map((bt) => ({
                ...bt,
                name: bt.name.trim(),
                description: bt.description?.trim() || undefined,
                sourceDistillery: bt.sourceDistillery?.trim() || undefined,
              })),
            }],
          },
          sessionId,
          userId,
        });
      } else {
        const brand = allBrands.find((b) => b.id === parentBrandId);
        const subBrand = allSubBrands.find((sb) => sb.id === parentSubBrandId);
        await submitEntry({
          type: "bottle",
          data: {
            bottleName: bottleName.trim(),
            bottleAbv: parseFloat(bottleAbv),
            bottlePrice: parseFloat(bottlePrice),
            bottleAge: bottleAge ? parseInt(bottleAge) : undefined,
            bottleRarity,
            bottleStyle: bottleStyle || undefined,
            bottleDescription: bottleDesc.trim() || undefined,
            bottleSourceDistillery: bottleSource.trim() || undefined,
          },
          parentId: parentSubBrandId || undefined,
          parentName: subBrand
            ? `${subBrand.brandName} / ${subBrand.name}`
            : parentSubBrandNameFree.trim() || brand?.name || parentBrandNameFree.trim(),
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

  // ── Header label ──────────────────────────────────────────────────
  function headerSub() {
    if (step === "path") return "What are you adding?";
    if (step === "brand") return "New distillery details";
    if (step === "subbrand") return "Sub-brand and bottles";
    if (step === "dist_confirm") return "Review your submission";
    if (step === "bottle_details") return "Bottle details";
    if (step === "bottle_confirm") return "Review your submission";
    return "";
  }

  // ── Sub-brand filter for bottle path ──────────────────────────────
  const filteredSubBrands = parentBrandId && parentBrandId !== "__new__"
    ? allSubBrands.filter((sb) => {
        const brand = allBrands.find((b) => b.id === parentBrandId);
        return brand?.subBrands.some((s) => s.id === sb.id);
      })
    : allSubBrands;

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
            <p className="text-xs text-gray-500 mt-0.5">{headerSub()}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none ml-4">×</button>
        </div>

        <div className="px-6 py-5">

          {/* ── Step: choose path ─────────────────────────────────────── */}
          {step === "path" && !submitted && (
            <div className="space-y-3">
              {(["distillery", "bottle"] as EntryPath[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPath(p)}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${
                    path === p
                      ? "border-amber-500 bg-amber-500/10 text-amber-300"
                      : "border-gray-700 text-gray-400 hover:border-gray-500"
                  }`}
                >
                  <div className="font-semibold text-sm">
                    {p === "distillery" ? "🏭 New Distillery" : "🍾 Add a Bottle"}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {p === "distillery"
                      ? "Add a brand that's not yet on the site, with sub-brand and bottles"
                      : "Add an expression to a distillery already on the site"}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* ── Distillery: brand info ────────────────────────────────── */}
          {step === "brand" && (
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Distillery / Brand Name *</label>
                <input
                  className={inputCls}
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="e.g. Sagamore Spirit"
                />
              </div>
              <div>
                <label className={labelCls}>Region (State) *</label>
                <input
                  className={inputCls}
                  value={brandRegion}
                  onChange={(e) => setBrandRegion(e.target.value)}
                  placeholder="e.g. Baltimore, MD"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isNDP}
                  onChange={(e) => setIsNDP(e.target.checked)}
                  className="accent-amber-500"
                />
                <span className="text-sm text-gray-400">This is a Non-Distilling Producer (NDP)</span>
              </label>
              {isNDP && (
                <p className="text-xs text-purple-400 bg-purple-900/20 rounded px-3 py-2 border border-purple-800/40">
                  This will be marked as an NDP in the visualization.
                </p>
              )}
            </div>
          )}

          {/* ── Distillery: sub-brand + bottles ──────────────────────── */}
          {step === "subbrand" && (
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Sub-Brand / Product Line Name *</label>
                <input
                  className={inputCls}
                  value={subBrandName}
                  onChange={(e) => setSubBrandName(e.target.value)}
                  placeholder={`e.g. ${brandName || "Sagamore Spirit"}`}
                />
                <p className="text-xs text-gray-600 mt-1">
                  Often the same as the distillery name. Used to group bottles.
                </p>
              </div>

              <div
                className="pt-1"
                style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
              >
                <p className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wider">Bottles</p>
                <div className="space-y-4">
                  {bottles.map((bt, i) => (
                    <div
                      key={i}
                      className="rounded-lg p-3 space-y-2"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-500">Bottle {i + 1}</span>
                        {bottles.length > 1 && (
                          <button
                            onClick={() => removeBottle(i)}
                            className="text-xs text-red-500 hover:text-red-400"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <div>
                        <label className={labelCls}>Name *</label>
                        <input
                          className={inputCls}
                          value={bt.name}
                          onChange={(e) => updateBottle(i, "name", e.target.value)}
                          placeholder="e.g. Sagamore Spirit Rye"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className={labelCls}>ABV % *</label>
                          <input
                            className={inputCls}
                            type="number"
                            step="0.1"
                            value={bt.abv || ""}
                            onChange={(e) => updateBottle(i, "abv", parseFloat(e.target.value) || 0)}
                            placeholder="e.g. 41.5"
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Price (USD) *</label>
                          <input
                            className={inputCls}
                            type="number"
                            value={bt.price || ""}
                            onChange={(e) => updateBottle(i, "price", parseFloat(e.target.value) || 0)}
                            placeholder="e.g. 35"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className={labelCls}>Age (years)</label>
                          <input
                            className={inputCls}
                            type="number"
                            value={bt.age ?? ""}
                            onChange={(e) =>
                              updateBottle(i, "age", e.target.value ? parseInt(e.target.value) : undefined)
                            }
                            placeholder="NAS"
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Rarity</label>
                          <select
                            className={inputCls}
                            value={bt.rarity}
                            onChange={(e) => updateBottle(i, "rarity", e.target.value as RarityLevel)}
                          >
                            {RARITY_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label.split(" — ")[0]}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className={labelCls}>Style</label>
                        <select
                          className={inputCls}
                          value={bt.style ?? ""}
                          onChange={(e) =>
                            updateBottle(i, "style", (e.target.value as WhiskeyStyle) || undefined)
                          }
                        >
                          <option value="">— select style (optional) —</option>
                          {STYLE_OPTIONS.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>Description</label>
                        <textarea
                          className={`${inputCls} resize-none`}
                          rows={2}
                          value={bt.description ?? ""}
                          onChange={(e) => updateBottle(i, "description", e.target.value || undefined)}
                          placeholder="Brief tasting notes or background…"
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Source Distillery (if NDP)</label>
                        <input
                          className={inputCls}
                          value={bt.sourceDistillery ?? ""}
                          onChange={(e) => updateBottle(i, "sourceDistillery", e.target.value || undefined)}
                          placeholder="e.g. MGP, LDI, Undisclosed"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={addBottle}
                  className="mt-3 w-full py-2 rounded-lg text-xs font-medium transition-colors"
                  style={{
                    border: "1px dashed rgba(245,158,11,0.3)",
                    color: "rgba(245,158,11,0.6)",
                  }}
                >
                  + Add another bottle
                </button>
              </div>
            </div>
          )}

          {/* ── Distillery: confirm ───────────────────────────────────── */}
          {step === "dist_confirm" && !submitted && (
            <div className="space-y-3">
              <div className="bg-gray-900 rounded-lg p-4 text-sm space-y-2">
                <div className="text-gray-500 text-xs uppercase tracking-wider mb-2">Summary</div>
                <div className="font-semibold text-amber-400">{brandName}</div>
                <div className="text-xs text-gray-400">{brandRegion}{isNDP ? " · NDP" : ""}</div>
                <div
                  className="mt-2 pt-2"
                  style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
                >
                  <div className="text-xs text-gray-500 mb-1">Sub-brand: <span className="text-gray-300">{subBrandName}</span></div>
                  {bottles.map((bt, i) => (
                    <div key={i} className="text-xs text-gray-400 ml-2 mt-0.5">
                      · {bt.name} — {bt.abv}% ABV, ${bt.price}{bt.age ? `, ${bt.age}yr` : ""}{bt.style ? `, ${bt.style}` : ""}
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-xs text-gray-600">
                Your submission will be reviewed before appearing on the map.
              </p>
              {error && <p className="text-red-400 text-xs">{error}</p>}
            </div>
          )}

          {/* ── Bottle path: details ──────────────────────────────────── */}
          {step === "bottle_details" && (
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Parent Distillery *</label>
                <select
                  className={inputCls}
                  value={parentBrandId}
                  onChange={(e) => {
                    setParentBrandId(e.target.value);
                    setParentBrandNameFree("");
                    setParentSubBrandId("");
                    setParentSubBrandNameFree("");
                  }}
                >
                  <option value="">— select distillery —</option>
                  {allBrands.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                  <option value="__new__">Other (not listed)</option>
                </select>
                {parentBrandId === "__new__" && (
                  <input
                    className={`${inputCls} mt-2`}
                    placeholder="Distillery name"
                    value={parentBrandNameFree}
                    onChange={(e) => setParentBrandNameFree(e.target.value)}
                  />
                )}
              </div>
              <div>
                <label className={labelCls}>Sub-Brand / Product Line *</label>
                <select
                  className={inputCls}
                  value={parentSubBrandId}
                  onChange={(e) => {
                    setParentSubBrandId(e.target.value);
                    setParentSubBrandNameFree("");
                  }}
                >
                  <option value="">— select sub-brand —</option>
                  {filteredSubBrands.map((sb) => (
                    <option key={sb.id} value={sb.id}>
                      {parentBrandId ? sb.name : `${sb.brandName} / ${sb.name}`}
                    </option>
                  ))}
                  <option value="__new__">Other (type name)</option>
                </select>
                {parentSubBrandId === "__new__" && (
                  <input
                    className={`${inputCls} mt-2`}
                    placeholder="Sub-brand name"
                    value={parentSubBrandNameFree}
                    onChange={(e) => setParentSubBrandNameFree(e.target.value)}
                  />
                )}
              </div>
              <div>
                <label className={labelCls}>Bottle / Expression Name *</label>
                <input
                  className={inputCls}
                  value={bottleName}
                  onChange={(e) => setBottleName(e.target.value)}
                  placeholder="e.g. Eagle Rare 17 Year"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>ABV % *</label>
                  <input
                    className={inputCls}
                    type="number"
                    step="0.1"
                    value={bottleAbv}
                    onChange={(e) => setBottleAbv(e.target.value)}
                    placeholder="e.g. 47.5"
                  />
                </div>
                <div>
                  <label className={labelCls}>Price (USD) *</label>
                  <input
                    className={inputCls}
                    type="number"
                    value={bottlePrice}
                    onChange={(e) => setBottlePrice(e.target.value)}
                    placeholder="e.g. 75"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>Age (years)</label>
                  <input
                    className={inputCls}
                    type="number"
                    value={bottleAge}
                    onChange={(e) => setBottleAge(e.target.value)}
                    placeholder="NAS"
                  />
                </div>
                <div>
                  <label className={labelCls}>Style</label>
                  <select
                    className={inputCls}
                    value={bottleStyle}
                    onChange={(e) => setBottleStyle(e.target.value as WhiskeyStyle | "")}
                  >
                    <option value="">— optional —</option>
                    {STYLE_OPTIONS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>Rarity</label>
                <select
                  className={inputCls}
                  value={bottleRarity}
                  onChange={(e) => setBottleRarity(e.target.value as RarityLevel)}
                >
                  {RARITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Description</label>
                <textarea
                  className={`${inputCls} resize-none`}
                  rows={2}
                  value={bottleDesc}
                  onChange={(e) => setBottleDesc(e.target.value)}
                  placeholder="Brief tasting notes or background…"
                />
              </div>
              <div>
                <label className={labelCls}>Source Distillery (if NDP)</label>
                <input
                  className={inputCls}
                  value={bottleSource}
                  onChange={(e) => setBottleSource(e.target.value)}
                  placeholder="e.g. MGP, LDI, Undisclosed"
                />
              </div>
            </div>
          )}

          {/* ── Bottle path: confirm ──────────────────────────────────── */}
          {step === "bottle_confirm" && !submitted && (
            <div className="space-y-3">
              <div className="bg-gray-900 rounded-lg p-4 text-sm space-y-1.5">
                <div className="text-gray-500 text-xs uppercase tracking-wider mb-2">Summary</div>
                <Row label="Type" value="Bottle" />
                <Row label="Name" value={bottleName} />
                <Row
                  label="Sub-Brand"
                  value={allSubBrands.find((sb) => sb.id === parentSubBrandId)?.name ?? parentSubBrandNameFree}
                />
                <Row label="ABV" value={`${bottleAbv}%`} />
                <Row label="Price" value={`$${bottlePrice}`} />
                {bottleAge && <Row label="Age" value={`${bottleAge} Year`} />}
                {bottleStyle && <Row label="Style" value={bottleStyle} />}
                <Row label="Rarity" value={bottleRarity} />
                {bottleSource && <Row label="Source" value={bottleSource} />}
              </div>
              <p className="text-xs text-gray-600">
                Your submission will be reviewed before appearing on the map.
              </p>
              {error && <p className="text-red-400 text-xs">{error}</p>}
            </div>
          )}

          {/* ── Success ───────────────────────────────────────────────── */}
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
            {/* Path selection */}
            {step === "path" && (
              <>
                <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-300">Cancel</button>
                <button
                  onClick={() => setStep(path === "distillery" ? "brand" : "bottle_details")}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold rounded"
                >
                  Next →
                </button>
              </>
            )}

            {/* Distillery: brand → subbrand */}
            {step === "brand" && (
              <>
                <button onClick={() => setStep("path")} className="text-sm text-gray-500 hover:text-gray-300">← Back</button>
                <button
                  onClick={() => setStep("subbrand")}
                  disabled={!distBrandValid()}
                  className={`px-4 py-2 text-sm font-semibold rounded transition-all ${
                    distBrandValid()
                      ? "bg-amber-500 hover:bg-amber-400 text-black"
                      : "bg-gray-700 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  Next →
                </button>
              </>
            )}

            {/* Distillery: subbrand → confirm */}
            {step === "subbrand" && (
              <>
                <button onClick={() => setStep("brand")} className="text-sm text-gray-500 hover:text-gray-300">← Back</button>
                <button
                  onClick={() => setStep("dist_confirm")}
                  disabled={!distSubBrandValid()}
                  className={`px-4 py-2 text-sm font-semibold rounded transition-all ${
                    distSubBrandValid()
                      ? "bg-amber-500 hover:bg-amber-400 text-black"
                      : "bg-gray-700 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  Review →
                </button>
              </>
            )}

            {/* Distillery: confirm → submit */}
            {step === "dist_confirm" && (
              <>
                <button onClick={() => setStep("subbrand")} className="text-sm text-gray-500 hover:text-gray-300">← Edit</button>
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

            {/* Bottle: details → confirm */}
            {step === "bottle_details" && (
              <>
                <button onClick={() => setStep("path")} className="text-sm text-gray-500 hover:text-gray-300">← Back</button>
                <button
                  onClick={() => setStep("bottle_confirm")}
                  disabled={!bottleDetailsValid()}
                  className={`px-4 py-2 text-sm font-semibold rounded transition-all ${
                    bottleDetailsValid()
                      ? "bg-amber-500 hover:bg-amber-400 text-black"
                      : "bg-gray-700 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  Review →
                </button>
              </>
            )}

            {/* Bottle: confirm → submit */}
            {step === "bottle_confirm" && (
              <>
                <button onClick={() => setStep("bottle_details")} className="text-sm text-gray-500 hover:text-gray-300">← Edit</button>
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
