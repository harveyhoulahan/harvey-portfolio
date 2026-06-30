import { ImageResponse } from "next/og";

// Generated OG / Twitter card. File-based metadata — Next wires this in automatically.
export const runtime = "edge";
export const alt =
  "Harvey Houlahan — Geospatial ML Infrastructure Engineer. Production spatial data systems for climate, carbon & nature tech.";
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
          backgroundColor: "#F7F5F0",
          color: "#1A1A18",
          padding: "72px",
          fontFamily: "Georgia, serif",
          borderLeft: "16px solid #4A6741",
        }}
      >
        <div
          style={{
            fontSize: 26,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: "#4A6741",
            fontFamily: "monospace",
          }}
        >
          Geospatial ML Infrastructure
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 84, lineHeight: 1.05 }}>Harvey Houlahan</div>
          <div
            style={{
              fontSize: 34,
              marginTop: 24,
              lineHeight: 1.35,
              color: "#3a3a36",
              fontFamily: "Helvetica, Arial, sans-serif",
            }}
          >
            Production spatial data systems for climate, carbon &amp; nature tech
          </div>
        </div>
        <div
          style={{
            fontSize: 24,
            color: "#1A1A18",
            fontFamily: "monospace",
            letterSpacing: 1,
          }}
        >
          FastAPI · PostGIS · React/MapLibre · Docker &nbsp;&nbsp;/&nbsp;&nbsp; Byron Bay · remote
        </div>
      </div>
    ),
    { ...size }
  );
}
