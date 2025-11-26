"use client";

import { Dithering } from "@paper-design/shaders-react";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, FileText, Mail, Linkedin } from "lucide-react";

export default function ProfessionalHeroWithShaders() {
  const [isDarkMode] = useState(true); // Always dark for your brand

  return (
    <div className="relative min-h-screen overflow-hidden flex flex-col lg:flex-row">
      {/* Left Panel - Content */}
      <div
        className={`w-full lg:w-1/2 p-8 lg:p-12 xl:p-16 font-sans relative z-10 flex flex-col justify-between ${
          isDarkMode ? "bg-black text-white" : "bg-white text-black"
        }`}
      >
        {/* Header */}
        <div>
          <div className="mb-12 lg:mb-16 animate-fade-in-up">
            <h1 className="text-sm font-mono text-red-400 mb-8 tracking-wider">
              PORTFOLIO.2025
            </h1>
            <div className="mb-8 space-y-2">
              <h2 className="text-4xl lg:text-5xl xl:text-6xl font-bold tracking-tight">
                HARVEY J.
              </h2>
              <h2 className="text-4xl lg:text-5xl xl:text-6xl font-bold tracking-tight">
                HOULAHAN
              </h2>
              <h3 className="text-xl lg:text-2xl font-normal text-neutral-400 mt-4">
                AI/ML ENGINEER
              </h3>
              <p className="text-sm lg:text-base text-neutral-500 mt-3 leading-relaxed">
                Australian ML engineer in NYC, shipping production systems for fashion, energy, and agtech — focused on LLMs, semantic search, and real-time data.
              </p>
            </div>
          </div>

          {/* Experience Timeline */}
          <div className="mb-12 space-y-3 font-mono text-sm lg:text-base animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-neutral-300 hover:text-white transition-colors duration-300">
              <span className="w-32 lg:w-40 text-red-400">Friday Tech</span>
              <span className="flex-1">AI/Backend</span>
              <span className="text-neutral-500">2025 → Present</span>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-neutral-300 hover:text-white transition-colors duration-300">
              <span className="w-32 lg:w-40 text-red-400">Step One</span>
              <span className="flex-1">Software Eng</span>
              <span className="text-neutral-500">2025 → Present</span>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-neutral-300 hover:text-white transition-colors duration-300">
              <span className="w-32 lg:w-40 text-red-400">FibreTrace</span>
              <span className="flex-1">iOS Engineer</span>
              <span className="text-neutral-500">2024 → Present</span>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-neutral-300 hover:text-white transition-colors duration-300">
              <span className="w-32 lg:w-40 text-red-400">AEMO</span>
              <span className="flex-1">SWE Intern</span>
              <span className="text-neutral-500">2023, 2024</span>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-neutral-300 hover:text-white transition-colors duration-300">
              <span className="w-32 lg:w-40 text-red-400">Education</span>
              <span className="flex-1">Monash CS/AI</span>
              <span className="text-neutral-500">Present</span>
            </div>
          </div>

          {/* Bio */}
          <div className="mb-8 max-w-lg animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
            <p className="text-neutral-400 leading-relaxed text-sm lg:text-base">
              Australian engineer from the cotton belt building ML systems, supply-chain
              transparency tools, and applied AI for products across fashion, energy, and
              healthcare. Now based in NYC.
            </p>
          </div>

          {/* Interests */}
          <div className="mb-8 max-w-lg animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
            <p className="text-xs font-mono text-neutral-500 mb-2">RECENT AI/LLM WORK</p>
            <p className="text-neutral-400 text-sm leading-relaxed">
              RAG systems for e-commerce search • LLM-driven semantic search • Time-series forecasting for energy & agriculture • CoreML-based on-device inference
            </p>
          </div>

          <div className="mb-8 max-w-lg animate-fade-in-up" style={{ animationDelay: '0.55s' }}>
            <p className="text-xs font-mono text-neutral-500 mb-2">INTERESTS</p>
            <p className="text-neutral-400 text-sm">
              Blockchain Engineering • Distributed Systems • Applied Cryptography
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-wrap gap-4 mb-8 animate-fade-in-up" style={{ animationDelay: '0.6s' }}>
            <Link
              href="/resume.pdf"
              className="group inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white rounded-lg transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-red-500/50 font-medium"
            >
              <FileText size={18} />
              Resume
              <ArrowRight
                size={18}
                className="group-hover:translate-x-1 transition-transform"
              />
            </Link>

            <Link
              href="/contact"
              className="group inline-flex items-center gap-2 px-6 py-3 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg border border-neutral-700 hover:border-red-500/50 transition-all duration-300 font-medium"
            >
              <Mail size={18} />
              Contact
            </Link>
          </div>
        </div>

        {/* Footer Links */}
        <div className="border-t border-neutral-800 pt-6">
          <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-mono">
            <Link
              href="/projects"
              className="text-neutral-400 hover:text-white transition-colors"
            >
              Projects
            </Link>
            <Link
              href="/experience"
              className="text-neutral-400 hover:text-white transition-colors"
            >
              Experience
            </Link>
            <Link
              href="/skills"
              className="text-neutral-400 hover:text-white transition-colors"
            >
              Skills
            </Link>
            <a
              href="mailto:harveyhoulahan@outlook.com"
              className="text-neutral-400 hover:text-white transition-colors"
            >
              Email
            </a>
            <a
              href="https://linkedin.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-400 hover:text-white transition-colors inline-flex items-center gap-1"
            >
              LinkedIn
              <Linkedin size={14} />
            </a>
          </div>

          {/* Location & Visa Status */}
          <div className="mt-4 text-xs text-neutral-500 font-mono">
            <span>NYC, USA</span>
            <span className="mx-2">•</span>
            <span className="text-red-400">E-3 Visa Eligible</span>
          </div>
        </div>
      </div>

      {/* Right Panel - Shader Animation */}
      <div className="w-full lg:w-1/2 relative min-h-[400px] lg:min-h-screen">
        <Dithering
          style={{ height: "100%", width: "100%" }}
          colorBack="hsl(0, 0%, 4%)"
          colorFront="hsl(0, 85%, 60%)"
          shape="ripple"
          type="4x4"
          pxSize={2}
          offsetX={0}
          offsetY={0}
          scale={1.2}
          rotation={0}
          speed={0.04}
        />
        
        {/* Overlay gradient for depth and flow */}
        <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 via-transparent to-red-600/10 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-black/30 pointer-events-none" />
      </div>
    </div>
  );
}
