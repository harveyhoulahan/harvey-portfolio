import type { CaseStudy } from "@/data/projects";
import CaseGallery from "@/components/CaseGallery";

// Full-width horizontal case-study block with a sage structural left border.
// Problem → Approach → Outcome.
export default function CaseStudyBlock({ study }: { study: CaseStudy }) {
  return (
    <article className="case-block py-10">
      <header>
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h3 className="font-display text-2xl md:text-3xl">{study.company}</h3>
          <span className="font-mono text-xs uppercase tracking-[0.12em] text-ink/50">
            {study.period}
          </span>
        </div>
        <p className="mt-1 font-mono text-sm text-sage">{study.role}</p>
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
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-sand" aria-hidden />
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
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-sage" aria-hidden />
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
  );
}
