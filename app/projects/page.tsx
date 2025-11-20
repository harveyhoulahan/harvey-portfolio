"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import SectionTitle from "@/components/SectionTitle";
import ProjectCard from "@/components/ProjectCard";
import { PortfolioGallery } from "@/components/ui/portfolio-gallery";
import TextCursorProximity from "@/components/ui/text-cursor-proximity";
import { projectsData } from "@/data/projects";
import { projectImages } from "@/data/project-images";
import { motion } from "framer-motion";

export default function Projects() {
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  const handleImageClick = (index: number) => {
    // Navigate to project detail page
    const projectId = projectImages[index].project;
    window.location.href = `/projects/${projectId}`;
  };

  return (
    <>
      {/* Hero Section with Text Cursor Proximity */}
      <div 
        ref={heroRef}
        className="relative w-full overflow-hidden bg-black border-b border-white/10"
      >
        {/* Main Title Area */}
        <div className="flex flex-col justify-between min-h-[85vh] px-8 md:px-16 lg:px-24 py-16">
          <div className="uppercase leading-[0.85] gap-2 flex-1 flex flex-col justify-center">
            <TextCursorProximity
              label="HARVEY'S"
              className="text-6xl will-change-transform sm:text-8xl md:text-9xl lg:text-[12rem] font-black tracking-tighter block"
              styles={{
                transform: {
                  from: "scale(1)",
                  to: "scale(1.3)",
                },
                color: { 
                  from: "#FFFFFF", 
                  to: "#FF0000"
                },
              }}
              falloff="gaussian"
              radius={150}
              containerRef={heroRef}
            />
            <TextCursorProximity
              label="WORKSHOP"
              className="leading-[0.85] text-6xl will-change-transform sm:text-8xl md:text-9xl lg:text-[12rem] font-black tracking-tighter block"
              styles={{
                transform: {
                  from: "scale(1)",
                  to: "scale(1.3)",
                },
                color: { 
                  from: "#FFFFFF", 
                  to: "#FF0000"
                },
              }}
              falloff="gaussian"
              radius={150}
              containerRef={heroRef}
            />
          </div>

          {/* Animated Project Carousel */}
          <div className="w-full overflow-hidden py-8 border-t border-white/5">
            <motion.div 
              className="flex gap-6 items-center"
              animate={{
                x: [0, -2000],
              }}
              transition={{
                x: {
                  repeat: Infinity,
                  repeatType: "loop",
                  duration: 40,
                  ease: "linear",
                },
              }}
            >
              {[...projectsData, ...projectsData, ...projectsData].map((project, index) => (
                <Link key={`${project.id}-${index}`} href={`/projects/${project.id}`}>
                  <motion.div
                    className="group cursor-pointer flex-shrink-0"
                    whileHover={{ scale: 1.05 }}
                  >
                    <div className="relative overflow-hidden">
                      <div className="flex items-center gap-4 px-6 py-3 rounded-full bg-gradient-to-r from-white/5 to-white/10 border border-white/20 hover:border-red-500 transition-all duration-500 backdrop-blur-sm whitespace-nowrap group-hover:from-red-500/20 group-hover:to-red-600/20">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>
                        <span className="text-sm font-bold text-white/90 group-hover:text-white transition-colors tracking-wide uppercase">
                          {project.title.split(" - ")[0]}
                        </span>
                        <div className="w-1 h-1 rounded-full bg-white/30"></div>
                      </div>
                    </div>
                  </motion.div>
                </Link>
              ))}
            </motion.div>
          </div>
        </div>

        <TextCursorProximity
          className="absolute top-8 right-8 md:top-12 md:right-12 text-xs md:text-sm font-mono tracking-[0.3em] uppercase"
          label="2021-2025"
          styles={{
            transform: {
              from: "scale(1)",
              to: "scale(1.2)",
            },
            color: { 
              from: "#666666", 
              to: "#FF0000"
            },
          }}
          falloff="exponential"
          radius={100}
          containerRef={heroRef}
        />
      </div>

      {/* Project Grid Section */}
      <div className="min-h-screen bg-gradient-to-b from-black via-neutral-950 to-black py-24 px-8 md:px-16 lg:px-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <TextCursorProximity
            label="FEATURED PROJECTS"
            className="text-5xl md:text-7xl font-black text-white mb-4 tracking-tight uppercase block"
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
            containerRef={heroRef}
          />
          <p className="text-neutral-400 text-lg max-w-2xl mt-6">
            Building AI systems for real-world problems in agriculture, energy, and supply chain.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {projectsData.map((project, index) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -8 }}
                className="group h-full"
              >
                <div className="relative h-full overflow-hidden rounded-2xl bg-gradient-to-br from-neutral-900 to-black border border-white/10 hover:border-red-500/50 transition-all duration-500">
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-br from-red-500/0 via-red-500/0 to-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  
                  <div className="relative p-8 h-full flex flex-col">
                    {/* Project header */}
                    <div className="flex items-start justify-between mb-6">
                      <div className="flex-1">
                        <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-red-400 transition-colors">
                          {project.title}
                        </h3>
                        <p className="text-sm text-red-500 font-mono">{project.category}</p>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-neutral-300 text-sm mb-6 leading-relaxed flex-1">
                      {project.description}
                    </p>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-2">
                      {project.tags.slice(0, 5).map((tag) => (
                        <span
                          key={tag}
                          className="px-3 py-1 text-xs font-medium bg-white/5 border border-white/10 rounded-full text-neutral-400 group-hover:border-red-500/30 group-hover:text-white transition-all"
                        >
                          {tag}
                        </span>
                      ))}
                      {project.tags.length > 5 && (
                        <span className="px-3 py-1 text-xs font-medium text-neutral-500">
                          +{project.tags.length - 5}
                        </span>
                      )}
                    </div>

                    {/* Arrow indicator */}
                    <div className="absolute bottom-8 right-8 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
                      <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </div>
                  </div>
                </div>
              </motion.div>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
