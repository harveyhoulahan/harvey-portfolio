"use client";

/*
 * PageRank proof-card motif — simple abstract surfboard.
 * Almond outline, center stringer, two tail fins. Draw-in on hover.
 */

import { cn } from "@/lib/utils";

export default function SurferMotif({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 160"
      fill="none"
      aria-hidden
      className={cn(
        "contour-motif pointer-events-none absolute -right-6 -top-6 z-0 h-28 w-36 text-ink/20 transition-colors duration-300 group-hover:text-flow/60",
        className
      )}
      style={{ ["--motif-len" as string]: 300 }}
    >
      <g transform="rotate(24, 104, 84)">
        <path
          d="M 104 30 C 120 38, 126 64, 124 90 C 122 114, 110 128, 104 130 C 98 128, 86 114, 84 90 C 82 64, 88 38, 104 30 Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.2}
          style={{ animationDelay: "0ms" }}
        />
        <path
          d="M 104 36 L 104 122"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth={0.9}
          opacity={0.5}
          style={{ animationDelay: "70ms" }}
        />
        <path
          d="M 88 124 Q 80 132, 86 136 M 120 124 Q 128 132, 122 136"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth={0.9}
          opacity={0.65}
          style={{ animationDelay: "130ms" }}
        />
      </g>
    </svg>
  );
}
