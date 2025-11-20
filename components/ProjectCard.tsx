"use client";

import { motion } from "framer-motion";
import { ExternalLink, Github } from "lucide-react";

interface ProjectCardProps {
  title: string;
  description: string;
  features: string[];
  tags?: string[];
  link?: string;
  github?: string;
  index: number;
}

export default function ProjectCard({
  title,
  description,
  features,
  tags = [],
  link,
  github,
  index,
}: ProjectCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="card-glass p-6 hover:border-red-500/50 transition-all duration-300 group h-full flex flex-col backdrop-blur-sm bg-neutral-900/30"
    >
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-2xl font-semibold group-hover:text-red-400 transition-colors">
          {title}
        </h3>
        <div className="flex gap-3">
          {github && (
            <a
              href={github}
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-400 hover:text-white transition-colors"
              aria-label="GitHub repository"
            >
              <Github size={20} />
            </a>
          )}
          {link && (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-400 hover:text-white transition-colors"
              aria-label="Project link"
            >
              <ExternalLink size={20} />
            </a>
          )}
        </div>
      </div>

      <p className="text-neutral-300 mb-4">{description}</p>

      <ul className="space-y-2 mb-4 flex-grow">
        {features.map((feature, i) => (
          <li key={i} className="flex gap-3 text-sm text-neutral-400">
            <span className="text-red-400 mt-1">•</span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-auto pt-4 border-t border-neutral-800">
          {tags.map((tag, i) => (
            <span
              key={i}
              className="px-3 py-1 text-xs font-medium bg-red-500/10 text-red-400 rounded-full border border-red-500/20"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}
