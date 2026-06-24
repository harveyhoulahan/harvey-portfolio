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

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-hairline bg-concrete/90 backdrop-blur-[2px]">
      <nav className="col-shell flex h-16 max-w-work items-center justify-between">
        <Link href="/" className="font-display text-lg tracking-tight">
          Harvey Houlahan
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {navItems.map((item) => {
            const active = pathname === item.path;
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`font-mono text-xs uppercase tracking-[0.12em] transition-colors ${
                  active ? "text-sage" : "text-ink/60 hover:text-ink"
                }`}
              >
                {item.name}
                {active && <span className="ml-2 text-sage">/</span>}
              </Link>
            );
          })}
        </div>

        <button
          onClick={() => setOpen(!open)}
          className="text-ink md:hidden"
          aria-label="Toggle menu"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      {open && (
        <div className="border-t border-hairline px-6 py-3 md:hidden">
          {navItems.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              onClick={() => setOpen(false)}
              className={`block py-2.5 font-mono text-xs uppercase tracking-[0.12em] ${
                pathname === item.path ? "text-sage" : "text-ink/70"
              }`}
            >
              {item.name}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
