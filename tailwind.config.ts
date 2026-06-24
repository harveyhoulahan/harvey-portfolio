import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Architectural palette — precision meets raw materiality.
        concrete: "#F7F5F0", // warm off-white background
        ink: "#1A1A18", // near-black, warm
        sage: "#4A6741", // muted native-vegetation green (accent)
        sand: "#C4A882", // warm timber (secondary accent)
        surface: "#EFECE5", // card / section surface, warmer than bg
        hairline: "#D8D3C8", // subtle border
        // Semantic aliases so utilities read cleanly.
        background: "#F7F5F0",
        foreground: "#1A1A18",
        border: "#D8D3C8",
      },
      fontFamily: {
        display: ["var(--font-display)", "Playfair Display", "Georgia", "serif"],
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "ui-monospace", "monospace"],
      },
      maxWidth: {
        prose: "720px",
        work: "1080px",
      },
      lineHeight: {
        prose: "1.7",
      },
    },
  },
  plugins: [],
};
export default config;
