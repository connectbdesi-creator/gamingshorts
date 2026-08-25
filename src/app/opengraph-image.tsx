import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#09090b",
          color: "#f4f4f5",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 96, fontWeight: 700 }}>
          <span>Game</span>
          <span style={{ color: "#7c5cff" }}>Shorts</span>
        </div>
        <div style={{ display: "flex", fontSize: 36, color: "#a1a1aa", marginTop: 16 }}>
          Gaming news in 60 words. Every 2 hours.
        </div>
      </div>
    ),
    { ...size }
  );
}
