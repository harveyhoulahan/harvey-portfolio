"use client";

/*
 * About, staged as a survey traverse. The four bio paragraphs (all copy from
 * data/metadata.ts, untouched) become numbered stations down a dashed
 * traverse line — diamond benchmarks at each station, the unused about.intro
 * line as a teal display lede, cursor-proximity type on the heading, and a
 * "Currently" legend card with a live Byron Bay clock.
 */

import { useRef } from "react";
import TextCursorProximity from "@/components/ui/text-cursor-proximity";
import ContourMotif from "@/components/ContourMotif";
import Reveal from "@/components/Reveal";
import LocalClock from "@/components/LocalClock";
import { useProximityHeadingStyles } from "@/hooks/use-proximity-heading-colors";
import { about, profile } from "@/data/metadata";

export default function AboutStory() {
  const headerRef = useRef<HTMLDivElement>(null);
  const headingStyles = useProximityHeadingStyles("scale(1.06)");

  return (
    <div className="py-20 md:py-28">
      {/* Header */}
      <div ref={headerRef} className="col-shell relative max-w-prose">
        <ContourMotif
          variant="rings"
          className="contour-motif pointer-events-none absolute -top-8 right-0 hidden h-40 w-52 text-ink/10 md:block"
        />
        <span className="mono-label">About</span>
        <h1 className="mt-5 font-display">
          <TextCursorProximity
            label="ML systems engineer; spatial, full-stack, simulation & applied AI."
            className="block"
            styles={headingStyles}
            falloff="gaussian"
            radius={120}
            containerRef={headerRef}
          />
        </h1>
        <p className="mt-6 font-display text-xl leading-snug text-flow md:text-2xl">
          {about.intro}
        </p>
      </div>

      {/* The traverse — one station per paragraph */}
      <div className="mx-auto max-w-prose px-6">
        <div className="relative mt-14 space-y-12 border-l border-dashed border-contour pl-8 md:pl-10">
          {about.paragraphs.map((para, i) => (
            <Reveal key={i} delay={0.05 * i}>
              <div className="group relative">
                <span
                  aria-hidden
                  className="absolute -left-[37px] top-1 h-2.5 w-2.5 rotate-45 border border-flow bg-paper transition-colors duration-300 group-hover:bg-flow md:-left-[45px]"
                />
                <span className="mono-label text-ink/40">
                  STA {String(i + 1).padStart(2, "0")}
                </span>
                <p className="mt-2 text-lg leading-relaxed text-ink/80">
                  {para}
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Currently — the legend card */}
        <Reveal delay={0.1}>
          <div className="survey-corners relative mt-16 border border-contour bg-terrace/50 p-7">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <span className="mono-label">Currently</span>
              <LocalClock />
            </div>
            <p className="mt-3 text-ink/80">
              {profile.locationNow} <span className="text-infra">→</span>{" "}
              {profile.locationNext} · {profile.timezone} · remote
            </p>
            <p className="mt-2 inline-flex items-center gap-2 font-mono text-sm text-ink">
              <span className="h-1.5 w-1.5 animate-pulse bg-flow" aria-hidden />
              {profile.availability}
            </p>
            <div className="mt-6 flex flex-wrap gap-4">
              <a href={profile.bookCall} className="btn-primary">
                Book an intro call
              </a>
              <a href={`mailto:${profile.email}`} className="btn-secondary">
                Email me
              </a>
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
