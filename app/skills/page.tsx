import type { Metadata } from "next";
import SkillsExplorer from "@/components/SkillsExplorer";
import { skillsData } from "@/data/skills";

export const metadata: Metadata = {
  title: "Skills — Harvey Houlahan",
  description:
    "Geospatial, backend, frontend, ML/data, iOS and infrastructure stack for production spatial data systems.",
};

export default function Skills() {
  return <SkillsExplorer groups={skillsData} />;
}
