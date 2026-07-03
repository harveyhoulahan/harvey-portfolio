// Hand-drawn contour motifs — nested closed loops like a hill on a topo sheet
// ("basin"), concentric Lenia rings ("rings"), and a braided channel pair
// ("channels"). Pure SVG strokes; they redraw on card hover via
// stroke-dashoffset (see .contour-motif in globals.css).
const MOTIFS = {
  basin: [
    "M30 90 C 20 55, 60 22, 110 30 C 158 38, 180 68, 168 98 C 156 128, 96 140, 62 126 C 36 115, 36 104, 30 90 Z",
    "M52 88 C 46 64, 76 42, 110 47 C 144 52, 158 72, 150 93 C 142 114, 98 122, 74 111 C 58 103, 56 98, 52 88 Z",
    "M74 86 C 71 72, 90 60, 110 63 C 130 66, 138 78, 133 90 C 128 102, 102 106, 88 99 C 79 94, 76 92, 74 86 Z",
    "M94 84 C 93 77, 102 72, 111 74 C 120 76, 123 82, 120 87 C 117 92, 105 93, 99 90 C 96 88, 95 87, 94 84 Z",
  ],
  rings: [
    // Wobbly, hand-drawn rings — slightly off-centre, like a rushed pen pass.
    "M 38 72 C 24 38, 58 6, 96 8 C 142 10, 186 38, 188 78 C 190 118, 152 158, 104 156 C 56 154, 14 118, 18 76 C 20 68, 28 62, 38 72 Z",
    "M 52 74 C 42 48, 68 24, 94 26 C 128 28, 162 52, 164 80 C 166 108, 138 138, 102 136 C 66 134, 38 108, 40 78 C 41 72, 46 68, 52 74 Z",
    "M 66 76 C 58 56, 78 38, 98 40 C 122 42, 146 62, 148 84 C 150 106, 128 126, 104 124 C 80 122, 60 102, 62 80 C 63 76, 64 74, 66 76 Z",
    "M 82 78 C 76 64, 90 52, 102 54 C 116 56, 128 68, 130 82 C 132 96, 120 110, 106 108 C 92 106, 82 94, 84 82 C 85 79, 83 78, 82 78 Z",
  ],
  channels: [
    "M20 20 C 60 40, 80 70, 110 80 C 140 90, 170 110, 185 140",
    "M45 12 C 75 40, 85 64, 112 74 C 145 86, 160 100, 172 128",
    "M20 20 C 40 60, 70 90, 110 80",
    "M110 80 C 120 105, 118 125, 130 148",
  ],
  // Scattered organic loops — particle-life swarms, not concentric rings.
  swarm: [
    "M 132 22 C 118 10, 148 8, 162 22 C 176 36, 158 52, 140 46 C 122 40, 128 28, 132 22 Z",
    "M 168 48 C 156 38, 182 34, 192 50 C 202 66, 184 76, 168 70 C 152 64, 160 52, 168 48 Z",
    "M 118 58 C 108 48, 128 42, 138 54 C 148 66, 132 74, 120 68 C 108 62, 112 54, 118 58 Z",
    "M 145 82 C 158 74, 178 78, 186 94 C 194 110, 172 118, 154 110 C 136 102, 132 90, 145 82 Z",
  ],
  // Slanted, hand-drawn timeline ladder — rails lean right, rungs wobble subtly.
  traverse: [
    "M 68 12 C 70 42, 66 72, 74 102 C 78 132, 72 148, 84 156",
    "M 104 8 C 108 38, 102 68, 110 98 C 114 128, 106 146, 118 154",
    "M 72 36 C 84 34, 96 38, 108 36",
    "M 74 68 C 86 66, 98 70, 110 68",
    "M 76 100 C 88 98, 100 102, 112 100",
    "M 78 132 C 90 130, 102 134, 114 132",
  ],
} as const;

export type MotifVariant = keyof typeof MOTIFS;

/** Staggered draw — each loop finishes on its own clock. */
const DRAW_TIMING = [
  { delay: "0.08s", duration: "1.7s", ease: "cubic-bezier(0.42, 0.02, 0.28, 1)" },
  { delay: "0.42s", duration: "0.9s", ease: "cubic-bezier(0.55, 0.12, 0.32, 1)" },
  { delay: "0.65s", duration: "1.45s", ease: "cubic-bezier(0.38, 0.04, 0.22, 1)" },
  { delay: "0.22s", duration: "1.05s", ease: "cubic-bezier(0.48, 0.08, 0.26, 1)" },
] as const;

/** Timeline ladder — spine and rails draw down, rungs follow top to bottom. */
const TRAVERSE_DRAW_TIMING = [
  { delay: "0s", duration: "1.4s", ease: "cubic-bezier(0.33, 0.02, 0.18, 1)" },
  { delay: "0.1s", duration: "1.4s", ease: "cubic-bezier(0.35, 0.03, 0.2, 1)" },
  { delay: "0.45s", duration: "0.34s", ease: "cubic-bezier(0.4, 0.05, 0.25, 1)" },
  { delay: "0.58s", duration: "0.34s", ease: "cubic-bezier(0.4, 0.05, 0.25, 1)" },
  { delay: "0.71s", duration: "0.34s", ease: "cubic-bezier(0.4, 0.05, 0.25, 1)" },
  { delay: "0.84s", duration: "0.34s", ease: "cubic-bezier(0.4, 0.05, 0.25, 1)" },
] as const;

function drawTimingFor(variant: MotifVariant, index: number) {
  const table = variant === "traverse" ? TRAVERSE_DRAW_TIMING : DRAW_TIMING;
  return table[index] ?? table[table.length - 1];
}

export default function ContourMotif({
  variant,
  className = "contour-motif pointer-events-none absolute -right-6 -top-6 h-28 w-36 text-ink/20 transition-colors duration-300 group-hover:text-flow/60",
  animateOnLoad = false,
}: {
  variant: MotifVariant;
  className?: string;
  animateOnLoad?: boolean;
}) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 200 160"
      className={`${className}${animateOnLoad ? " contour-motif-draw" : ""}`}
      fill="none"
      style={{ ["--motif-len" as string]: 480 }}
    >
      {MOTIFS[variant].map((d, i) => {
        const draw = animateOnLoad ? drawTimingFor(variant, i) : null;
        const thin = variant === "traverse";
        return (
          <path
            key={i}
            d={d}
            pathLength={draw ? 1 : undefined}
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={thin ? (i < 2 ? 1.05 : 0.82) : i % 2 === 0 ? 1.2 : 0.85}
            style={
              draw
                ? {
                    animationDelay: draw.delay,
                    animationDuration: draw.duration,
                    animationTimingFunction: draw.ease,
                  }
                : { animationDelay: `${i * 70}ms` }
            }
          />
        );
      })}
    </svg>
  );
}
