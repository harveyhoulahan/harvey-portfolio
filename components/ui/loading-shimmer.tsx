"use client";

import { TextShimmer } from "./text-shimmer";
import { cn } from "@/lib/utils";

/**
 * Branded shimmer text components for Harvey's portfolio
 * Uses blue/cyan gradient matching the portfolio's color scheme
 */

interface LoadingShimmerProps {
  text: string;
  className?: string;
  duration?: number;
}

// Primary shimmer - Blue gradient (for main loading states)
export function PrimaryShimmer({ text, className, duration = 1.5 }: LoadingShimmerProps) {
  return (
    <TextShimmer
      duration={duration}
      className={cn(
        "font-mono text-sm",
        "[--base-color:theme(colors.neutral.600)]",
        "[--base-gradient-color:theme(colors.blue.400)]",
        "dark:[--base-color:theme(colors.neutral.500)]",
        "dark:[--base-gradient-color:theme(colors.blue.400)]",
        className
      )}
    >
      {text}
    </TextShimmer>
  );
}

// Accent shimmer - Cyan gradient (for special states)
export function AccentShimmer({ text, className, duration = 1.5 }: LoadingShimmerProps) {
  return (
    <TextShimmer
      duration={duration}
      className={cn(
        "font-mono text-sm",
        "[--base-color:theme(colors.neutral.600)]",
        "[--base-gradient-color:theme(colors.cyan.400)]",
        "dark:[--base-color:theme(colors.neutral.500)]",
        "dark:[--base-gradient-color:theme(colors.cyan.300)]",
        className
      )}
    >
      {text}
    </TextShimmer>
  );
}

// Hero shimmer - Large text for hero sections
export function HeroShimmer({ text, className, duration = 2 }: LoadingShimmerProps) {
  return (
    <TextShimmer
      duration={duration}
      className={cn(
        "text-4xl md:text-5xl lg:text-6xl font-bold",
        "[--base-color:theme(colors.neutral.700)]",
        "[--base-gradient-color:theme(colors.blue.400)]",
        "dark:[--base-color:theme(colors.neutral.600)]",
        "dark:[--base-gradient-color:theme(colors.blue.300)]",
        className
      )}
    >
      {text}
    </TextShimmer>
  );
}

// Gradient shimmer - Blue to Cyan (portfolio signature)
export function GradientShimmer({ text, className, duration = 1.8 }: LoadingShimmerProps) {
  return (
    <TextShimmer
      duration={duration}
      spread={3}
      className={cn(
        "text-2xl md:text-3xl font-semibold",
        "[--base-color:theme(colors.neutral.600)]",
        "[--base-gradient-color:theme(colors.blue.400)]",
        "dark:[--base-color:theme(colors.neutral.500)]",
        "dark:[--base-gradient-color:theme(colors.cyan.400)]",
        className
      )}
    >
      {text}
    </TextShimmer>
  );
}

// Status shimmer - For status messages
export function StatusShimmer({ text, className, duration = 1.2 }: LoadingShimmerProps) {
  return (
    <TextShimmer
      duration={duration}
      className={cn(
        "text-xs font-medium tracking-wide uppercase",
        "[--base-color:theme(colors.neutral.500)]",
        "[--base-gradient-color:theme(colors.blue.500)]",
        "dark:[--base-color:theme(colors.neutral.600)]",
        "dark:[--base-gradient-color:theme(colors.blue.400)]",
        className
      )}
    >
      {text}
    </TextShimmer>
  );
}

// Common loading messages
export const LoadingMessages = {
  // Generic
  loading: "Loading...",
  processing: "Processing...",
  initializing: "Initializing...",
  
  // Portfolio specific
  buildingPortfolio: "Building portfolio...",
  loadingProjects: "Loading projects...",
  loadingExperience: "Loading experience...",
  generatingContent: "Generating content...",
  
  // AI/ML themed (matching your background)
  trainingModel: "Training model...",
  analyzingData: "Analyzing data...",
  optimizing: "Optimizing...",
  
  // Fun/personality
  brewingCode: "Brewing code...",
  weavingFibers: "Weaving fibers...", // Reference to cotton/FibreTrace
  synthesizing: "Synthesizing...",
};
