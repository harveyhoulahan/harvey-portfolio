import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Hero from "@/components/Hero";
import WorkIndex from "@/components/WorkIndex";
import AnimatedStats from "@/components/AnimatedStats";
import ContourMotif from "@/components/ContourMotif";
import { papers } from "@/data/projects";
import { about, profile, stats } from "@/data/metadata";

export default function Home() {
  return (
    <>
      <Hero />

      {/* Positioning line */}
      <section className="graticule-grid border-y border-contour bg-terrace">
        <div className="mx-auto max-w-prose px-6 py-16">
          <p className="font-display text-2xl leading-snug md:text-3xl">
            {about.paragraphs[1]}
          </p>
        </div>
      </section>

      {/* By the numbers */}
      <section className="mx-auto max-w-work px-6 py-16">
        <span className="mono-label">By the numbers</span>
        <div className="mt-6">
          <AnimatedStats stats={[...stats]} />
        </div>
      </section>

      {/* Selected work */}
      <section className="mx-auto max-w-work px-6 py-20 pt-4">
        <div className="flex items-baseline justify-between">
          <span className="mono-label">Selected work</span>
          <Link
            href="/projects"
            className="inline-flex items-center gap-1 font-mono text-xs uppercase tracking-[0.12em] text-ink/60 hover:text-flow"
          >
            All work <ArrowRight size={13} />
          </Link>
        </div>

        <WorkIndex />
      </section>

      {/* Physics, learned — the ML evidence, above the fold of the footer */}
      <section className="border-t border-contour bg-terrace">
        <div className="mx-auto max-w-work px-6 py-16">
          <span className="mono-label">Physics, learned</span>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <Link
              href="/catchment"
              className="group survey-corners relative flex flex-col justify-between overflow-hidden border border-contour bg-paper/40 p-6 transition-colors duration-300 hover:border-flow"
            >
              <ContourMotif variant="basin" />
              <div className="relative">
                <h3 className="font-display text-xl text-ink">
                  A neural operator, racing its own teacher
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-ink/70">
                  Catchment runs a real shallow-water solver on your GPU — and a
                  convolutional neural operator trained against that solver,
                  executing as hand-written WGSL compute passes. Flip between
                  physics and neural and watch the error field live.
                </p>
              </div>
              <span className="mt-6 font-mono text-xs uppercase tracking-[0.12em] text-flow transition-transform duration-300 ease-out group-hover:translate-x-1 motion-reduce:transform-none">
                Run it in your browser →
              </span>
            </Link>
            <a
              href={papers[0].links[0].href}
              className="group survey-corners relative flex flex-col justify-between overflow-hidden border border-contour bg-paper/40 p-6 transition-colors duration-300 hover:border-flow"
            >
              <ContourMotif variant="channels" />
              <div className="relative">
                <h3 className="font-display text-xl text-ink">
                  1.75 → 1.18 val loss, fixed compute
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-ink/70">
                  {papers[0].summary}
                </p>
              </div>
              <span className="mt-6 font-mono text-xs uppercase tracking-[0.12em] text-flow transition-transform duration-300 ease-out group-hover:translate-x-1 motion-reduce:transform-none">
                Read the report (PDF) →
              </span>
            </a>
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="graticule-grid border-t border-contour bg-terrace">
        <div className="mx-auto max-w-prose px-6 py-20 text-center">
          <span className="mono-label inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 animate-pulse bg-flow" aria-hidden />
            {profile.availability}
          </span>
          <h2 className="mt-4 font-display">Let&apos;s build something.</h2>
          <p className="mx-auto mt-5 max-w-prose text-ink/70">
            Climate, carbon, biodiversity, agriculture — the real-world problems
            where I do my best work.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link href="/playground" className="btn-primary">
              Live demos <ArrowRight size={15} />
            </Link>
            <Link href="/contact" className="btn-secondary">
              Get in touch
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
