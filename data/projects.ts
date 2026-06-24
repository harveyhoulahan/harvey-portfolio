export interface CaseImage {
  src: string;
  alt: string;
  caption?: string;
}

export interface CaseStudy {
  id: string;
  company: string;
  role: string;
  period: string;
  summary: string; // one-line framing
  problem: string;
  approach: string[];
  outcome: string[];
  stack: string[];
  images?: CaseImage[];
  link?: string;
}

// Case studies, ordered by relevance to the geospatial / climate niche.
// Structure is deliberate: Problem → Approach → Outcome.
export const caseStudies: CaseStudy[] = [
  {
    id: "arbormeta",
    company: "ArborMeta",
    role: "Machine Learning Engineer",
    period: "Byron Bay, NSW · 2025 – present",
    summary:
      "The mapping platform that turns ecological field data into something government can act on.",
    problem:
      "Carbon and ecology data was scattered across field surveys and raw LiDAR. None of it sat in one place a policymaker could actually look at.",
    approach: [
      "A map viewer that renders live survey data over satellite imagery",
      "A tiling pipeline that keeps huge datasets fast at any zoom level",
      "A backend over PostGIS for everything spatial",
      "Parsers that pull field surveys straight into the platform",
    ],
    outcome: [
      "Used to advise federal and state government on carbon credit rules",
      "Field data from four countries, readable in one live interface",
    ],
    stack: [
      "FastAPI",
      "PostGIS",
      "MapLibre GL JS",
      "PMTiles",
      "ALS / LiDAR",
      "Docker",
      "React",
    ],
    images: [
      {
        src: "/images/projects/arbormeta/canopy-carbon.jpg",
        alt: "Canopy-height heatmap comparing two LiDAR captures with carbon estimates",
        caption: "Canopy growth and above-ground carbon between two LiDAR captures",
      },
      {
        src: "/images/projects/arbormeta/fire-spread.jpg",
        alt: "Fire-spread map with active fire points and wind vectors over satellite imagery",
        caption: "Live fire-spread and ember mapping",
      },
      {
        src: "/images/projects/arbormeta/pipeline-provenance.jpg",
        alt: "Processing pipeline view with provenance timeline and canopy model comparison",
        caption: "Processing pipeline with live data provenance",
      },
      {
        src: "/images/projects/arbormeta/als-coverage.jpg",
        alt: "Continental-scale map of LiDAR survey coverage parcels",
        caption: "Continental-scale survey coverage",
      },
      {
        src: "/images/projects/arbormeta/fire-wind-density.jpg",
        alt: "Australia-wide fire and wind density visualisation",
        caption: "Australia-wide fire and wind density",
      },
    ],
  },
  {
    id: "step-one",
    company: "Step One Clothing",
    role: "Software Engineer (Contract)",
    period: "Sydney · 2025 – present",
    summary:
      "Making a large, growing catalogue easy to navigate.",
    problem:
      "As the store grew, shoppers struggled to find the right product quickly.",
    approach: [
      "Natural-language product search",
      "A new mega-menu the merchandising team can edit themselves",
      "Accessible navigation with analytics built in",
    ],
    outcome: [
      "Easier product discovery at scale",
      "Content changes ship without engineering",
      "Kept on as the lead front-end contractor",
    ],
    stack: ["Shopify Liquid", "JavaScript", "NLP Search", "Analytics"],
    images: [
      {
        src: "/images/projects/step-one/ai-search.jpg",
        alt: "AI search overlay where a shopper types 'best undies for pants suit' and gets a matched product recommendation",
        caption: "Natural-language search — describe a need, get a matched product",
      },
      {
        src: "/images/projects/step-one/mega-menu.jpg",
        alt: "Expanded Step One mega-menu with product categories and editorial tiles",
        caption: "Schema-driven mega-menu the merchandising team edits themselves",
      },
      {
        src: "/images/projects/step-one/main-nav.jpg",
        alt: "Step One storefront homepage with the primary navigation bar",
        caption: "Accessible primary navigation across the storefront",
      },
    ],
  },
  {
    id: "fibretrace",
    company: "FibreTrace",
    role: "iOS Engineer",
    period: "Remote · 2025",
    summary:
      "A product passport that proves where a garment's fibre actually came from.",
    problem:
      "Brands needed shoppers to scan a product, see its origin, and trust the result.",
    approach: [
      "Native iOS app in SwiftUI",
      "A QR / NFC scan opens a signed, tamper-proof passport",
      "Works offline",
      "On-device ML flags fake tags and broken chains of custody",
    ],
    outcome: [
      "Passport loads in under three seconds",
      "Secured CEO buy-in",
      "Launched a pilot with a partner brand",
    ],
    stack: ["Swift", "SwiftUI", "Core ML", "NFC", "Offline-first"],
    images: [
      {
        src: "/images/projects/fibretrace/traceability-globe.jpg",
        alt: "FibreTrace platform showing a material's journey across the supply chain on a globe, from fibre to consumer with process provenance",
        caption: "Trace a material at every stage — fibre to consumer, with provenance",
      },
      {
        src: "/images/projects/fibretrace/infrastructure.jpg",
        alt: "Embed, Verify, Share — the three-step infrastructure behind fibre integrity",
        caption: "Embed, verify, share — how fibre integrity is proven end to end",
      },
      {
        src: "/images/projects/fibretrace/fibre-hub.jpg",
        alt: "FibreTrace Fibre Hub: a searchable, filterable directory of verified suppliers",
        caption: "A searchable network of FibreTrace-verified suppliers",
      },
    ],
  },
];

export interface Paper {
  title: string;
  context: string;
  summary: string;
  links: { label: string; href: string; external?: boolean }[];
}

// Research, write-ups and technical reports.
export const papers: Paper[] = [
  {
    title: "Adapting frontier LLM-pretraining techniques under fixed compute",
    context: "Maincode — Mainrun assessment · 2026",
    summary:
      "A 33% validation-loss reduction (1.75 → 1.18) on a ~40M-parameter GPT-style transformer, reasoning from first principles to stack Muon optimisation, rotary embeddings, warmup-stable-decay scheduling, ReLU² activations and value-residual connections; adapted to a fixed 7-epoch budget.",
    links: [
      { label: "Read the report (PDF)", href: "/papers/mainrun-report.pdf" },
    ],
  },
  {
    title: "Web-page navigation as a stochastic process",
    context: "Monash FIT3139 — Computational Modelling & Simulation",
    summary:
      "Extends Google's PageRank beyond linear algebra: Gillespie stochastic simulation, chain-binomial Markov analysis solved by eigendecomposition, and simulated-annealing parameter fitting via Metropolis–Hastings; recovering true teleportation parameter from realistic navigation data.",
    links: [
      {
        label: "GitHub",
        href: "https://github.com/harveyhoulahan/Web-Page-Navigation-Model-with-AI-ML-Extensions",
        external: true,
      },
    ],
  },
];

export interface PersonalProject {
  name: string;
  blurb: string;
  tags: string[];
  year?: string;
  status?: string;
  links?: { label: string; href: string; external?: boolean }[];
}

// Things built outside of client work.
export const personalProjects: PersonalProject[] = [
  {
    name: "Modaics",
    blurb:
      "Digital wardrobe and sustainable-fashion marketplace with AI-powered styling. Built through the RMIT Activator accelerator program.",
    tags: ["Computer Vision", "NLP", "React Native", "Swift"],
    year: "2024",
    links: [{ label: "Overview", href: "/projects/modaics.html", external: true }],
  },
];
