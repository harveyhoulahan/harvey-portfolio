"use client";

/*
 * Elevation cross-section — the survey profile that runs above the footer.
 * A hand-drawn transect from the Nightcap Range down to the coast: peaks,
 * the caldera dip, then the long fall to sea level. The profile line draws
 * itself in when scrolled into view (once), like a plotter tracing the sheet.
 * Static under prefers-reduced-motion; hidden entirely on the demo routes.
 *
 * Easter egg: click the red benchmark at the summit to plant a survey flag.
 */

import { useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const PROFILE =
  "M0 96 L60 90 C 120 82 150 58 200 34 C 228 21 258 26 288 44 " +
  "C 318 62 348 70 388 66 C 428 62 466 42 508 38 C 548 35 578 52 618 64 " +
  "C 658 76 700 80 750 84 C 820 90 900 94 980 97 L1100 99 L1200 99";

export default function ElevationProfile() {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const [flag, setFlag] = useState(false);
  if (pathname === "/genesis" || pathname === "/catchment") return null;

  return (
    <div aria-hidden className="pointer-events-none select-none">
      <svg
        viewBox="0 0 1200 110"
        preserveAspectRatio="none"
        className="block h-16 w-full md:h-20"
        fill="none"
      >
        {/* sea-level datum with survey ticks */}
        <line
          x1="0"
          y1="100"
          x2="1200"
          y2="100"
          stroke="var(--contour)"
          strokeWidth="1"
        />
        {Array.from({ length: 24 }, (_, i) => (
          <line
            key={i}
            x1={i * 50 + 25}
            y1="100"
            x2={i * 50 + 25}
            y2={i % 4 === 0 ? 93 : 96}
            stroke="var(--contour)"
            strokeWidth="1"
          />
        ))}
        {/* the transect */}
        <motion.path
          d={PROFILE}
          stroke="var(--flow)"
          strokeWidth="1.6"
          strokeLinecap="round"
          initial={reduceMotion ? { pathLength: 1 } : { pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 1.8, ease: [0.65, 0, 0.35, 1] }}
        />
        {/* benchmark at the summit + CIR canopy tick on the range */}
        <motion.g
          initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ delay: reduceMotion ? 0 : 1.1, duration: 0.5 }}
        >
          <rect x="197" y="27" width="6" height="6" fill="var(--infra)" />
          <line
            x1="200"
            y1="34"
            x2="200"
            y2="100"
            stroke="var(--contour)"
            strokeWidth="1"
            strokeDasharray="2 4"
          />
        </motion.g>
        {/* summit flag — planted by whoever finds the benchmark */}
        <g transform="translate(200 32)">
          <AnimatePresence>
            {flag && (
              <motion.g
                initial={reduceMotion ? { scaleY: 1 } : { scaleY: 0 }}
                animate={{ scaleY: 1 }}
                exit={{ scaleY: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 340, damping: 18 }}
                style={{ transformBox: "fill-box", originX: 0, originY: 1 }}
              >
                <line
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="-22"
                  stroke="var(--foreground)"
                  strokeWidth="1.4"
                />
                <path d="M0 -22 L15 -17.5 L0 -13 Z" fill="var(--infra)" />
              </motion.g>
            )}
          </AnimatePresence>
        </g>
        {/* invisible hit area over the benchmark */}
        <rect
          x="190"
          y="18"
          width="20"
          height="22"
          fill="transparent"
          className="pointer-events-auto cursor-pointer"
          onClick={() => setFlag((f) => !f)}
        />
      </svg>
    </div>
  );
}
