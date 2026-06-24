// Concise career timeline. Honest, no inflation — drawn from the CV.
export interface TimelineEntry {
  org: string;
  role: string;
  period: string;
  location: string;
  notes: string[];
}

export const experienceData: TimelineEntry[] = [
  {
    org: "ArborMeta",
    role: "Machine Learning Engineer",
    period: "2025 – present",
    location: "Byron Bay, NSW",
    notes: [
      "Geospatial web applications in React, MapLibre GL JS and PostgreSQL/PostGIS visualising ecological survey and carbon-farming data across Australia.",
      "High-performance spatial pipelines: multi-LOD PMTiles generation, Fulcrum field-survey parsing, ecological transect analysis.",
      "Research into carbon sequestration measurement & verification, producing outputs that consult federal and state government on accreditation pathways.",
    ],
  },
  {
    org: "Step One Clothing",
    role: "Software Engineer (Contract)",
    period: "2025 – present",
    location: "Sydney",
    notes: [
      "AI-powered natural-language product search; built the premium Shopify mega-menu end-to-end with schema-driven controls.",
      "Retained as primary front-end contractor for ongoing feature development across the Shopify stack.",
    ],
  },
  {
    org: "FibreTrace",
    role: "iOS Engineer",
    period: "2025",
    location: "Remote",
    notes: [
      "Native SwiftUI product-passport app for world-first fibre-level verification: QR/NFC scan, signed deep links, offline-first caching.",
      "On-device ML for tag-spoofing and chain-of-custody anomaly detection; <3s time-to-passport, partner-brand pilot launched.",
    ],
  },
  {
    org: "Australian Energy Market Operator (AEMO)",
    role: "Software Engineering Intern",
    period: "2023, 2024",
    location: "Melbourne",
    notes: [
      "Python analytics over terabyte-scale NEM/MMS datasets with real-time dashboards used by operations.",
      "High-throughput C parsers for market/telemetry files; C# micro-services integrating MMS schemas and SQL stores.",
    ],
  },
  {
    org: "Monash University",
    role: "B.S. Advanced Computer Science (AI/ML)",
    period: "2023 – 2025",
    location: "Melbourne",
    notes: [
      "Concentrations in Artificial Intelligence / Machine Learning and Advanced Algorithms & Data Structures. High Distinction GPA.",
    ],
  },
  {
    org: "James Cook University",
    role: "Medicine (MBBS) — deferred after 6 months",
    period: "2022",
    location: "Townsville",
    notes: [
      "Left a medical degree to build geospatial tools full-time — the decision that set this whole path in motion.",
    ],
  },
];
