// Single source of truth for identity, positioning, and contact details.
// All copy lives here (or in the other data/*.ts files) — not hardcoded in JSX.

export const profile = {
  name: "Harvey Houlahan",
  title: "ML Systems · Simulation · Spatial Engineer",
  descriptor:
    "I build ML that ships. By day, satellite and LiDAR pipelines measuring forest carbon underneath Australian policy. By night, GPU physics engines and pretraining studies that run live on this site. If it needs gradients, geodata or a GPU, we should talk.",

  // Location & relocation
  locationNow: "Byron Bay, NSW",
  locationNext: "open to EU / US",
  timezone: "AEST",
  footerSubtitle:
    "ML systems, simulation & spatial engineering · Byron Bay · remote · open to relocate",
  coordinates: { lat: -28.6431, lng: 153.6122, label: "28.6431° S, 153.6122° E" },

  // Availability
  availability: "Open for contract work · currently booking",

  // Contact
  email: "harveyhoulahan@outlook.com",
  // Resume — served from /public/resume/
  resume: "/resume/HJH-cv.pdf",
  resumeFilename: "Harvey-Houlahan-CV.pdf",
  // Booking CTA — used on About and Contact
  bookCall:
    "mailto:harveyhoulahan@outlook.com?subject=Intro%20call&body=Hi%20Harvey%20%E2%80%94%20found%20you%20via%20hjhportfolio.com.%20Keen%20to%20chat%20about%3A%20",
  // Primary hero CTA — a scoped project inquiry, not a job application.
  startProject:
    "mailto:harveyhoulahan@outlook.com?subject=Project%20inquiry&body=Hi%20Harvey%2C%20found%20you%20via%20hjhportfolio.com.%20We%27re%20looking%20at%3A%20",
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
      pitch: "The lane I work in every day.",
      items: [
        "Carbon MRV and canopy modelling from LiDAR + satellite",
        "Spatial data pipelines that stay fast at continental scale",
        "Biodiversity monitoring and precision-agriculture models",
      ],
    },
    {
      name: "Applied ML & AI systems",
      pitch: "The lane where most teams need a finisher.",
      items: [
        "Model training and fine-tuning on your data, on your budget",
        "Search and retrieval that understands what users mean",
        "Deployment that doesn't marry you to one API vendor",
      ],
    },
  ],
  models: [
    {
      name: "Monthly retainer",
      detail: "A standing lane of engineering. This is how Step One runs today: features, maintenance, momentum.",
    },
    {
      name: "Fixed-scope build",
      detail: "A pipeline, a model, an app. Scoped in a call, priced up front, shipped with a handover you can run without me.",
    },
    {
      name: "Advisory",
      detail: "Architecture reviews, model audits, a second opinion before you commit a quarter to something.",
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
    "At ArborMeta I build the infrastructure connecting ecological field surveys and satellite data to Australian carbon policy: canopy-height and above-ground-carbon models from paired LiDAR captures, live fire-spread mapping, and the pipelines that determine how land is measured, what gets logged, and what makes it into the registry.",
    "I grew up on a cotton farm in Queensland. At Monash I set out to become a doctor; six months in I was writing more code than medical notes, so I switched to computer science.",
    "The playground on this site is the same discipline, off the clock: real solvers running on your GPU, and neural operators trained to emulate them — physics as the teacher, the network as the student, racing side-by-side in a browser tab.",
    "Open to contract work in two lanes: climate tech — carbon MRV, biodiversity monitoring, spatial data pipelines, precision agriculture — and applied ML/AI systems: RAG pipelines, fine-tuning open-source models (Llama, Mistral), vector search, and cost-effective model deployment without full reliance on a single API provider.",
  ],
} as const;
