import type { CaseStudy } from "@/data/projects";
import CaseGallery from "@/components/CaseGallery";
import Reveal from "@/components/Reveal";

// Full-width horizontal case-study block with a contour hairline and a survey
// benchmark at datum. Problem → Approach → Outcome. Rises in on scroll.
// showPeriod=false when the block sits beside a timeline that already
// carries the dates.
export default function CaseStudyBlock({ study, showPeriod = true }: { study: CaseStudy; showPeriod?: boolean }) {
  return (
    <Reveal>
      <article id={study.id} className="case-block scroll-mt-24 py-6 md:py-8">
        <header>
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <h3 className="font-display text-2xl md:text-3xl">{study.company}</h3>
            {showPeriod && (
              <span className="font-mono text-xs uppercase tracking-[0.12em] text-ink/50">
                {study.period}
              </span>
            )}
          </div>
          <p className="mt-1 font-mono text-sm text-flow">{study.role}</p>
          {study.link && (
            <a
              href={study.link}
              className="mt-2 inline-block font-mono text-xs uppercase tracking-[0.12em] text-ink/55 underline decoration-contour underline-offset-4 transition-colors hover:text-flow"
            >
              Read the deep-dive →
            </a>
          )}
        </header>

        <div className="mt-7 grid grid-cols-1 gap-7 md:grid-cols-3">
          <div>
            <span className="mono-label text-ink/60">Problem</span>
            <p className="mt-3 text-ink/80">{study.problem}</p>
          </div>
          <div>
            <span className="mono-label text-ink/60">Approach</span>
            <ul className="mt-3 space-y-2">
              {study.approach.map((item) => (
                <li key={item} className="flex gap-2 text-ink/80">
                  <span className="mt-2.5 h-1 w-2.5 shrink-0 bg-infra" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <span className="mono-label text-ink/60">Outcome</span>
            <ul className="mt-3 space-y-2">
              {study.outcome.map((item) => (
                <li key={item} className="flex gap-2 text-ink/80">
                  <span className="mt-2.5 h-1 w-2.5 shrink-0 bg-flow" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-7 flex flex-wrap gap-2">
          {study.stack.map((tech) => (
            <span key={tech} className="stack-tag">
              {tech}
            </span>
          ))}
        </div>

        {study.images && study.images.length > 0 && (
          <CaseGallery images={study.images} />
        )}
      </article>
    </Reveal>
  );
}
