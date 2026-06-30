// Single source of truth for identity, positioning, and contact details.
// All copy lives here (or in the other data/*.ts files) — not hardcoded in JSX.

export const profile = {
  name: "Harvey Houlahan",
  title: "Spatial · Simulation · ML Engineer",
  descriptor:
    "Spatial systems and simulations for climate, carbon & nature tech.",

  // Location & relocation
  locationNow: "Byron Bay, NSW",
  locationNext: "open to EU / US",
  timezone: "AEST",
  footerSubtitle:
    "Spatial systems & simulations · Byron Bay · remote · open to relocate",
  coordinates: { lat: -28.6431, lng: 153.6122, label: "28.6431° S, 153.6122° E" },

  // Availability
  availability: "Available for contract work",

  // Contact
  email: "harveyhoulahan@outlook.com",
  // Calendly placeholder — replace with your real scheduling link.
  calendly: "https://calendly.com/your-handle/intro",
  social: {
    linkedin: "https://www.linkedin.com/in/harveyhoulahan",
    linkedinHandle: "@harveyhoulahan",
    github: "https://github.com/harveyhoulahan",
    githubHandle: "harveyhoulahan",
    portfolio: "https://hjhportfolio.com",
  },
} as const;

// A small, honest set of figures drawn from the real work in data/*.ts.
export const stats = [
  { value: 4, label: "Countries of ecological data" },
  { value: 0, display: "TB", label: "Spatial & energy data in production" },
  { value: 4, label: "Industries: climate, energy, retail, supply chain" },
  { value: 2, label: "Levels of government advised on carbon policy" },
] as const;

// About — written as prose, rendered paragraph by paragraph.
export const about = {
  intro:
    "A clear, visible signal: I build the infrastructure that turns ecological field data into decisions.",
  paragraphs: [
    "I grew up on a cotton farm in rural Queensland and left a medical degree six months in. I was already spending more time building software than studying for it. That led to a computer science degree at Monash, and then to ArborMeta, where I build the infrastructure that connects ecological field data to Australian carbon policy.",
    "The work I care about sits where spatial data and ML meet the real world: systems that feed real decisions, not another dashboard. How land gets managed, what ends up in government policy. I'm available for contract work in climate tech, carbon MRV, biodiversity monitoring, and precision agriculture.",
    "I'm based in Byron Bay. Remote-first — open to relocating for the right role.",
  ],
} as const;
