import { ImageResponse } from "next/og";

// Generated OG / Twitter card. File-based metadata — Next wires this in automatically.
export const runtime = "edge";
export const alt =
  "Harvey Houlahan — ML Systems Engineer. Applied AI integration, including RAG and fine-tuned open-source models, and GPU simulation, proven in climate, carbon and spatial data.";
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
          backgroundColor: "#ECEFEA",
          color: "#161F1B",
          padding: "72px",
          fontFamily: "Helvetica, Arial, sans-serif",
          borderLeft: "16px solid #14655A",
        }}
      >
        <div
          style={{
            fontSize: 26,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: "#14655A",
            fontFamily: "monospace",
          }}
        >
          ML Systems Engineering
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 84, lineHeight: 1.05, fontWeight: 700, letterSpacing: -2 }}>Harvey Houlahan</div>
          <div
            style={{
              fontSize: 34,
              marginTop: 24,
              lineHeight: 1.35,
              color: "#3d4a44",
              fontFamily: "Helvetica, Arial, sans-serif",
            }}
          >
            Applied AI integration and GPU simulation, proven in climate, carbon and spatial data
          </div>
        </div>
        <div
          style={{
            fontSize: 24,
            color: "#161F1B",
            fontFamily: "monospace",
            letterSpacing: 1,
          }}
        >
          PyTorch · FastAPI · PostGIS · React/MapLibre &nbsp;&nbsp;/&nbsp;&nbsp; Byron Bay · remote
        </div>
      </div>
    ),
    { ...size }
  );
}
