import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import CaseStudyBlock from "@/components/CaseStudyBlock";
import WorkshopHero from "@/components/WorkshopHero";
import { caseStudies, papers, personalProjects } from "@/data/projects";

export const metadata: Metadata = {
  title: "Work — Harvey Houlahan",
  description:
    "Case studies in applied ML and spatial systems: the ArborMeta carbon policy platform, Step One AI product search, and the FibreTrace product passport.",
};

export default function Projects() {
  return (
    <>
      <WorkshopHero />

      <div className="mx-auto max-w-work px-6 py-20 md:py-28">
        <span className="mono-label">Case studies</span>
        <h2 className="mt-5 font-display">Systems people actually use</h2>
        <p className="mt-6 max-w-prose text-lg leading-relaxed text-ink/80">
          Production work across climate, energy, e-commerce, and supply chain.
          Real systems with real users, not proof-of-concept demos.
        </p>

        <div className="mt-10 divide-y divide-contour">
          {caseStudies.map((study) => (
            <CaseStudyBlock key={study.id} study={study} />
          ))}
        </div>
      </div>

      {/* Research & writing */}
      <section className="border-t border-contour bg-terrace">
        <div className="mx-auto max-w-work px-6 py-16 md:py-20">
          <span className="mono-label">Research &amp; writing</span>
          <h2 className="mt-5 font-display">Papers</h2>

          <div className="mt-8 divide-y divide-contour border-t border-contour">
            {papers.map((paper) => (
              <article
                key={paper.title}
                className="grid grid-cols-1 gap-x-10 gap-y-4 py-8 md:grid-cols-[1fr_auto]"
              >
                <div>
                  <h3 className="font-display text-xl md:text-2xl">
                    {paper.title}
                  </h3>
                  <p className="mt-1 font-mono text-xs uppercase tracking-[0.12em] text-ink/50">
                    {paper.context}
                  </p>
                  <p className="mt-3 max-w-prose text-ink/80">{paper.summary}</p>
                </div>
                <div className="flex flex-col gap-2 md:items-end">
                  {paper.links.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      target={link.external ? "_blank" : undefined}
                      rel={link.external ? "noopener noreferrer" : undefined}
                      className="inline-flex items-center gap-1 whitespace-nowrap font-mono text-sm text-ink/70 transition-colors hover:text-flow"
                    >
                      {link.label} <ArrowUpRight size={13} />
                    </a>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Personal projects */}
      <section className="border-t border-contour">
        <div className="mx-auto max-w-work px-6 py-16 md:py-20">
          <span className="mono-label">Personal projects</span>
          <h2 className="mt-5 font-display">Built for myself</h2>

          <div className="mt-8 grid grid-cols-1 gap-px overflow-hidden border border-contour bg-contour md:grid-cols-2">
            {personalProjects.map((project) => (
              <div key={project.name} className="flex flex-col bg-terrace p-7">
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="font-display text-xl">{project.name}</h3>
                  {project.year && (
                    <span className="font-mono text-xs text-ink/40">
                      {project.status ?? project.year}
                    </span>
                  )}
                </div>
                <p className="mt-3 flex-1 text-ink/80">{project.blurb}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {project.tags.map((tag) => (
                    <span key={tag} className="stack-tag">
                      {tag}
                    </span>
                  ))}
                </div>
                {project.links && project.links.length > 0 && (
                  <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
                    {project.links.map((link) => (
                      <a
                        key={link.href}
                        href={link.href}
                        target={link.external ? "_blank" : undefined}
                        rel={link.external ? "noopener noreferrer" : undefined}
                        className="inline-flex items-center gap-1 font-mono text-sm text-ink/70 transition-colors hover:text-flow"
                      >
                        {link.label} <ArrowUpRight size={13} />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
