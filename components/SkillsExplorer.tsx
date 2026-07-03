"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import ContourMotif from "@/components/ContourMotif";
import TextCursorProximity from "@/components/ui/text-cursor-proximity";
import { useProximityHeadingStyles } from "@/hooks/use-proximity-heading-colors";

interface SkillGroup {
  category: string;
  skills: string[];
}

export default function SkillsExplorer({ groups }: { groups: SkillGroup[] }) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const [active, setActive] = useState<string>("All");
  const headingStyles = useProximityHeadingStyles("scale(1.08)");

  const tabs = ["All", ...groups.map((g) => g.category)];
  const visible =
    active === "All" ? groups : groups.filter((g) => g.category === active);

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
          Applied ML/AI, spatial work, and simulation. The languages and tools I
          use to build all of it.
        </p>

        {/* Filter chips */}
        <div className="mt-12 flex flex-wrap items-center gap-2.5 border-b border-contour pb-6">
          {tabs.map((tab) => {
            const isActive = active === tab;
            const count =
              tab === "All"
                ? total
                : groups.find((g) => g.category === tab)?.skills.length ?? 0;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActive(tab)}
                className={`relative rounded-sm px-4 py-2 font-mono text-[0.7rem] uppercase tracking-[0.12em] transition-colors duration-200 ${
                  isActive ? "text-flow" : "text-ink/50 hover:text-ink"
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="skillTabPill"
                    className="absolute inset-0 rounded-sm bg-flow/10 ring-1 ring-inset ring-flow/40"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <span className="relative flex items-center gap-1.5">
                  {tab}
                  <span
                    className={`tabular-nums transition-colors ${
                      isActive ? "text-flow/60" : "text-ink/30"
                    }`}
                  >
                    {count}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        </div>

        {/* Grouped, animated skill clusters */}
        <div className="mx-auto mt-10 max-w-work space-y-px px-6">
          <AnimatePresence mode="popLayout" initial={false}>
            {visible.map((group) => (
              <motion.div
                key={group.category}
                layout
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35 }}
                className="grid grid-cols-1 gap-3 border-t border-contour py-7 md:grid-cols-[200px_1fr]"
              >
                <div className="flex items-baseline gap-3">
                  <h2 className="font-display text-xl">{group.category}</h2>
                  <span className="font-mono text-xs text-ink/40">
                    {group.skills.length}
                  </span>
                </div>

                <motion.div
                  className="flex flex-wrap gap-2"
                  variants={{
                    show: {
                      transition: { staggerChildren: reduceMotion ? 0 : 0.03 },
                    },
                  }}
                  initial="hidden"
                  animate="show"
                >
                  {group.skills.map((skill) => (
                    <motion.span
                      key={skill}
                      variants={{
                        hidden: { opacity: 0, y: 8 },
                        show: { opacity: 1, y: 0 },
                      }}
                      whileHover={reduceMotion ? undefined : { y: -3 }}
                      className="cursor-default select-none rounded-sm border border-contour bg-transparent px-3 py-1.5 font-mono text-[0.78rem] tracking-[0.01em] text-ink transition-colors duration-200 hover:border-flow hover:bg-flow/5 hover:text-flow"
                    >
                      {skill}
                    </motion.span>
                  ))}
                </motion.div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
