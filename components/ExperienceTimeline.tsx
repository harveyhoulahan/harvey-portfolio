"use client";

import { Timeline } from "@/components/ui/timeline";
import { experienceData } from "@/data/experience";

export default function ExperienceTimeline() {
  const timelineData = experienceData.map((entry) => ({
    title: entry.period,
    content: (
      <div className="case-block">
        <h2 className="font-display text-xl md:text-2xl">{entry.org}</h2>
        <p className="mt-1 font-mono text-sm text-flow">{entry.role}</p>
        <p className="mt-1 font-mono text-xs uppercase tracking-[0.12em] text-ink/40">
          {entry.location}
        </p>
        <ul className="mt-4 space-y-2">
          {entry.notes.map((note) => (
            <li key={note} className="flex gap-2 text-ink/80">
              <span
                className="mt-2.5 h-1 w-2.5 shrink-0 bg-infra"
                aria-hidden
              />
              <span>{note}</span>
            </li>
          ))}
        </ul>
      </div>
    ),
  }));

  return <Timeline data={timelineData} />;
}
