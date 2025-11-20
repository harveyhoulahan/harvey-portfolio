"use client";

import { motion } from "framer-motion";
import TextCursorProximity from "@/components/ui/text-cursor-proximity";
import AnimatedStats from "@/components/AnimatedStats";
import Image from "next/image";
import { useRef } from "react";

const careerStats = [
  { value: 5, label: "Companies Worked With", suffix: "+" },
  { value: 94, label: "ML Model Accuracy", suffix: "%" },
  { value: 7, label: "Major Projects Shipped", suffix: "" },
  { value: 15, label: "Technologies Mastered", suffix: "+" },
];

export default function About() {
  const headerRef = useRef<HTMLDivElement>(null);
  
  return (
    <div className="section-container">
      <div ref={headerRef} className="mb-16">
        <TextCursorProximity
          label="ABOUT ME"
          className="text-5xl md:text-7xl font-black text-white tracking-tight uppercase block mb-4"
          styles={{
            transform: {
              from: "scale(1)",
              to: "scale(1.1)",
            },
            color: { 
              from: "#FFFFFF", 
              to: "#FF0000"
            },
          }}
          falloff="gaussian"
          radius={120}
          containerRef={headerRef}
        />
        <p className="text-xl text-neutral-400 max-w-3xl mt-6">
          A background that bridges farming, engineering, and applied AI.
        </p>
      </div>

      {/* Animated Stats */}
      <div className="mb-16">
        <AnimatedStats stats={careerStats} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
        {/* Image */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="relative"
        >
          <div className="aspect-square rounded-lg overflow-hidden relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            {/* Placeholder for professional portrait */}
            <div className="w-full h-full bg-gradient-to-br from-neutral-800 to-neutral-900 flex items-center justify-center border border-red-900/20">
              <span className="text-6xl text-neutral-600 group-hover:text-red-400/50 transition-colors">HJH</span>
            </div>
          </div>
        </motion.div>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="space-y-6"
        >
          <p className="text-lg leading-relaxed text-neutral-300">
            Raised in the cotton-growing region of northern NSW, I grew up around fabrics,
            textiles, and supply chains long before studying engineering. That experience now
            shapes the systems I build—whether it&apos;s a fibre-level trust architecture at
            FibreTrace, a circular fashion platform at Modaics, or livestock intelligence models
            at AgrIQ.
          </p>

          <p className="text-lg leading-relaxed text-neutral-300">
            I&apos;m completing a B.S. in Advanced Computer Science (AI/ML) at Monash University
            and working across applied machine learning, NLP, data pipelines, and iOS engineering.
            I focus on turning unstructured data into accurate, reliable insights at scale.
          </p>

          <div className="pt-6 space-y-4">
            <h3 className="text-xl font-semibold text-red-400">Currently</h3>
            <ul className="space-y-3">
              <li className="flex gap-3">
                <span className="text-red-400 mt-1">▸</span>
                <span className="text-neutral-300">
                  Building production ML systems at Friday Technologies & Step One Clothing
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-red-400 mt-1">▸</span>
                <span className="text-neutral-300">
                  Developing iOS applications for supply chain transparency at FibreTrace
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-red-400 mt-1">▸</span>
                <span className="text-neutral-300">
                  Completing Advanced Computer Science degree at Monash University
                </span>
              </li>
            </ul>
          </div>

          <div className="pt-6 space-y-4">
            <h3 className="text-xl font-semibold text-red-400">Background</h3>
            <p className="text-neutral-300">
              From northern NSW&apos;s cotton belt to NYC&apos;s tech scene, my journey combines
              hands-on agricultural experience with cutting-edge software engineering. This unique
              perspective drives my work in sustainable tech and applied AI.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
