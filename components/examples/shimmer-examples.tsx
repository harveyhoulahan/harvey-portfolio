"use client";

/**
 * Example implementations of shimmer text loading states
 * for Harvey's portfolio
 * 
 * Copy these patterns into your actual components
 */

import { useState, useEffect } from "react";
import {
  PrimaryShimmer,
  AccentShimmer,
  HeroShimmer,
  GradientShimmer,
  StatusShimmer,
  LoadingMessages,
} from "@/components/ui/loading-shimmer";

// Example 1: Page Loading State
export function PageLoadingExample() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <HeroShimmer text="Harvey J. Houlahan" />
        <PrimaryShimmer text={LoadingMessages.buildingPortfolio} />
      </div>
    </div>
  );
}

// Example 2: Content Loading State (for Projects/Experience pages)
export function ContentLoadingExample() {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => setIsLoading(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <div className="section-container">
        <div className="space-y-6">
          <GradientShimmer text={LoadingMessages.loadingProjects} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2].map((i) => (
              <div key={i} className="card-glass p-6 h-64 animate-pulse">
                <div className="h-4 bg-neutral-800 rounded w-3/4 mb-4"></div>
                <div className="h-3 bg-neutral-800 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return <div>Your actual content here</div>;
}

// Example 3: Contact Form Submission State
export function ContactFormSubmittingExample() {
  const [status, setStatus] = useState<"idle" | "submitting" | "sent">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("submitting");
    
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setStatus("sent");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Form fields here */}
      
      <button
        type="submit"
        disabled={status === "submitting"}
        className="w-full px-6 py-3 bg-blue-600 rounded-lg"
      >
        {status === "submitting" ? (
          <StatusShimmer text="Sending message..." className="text-white" />
        ) : status === "sent" ? (
          "Message Sent!"
        ) : (
          "Send Message"
        )}
      </button>
    </form>
  );
}

// Example 4: Data Fetching with Shimmer
export function DataFetchingExample() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate data fetching
    const fetchData = async () => {
      setIsLoading(true);
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setData({ /* your data */ });
      setIsLoading(false);
    };
    
    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="card-glass p-8 text-center">
        <AccentShimmer 
          text={LoadingMessages.analyzingData} 
          className="text-lg"
        />
      </div>
    );
  }

  return <div>Your data content</div>;
}

// Example 5: Inline Loading State (for small components)
export function InlineLoadingExample({ isProcessing }: { isProcessing: boolean }) {
  return (
    <div className="flex items-center gap-3">
      {isProcessing ? (
        <PrimaryShimmer text={LoadingMessages.processing} />
      ) : (
        <span className="text-green-400">✓ Ready</span>
      )}
    </div>
  );
}

// Example 6: Hero Section with Initial Load Animation
export function HeroWithShimmerExample() {
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  if (!showContent) {
    return (
      <section className="min-h-[90vh] flex items-center justify-center">
        <div className="space-y-6 text-center">
          <HeroShimmer text="Harvey J. Houlahan" duration={1.5} />
          <PrimaryShimmer 
            text="AI/ML Engineer • Applied NLP • Data Systems" 
            className="text-base"
          />
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-[90vh]">
      {/* Your actual hero content */}
    </section>
  );
}

// Example 7: Multiple Sequential Loading States
export function SequentialLoadingExample() {
  const [stage, setStage] = useState(0);
  
  const stages = [
    LoadingMessages.initializing,
    LoadingMessages.loadingExperience,
    LoadingMessages.loadingProjects,
    "Complete!",
  ];

  useEffect(() => {
    if (stage < stages.length - 1) {
      const timer = setTimeout(() => setStage(stage + 1), 800);
      return () => clearTimeout(timer);
    }
  }, [stage, stages.length]);

  return (
    <div className="text-center space-y-4">
      <StatusShimmer text={stages[stage]} />
      <div className="flex gap-2 justify-center">
        {stages.map((_, i) => (
          <div
            key={i}
            className={`h-2 w-2 rounded-full ${
              i <= stage ? "bg-blue-400" : "bg-neutral-700"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// Export all examples for documentation
export const ShimmerExamples = {
  PageLoadingExample,
  ContentLoadingExample,
  ContactFormSubmittingExample,
  DataFetchingExample,
  InlineLoadingExample,
  HeroWithShimmerExample,
  SequentialLoadingExample,
};
