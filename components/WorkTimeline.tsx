"use client";

/*
 * The work, on the timeline — /projects and /experience merged. One
 * chronological spine (the scroll-tracked beam from ui/timeline) carries
 * everything: orgs with a full case study get the whole Problem → Approach →
 * Outcome block sitting beside their period; the rest of the career (AEMO,
 * Monash, the medicine detour) appear as compact field-note entries in the
 * same stream, so the story reads as one route walked rather than two pages.
 */

import { Timeline } from "@/components/ui/timeline";
import CaseStudyBlock from "@/components/CaseStudyBlock";
import { caseStudies } from "@/data/projects";
import { experienceData } from "@/data/experience";

export default function WorkTimeline() {
  const timelineData = experienceData.map((entry) => {
    const study = caseStudies.find((s) => s.company === entry.org);
    return {
      title: entry.period,
      content: study ? (
        <CaseStudyBlock study={study} showPeriod={false} />
      ) : (
        <div className="case-block py-6">
          <h3 className="font-display text-xl md:text-2xl">{entry.org}</h3>
          <p className="mt-1 font-mono text-sm text-flow">{entry.role}</p>
          <p className="mt-1 font-mono text-xs uppercase tracking-[0.12em] text-ink/40">
            {entry.location}
          </p>
          <ul className="mt-4 space-y-2">
            {entry.notes.map((note) => (
              <li key={note} className="flex gap-2 text-ink/80">
                <span className="mt-2.5 h-1 w-2.5 shrink-0 bg-infra" aria-hidden />
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>
      ),
    };
  });

  return <Timeline data={timelineData} />;
}
