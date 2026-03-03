import { fetchPendingSubmissions, fetchReviewedSubmissions } from "@/lib/supabase";
import { Submission, SubmissionData } from "@/types/whiskey";
import AdminActions from "./AdminActions";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function submissionTitle(s: Submission): string {
  const d = s.data as SubmissionData;
  if (s.type === "brand") {
    const bottleCount = d.bundledSubBrands?.flatMap((sb) => sb.bottles).length ?? 0;
    const suffix = bottleCount > 0 ? ` (${bottleCount} bottle${bottleCount > 1 ? "s" : ""})` : "";
    return (d.brandName ?? "Unnamed Brand") + suffix;
  }
  if (s.type === "sub_brand") return d.subBrandName ?? "Unnamed Sub-Brand";
  if (s.type === "correction") return s.parentName ?? "Unknown Bottle";
  return d.bottleName ?? "Unnamed Bottle";
}

function submissionDetail(s: Submission): string[] {
  const d = s.data as SubmissionData;
  const lines: string[] = [];
  if (s.type === "brand") {
    if (d.brandRegion) lines.push(`Region: ${d.brandRegion}`);
    if (d.brandIsNDP) lines.push("NDP: Yes");
    // Show bundled sub-brands and bottles
    d.bundledSubBrands?.forEach((sb) => {
      lines.push(`Sub-brand: ${sb.name}`);
      sb.bottles.forEach((bt) => {
        lines.push(`  · ${bt.name} — ${bt.abv}% ABV, $${bt.price}${bt.age ? `, ${bt.age}yr` : ""}${bt.style ? `, ${bt.style}` : ""}`);
      });
    });
  } else if (s.type === "sub_brand") {
    if (s.parentName) lines.push(`Brand: ${s.parentName}`);
  } else if (s.type === "correction") {
    if (d.bottleDescription) lines.push(`"${d.bottleDescription.slice(0, 120)}${d.bottleDescription.length > 120 ? "…" : ""}"`);
  } else {
    if (s.parentName) lines.push(`Sub-Brand: ${s.parentName}`);
    if (d.bottleAbv) lines.push(`ABV: ${d.bottleAbv}%`);
    if (d.bottlePrice) lines.push(`Price: $${d.bottlePrice}`);
    if (d.bottleAge) lines.push(`Age: ${d.bottleAge}yr`);
    if (d.bottleRarity) lines.push(`Rarity: ${d.bottleRarity}`);
    if (d.bottleSourceDistillery) lines.push(`Source: ${d.bottleSourceDistillery}`);
    if (d.bottleDescription) lines.push(`"${d.bottleDescription.slice(0, 80)}${d.bottleDescription.length > 80 ? "…" : ""}"`);
  }
  return lines;
}

const TYPE_COLORS: Record<string, string> = {
  brand: "rgba(245,158,11,0.2)",
  sub_brand: "rgba(59,130,246,0.2)",
  bottle: "rgba(34,197,94,0.2)",
  correction: "rgba(239,68,68,0.15)",
};
const TYPE_TEXT: Record<string, string> = {
  brand: "#f59e0b",
  sub_brand: "#60a5fa",
  bottle: "#4ade80",
  correction: "#f87171",
};

function TypeBadge({ type }: { type: string }) {
  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide"
      style={{
        background: TYPE_COLORS[type] ?? "rgba(255,255,255,0.1)",
        color: TYPE_TEXT[type] ?? "#f5f5f5",
      }}
    >
      {type.replace("_", " ")}
    </span>
  );
}

