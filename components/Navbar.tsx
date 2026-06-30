"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";

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
const DEMO_RED = "#C0492E";
type DemoTheme = "dark" | "light" | null;
function demoThemeFor(pathname: string): DemoTheme {
  if (pathname === "/genesis") return "dark";
  if (pathname === "/catchment") return "light";
  return null;
}

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const theme = demoThemeFor(pathname);
  const inDemo = theme !== null;
  const dark = theme === "dark";
  const isActive = (path: string) =>
    pathname === path || (path === "/playground" && inDemo);

  // header shell per theme
  const headerCls = dark
    ? "border-white/10 bg-[rgba(20,20,18,0.55)] backdrop-blur-lg"
    : theme === "light"
      ? "border-white/40 bg-[rgba(244,242,236,0.5)] backdrop-blur-lg shadow-[0_1px_12px_rgba(26,26,24,0.05)]"
      : "border-hairline bg-concrete/90 backdrop-blur-[2px]";

  // nav link colours: light text only on the dark bar; ink elsewhere
  const linkCls = (active: boolean) =>
    dark
      ? active ? "text-sand" : "text-concrete/55 hover:text-concrete"
      : active ? "text-sage" : "text-ink/60 hover:text-ink";

  return (
    <header className={`sticky top-0 z-50 border-b transition-colors duration-500 ${headerCls}`}>
      <nav className="col-shell flex h-16 max-w-work items-center justify-between">
        <Link
          href="/"
          className="font-display text-lg tracking-tight transition-colors duration-500"
          style={{ color: inDemo ? DEMO_RED : undefined }}
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
                className={`font-mono text-xs uppercase tracking-[0.12em] transition-colors duration-500 ${linkCls(active)}`}
              >
                {item.name}
                {active && <span className={`ml-2 ${dark ? "text-sand" : "text-sage"}`}>/</span>}
              </Link>
            );
          })}
        </div>

        <button
          onClick={() => setOpen(!open)}
          className={`transition-colors duration-500 md:hidden ${dark ? "text-concrete" : "text-ink"}`}
          aria-label="Toggle menu"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      {open && (
        <div
          className={`border-t px-6 py-3 transition-colors duration-500 md:hidden ${
            dark ? "border-white/10 bg-[rgba(20,20,18,0.92)]" : "border-hairline bg-[rgba(244,242,236,0.97)]"
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
                    ? active ? "text-sand" : "text-concrete/70"
                    : active ? "text-sage" : "text-ink/70"
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
