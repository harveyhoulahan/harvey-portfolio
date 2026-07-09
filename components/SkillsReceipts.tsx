"use client";

/*
 * The stack, with receipts — the working half of the old /skills page,
 * extracted so it can live inside /about. Four evidence cards map skill
 * clusters to real artifacts on this site with their headline numbers; the
 * full stack follows as a condensed ledger where each category leads with
 * its heavy hitters and one click unfolds the rest.
 */

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import ContourMotif, { type MotifVariant } from "@/components/ContourMotif";
import PretrainingMotif from "@/components/PretrainingMotif";
import SurferMotif from "@/components/SurferMotif";
import { skillProofs } from "@/data/skills";

interface SkillGroup {
  category: string;
  skills: string[];
}

const LEDGER_PREVIEW = 6; // lead skills shown per category before unfolding

export default function SkillsReceipts({ groups }: { groups: SkillGroup[] }) {
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const total = groups.reduce((n, g) => n + g.skills.length, 0);

  return (
    <div>
      {/* Evidence cards: a skill cluster, its artifact, its number */}
      <div className="mx-auto mt-8 grid max-w-work grid-cols-1 gap-5 px-6 md:grid-cols-2">
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
                <h3 className="mt-2 font-display text-2xl text-ink">{p.title}</h3>
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
      <div className="col-shell mt-14 max-w-work">
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
                <h3 className="font-display text-xl">{group.category}</h3>
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
  );
}
