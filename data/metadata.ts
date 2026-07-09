// Single source of truth for identity, positioning, and contact details.
// All copy lives here (or in the other data/*.ts files) — not hardcoded in JSX.

export const profile = {
  name: "Harvey Houlahan",
  title: "ML Systems · Simulation · Spatial Engineer",
  descriptor:
    "ML that delivers. Satellite and LiDAR for forest carbon at work; GPU physics and pretraining studies here, live in the browser.",

  // Location & relocation
  locationNow: "Byron Bay, NSW",
  locationNext: "open to EU / US",
  timezone: "AEST",
  footerSubtitle: "ML systems · open to relocate",
  coordinates: { lat: -28.6431, lng: 153.6122, label: "28.6431° S, 153.6122° E" },

  // Availability
  availability: "Open for contract work",

  // Contact
  email: "harveyhoulahan@outlook.com",
  // Resume — served from /public/resume/
  resume: "/resume/HJH-cv.pdf",
  resumeFilename: "Harvey-Houlahan-CV.pdf",
  // Primary CTA — contact page (form + direct channels).
  startProject: "/contact",
  social: {
    linkedin: "https://www.linkedin.com/in/harveyhoulahan",
    linkedinHandle: "@harveyhoulahan",
    github: "https://github.com/harveyhoulahan",
    githubHandle: "harveyhoulahan",
    portfolio: "https://hjhportfolio.com",
  },
} as const;

// The contract offer — two lanes of work, three ways to engage.
// Rendered on the homepage; keep it concrete, keep it priced-in-reality.
export const services = {
  lanes: [
    {
      name: "Climate & spatial ML",
      pitch: "What I do every day.",
      items: [
        "Carbon MRV and canopy modelling from LiDAR + satellite",
        "Spatial pipelines that stay fast at continental scale",
        "Biodiversity monitoring and precision-ag models",
      ],
    },
    {
      name: "Applied ML & AI systems",
      pitch: "Fine-tuning, search, deployment.",
      items: [
        "Training and fine-tuning on your data, on your budget",
        "Search that understands what users mean",
        "Deployment without marrying you to one API vendor",
      ],
    },
  ],
  models: [
    {
      name: "Monthly retainer",
      detail: "Ongoing engineering capacity, month to month.",
    },
    {
      name: "Fixed-scope build",
      detail: "A pipeline, a model, an app. Scoped on a call, priced up front, handed over runnable.",
    },
    {
      name: "Advisory",
      detail: "Architecture reviews, model audits, a second opinion before you commit a quarter.",
    },
  ],
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
    "At ArborMeta I connect field surveys and satellite data to Australian carbon policy: canopy-height and above-ground-carbon models from paired LiDAR captures, fire-spread mapping, and the pipelines that decide how land is measured and what reaches the registry.",
    "I grew up on a cotton farm in Queensland. Initially I set out to become a doctor; three months in I found myself programming more than studying medicine, so I switched to computer science.",
    "The playground here is the same discipline off the clock: solvers on your GPU, neural operators trained to emulate them, racing in a tab.",
    "Open to contract work in climate tech and applied ML: carbon MRV, spatial pipelines, fine-tuning, vector search, deployment that does not live on one API.",
  ],
} as const;
