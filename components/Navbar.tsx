"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { motion, useReducedMotion, useScroll } from "framer-motion";

const navItems = [
  { name: "About", path: "/about" },
  { name: "Work", path: "/projects" },
  { name: "Skills", path: "/skills" },
  { name: "Playground", path: "/playground" },
  { name: "Experience", path: "/experience" },
  { name: "Contact", path: "/contact" },
];

// Full-screen demo routes reached from the Playground tab. On each, the header
// shifts to a theme that matches that demo's own palette — a deep ink bar for the
// dark Genesis, a quiet near-solid light bar for the pale Catchment — separated by
// a soft edge rather than a loud fill, with the name in brick red either way.
const DEMO_RED_DARK = "#D2603B"; // lifted for contrast on the dark Genesis bar
const DEMO_RED_LIGHT = "#B23A18"; // CIR vegetation red on the pale Catchment bar
type DemoTheme = "dark" | "light" | null;
function demoThemeFor(pathname: string): DemoTheme {
  if (pathname === "/genesis") return "dark";
  if (pathname === "/catchment") return "light";
  return null;
}

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const theme = demoThemeFor(pathname);
  const inDemo = theme !== null;
  const dark = theme === "dark";
  const isActive = (path: string) =>
    pathname === path || (path === "/playground" && inDemo);

  // header shell per theme
  const headerCls = dark
    ? "border-white/10 bg-[rgba(20,20,18,0.55)] backdrop-blur-lg"
    : theme === "light"
      ? "border-white/40 bg-[rgba(240,243,238,0.5)] backdrop-blur-lg shadow-[0_1px_12px_rgba(22,31,27,0.05)]"
      : "border-contour bg-paper/90 backdrop-blur-[2px]";

  // nav link colours: light text only on the dark bar; ink elsewhere
  const linkCls = (active: boolean) =>
    dark
      ? active ? "text-[#D2603B]" : "text-paper/55 hover:text-paper"
      : active ? "text-flow" : "text-ink/60 hover:text-ink";

  return (
    <header className={`sticky top-0 z-50 border-b transition-colors duration-500 ${headerCls}`}>
      <nav className="col-shell flex h-16 max-w-work items-center justify-between">
        <Link
          href="/"
          className="font-display text-lg font-semibold tracking-tight transition-colors duration-500"
          style={{ color: inDemo ? (dark ? DEMO_RED_DARK : DEMO_RED_LIGHT) : undefined }}
        >
          Harvey Houlahan
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`relative py-1 font-mono text-xs uppercase tracking-[0.12em] transition-colors duration-500 ${linkCls(active)}`}
              >
                {item.name}
                {active && (
                  <motion.span
                    layoutId="nav-active-tick"
                    aria-hidden
                    className={`absolute -bottom-0.5 left-0 right-0 h-[2px] ${dark ? "bg-[#D2603B]" : "bg-flow"}`}
                    transition={
                      reduceMotion
                        ? { duration: 0 }
                        : { type: "spring", stiffness: 420, damping: 36 }
                    }
                  />
                )}
              </Link>
            );
          })}
        </div>

        <button
          onClick={() => setOpen(!open)}
          className={`transition-colors duration-500 md:hidden ${dark ? "text-paper" : "text-ink"}`}
          aria-label="Toggle menu"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      {/* Graticule ruler edge — survey-sheet tick marks — with the scroll
          position sweeping across it like a plotter carriage. Off on demo routes. */}
      {!inDemo && (
        <>
          <div className="graticule-ticks pointer-events-none absolute inset-x-0 top-full" aria-hidden />
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-full h-[2px] origin-left bg-flow"
            style={{ scaleX: scrollYProgress }}
          />
        </>
      )}

      {open && (
        <div
          className={`border-t px-6 py-3 transition-colors duration-500 md:hidden ${
            dark ? "border-white/10 bg-[rgba(20,20,18,0.92)]" : "border-contour bg-[rgba(240,243,238,0.97)]"
          }`}
        >
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                href={item.path}
                onClick={() => setOpen(false)}
                className={`block py-2.5 font-mono text-xs uppercase tracking-[0.12em] ${
                  dark
                    ? active ? "text-[#D2603B]" : "text-paper/70"
                    : active ? "text-flow" : "text-ink/70"
                }`}
              >
                {item.name}
              </Link>
            );
          })}
        </div>
      )}
    </header>
  );
}
