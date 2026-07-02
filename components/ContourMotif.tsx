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
    "M110 12 A 68 68 0 1 1 109.9 12 Z",
    "M110 30 A 50 50 0 1 1 109.9 30 Z",
    "M110 48 A 32 32 0 1 1 109.9 48 Z",
    "M110 64 A 16 16 0 1 1 109.9 64 Z",
  ],
  channels: [
    "M20 20 C 60 40, 80 70, 110 80 C 140 90, 170 110, 185 140",
    "M45 12 C 75 40, 85 64, 112 74 C 145 86, 160 100, 172 128",
    "M20 20 C 40 60, 70 90, 110 80",
    "M110 80 C 120 105, 118 125, 130 148",
  ],
} as const;

export type MotifVariant = keyof typeof MOTIFS;

export default function ContourMotif({
  variant,
  className = "contour-motif pointer-events-none absolute -right-6 -top-6 h-28 w-36 text-ink/20 transition-colors duration-300 group-hover:text-flow/60",
}: {
  variant: MotifVariant;
  className?: string;
}) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 200 160"
      className={className}
      fill="none"
      style={{ ["--motif-len" as string]: 480 }}
    >
      {MOTIFS[variant].map((d, i) => (
        <path
          key={i}
          d={d}
          stroke="currentColor"
          strokeWidth={i % 2 === 0 ? 1.2 : 0.8}
          style={{ animationDelay: `${i * 70}ms` }}
        />
      ))}
    </svg>
  );
}
