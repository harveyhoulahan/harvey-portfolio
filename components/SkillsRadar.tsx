"use client";

import { motion } from "framer-motion";
import { useState } from "react";

interface Skill {
  name: string;
  level: number; // 0-100
  category: string;
}

interface SkillsRadarProps {
  skills: Skill[];
}

export default function SkillsRadar({ skills }: SkillsRadarProps) {
  const [hoveredSkill, setHoveredSkill] = useState<string | null>(null);

  return (
    <div className="relative w-full max-w-4xl mx-auto">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {skills.map((skill, index) => (
          <motion.div
            key={skill.name}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            onHoverStart={() => setHoveredSkill(skill.name)}
            onHoverEnd={() => setHoveredSkill(null)}
            className="relative group"
          >
            <div className="bg-neutral-900/50 backdrop-blur-sm border border-red-900/30 rounded-lg p-4 hover:border-red-500/50 transition-all duration-300 h-full">
              <div className="flex flex-col h-full">
                <h4 className="text-sm font-semibold mb-2 text-white group-hover:text-red-400 transition-colors">
                  {skill.name}
                </h4>
                <div className="flex-grow flex items-end">
                  <div className="w-full">
                    <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${skill.level}%` }}
                        transition={{ duration: 1, delay: index * 0.05 }}
                        className="h-full bg-gradient-to-r from-red-600 to-red-400 rounded-full relative"
                      >
                        {hoveredSkill === skill.name && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="absolute -top-8 right-0 bg-red-500 text-white text-xs px-2 py-1 rounded whitespace-nowrap"
                          >
                            {skill.level}%
                          </motion.div>
                        )}
                      </motion.div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
