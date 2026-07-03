"use client";

import { useEffect, useState } from "react";

export const PROXIMITY_HEADING_COLORS = {
  light: { from: "#161F1B", to: "#14655A" },
  dark: { from: "#ECEFEA", to: "#D2603B" },
} as const;

export function proximityHeadingColors(): {
  from: string;
  to: string;
} {
  if (typeof window === "undefined") {
    return PROXIMITY_HEADING_COLORS.light;
  }
  const dark = document.documentElement.classList.contains("dark");
  return dark ? PROXIMITY_HEADING_COLORS.dark : PROXIMITY_HEADING_COLORS.light;
}

/** Cursor-proximity heading colors — white at rest in dark mode, red on hover. */
export function useProximityHeadingColors() {
  const [colors, setColors] = useState(proximityHeadingColors);

  useEffect(() => {
    const update = () => setColors(proximityHeadingColors());

    window.addEventListener("theme-change", update);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", update);

    return () => {
      window.removeEventListener("theme-change", update);
      mq.removeEventListener("change", update);
    };
  }, []);

  return colors;
}

export function useProximityHeadingStyles(scaleTo: string) {
  const color = useProximityHeadingColors();
  return {
    transform: { from: "scale(1)", to: scaleTo },
    color,
  };
}
