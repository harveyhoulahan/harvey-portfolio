"use client";

import { motion } from "framer-motion";
import { useState } from "react";

interface TimelineItem {
  year: string;
  company: string;
  role: string;
  highlight: string;
}

interface InteractiveTimelineProps {
  items: TimelineItem[];
}

export default function InteractiveTimeline({ items }: InteractiveTimelineProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <div className="relative mb-16">
      <div className="text-center mb-12">
        <h3 className="text-2xl font-semibold text-red-400 mb-4">Career Timeline</h3>
        <p className="text-neutral-400">Click on a year to explore my journey</p>
      </div>

      {/* Timeline Line */}
      <div className="relative">
        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-neutral-800 -translate-y-1/2" />
        <motion.div
          className="absolute top-1/2 left-0 h-0.5 bg-gradient-to-r from-red-600 to-red-400 -translate-y-1/2"
          initial={{ width: "0%" }}
          animate={{ width: `${((activeIndex + 1) / items.length) * 100}%` }}
          transition={{ duration: 0.5 }}
        />

        {/* Timeline Points */}
        <div className="relative flex justify-between items-center py-8">
          {items.map((item, index) => (
            <motion.button
              key={index}
              onClick={() => setActiveIndex(index)}
              className="relative z-10 group focus:outline-none"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              <div
                className={`w-4 h-4 rounded-full border-2 transition-all duration-300 ${
                  index <= activeIndex
                    ? "bg-red-500 border-red-500 shadow-lg shadow-red-500/50"
                    : "bg-neutral-900 border-neutral-700 group-hover:border-red-400"
                }`}
              />
              <div className="absolute top-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
                <span
                  className={`text-sm font-mono transition-colors ${
                    index === activeIndex ? "text-red-400 font-bold" : "text-neutral-500"
                  }`}
                >
                  {item.year}
                </span>
              </div>
            </motion.button>
          ))}
        </div>

        {/* Active Card */}
        <motion.div
          key={activeIndex}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mt-8 bg-neutral-900/50 backdrop-blur-sm border border-red-900/30 rounded-lg p-8 hover:border-red-500/50 transition-colors"
        >
          <div className="text-center">
            <h4 className="text-2xl font-bold text-white mb-2">{items[activeIndex].role}</h4>
            <p className="text-lg text-red-400 mb-4">{items[activeIndex].company}</p>
            <p className="text-neutral-300 max-w-2xl mx-auto">{items[activeIndex].highlight}</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
