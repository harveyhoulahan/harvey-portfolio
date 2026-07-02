"use client";

/*
 * Signature element: a real map of Byron Bay, rendered as a caldera-teal duotone.
 *
 * Basemap is Esri World Imagery (free, no API key, CORS-enabled, reliable), so
 * the actual coastline / Cape Byron / beaches are recognisable. The imagery is
 * desaturated and a deep-teal gradient is blended over it (mix-blend-mode:
 * color) for the signature duotone. If WebGL or the tiles are unavailable we
 * fall back to a static coordinate card so the hero never shows an empty box.
 */

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { profile } from "@/data/metadata";

const BYRON = { lng: profile.coordinates.lng, lat: profile.coordinates.lat };
// Framed on Cape Byron — the easternmost point of mainland Australia.
const CENTER: [number, number] = [153.628, -28.642];

const SAT =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export default function ByronMap() {
  const wrap = useRef<HTMLDivElement>(null);
  const mapDiv = useRef<HTMLDivElement>(null);
  const marker = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    if (!mapDiv.current) return;
    if (!hasWebGL()) {
      setErr(true);
      return;
    }

    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: mapDiv.current,
        style: {
          version: 8,
          sources: {
            sat: {
              type: "raster",
              tiles: [SAT],
              tileSize: 256,
              maxzoom: 19,
              attribution: "Imagery &copy; Esri",
            },
          },
          layers: [{ id: "sat", type: "raster", source: "sat" }],
        },
        center: CENTER,
        zoom: 11.5,
        minZoom: 9.5,
        maxZoom: 15,
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
      });
    } catch {
      setErr(true);
      return;
    }

    map.scrollZoom.disable();
    map.touchZoomRotate.disableRotation();

    const place = () => {
      if (!marker.current) return;
      const p = map.project([BYRON.lng, BYRON.lat]);
      marker.current.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
    };
    map.on("load", place);
    map.on("move", place);
    map.on("resize", place);

    return () => map.remove();
  }, []);

  if (err) {
    return (
      <div
        className="relative flex h-full min-h-[260px] w-full flex-col items-center justify-center overflow-hidden border border-contour text-center"
        style={{ background: "#0b1512" }}
      >
        <span className="mono-label" style={{ color: "rgba(214,236,229,0.85)" }}>
          Byron Bay, NSW
        </span>
        <span className="mt-2 font-mono text-sm" style={{ color: "rgba(214,236,229,0.55)" }}>
          {profile.coordinates.label}
        </span>
      </div>
    );
  }

  return (
    <div
      ref={wrap}
      aria-label="Map of Byron Bay, New South Wales"
      className="relative h-full min-h-[260px] w-full overflow-hidden border border-contour"
      style={{ background: "#0b1512", isolation: "isolate" }}
    >
      {/* desaturated satellite basemap */}
      <div
        ref={mapDiv}
        className="h-full w-full"
        style={{ filter: "grayscale(1) contrast(1.05) brightness(1.05)" }}
      />
      {/* caldera-teal duotone — imposes hue, keeps satellite luminance */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, #0e2b26 0%, #14655a 52%, #6fb8aa 100%)",
          mixBlendMode: "color",
        }}
      />
      {/* subtle highlight to lift the contrast */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, rgba(126,206,188,0.16) 0%, transparent 45%)",
          mixBlendMode: "screen",
        }}
      />
      {/* depth vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 95% at 50% 38%, transparent 55%, rgba(6,16,13,0.55) 100%)",
        }}
      />
      {/* Byron Bay marker (crisp, above the blend layers) */}
      <div ref={marker} className="pointer-events-none absolute left-0 top-0 z-10">
        <span
          className="block h-3 w-3"
          style={{
            background: "#ff8a5c",
            boxShadow:
              "0 0 0 4px rgba(255,138,92,0.30), 0 0 16px rgba(255,138,92,0.80)",
          }}
        />
      </div>
      <div
        className="pointer-events-none absolute bottom-3 left-3 z-10 font-mono text-[11px] uppercase tracking-[0.18em]"
        style={{ color: "rgba(214,236,229,0.92)" }}
      >
        Byron Bay · {profile.coordinates.label}
        <span style={{ color: "rgba(214,236,229,0.5)" }}> · Esri</span>
      </div>
    </div>
  );
}
