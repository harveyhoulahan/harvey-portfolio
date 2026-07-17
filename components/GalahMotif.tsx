"use client";

/*
 * Galah proof-card motif: line-bird from the reference doodle.
 * Body, triangle beak, eye, leaf wing, pointed tail.
 */

import { cn } from "@/lib/utils";

export default function GalahMotif({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 160"
      fill="none"
      aria-hidden
      className={cn(
        "contour-motif pointer-events-none absolute right-0 -top-5 z-0 h-24 w-32 text-ink/18 transition-colors duration-300 group-hover:text-flow/55",
        className
      )}
      style={{ ["--motif-len" as string]: 300 }}
    >
      {/* head + body, one continuous outline */}
      <path
        d="M 120 46
           C 148 42, 168 60, 166 86
           C 164 112, 142 130, 112 128
           C 82 126, 62 104, 66 78
           C 70 56, 92 48, 120 46 Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.35}
        style={{ animationDelay: "0ms" }}
      />

      {/* beak: small triangle */}
      <path
        d="M 164 74 L 186 84 L 164 94 Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth={1.2}
        style={{ animationDelay: "40ms" }}
      />

      {/* eye */}
      <circle cx="148" cy="72" r="3.6" fill="currentColor" stroke="none" />

      {/* wing: leaf shape + inner stroke */}
      <path
        d="M 104 78
           C 128 72, 150 84, 146 108
           C 144 118, 128 120, 112 110
           C 100 102, 98 88, 104 78 Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.15}
        style={{ animationDelay: "80ms" }}
      />
      <path
        d="M 112 86 C 130 90, 138 100, 136 112"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth={1}
        opacity={0.7}
        style={{ animationDelay: "110ms" }}
      />

      {/* tail: two lines to a tip */}
      <path
        d="M 78 118
           C 58 130, 42 144, 34 156
           M 78 118
           C 64 134, 50 148, 42 158"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.2}
        style={{ animationDelay: "130ms" }}
      />
    </svg>
  );
}
