"use client";

import { motion, useInView } from "framer-motion";
import { useRef, useEffect, useState } from "react";

interface Stat {
  value: number;
  label: string;
  suffix?: string;
  prefix?: string;
}

interface AnimatedStatsProps {
  stats: Stat[];
}

export default function AnimatedStats({ stats }: AnimatedStatsProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  return (
    <div ref={ref} className="grid grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: index * 0.1, duration: 0.5 }}
          className="relative group"
        >
          <div className="bg-neutral-900/50 backdrop-blur-sm border border-red-900/30 rounded-lg p-6 hover:border-red-500/50 transition-all duration-300">
            <div className="text-center">
              <CountUpNumber
                end={stat.value}
                prefix={stat.prefix}
                suffix={stat.suffix}
                isInView={isInView}
              />
              <p className="text-sm text-neutral-400 mt-2">{stat.label}</p>
            </div>
          </div>
          
          {/* Decorative glow on hover */}
          <div className="absolute inset-0 bg-red-500/5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity blur-xl -z-10" />
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
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;

    const duration = 2000; // 2 seconds
    const steps = 60;
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
  }, [end, isInView]);

  return (
    <div className="text-4xl font-bold text-red-400">
      {prefix}
      {count.toLocaleString()}
      {suffix}
    </div>
  );
}
