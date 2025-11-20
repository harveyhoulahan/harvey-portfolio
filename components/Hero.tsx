"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, FileText, Mail } from "lucide-react";

export default function Hero() {
  return (
    <section className="relative min-h-[90vh] flex items-center overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl" />
      </div>

      <div className="section-container relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Text Content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mb-4"
            >
              <span className="text-blue-400 text-sm font-mono tracking-wider">
                &lt;Welcome /&gt;
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mb-4"
            >
              Harvey J. Houlahan
            </motion.h1>

            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-2xl md:text-3xl font-normal text-neutral-400 mb-6"
            >
              AI/ML Engineer • Applied NLP • Data Systems • iOS • Sustainable Tech
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mb-8 max-w-2xl"
            >
              Australian engineer from the cotton belt building ML systems, supply-chain
              transparency tools, and applied AI for products used across fashion, energy,
              and healthcare. Now based in NYC.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="flex flex-wrap gap-4"
            >
              <Link
                href="/resume.pdf"
                className="group flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-blue-500/50"
              >
                <FileText size={18} />
                View Resume
                <ArrowRight
                  size={18}
                  className="group-hover:translate-x-1 transition-transform"
                />
              </Link>

              <Link
                href="/contact"
                className="group flex items-center gap-2 px-6 py-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg border border-neutral-700 transition-all duration-300 hover:scale-105"
              >
                <Mail size={18} />
                Contact Me
              </Link>

              <Link
                href="/projects"
                className="group flex items-center gap-2 px-6 py-3 text-neutral-300 hover:text-white transition-colors"
              >
                View Projects
                <ArrowRight
                  size={18}
                  className="group-hover:translate-x-1 transition-transform"
                />
              </Link>
            </motion.div>
          </motion.div>

          {/* Visual Element */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.4 }}
            className="relative hidden lg:block"
          >
            <div className="relative w-full h-[500px] rounded-lg overflow-hidden card-glass p-8">
              {/* Placeholder for split-screen cotton/NYC image */}
              <div className="absolute inset-0 bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 opacity-50" />
              
              {/* Matrix pattern overlay */}
              <div className="absolute inset-0 matrix-overlay opacity-30" />
              
              {/* Floating code snippets effect */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="space-y-2 font-mono text-xs text-blue-400/60">
                  <div>const engineer = &#123;</div>
                  <div className="pl-4">focus: "Applied AI",</div>
                  <div className="pl-4">stack: ["Python", "Swift", "TypeScript"],</div>
                  <div className="pl-4">location: "NYC"</div>
                  <div>&#125;;</div>
                </div>
              </div>

              {/* Glow effect */}
              <div className="absolute inset-0 bg-gradient-to-t from-blue-600/10 to-transparent" />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
