"use client";

// Shared scroll-entrance: a quiet rise as blocks reach the viewport, once.
// No-op (content just renders) under prefers-reduced-motion.
import { motion, useReducedMotion } from "framer-motion";

export default function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-8% 0px" }}
      transition={{ duration: 0.55, delay, ease: [0.2, 0.6, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}
