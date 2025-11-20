"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface SectionTitleProps {
  children: ReactNode;
  subtitle?: string;
}

export default function SectionTitle({ children, subtitle }: SectionTitleProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="mb-12"
    >
      <h2 className="mb-4">{children}</h2>
      {subtitle && (
        <p className="text-xl text-neutral-400 max-w-3xl">{subtitle}</p>
      )}
      <div className="mt-4 h-1 w-20 bg-gradient-to-r from-red-600 to-red-400 rounded-full" />
    </motion.div>
  );
}
