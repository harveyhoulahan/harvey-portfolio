"use client";

/*
 * Pretraining proof-card motif — descending validation loss curve.
 * Hand-drawn step path with axis floor and terminal dot. Draw-in on hover.
 */

import { cn } from "@/lib/utils";

export default function PretrainingMotif({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 160"
      fill="none"
      aria-hidden
      className={cn(
        "contour-motif pointer-events-none absolute -right-6 -top-6 z-0 h-28 w-36 text-ink/20 transition-colors duration-300 group-hover:text-flow/60",
        className
      )}
      style={{ ["--motif-len" as string]: 320 }}
    >
      <path
        d="M 36 128 L 158 128"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth={0.85}
        opacity={0.35}
        style={{ animationDelay: "0ms" }}
      />
      <path
        d="M 40 38 C 58 46, 74 58, 88 72 C 102 86, 118 102, 134 114 C 144 120, 150 124, 154 126"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.2}
        style={{ animationDelay: "60ms" }}
      />
      <path
        d="M 88 72 m -2 0 a 2 2 0 1 0 4 0 a 2 2 0 1 0 -4 0 M 134 114 m -2 0 a 2 2 0 1 0 4 0 a 2 2 0 1 0 -4 0 M 154 126 m -2.5 0 a 2.5 2.5 0 1 0 5 0 a 2.5 2.5 0 1 0 -5 0"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth={1}
        opacity={0.7}
        style={{ animationDelay: "140ms" }}
      />
    </svg>
  );
}
