"use client";

import { motion, useInView, useReducedMotion } from "framer-motion";
import { useRef, useEffect, useState } from "react";

export interface Stat {
  value: number;
  label: string;
  suffix?: string;
  prefix?: string;
  // When set, this string is shown verbatim instead of a counting number.
  display?: string;
}

export default function AnimatedStats({ stats }: { stats: Stat[] }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-10%" });

  return (
    <div ref={ref} className="grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-hairline bg-hairline lg:grid-cols-4">
      {stats.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: index * 0.08, duration: 0.5 }}
          className="bg-surface p-6"
        >
          {stat.display ? (
            <div className="font-display text-4xl text-sage md:text-5xl">
              {stat.display}
            </div>
          ) : (
            <CountUpNumber
              end={stat.value}
              prefix={stat.prefix}
              suffix={stat.suffix}
              isInView={isInView}
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
}: {
  end: number;
  prefix?: string;
  suffix?: string;
  isInView: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const [count, setCount] = useState(reduceMotion ? end : 0);

  useEffect(() => {
    if (!isInView) return;
    if (reduceMotion) {
      setCount(end);
      return;
    }

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
  }, [end, isInView, reduceMotion]);

  return (
    <div className="font-display text-4xl text-sage md:text-5xl">
      {prefix}
      {count.toLocaleString()}
      {suffix}
    </div>
  );
}
