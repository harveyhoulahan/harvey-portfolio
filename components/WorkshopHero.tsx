"use client";

import { useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import TextCursorProximity from "@/components/ui/text-cursor-proximity";
import { useProximityHeadingStyles } from "@/hooks/use-proximity-heading-colors";
import { caseStudies } from "@/data/projects";

export default function WorkshopHero() {
  const heroRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const headingStyles = useProximityHeadingStyles("scale(1.12)");

  // Triple the list so the marquee loop reads as seamless.
  const marqueeItems = [...caseStudies, ...caseStudies, ...caseStudies];

  return (
    <div
      ref={heroRef}
      className="graticule-grid relative overflow-hidden border-b border-contour"
    >
      <div className="col-shell flex min-h-[70vh] max-w-work flex-col justify-between py-16 md:py-24">
        <div className="flex flex-1 flex-col justify-center">
          <span className="mono-label">Selected work · 2021–2026</span>
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

        {/* Auto-scrolling project name pills */}
        <div className="mt-12 w-full overflow-hidden border-t border-contour pt-8">
          <motion.div
            className="flex w-max items-center gap-4"
            animate={reduceMotion ? undefined : { x: ["0%", "-33.333%"] }}
            transition={{
              x: {
                repeat: Infinity,
                repeatType: "loop",
                duration: 45,
                ease: "linear",
              },
            }}
          >
            {marqueeItems.map((project, index) => (
              <span
                key={`${project.id}-${index}`}
                className="inline-flex shrink-0 items-center gap-2 border border-contour bg-terrace px-5 py-2 font-mono text-xs uppercase tracking-[0.12em] text-ink/70"
              >
                <span
                  className="h-1.5 w-1.5 bg-flow"
                  aria-hidden
                />
                {project.company}
              </span>
            ))}
          </motion.div>
        </div>
      </div>

      <span className="pointer-events-none absolute right-6 top-8 hidden font-mono text-xs uppercase tracking-[0.3em] text-ink/40 md:block">
        2021—2026
      </span>
    </div>
  );
}
