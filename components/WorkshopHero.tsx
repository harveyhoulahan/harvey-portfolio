"use client";

import { useRef } from "react";
import TextCursorProximity from "@/components/ui/text-cursor-proximity";
import NeuralMesh from "@/components/NeuralMesh";
import { useProximityHeadingStyles } from "@/hooks/use-proximity-heading-colors";

export default function WorkshopHero() {
  const heroRef = useRef<HTMLDivElement>(null);
  const headingStyles = useProximityHeadingStyles("scale(1.12)");

  return (
    <div
      ref={heroRef}
      className="graticule-grid relative overflow-hidden border-b border-contour"
    >
      {/* Neural mesh lives behind the headline — signals hop the plexus while
          the type reacts to the same cursor above it. */}
      <NeuralMesh className="absolute inset-0 h-full w-full" />
      <div className="col-shell relative flex min-h-[70vh] max-w-work flex-col justify-between py-16 md:py-24">
        <div className="flex flex-1 flex-col justify-center">
          <span className="mono-label">Selected work · 2024–2026</span>
          <h1 className="mt-6 font-display leading-[0.85]">
            <TextCursorProximity
              label="THE"
              className="block text-[15vw] font-semibold tracking-tight md:text-[min(12rem,13vw)]"
              styles={headingStyles}
              falloff="gaussian"
              radius={150}
              containerRef={heroRef}
            />
            <TextCursorProximity
              label="WORKSHOP"
              className="block text-[15vw] font-semibold tracking-tight md:text-[min(12rem,13vw)]"
              styles={headingStyles}
              falloff="gaussian"
              radius={150}
              containerRef={heroRef}
            />
          </h1>
        </div>

      </div>

      <span className="pointer-events-none absolute right-6 top-8 hidden font-mono text-xs uppercase tracking-[0.3em] text-ink/40 md:block">
        2024—2026
      </span>
    </div>
  );
}
