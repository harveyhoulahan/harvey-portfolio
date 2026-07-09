"use client";

/*
 * Skills, with receipts. The old page was a wall of 80+ chips nobody read.
 * Now four evidence cards anchor the page: each maps a cluster of the stack
 * to a real artifact on this site (the pretraining report, the canopy deep
 * dive, the two GPU demos) with its headline number. The full stack survives
 * below as a condensed ledger: every category shows its lead skills, and one
 * click unfolds the rest. Curation up top, completeness on demand.
 */

import { useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import ContourMotif, { type MotifVariant } from "@/components/ContourMotif";
import PretrainingMotif from "@/components/PretrainingMotif";
import SurferMotif from "@/components/SurferMotif";
import TextCursorProximity from "@/components/ui/text-cursor-proximity";
import { useProximityHeadingStyles } from "@/hooks/use-proximity-heading-colors";
import { skillProofs } from "@/data/skills";

interface SkillGroup {
  category: string;
  skills: string[];
}

const LEDGER_PREVIEW = 6; // lead skills shown per category before unfolding

export default function SkillsExplorer({ groups }: { groups: SkillGroup[] }) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const headingStyles = useProximityHeadingStyles("scale(1.08)");
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const total = groups.reduce((n, g) => n + g.skills.length, 0);

  return (
    <div ref={sectionRef} className="relative overflow-visible py-20 md:py-28">
      <ContourMotif
        variant="mesh"
        animateOnLoad
        className="contour-motif pointer-events-none absolute right-[clamp(1.25rem,4vw,3rem)] top-[5.75rem] z-0 hidden h-40 w-48 text-ink/[0.09] md:block md:top-[6.5rem] lg:right-[clamp(2rem,8vw,5rem)] lg:top-[7rem] lg:h-44 lg:w-56 xl:right-[clamp(2.5rem,10vw,7rem)]"
      />
      <div className="relative z-10">
        <div className="col-shell relative max-w-work overflow-visible">
          <span className="mono-label">Stack</span>
          <div className="relative mt-5 overflow-visible">
            <div className="max-w-prose">
              <h1 className="relative z-10 font-display">
                <TextCursorProximity
                  label="What I build with."
                  className="block"
                  styles={headingStyles}
                  falloff="gaussian"
                  radius={110}
                  containerRef={sectionRef}
                />
              </h1>
            </div>
          </div>
          <p className="mt-6 max-w-prose text-lg leading-relaxed text-ink/80">
            ML, spatial work, and simulation. Tool lists are easy. The four
            cards above come with receipts. The ledger has everything else.
          </p>
        </div>

        {/* Evidence cards: a skill cluster, its artifact, its number */}
        <div className="mx-auto mt-12 grid max-w-work grid-cols-1 gap-5 px-6 md:grid-cols-2">
          {skillProofs.map((p, i) => (
            <motion.div
              key={p.href}
              initial={reduceMotion ? false : { opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-6% 0px" }}
              transition={{ duration: 0.5, delay: (i % 2) * 0.08, ease: [0.2, 0.6, 0.2, 1] }}
            >
              <Link
                href={p.href}
                className="group survey-corners relative flex h-full flex-col overflow-hidden border border-contour bg-terrace/40 p-6 transition-colors duration-300 hover:border-flow"
              >
                {p.motif === "surfer" ? (
                  <SurferMotif />
                ) : p.motif === "pretraining" ? (
                  <PretrainingMotif />
                ) : (
                  <ContourMotif variant={p.motif as MotifVariant} />
                )}
                <div className="relative z-10">
                  <span className="mono-label">{p.kicker}</span>
                  <h2 className="mt-2 font-display text-2xl text-ink">{p.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-ink/70">{p.proof}</p>
                </div>
                <div className="relative z-10 mt-4 flex flex-wrap gap-1.5">
                  {p.skills.map((s) => (
                    <span
                      key={s}
                      className="border border-contour px-2 py-0.5 font-mono text-[0.68rem] tracking-[0.01em] text-ink/70 transition-colors duration-200 group-hover:border-flow/40"
                    >
                      {s}
                    </span>
                  ))}
                </div>
                <div className="relative z-10 mt-5 flex flex-1 items-end justify-between gap-4">
                  <span className="font-mono text-xs uppercase tracking-[0.12em] text-flow transition-transform duration-300 ease-out group-hover:translate-x-1 motion-reduce:transform-none">
                    {p.cta} →
                  </span>
                  <span className="font-mono text-xs tabular-nums text-infra">{p.stat}</span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* The full ledger: every category leads with its heavy hitters,
            one click unfolds the long tail */}
        <div className="col-shell mt-16 max-w-work">
          <div className="flex items-baseline gap-3 border-b border-contour pb-4">
            <span className="mono-label">The full ledger</span>
            <span className="font-mono text-xs text-ink/40">
              {total} across {groups.length} disciplines
            </span>
          </div>
        </div>
        <div className="mx-auto max-w-work space-y-px px-6">
          {groups.map((group) => {
            const expanded = !!open[group.category];
            const lead = group.skills.slice(0, LEDGER_PREVIEW);
            const rest = group.skills.slice(LEDGER_PREVIEW);
            const shown = expanded ? group.skills : lead;
            return (
              <div
                key={group.category}
                className="grid grid-cols-1 gap-3 border-b border-contour py-6 md:grid-cols-[200px_1fr]"
              >
                <div className="flex items-baseline gap-3">
                  <h2 className="font-display text-xl">{group.category}</h2>
                  <span className="font-mono text-xs text-ink/40">{group.skills.length}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <AnimatePresence initial={false}>
                    {shown.map((skill) => (
                      <motion.span
                        key={skill}
                        initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
                        transition={{ duration: 0.2 }}
                        whileHover={reduceMotion ? undefined : { y: -3 }}
                        className="cursor-default select-none rounded-sm border border-contour bg-transparent px-3 py-1.5 font-mono text-[0.78rem] tracking-[0.01em] text-ink transition-colors duration-200 hover:border-flow hover:bg-flow/5 hover:text-flow"
                      >
                        {skill}
                      </motion.span>
                    ))}
                  </AnimatePresence>
                  {rest.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setOpen((o) => ({ ...o, [group.category]: !expanded }))}
                      aria-expanded={expanded}
                      className="rounded-sm px-3 py-1.5 font-mono text-[0.78rem] text-flow transition-colors duration-200 hover:bg-flow/10"
                    >
                      {expanded ? "− fold" : `+${rest.length} more`}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
