import { ImageResponse } from "next/og";
import { brand } from "@/config/brand";

// The picture shown when the site is shared on LinkedIn, X, Slack or WhatsApp. Also used as the
// Twitter card image (layout metadata). Brand colours as in globals.css.
export const alt = `${brand.fullName}: ${brand.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "radial-gradient(circle at 80% 10%, #3a1347 0%, #0b1026 55%)",
          color: "#f5f3ff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 34, fontWeight: 600 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: "linear-gradient(135deg, #c4006a 0%, #ff7a3d 58%, #ffd700 100%)",
            }}
          />
          {brand.fullName}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.08, letterSpacing: -1.5 }}>
            Find the B2B partners worth pitching.
          </div>
          <div style={{ fontSize: 30, color: "#c9c3e6" }}>
            Design and automate your pitches and multi-channel outreach with frontier AI models.
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 24, color: "#ffd700", letterSpacing: 4, textTransform: "uppercase" }}>
          B2B partnership &amp; GTM intelligence
        </div>
      </div>
    ),
    size,
  );
}
