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
        // "CALDERA-CIR" — the Tweed-caldera DEM behind Catchment, graded as a
        // colour-infrared composite. Hillshade paper, rainforest-shadow ink,
        // channel teal for flow accumulation, CIR vegetation red as the signal.
        paper: "#ECEFEA", // hillshade paper — flat unlit-slope white, cool cast
        ink: "#161F1B", // rainforest shadow — blue-green black
        flow: "#14655A", // channel teal — flow accumulation / estuary (accent)
        infra: "#B23A18", // CIR vegetation red — canopy in false-colour infrared
        terrace: "#E2E7E0", // bench surface — cards / sections
        contour: "#C3CCC2", // contour grey-green — hairline borders
        // Legacy aliases (old token names → new hexes) so nothing off the main
        // redesign path breaks; new chrome should use the names above.
        concrete: "#ECEFEA",
        sage: "#14655A",
        sand: "#B23A18",
        surface: "#E2E7E0",
        hairline: "#C3CCC2",
        // Semantic aliases so utilities read cleanly.
        background: "#ECEFEA",
        foreground: "#161F1B",
        border: "#C3CCC2",
      },
      fontFamily: {
        display: ["var(--font-display)", "Archivo", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "IBM Plex Sans", "system-ui", "sans-serif"],
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
