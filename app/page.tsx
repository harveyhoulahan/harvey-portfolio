import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Hero from "@/components/Hero";
import CaseStudyBlock from "@/components/CaseStudyBlock";
import AnimatedStats from "@/components/AnimatedStats";
import { TextShimmer } from "@/components/ui/text-shimmer";
import { caseStudies, papers } from "@/data/projects";
import { about, profile, stats } from "@/data/metadata";

export default function Home() {
  return (
    <>
      <Hero />

      {/* Positioning line */}
      <section className="border-y border-hairline bg-surface">
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
            className="inline-flex items-center gap-1 font-mono text-xs uppercase tracking-[0.12em] text-ink/60 hover:text-sage"
          >
            All work <ArrowRight size={13} />
          </Link>
        </div>

        <div className="mt-6 divide-y divide-hairline">
          {caseStudies.map((study) => (
            <CaseStudyBlock key={study.id} study={study} />
          ))}
        </div>
      </section>

      {/* Physics, learned — the ML evidence, above the fold of the footer */}
      <section className="border-t border-hairline bg-surface">
        <div className="mx-auto max-w-work px-6 py-16">
          <span className="mono-label">Physics, learned</span>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <Link
              href="/catchment"
              className="group flex flex-col justify-between border border-hairline bg-concrete/40 p-6 transition-colors hover:border-sage"
            >
              <div>
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
              <span className="mt-6 font-mono text-xs uppercase tracking-[0.12em] text-sage transition-transform group-hover:translate-x-1">
                Run it in your browser →
              </span>
            </Link>
            <a
              href={papers[0].links[0].href}
              className="group flex flex-col justify-between border border-hairline bg-concrete/40 p-6 transition-colors hover:border-sage"
            >
              <div>
                <h3 className="font-display text-xl text-ink">
                  1.75 → 1.18 val loss, fixed compute
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-ink/70">
                  {papers[0].summary}
                </p>
              </div>
              <span className="mt-6 font-mono text-xs uppercase tracking-[0.12em] text-sage transition-transform group-hover:translate-x-1">
                Read the report (PDF) →
              </span>
            </a>
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="border-t border-hairline bg-surface">
        <div className="mx-auto max-w-prose px-6 py-20 text-center">
          <TextShimmer as="span" className="mono-label">
            {profile.availability}
          </TextShimmer>
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
