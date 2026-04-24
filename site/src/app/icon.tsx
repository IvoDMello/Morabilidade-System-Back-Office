import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 64,
          height: 64,
          background: "#585a4f",
          borderRadius: 12,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
        }}
      >
        {/* Building silhouette */}
        <svg width="26" height="18" viewBox="0 0 26 18" fill="none">
          <rect x="1" y="6" width="7" height="12" fill="#d8cb6a" />
          <rect x="10" y="0" width="6" height="18" fill="#d8cb6a" />
          <rect x="18" y="4" width="7" height="14" fill="#d8cb6a" />
        </svg>
        {/* MORA text */}
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: "#d8cb6a",
            letterSpacing: "0.5px",
            lineHeight: 1,
            fontFamily: "sans-serif",
          }}
        >
          MORA
        </div>
      </div>
    ),
    { ...size }
  );
}
