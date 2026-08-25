import { ImageResponse } from "next/og";

// Larger companion to icon.tsx (Next serves numbered icon variants at
// /icon1, /icon2, ...) — 512x512 is what the web app manifest and Android
// installability checks expect in addition to the 192x192 one.
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#7c5cff",
          color: "#ffffff",
          fontFamily: "sans-serif",
          fontSize: 280,
          fontWeight: 700,
        }}
      >
        GS
      </div>
    ),
    { ...size }
  );
}
