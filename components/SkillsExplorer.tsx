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
  color: { from: "#161F1B", to: "#14655A" },
} as const;

export default function SkillsExplorer({ groups }: { groups: SkillGroup[] }) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const [active, setActive] = useState<string>("All");

  const tabs = ["All", ...groups.map((g) => g.category)];
  const visible =
    active === "All" ? groups : groups.filter((g) => g.category === active);

  const total = groups.reduce((n, g) => n + g.skills.length, 0);

  // Soft bubble — drifts behind copy; trail, swell, and click ripples.
  const mx = useMotionValue(-200);
  const my = useMotionValue(-200);
  const sx = useSpring(mx, { stiffness: 220, damping: 26 });
  const sy = useSpring(my, { stiffness: 220, damping: 26 });
  const tx = useSpring(mx, { stiffness: 55, damping: 16 });
  const ty = useSpring(my, { stiffness: 55, damping: 16 });
  const rotRaw = useMotionValue(0);
  const rot = useSpring(rotRaw, { stiffness: 50, damping: 14 });
  const scRaw = useMotionValue(1);
  const sc = useSpring(scRaw, { stiffness: 200, damping: 22 });
  const opRaw = useMotionValue(0);
  const op = useSpring(opRaw, { stiffness: 140, damping: 28 });
  const lastPos = useRef<[number, number] | null>(null);

  const [bursts, setBursts] = useState<{ id: number; x: number; y: number }[]>(
    []
  );
  const burstId = useRef(0);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reduceMotion) return;
    mx.set(e.clientX);
    my.set(e.clientY);
    opRaw.set(1);

    const last = lastPos.current;
    let dist = 0;
    if (last) {
      dist = Math.hypot(e.clientX - last[0], e.clientY - last[1]);
      rotRaw.set(rotRaw.get() + Math.min(14, dist) * 0.22);
    }
    lastPos.current = [e.clientX, e.clientY];

    const el = e.target as HTMLElement;
    scRaw.set(
      el.closest("button, a, [data-skill]")
        ? 1.32
        : 1 + Math.min(0.22, dist * 0.011)
    );
  };
  const onLeave = () => {
    opRaw.set(0);
    lastPos.current = null;
  };
  const onDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reduceMotion) return;
    const id = ++burstId.current;
    setBursts((b) => [...b.slice(-3), { id, x: e.clientX, y: e.clientY }]);
    scRaw.set(scRaw.get() + 0.12);
    window.setTimeout(
      () => setBursts((b) => b.filter((x) => x.id !== id)),
      900
    );
  };

  return (
    <div
      ref={sectionRef}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onMouseDown={onDown}
      className="relative overflow-hidden py-20 md:cursor-none md:py-28"
    >
      {!reduceMotion && (
        <>
          {/* lagging outer haze */}
          <motion.div
            aria-hidden
            className="pointer-events-none fixed left-0 top-0 z-[4] hidden h-[22rem] w-[22rem] rounded-full md:block"
            style={{
              x: tx,
              y: ty,
              rotate: rot,
              scale: sc,
              opacity: op,
              translateX: "-50%",
              translateY: "-50%",
              background:
                "radial-gradient(circle, rgba(20, 101, 90, 0.22) 0%, rgba(20, 101, 90, 0.1) 32%, rgba(20, 101, 90, 0.03) 58%, rgba(20, 101, 90, 0) 78%)",
              filter: "blur(18px)",
            }}
          />
          {/* main bubble */}
          <motion.div
            aria-hidden
            className="pointer-events-none fixed left-0 top-0 z-[5] hidden h-64 w-64 rounded-full md:block"
            style={{
              x: sx,
              y: sy,
              rotate: rot,
              scale: sc,
              opacity: op,
              translateX: "-50%",
              translateY: "-50%",
              background:
                "radial-gradient(circle, rgba(111, 184, 170, 0.32) 0%, rgba(20, 101, 90, 0.22) 22%, rgba(20, 101, 90, 0.1) 42%, rgba(20, 101, 90, 0.03) 62%, rgba(20, 101, 90, 0) 82%)",
              boxShadow: "0 0 64px rgba(20, 101, 90, 0.14)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              filter: "blur(4px)",
            }}
          />
        </>
      )}

      {/* click ripples — soft green pulses */}
      {!reduceMotion &&
        bursts.map((b) =>
          [0, 1, 2].map((ring) => (
            <motion.span
              key={`${b.id}-${ring}`}
              aria-hidden
              className="pointer-events-none fixed left-0 top-0 z-[6] hidden rounded-full md:block"
              initial={{ width: 20, height: 20, opacity: 0.45 }}
              animate={{
                width: 70 + ring * 50,
                height: 70 + ring * 50,
                opacity: 0,
              }}
              transition={{
                duration: 0.8,
                delay: ring * 0.08,
                ease: [0.16, 1, 0.3, 1],
              }}
              style={{
                left: b.x,
                top: b.y,
                x: "-50%",
                y: "-50%",
                position: "fixed",
                background:
                  "radial-gradient(circle, rgba(20, 101, 90, 0.18) 0%, rgba(20, 101, 90, 0) 70%)",
                filter: "blur(6px)",
              }}
            />
          ))
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
                      data-skill
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
