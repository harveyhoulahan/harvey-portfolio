import type { Metadata } from "next";
import AboutStory from "@/components/AboutStory";
import { about } from "@/data/metadata";

export const metadata: Metadata = {
  title: "About — Harvey Houlahan",
  description: `${about.paragraphs[0]} Plus the stack: pretraining, canopy ML, GPU simulation and stochastic modelling, each tied to a real artifact.`,
};

export default function About() {
  return <AboutStory />;
}
