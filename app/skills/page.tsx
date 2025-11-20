"use client";

import { motion } from "framer-motion";
import TextCursorProximity from "@/components/ui/text-cursor-proximity";
import { skillsData } from "@/data/skills";
import { useRef } from "react";

export default function Skills() {
  const headerRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLDivElement>(null);

  return (
    <div className="min-h-screen bg-black">
      {/* Hero Section */}
      <div ref={headerRef} className="relative border-b border-white/10 py-20 px-8 md:px-16 lg:px-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <TextCursorProximity
            label="TECHNICAL SKILLS"
            className="text-6xl md:text-8xl font-black text-white tracking-tighter uppercase block mb-6"
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
            radius={150}
            containerRef={headerRef}
          />
          <p className="text-xl md:text-2xl text-neutral-400 max-w-3xl mt-8">
            A comprehensive toolkit for building intelligent, scalable systems.
          </p>
        </motion.div>
      </div>

      {/* Skills Grid */}
      <div ref={sectionRef} className="py-16 px-8 md:px-16 lg:px-24">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mb-12"
        >
          <TextCursorProximity
            label="CORE COMPETENCIES"
            className="text-4xl md:text-5xl font-black text-white tracking-tight uppercase block"
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
            containerRef={sectionRef}
          />
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {skillsData.map((category, categoryIndex) => (
            <motion.div
              key={categoryIndex}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: categoryIndex * 0.1 }}
              className="group"
            >
              <div className="h-full rounded-xl bg-gradient-to-br from-neutral-900 to-black border border-white/10 hover:border-red-500/50 transition-all duration-500 overflow-hidden">
                <div className="p-6">
                  {/* Category Header */}
                  <h3 className="text-xl font-bold text-white mb-6 group-hover:text-red-400 transition-colors">
                    {category.category}
                  </h3>

                  {/* Skills List */}
                  <div className="space-y-3">
                    {category.skills.map((skill, skillIndex) => (
                      <motion.div
                        key={skillIndex}
                        initial={{ opacity: 0, x: -10 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: categoryIndex * 0.1 + skillIndex * 0.05 }}
                        className="group/skill"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-red-500 opacity-50 group-hover/skill:opacity-100 group-hover/skill:animate-pulse transition-opacity"></div>
                          <span className="text-sm text-neutral-400 group-hover/skill:text-white transition-colors font-medium">
                            {skill}
                          </span>
                        </div>
                        
                        {/* Animated skill bar */}
                        <div className="mt-2 ml-5 h-0.5 bg-white/5 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            whileInView={{ width: `${75 + Math.random() * 25}%` }}
                            viewport={{ once: true }}
                            transition={{ duration: 1, delay: categoryIndex * 0.1 + skillIndex * 0.05 }}
                            className="h-full bg-gradient-to-r from-red-600 to-red-400 rounded-full"
                          />
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-20 text-center"
        >
          <div className="inline-block px-8 py-4 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm">
            <p className="text-neutral-300 text-sm md:text-base">
              <span className="text-red-500 font-bold">Continuous learner</span> • Staying current with emerging tech through hands-on experimentation
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
