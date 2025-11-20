"use client";

import { motion } from "framer-motion";
import { Calendar, MapPin } from "lucide-react";

interface ExperienceCardProps {
  company: string;
  role: string;
  period: string;
  location?: string;
  achievements: string[];
  index: number;
}

export default function ExperienceCard({
  company,
  role,
  period,
  location,
  achievements,
  index,
}: ExperienceCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="card-glass p-6 hover:border-red-500/50 transition-all duration-300 group backdrop-blur-sm bg-neutral-900/30"
    >
      <div className="flex flex-col md:flex-row md:items-start md:justify-between mb-4">
        <div>
          <h3 className="text-2xl font-semibold mb-1 group-hover:text-red-400 transition-colors">
            {role}
          </h3>
          <p className="text-lg text-red-400 font-medium">{company}</p>
        </div>
        <div className="mt-2 md:mt-0 md:text-right">
          <div className="flex items-center gap-2 text-sm text-neutral-400">
            <Calendar size={16} />
            <span>{period}</span>
          </div>
          {location && (
            <div className="flex items-center gap-2 text-sm text-neutral-400 mt-1">
              <MapPin size={16} />
              <span>{location}</span>
            </div>
          )}
        </div>
      </div>

      <ul className="space-y-2">
        {achievements.map((achievement, i) => (
          <li key={i} className="flex gap-3 text-neutral-300">
            <span className="text-red-400 mt-1.5">▸</span>
            <span>{achievement}</span>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}
