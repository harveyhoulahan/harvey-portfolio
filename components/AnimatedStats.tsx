"use client";

import { motion, useInView, useReducedMotion } from "framer-motion";
import { useRef, useEffect, useState } from "react";

export interface Stat {
  value?: number;
  label: string;
  suffix?: string;
  prefix?: string;
  // When set, this string is shown verbatim instead of a counting number.
  display?: string;
}

export default function AnimatedStats({ stats }: { stats: Stat[] }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-10%" });
  // Easter egg: clicking a cell re-runs its count-up.
  const [runs, setRuns] = useState<Record<string, number>>({});

  return (
    <div ref={ref} className="grid grid-cols-2 gap-px overflow-hidden border border-contour bg-contour lg:grid-cols-4">
      {stats.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: index * 0.08, duration: 0.5 }}
          onClick={() =>
            setRuns((r) => ({ ...r, [stat.label]: (r[stat.label] ?? 0) + 1 }))
          }
          className="group relative bg-terrace p-6 transition-colors duration-300 hover:bg-paper"
        >
          <span
            aria-hidden
            className="absolute left-0 top-0 h-full w-[2px] origin-top scale-y-0 bg-flow transition-transform duration-300 ease-out group-hover:scale-y-100 motion-reduce:transition-none"
          />
          {stat.display ? (
            <div className="font-mono text-4xl font-medium tabular-nums tracking-tight text-flow md:text-5xl">
              {stat.display}
            </div>
          ) : (
            <CountUpNumber
              end={stat.value ?? 0}
              prefix={stat.prefix}
              suffix={stat.suffix}
              isInView={isInView}
              runKey={runs[stat.label] ?? 0}
            />
          )}
          <p className="mt-2 font-mono text-xs uppercase tracking-[0.1em] text-ink/55">
            {stat.label}
          </p>
        </motion.div>
      ))}
    </div>
  );
}

function CountUpNumber({
  end,
  prefix = "",
  suffix = "",
  isInView,
  runKey = 0,
}: {
  end: number;
  prefix?: string;
  suffix?: string;
  isInView: boolean;
  runKey?: number;
}) {
  const reduceMotion = useReducedMotion();
  // Start at the real value so the server-rendered HTML (crawlers, link
  // previews, no-JS) never shows a row of zeros; the count-up runs on view.
  const [count, setCount] = useState(end);

  useEffect(() => {
    if (!isInView) return;
    if (reduceMotion) {
      setCount(end);
      return;
    }

    setCount(0);
    const duration = 1600;
    const steps = 50;
    const increment = end / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [end, isInView, reduceMotion, runKey]);

  return (
    <div className="font-mono text-4xl font-medium tabular-nums tracking-tight text-flow md:text-5xl">
      {prefix}
      {count.toLocaleString()}
      {suffix}
    </div>
  );
}
