import Link from "next/link";
import { caseStudies } from "@/data/projects";

// Compact map-legend index of the case studies for the homepage — the full
// Problem → Approach → Outcome blocks live on /projects. Each row deep-links
// to its anchor there. Numbered like sheets in a map series.
export default function WorkIndex() {
  return (
    <div className="mt-6 border-t border-contour">
      {caseStudies.map((study, i) => (
        <Link
          key={study.id}
          href={`/projects#${study.id}`}
          className="group relative grid grid-cols-[2.5rem_1fr_auto] items-baseline gap-x-4 border-b border-contour py-5 pl-8 pr-2 transition-colors duration-300 hover:bg-terrace/60 md:grid-cols-[3rem_1.1fr_1fr_auto]"
        >
          <span
            aria-hidden
            className="absolute left-0 top-0 h-full w-[2px] origin-top scale-y-0 bg-flow transition-transform duration-300 ease-out group-hover:scale-y-100 motion-reduce:transition-none"
          />
          <span className="font-mono text-xs tabular-nums text-ink/40">
            {String(i + 1).padStart(2, "0")}
          </span>
          <span className="font-display text-xl tracking-tight md:text-2xl">
            {study.company}
          </span>
          <span className="hidden font-mono text-sm text-flow md:block">
            {study.role}
          </span>
          <span className="justify-self-end font-mono text-xs uppercase tracking-[0.12em] text-flow transition-transform duration-300 ease-out group-hover:translate-x-1 motion-reduce:transform-none">
            →
          </span>
          <span className="col-start-2 mt-1 font-mono text-xs uppercase tracking-[0.12em] text-ink/45 md:col-span-2">
            {study.period}
          </span>
        </Link>
      ))}
    </div>
  );
}
