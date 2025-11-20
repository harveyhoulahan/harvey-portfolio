"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { useState } from "react";

const navItems = [
  { name: "Home", path: "/" },
  { name: "About", path: "/about" },
  { name: "Experience", path: "/experience" },
  { name: "Projects", path: "/projects" },
  { name: "Skills", path: "/skills" },
  { name: "Contact", path: "/contact" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-md bg-black/70 border-b border-red-900/20">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="text-xl font-bold tracking-tight group">
            <span className="bg-gradient-to-r from-red-500 to-red-400 bg-clip-text text-transparent group-hover:from-red-400 group-hover:to-red-300 transition-all">
              HJH
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                className="relative group"
              >
                <span
                  className={`text-sm font-medium transition-colors ${
                    pathname === item.path
                      ? "text-red-400"
                      : "text-neutral-300 hover:text-white"
                  }`}
                >
                  {item.name}
                </span>
                {pathname === item.path && (
                  <motion.div
                    layoutId="navbar-indicator"
                    className="absolute -bottom-[1.45rem] left-0 right-0 h-0.5 bg-gradient-to-r from-red-600 to-red-400"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </Link>
            ))}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden text-neutral-300 hover:text-white"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="md:hidden py-4 border-t border-red-900/20"
          >
            {navItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`block py-3 text-sm font-medium ${
                  pathname === item.path
                    ? "text-red-400"
                    : "text-neutral-300 hover:text-white"
                }`}
              >
                {item.name}
              </Link>
            ))}
          </motion.div>
        )}
      </div>
    </nav>
  );
}
