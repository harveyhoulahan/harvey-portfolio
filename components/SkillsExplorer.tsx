"use client";

import { useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "framer-motion";
import TextCursorProximity from "@/components/ui/text-cursor-proximity";

interface SkillGroup {
  category: string;
  skills: string[];
}

const headingStyles = {
  transform: { from: "scale(1)", to: "scale(1.08)" },
  color: { from: "#1A1A18", to: "#4A6741" },
} as const;

export default function SkillsExplorer({ groups }: { groups: SkillGroup[] }) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const [active, setActive] = useState<string>("All");

  const tabs = ["All", ...groups.map((g) => g.category)];
  const visible =
    active === "All" ? groups : groups.filter((g) => g.category === active);

  const total = groups.reduce((n, g) => n + g.skills.length, 0);

  // Soft spotlight that trails the cursor for subtle depth on the light bg.
  const mx = useMotionValue(-400);
  const my = useMotionValue(-400);
  const sx = useSpring(mx, { stiffness: 120, damping: 20 });
  const sy = useSpring(my, { stiffness: 120, damping: 20 });

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reduceMotion) return;
    const rect = sectionRef.current?.getBoundingClientRect();
    if (!rect) return;
    mx.set(e.clientX - rect.left);
    my.set(e.clientY - rect.top);
  };

  return (
    <div
      ref={sectionRef}
      onMouseMove={onMove}
      className="relative overflow-hidden py-20 md:py-28"
    >
      {!reduceMotion && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -z-0 h-[420px] w-[420px] rounded-full"
          style={{
            x: sx,
            y: sy,
            translateX: "-50%",
            translateY: "-50%",
            background:
              "radial-gradient(circle, rgba(74,103,65,0.10) 0%, rgba(74,103,65,0) 70%)",
          }}
        />
      )}

      <div className="relative z-10">
        <div className="col-shell max-w-work">
        <span className="mono-label">Stack</span>
        <h1 className="mt-5 font-display">
          <TextCursorProximity
            label="What I build with."
            className="block"
            styles={headingStyles}
            falloff="gaussian"
            radius={110}
            containerRef={sectionRef}
          />
        </h1>
        <p className="mt-6 max-w-prose text-lg leading-relaxed text-ink/80">
          The tools I reach for when shipping production geospatial ML
          infrastructure. {total} across {groups.length} disciplines —{" "}
          <span className="text-ink/60">filter to explore.</span>
        </p>

        {/* Filter chips */}
        <div className="mt-12 flex flex-wrap items-center gap-2.5 border-b border-hairline pb-6">
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
                className={`relative rounded-full px-4 py-2 font-mono text-[0.7rem] uppercase tracking-[0.12em] transition-colors duration-200 ${
                  isActive ? "text-sage" : "text-ink/50 hover:text-ink"
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="skillTabPill"
                    className="absolute inset-0 rounded-full bg-sage/10 ring-1 ring-inset ring-sage/40"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <span className="relative flex items-center gap-1.5">
                  {tab}
                  <span
                    className={`tabular-nums transition-colors ${
                      isActive ? "text-sage/60" : "text-ink/30"
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
                className="grid grid-cols-1 gap-3 border-t border-hairline py-7 md:grid-cols-[200px_1fr]"
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
                      className="cursor-default select-none rounded-sm border border-hairline bg-transparent px-3 py-1.5 font-mono text-[0.78rem] tracking-[0.01em] text-ink transition-colors duration-200 hover:border-sage hover:bg-sage/5 hover:text-sage"
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
