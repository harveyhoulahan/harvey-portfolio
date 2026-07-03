import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Tokens map to CSS variables — see app/globals.css for light/dark values.
        paper: "var(--paper)",
        ink: "var(--ink)",
        flow: "var(--flow)",
        infra: "var(--infra)",
        terrace: "var(--terrace)",
        contour: "var(--contour)",
        // Legacy aliases
        concrete: "var(--paper)",
        sage: "var(--flow)",
        sand: "var(--infra)",
        surface: "var(--terrace)",
        hairline: "var(--contour)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        border: "var(--contour)",
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
