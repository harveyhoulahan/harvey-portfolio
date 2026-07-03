"use client";

/*
 * Deferred ByronMap. maplibre-gl is ~200 kB of the homepage's first-load JS for
 * one duotone hero map, so it's split out and hydrated after the hero copy and
 * CTAs paint. The loading state mirrors ByronMap's own no-WebGL coordinate card,
 * so the swap reads as the map "developing" rather than popping in.
 */

import dynamic from "next/dynamic";
import { profile } from "@/data/metadata";

function CoordinateCard() {
  return (
    <div className="byron-map-shell relative flex h-full min-h-[260px] w-full flex-col items-center justify-center overflow-hidden border border-contour text-center">
      <span className="mono-label" style={{ color: "rgba(214,236,229,0.85)" }}>
        Byron Bay, NSW
      </span>
      <span className="mt-2 font-mono text-sm" style={{ color: "rgba(214,236,229,0.55)" }}>
        {profile.coordinates.label}
      </span>
    </div>
  );
}

const ByronMapLazy = dynamic(() => import("@/components/ByronMap"), {
  ssr: false,
  loading: CoordinateCard,
});

export default ByronMapLazy;
