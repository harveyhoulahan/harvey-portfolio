import type { Metadata } from "next";
import AboutStory from "@/components/AboutStory";
import { about } from "@/data/metadata";

export const metadata: Metadata = {
  title: "About — Harvey Houlahan",
  description: `${about.paragraphs[0]} Plus the full stack, with receipts: pretraining, canopy ML, GPU simulation and stochastic modelling, each anchored to a real artifact.`,
};

export default function About() {
  return <AboutStory />;
}
