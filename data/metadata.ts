// Single source of truth for identity, positioning, and contact details.
// All copy lives here (or in the other data/*.ts files) — not hardcoded in JSX.

export const profile = {
  name: "Harvey Houlahan",
  title: "ML Systems · Simulation · Spatial Engineer",
  descriptor:
    "I build applied ML and AI systems, from RAG pipelines and fine-tuned open-source models to GPU simulation, proven in climate, carbon and spatial data.",

  // Location & relocation
  locationNow: "Byron Bay, NSW",
  locationNext: "open to EU / US",
  timezone: "AEST",
  footerSubtitle:
    "ML systems, simulation & spatial engineering · Byron Bay · remote · open to relocate",
  coordinates: { lat: -28.6431, lng: 153.6122, label: "28.6431° S, 153.6122° E" },

  // Availability
  availability: "Available for contract work",

  // Contact
  email: "harveyhoulahan@outlook.com",
  // Resume — served from /public/resume/
  resume: "/resume/HJH-cv.pdf",
  resumeFilename: "Harvey-Houlahan-CV.pdf",
  // Booking CTA — used on About and Contact
  bookCall:
    "mailto:harveyhoulahan@outlook.com?subject=Intro%20call&body=Hi%20Harvey%20%E2%80%94%20found%20you%20via%20hjhportfolio.com.%20Keen%20to%20chat%20about%3A%20",
  social: {
    linkedin: "https://www.linkedin.com/in/harveyhoulahan",
    linkedinHandle: "@harveyhoulahan",
    github: "https://github.com/harveyhoulahan",
    githubHandle: "harveyhoulahan",
    portfolio: "https://hjhportfolio.com",
  },
} as const;

// A small, honest set of figures drawn from the real work in data/*.ts.
// Every number here must be verifiable somewhere on this site.
export const stats = [
  { value: 6, label: "Years of programming" },
  {
    display: "33%",
    label: "Validation-loss cut — LLM pretraining under fixed compute",
  },
  { value: 2, label: "Levels of government advised on carbon policy" },
  {
    display: "60 fps",
    label: "Physics + trained neural operator, live in your browser",
  },
] as const;

// About — written as prose, rendered paragraph by paragraph.
export const about = {
  intro:
    "Right now I'm building the systems that connect field data to carbon policy.",
  paragraphs: [
    "At ArborMeta I build the infrastructure connecting ecological field surveys and satellite data to Australian carbon policy: canopy-height and above-ground-carbon models from paired LiDAR captures, live fire-spread mapping, and the pipelines that determine how land is measured, what gets logged, and what makes it into the registry.",
    "I grew up on a cotton farm in Queensland. At Monash I set out to become a doctor; six months in I was writing more code than medical notes, so I switched to computer science.",
    "The playground on this site is the same discipline, off the clock: real solvers running on your GPU, and neural operators trained to emulate them — physics as the teacher, the network as the student, racing side-by-side in a browser tab.",
    "Open to contract work in two lanes: climate tech — carbon MRV, biodiversity monitoring, spatial data pipelines, precision agriculture — and applied ML/AI systems: RAG pipelines, fine-tuning open-source models (Llama, Mistral), vector search, and cost-effective model deployment without full reliance on a single API provider.",
  ],
} as const;
