import type { Metadata } from "next";
import AboutStory from "@/components/AboutStory";
import { about } from "@/data/metadata";

export const metadata: Metadata = {
  title: "About — Harvey Houlahan",
  description: about.paragraphs[0],
};

export default function About() {
  return <AboutStory />;
}
