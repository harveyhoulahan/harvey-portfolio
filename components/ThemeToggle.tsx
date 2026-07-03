"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import {
  getResolvedTheme,
  getStoredTheme,
  setTheme,
} from "@/lib/theme";

type ThemeToggleProps = {
  className?: string;
  /** Match navbar styling on full-screen demo routes. */
  variant?: "default" | "on-dark" | "on-light";
};

export default function ThemeToggle({
  className = "",
  variant = "default",
}: ThemeToggleProps) {
  const [resolved, setResolved] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setResolved(getResolvedTheme());

    const onSystemChange = () => {
      if (getStoredTheme() === "system") {
        setResolved(getResolvedTheme());
      }
    };

    const onThemeChange = () => setResolved(getResolvedTheme());

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", onSystemChange);
    window.addEventListener("theme-change", onThemeChange);

    return () => {
      mq.removeEventListener("change", onSystemChange);
      window.removeEventListener("theme-change", onThemeChange);
    };
  }, []);

  const colorCls =
    variant === "on-dark"
      ? "text-paper/55 hover:text-paper"
      : "text-ink/60 hover:text-ink";

  if (!mounted) {
    return <span className={`inline-block h-[18px] w-[18px] ${className}`} aria-hidden />;
  }

  const isDark = resolved === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={`inline-flex items-center justify-center transition-colors duration-500 ${colorCls} ${className}`}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <Sun size={18} strokeWidth={1.75} /> : <Moon size={18} strokeWidth={1.75} />}
    </button>
  );
}
