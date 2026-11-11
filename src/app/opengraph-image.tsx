import { ImageResponse } from "next/og";
import { getCatalog } from "@/lib/catalog";

// The card shown when a Common Cask link is shared (and the image Google may
// show beside a result). Inherited by every page that doesn't define its own.
export const alt = "Common Cask — American Whiskey Explorer";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 86400;

export default async function OpengraphImage() {
  const { brands, bottles } = await getCatalog();

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
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 34, letterSpacing: 14, color: "rgba(90,60,20,0.75)" }}>COMMON</div>
          <div style={{ width: 330, height: 2, background: "rgba(90,60,20,0.4)", margin: "10px 0 6px" }} />
          <div style={{ fontSize: 132, fontWeight: 700, letterSpacing: 16, color: "#8b1515", lineHeight: 1 }}>CASK</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 54, lineHeight: 1.15 }}>Explore American whiskey by distillery, style, price and rarity.</div>
          <div
            style={{
              display: "flex",
              marginTop: 28,
              paddingTop: 24,
              borderTop: "2px solid rgba(13,11,8,0.15)",
              fontSize: 30,
              color: "rgba(13,11,8,0.65)",
            }}
          >
            {brands.length} distilleries · {bottles.length} bottles · no paid rankings
          </div>
        </div>
      </div>
    ),
    size
  );
}
