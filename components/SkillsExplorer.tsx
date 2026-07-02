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

// The wind rose — a hand-cut eight-spoke compass asterisk that rides with the
// cursor. Cardinal spokes in channel teal, intercardinals in CIR rust, a
// benchmark square at centre. It rolls like a wheel as you move (rotation is
// driven by distance travelled), swells slightly with speed, blooms over
// anything interactive, and kicks a burst of contour rings on click.
function WindRose() {
  return (
    <svg width="36" height="36" viewBox="0 0 32 32" fill="none" aria-hidden>
      <g className="text-flow" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <path d="M16 2.5V10" />
        <path d="M16 22v7.5" />
        <path d="M2.5 16H10" />
        <path d="M22 16h7.5" />
      </g>
      <g className="text-infra" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
        <path d="M6.8 6.8l4.3 4.3" />
        <path d="M20.9 20.9l4.3 4.3" />
        <path d="M25.2 6.8l-4.3 4.3" />
        <path d="M11.1 20.9l-4.3 4.3" />
      </g>
      <rect
        className="text-infra"
        x="14.2"
        y="14.2"
        width="3.6"
        height="3.6"
        fill="currentColor"
      />
    </svg>
  );
}

export default function SkillsExplorer({ groups }: { groups: SkillGroup[] }) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const [active, setActive] = useState<string>("All");

  const tabs = ["All", ...groups.map((g) => g.category)];
  const visible =
    active === "All" ? groups : groups.filter((g) => g.category === active);

  const total = groups.reduce((n, g) => n + g.skills.length, 0);

  // Cursor follower in fixed viewport coordinates — 1:1 under the pointer,
  // no rect math, immune to scroll. Tight spring so it feels attached.
  const mx = useMotionValue(-100);
  const my = useMotionValue(-100);
  const sx = useSpring(mx, { stiffness: 900, damping: 55 });
  const sy = useSpring(my, { stiffness: 900, damping: 55 });
  const rotRaw = useMotionValue(0);
  const rot = useSpring(rotRaw, { stiffness: 70, damping: 16 });
  const scRaw = useMotionValue(1);
  const sc = useSpring(scRaw, { stiffness: 320, damping: 22 });
  const opRaw = useMotionValue(0);
  const op = useSpring(opRaw, { stiffness: 260, damping: 30 });
  const lastPos = useRef<[number, number] | null>(null);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reduceMotion) return;
    mx.set(e.clientX);
    my.set(e.clientY);
    opRaw.set(1);
    const last = lastPos.current;
    let dist = 0;
    if (last) {
      dist = Math.hypot(e.clientX - last[0], e.clientY - last[1]);
      rotRaw.set(rotRaw.get() + Math.min(28, dist) * 0.9);
    }
    lastPos.current = [e.clientX, e.clientY];
    const el = e.target as HTMLElement;
    // Bloom over interactive things; otherwise swell a touch with speed.
    scRaw.set(
      el.closest("button, a") ? 1.6 : 1 + Math.min(0.35, dist * 0.015)
    );
  };
  const onLeave = () => {
    opRaw.set(0);
    lastPos.current = null;
  };

  // Click burst: expanding contour rings from the point of impact, and the
  // rose kicks a half-turn-ish with spring overshoot.
  const [bursts, setBursts] = useState<{ id: number; x: number; y: number }[]>(
    []
  );
  const burstId = useRef(0);
  const onDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reduceMotion) return;
    const id = ++burstId.current;
    setBursts((b) => [...b.slice(-3), { id, x: e.clientX, y: e.clientY }]);
    rotRaw.set(rotRaw.get() + 135);
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
      className="relative overflow-hidden py-20 md:py-28"
    >
      {!reduceMotion && (
        <motion.div
          aria-hidden
          className="pointer-events-none fixed left-0 top-0 z-40 hidden md:block"
          style={{
            x: sx,
            y: sy,
            rotate: rot,
            scale: sc,
            opacity: op,
            translateX: "-50%",
            translateY: "-50%",
          }}
        >
          <WindRose />
        </motion.div>
      )}

      {/* Contour rings radiating from each click, like a dropped station. */}
      {!reduceMotion &&
        bursts.map((b) =>
          [0, 1, 2].map((ring) => (
            <motion.span
              key={`${b.id}-${ring}`}
              aria-hidden
              className={`pointer-events-none fixed left-0 top-0 z-30 hidden rounded-full border md:block ${
                ring === 1 ? "border-infra/70" : "border-flow/60"
              }`}
              initial={{ width: 10, height: 10, opacity: 0.85 }}
              animate={{
                width: 90 + ring * 55,
                height: 90 + ring * 55,
                opacity: 0,
              }}
              transition={{
                duration: 0.75,
                delay: ring * 0.09,
                ease: [0.16, 1, 0.3, 1],
              }}
              style={{
                left: b.x,
                top: b.y,
                x: "-50%",
                y: "-50%",
                position: "fixed",
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
