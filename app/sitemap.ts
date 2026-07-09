import type { MetadataRoute } from "next";
import { caseStudies } from "@/data/projects";

const BASE = "https://hjhportfolio.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = [
    { path: "", priority: 1.0 },
    { path: "/projects", priority: 0.9 },
    { path: "/playground", priority: 0.9 },
    { path: "/catchment", priority: 0.8 },
    { path: "/genesis", priority: 0.8 },
    { path: "/about", priority: 0.7 },
    { path: "/contact", priority: 0.6 },
  ];
  return [
    ...pages.map(({ path, priority }) => ({
      url: `${BASE}${path}`,
      lastModified: new Date(),
      priority,
    })),
    ...caseStudies.map((study) => ({
      url: `${BASE}/projects/${study.id}`,
      lastModified: new Date(),
      priority: 0.7,
    })),
  ];
}
