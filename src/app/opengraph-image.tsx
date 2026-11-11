import { ImageResponse } from "next/og";
import { getCatalog } from "@/lib/catalog";
import { MARK_INNER, MARK_OUTER } from "@/components/Logo";

// The card shown when a Common Cask link is shared (and the image Google may
// show beside a result). Inherited by every page that doesn't define its own.
export const alt = "Common Cask — American Whiskey Explorer";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 86400;

const WORDMARK = "Common Cask";
const TAGLINE = "Explore American whiskey by distillery, style, price and rarity.";

/**
 * The logo's typeface for the picture. Images are drawn outside the browser,
 * so the font has to be handed over as a file; Google Fonts serves just the
 * characters asked for. Returns null if the request fails — the card then
 * renders in the default typeface rather than not at all.
 */
async function loadFraunces(weight: number, text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@72,${weight}&text=${encodeURIComponent(text)}`
    ).then((r) => r.text());
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    if (!url) return null;
    const file = await fetch(url);
    return file.ok ? await file.arrayBuffer() : null;
  } catch {
    return null;
  }
}

export default async function OpengraphImage() {
  const { brands, bottles } = await getCatalog();
  const stats = `${brands.length} distilleries · ${bottles.length} bottles · no paid rankings`;

  // Both weights must cover every character drawn in them; a letter missing
  // from one would be drawn in a different typeface mid-word.
  const [bold, regular] = await Promise.all([
    loadFraunces(600, WORDMARK),
    loadFraunces(400, TAGLINE + stats + "0123456789"),
  ]);
  const haveFonts = bold !== null && regular !== null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#f0e8d8",
          color: "#0d0b08",
          padding: "72px 80px",
          fontFamily: haveFonts ? "Fraunces" : undefined,
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <svg width="150" height="150" viewBox="0 0 64 64" fill="none">
            <path d={MARK_OUTER} stroke="#0d0b08" strokeWidth="7" strokeLinecap="round" />
            <path d={MARK_INNER} stroke="#8b1515" strokeWidth="7" strokeLinecap="round" />
          </svg>
          <div style={{ marginLeft: 34, fontSize: 104, fontWeight: 600, letterSpacing: -2, lineHeight: 1 }}>
            {WORDMARK}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 52, fontWeight: 400, lineHeight: 1.18 }}>{TAGLINE}</div>
          <div
            style={{
              display: "flex",
              marginTop: 28,
              paddingTop: 24,
              borderTop: "2px solid rgba(13,11,8,0.15)",
              fontSize: 30,
              fontWeight: 400,
              color: "rgba(13,11,8,0.65)",
            }}
          >
            {stats}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: haveFonts
        ? [
            { name: "Fraunces", data: bold, weight: 600, style: "normal" },
            { name: "Fraunces", data: regular, weight: 400, style: "normal" },
          ]
        : undefined,
    }
  );
}