export default async function AdminPage() {
  let pending: Submission[] = [];
  let reviewed: Submission[] = [];
  let configError = false;

  try {
    [pending, reviewed] = await Promise.all([
      fetchPendingSubmissions(),
      fetchReviewedSubmissions(),
    ]);
  } catch {
    configError = true;
  }

  const approved = reviewed.filter((s) => s.status === "approved");
  const rejected = reviewed.filter((s) => s.status === "rejected");

  return (
    <main
      className="min-h-screen"
      style={{
        background: "linear-gradient(160deg, #0a0608 0%, #0f0a18 50%, #080a0f 100%)",
        color: "#f5f5f5",
      }}
    >
      {/* Header */}
      <header
        className="px-6 py-3 flex items-center gap-4"
        style={{ borderBottom: "1px solid rgba(245,158,11,0.2)" }}
      >
        <div className="flex flex-col leading-none select-none">
          <span style={{ fontSize: "9px", color: "rgba(245,158,11,0.7)", letterSpacing: "0.25em" }}>COMMON</span>
          <div style={{ height: "1px", background: "rgba(245,158,11,0.4)", margin: "2px 0" }} />
          <span className="font-bold uppercase" style={{ fontSize: "18px", color: "#f5f5f5", letterSpacing: "0.12em" }}>CASK</span>
        </div>
        <span className="text-xs" style={{ color: "rgba(245,158,11,0.5)" }}>Admin Dashboard</span>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-gray-500">
            {pending.length} pending · {approved.length} approved · {rejected.length} rejected
          </span>
          <a
            href="/"
            className="text-xs px-3 py-1.5 rounded-lg transition-colors"
            style={{ border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af" }}
          >
            ← Back to site
          </a>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-10">
        {configError && (
          <div
            className="rounded-xl p-4 text-sm"
            style={{ background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.3)", color: "#fca5a5" }}
          >
            <strong>Configuration error:</strong> Could not connect to Supabase. Ensure{" "}
            <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> is set in your{" "}
            <code className="font-mono">.env.local</code>.
          </div>
        )}

        {/* ── Pending ────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span style={{ color: "#f59e0b" }}>Pending Review</span>
            {pending.length > 0 && (
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}
              >
                {pending.length}
              </span>
            )}
          </h2>

          {pending.length === 0 ? (
            <p className="text-sm text-gray-500 italic">No pending submissions.</p>
          ) : (
            <div className="space-y-3">
              {pending.map((s) => (
                <div
                  key={s.id}
                  className="rounded-xl p-4"
                  style={{
                    background: "rgba(10,10,20,0.85)",
                    border: "1px solid rgba(245,158,11,0.15)",
                  }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <TypeBadge type={s.type} />
                        <span className="font-semibold text-sm truncate">{submissionTitle(s)}</span>
                      </div>
                      <div className="space-y-0.5 text-xs text-gray-400">
                        {submissionDetail(s).map((line, i) => (
                          <div key={i}>{line}</div>
                        ))}
                        <div className="text-gray-600 mt-1">Submitted {formatDate(s.submittedAt)}</div>
                      </div>
                    </div>
                    <AdminActions id={s.id} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── History ────────────────────────────────────────────────── */}
        {reviewed.length > 0 && (
          <section>
            <h2 className="text-lg font-bold mb-4" style={{ color: "#9ca3af" }}>
              Recent History
            </h2>
            <div className="space-y-2">
              {reviewed.map((s) => (
                <div
                  key={s.id}
                  className="rounded-xl px-4 py-3 flex items-center gap-3"
                  style={{
                    background: "rgba(10,10,20,0.5)",
                    border: s.status === "approved"
                      ? "1px solid rgba(34,197,94,0.15)"
                      : "1px solid rgba(220,38,38,0.15)",
                    opacity: 0.8,
                  }}
                >
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={
                      s.status === "approved"
                        ? { background: "rgba(34,197,94,0.15)", color: "#4ade80" }
                        : { background: "rgba(220,38,38,0.15)", color: "#f87171" }
                    }
                  >
                    {s.status === "approved" ? "✓ Approved" : "✕ Rejected"}
                  </span>
                  <TypeBadge type={s.type} />
                  <span className="text-sm flex-1 truncate">{submissionTitle(s)}</span>
                  {s.adminNote && (
                    <span className="text-xs text-gray-500 italic truncate max-w-xs">
                      Note: {s.adminNote}
                    </span>
                  )}
                  <span className="text-xs text-gray-600 flex-shrink-0">
                    {s.reviewedAt ? formatDate(s.reviewedAt) : "—"}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
