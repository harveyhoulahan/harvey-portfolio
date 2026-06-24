import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { caseStudies } from "@/data/projects";

export function generateStaticParams() {
  return caseStudies.map((study) => ({ id: study.id }));
}

export function generateMetadata({
  params,
}: {
  params: { id: string };
}): Metadata {
  const study = caseStudies.find((s) => s.id === params.id);
  if (!study) return { title: "Work — Harvey Houlahan" };
  return {
    title: `${study.company} — Harvey Houlahan`,
    description: study.summary,
  };
}

export default function CaseStudyPage({
  params,
}: {
  params: { id: string };
}) {
  const study = caseStudies.find((s) => s.id === params.id);
  if (!study) notFound();

  return (
    <div className="py-20 md:py-28">
      <div className="col-shell max-w-work">
        <Link
          href="/projects"
          className="group inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.12em] text-ink/60 hover:text-sage"
        >
          <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-1" />
          All work
        </Link>

        <header className="mt-8 border-l-2 border-sage pl-6 md:pl-10">
          <p className="font-mono text-sm text-sage">{study.role}</p>
          <h1 className="mt-2 font-display">{study.company}</h1>
          <p className="mt-2 font-mono text-xs uppercase tracking-[0.12em] text-ink/50">
            {study.period}
          </p>
          <p className="mt-6 max-w-prose text-lg leading-relaxed text-ink/80">
            {study.summary}
          </p>
        </header>
      </div>

      <div className="mx-auto max-w-work px-6">
      <div className="mt-12 grid grid-cols-1 gap-10 md:grid-cols-3">
        <section>
          <span className="mono-label text-ink/60">Problem</span>
          <p className="mt-3 text-ink/80">{study.problem}</p>
        </section>
        <section>
          <span className="mono-label text-ink/60">Approach</span>
          <ul className="mt-3 space-y-2">
            {study.approach.map((item) => (
              <li key={item} className="flex gap-2 text-ink/80">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-sand" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <span className="mono-label text-ink/60">Outcome</span>
          <ul className="mt-3 space-y-2">
            {study.outcome.map((item) => (
              <li key={item} className="flex gap-2 text-ink/80">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-sage" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="mt-12 border-t border-hairline pt-8">
        <span className="mono-label text-ink/60">Stack</span>
        <div className="mt-4 flex flex-wrap gap-2">
          {study.stack.map((tech) => (
            <span key={tech} className="stack-tag">
              {tech}
            </span>
          ))}
        </div>
      </div>
      </div>
    </div>
  );
}
