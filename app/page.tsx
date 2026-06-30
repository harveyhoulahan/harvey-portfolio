import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Hero from "@/components/Hero";
import CaseStudyBlock from "@/components/CaseStudyBlock";
import AnimatedStats from "@/components/AnimatedStats";
import { TextShimmer } from "@/components/ui/text-shimmer";
import { caseStudies } from "@/data/projects";
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
