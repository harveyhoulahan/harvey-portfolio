"use client";

import { Github, Linkedin, Mail } from "lucide-react";
import Link from "next/link";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-neutral-800 bg-black/30 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Branding */}
          <div>
            <h3 className="text-xl font-bold mb-2">
              <span className="text-gradient">Harvey J. Houlahan</span>
            </h3>
            <p className="text-sm text-neutral-400">
              AI/ML Engineer building intelligent systems for a sustainable future.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-sm font-semibold mb-4 text-neutral-200">Navigation</h4>
            <ul className="space-y-2 text-sm text-neutral-400">
              <li>
                <Link href="/about" className="hover:text-white transition-colors">
                  About
                </Link>
              </li>
              <li>
                <Link href="/experience" className="hover:text-white transition-colors">
                  Experience
                </Link>
              </li>
              <li>
                <Link href="/projects" className="hover:text-white transition-colors">
                  Projects
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-white transition-colors">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Social Links */}
          <div>
            <h4 className="text-sm font-semibold mb-4 text-neutral-200">Connect</h4>
            <div className="flex space-x-4">
              <a
                href="mailto:harveyhoulahan@outlook.com"
                className="text-neutral-400 hover:text-white transition-colors"
                aria-label="Email"
              >
                <Mail size={20} />
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-neutral-400 hover:text-white transition-colors"
                aria-label="LinkedIn"
              >
                <Linkedin size={20} />
              </a>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-neutral-400 hover:text-white transition-colors"
                aria-label="GitHub"
              >
                <Github size={20} />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-neutral-800 text-center text-sm text-neutral-500">
          © {currentYear} Harvey J. Houlahan. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
