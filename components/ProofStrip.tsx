"use client";

/*
 * The proof strip: stats with receipts. A dark kernel-log plate on the
 * homepage where every line is a real, clickable artifact somewhere on this
 * site. Lines land one by one as the strip scrolls into view (instant under
 * reduced motion); the last line summons the site shell instead of navigating.
 */

import Link from "next/link";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { useRef } from "react";

type ProofLine = {
  marker: "ok" | "..";
  name: string;
  detail: string;
  dest: string;         // shown right-aligned
  href?: string;        // navigate…
  shell?: boolean;      // …or open the site terminal
};

const LINES: ProofLine[] = [
  { marker: "ok", name: "canopy model", detail: "0.5 m from orbit · val 0.0096 · in production", dest: "/canopy", href: "/canopy" },
  { marker: "ok", name: "pretraining", detail: "1.75 → 1.18 under fixed compute · every run kept", dest: "/pretraining", href: "/pretraining" },
  { marker: "ok", name: "earth engine", detail: "60 fps · hand-written wgsl · physics vs neural, live", dest: "/catchment", href: "/catchment" },
  { marker: "ok", name: "life lab", detail: "2,400 agents · clip-scored evolution, in-browser", dest: "/genesis", href: "/genesis" },
  { marker: "..", name: "intent model", detail: "26k params · 83 kb · parsing this site's terminal", dest: "press /", shell: true },
];

/* Fully token-driven: the plate is printed on terrace paper in light mode and
 * flips with the theme — no fixed-dark terminal fighting a white page. */
const STRIP_CSS = `
.ps-plate{background:var(--terrace);border:1px solid var(--contour);border-left:3px solid var(--flow);font-family:var(--font-mono),"JetBrains Mono",ui-monospace,monospace;}
.ps-cmd{color:var(--ink);opacity:0.45;font-size:0.68rem;padding:14px 18px 4px;}
.ps-row{display:flex;align-items:baseline;gap:14px;width:100%;padding:7px 18px;text-align:left;background:none;border:none;cursor:pointer;font-family:inherit;text-decoration:none;transition:background .15s;}
.ps-row:hover{background:color-mix(in srgb, var(--ink) 5%, transparent);}
.ps-row:last-of-type{padding-bottom:16px;}
.ps-mark{flex:none;font-size:0.68rem;color:var(--flow);}
.ps-mark.pending{color:var(--infra);}
.ps-name{flex:none;width:8.5rem;font-size:0.72rem;color:var(--ink);opacity:0.92;}
.ps-detail{flex:1;min-width:0;font-size:0.68rem;color:var(--ink);opacity:0.55;transition:opacity .15s;}
.ps-row:hover .ps-detail{opacity:0.85;}
.ps-dest{flex:none;font-size:0.66rem;color:var(--flow);opacity:0.85;transition:opacity .15s,transform .2s;}
.ps-row:hover .ps-dest{opacity:1;transform:translateX(2px);}
@media (max-width: 640px){
  .ps-row{flex-wrap:wrap;row-gap:2px;}
  .ps-name{width:auto;}
  .ps-detail{flex-basis:100%;order:3;padding-left:1.6rem;}
}
`;

export default function ProofStrip() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-15% 0px" });
  const reduce = useReducedMotion();
  const play = inView || reduce;

  const row = (l: ProofLine, i: number) => {
    const inner = (
      <>
        <span className={`ps-mark${l.marker === ".." ? " pending" : ""}`}>[{l.marker}]</span>
        <span className="ps-name">{l.name}</span>
        <span className="ps-detail">{l.detail}</span>
        <span className="ps-dest">{l.dest} ↵</span>
      </>
    );
    const anim = {
      initial: reduce ? false : ({ opacity: 0, x: -6 } as const),
      animate: play ? { opacity: 1, x: 0 } : {},
      transition: { duration: 0.3, delay: reduce ? 0 : 0.15 + i * 0.14, ease: [0.2, 0.6, 0.2, 1] as const },
    };
    return l.shell ? (
      <motion.button
        key={l.name}
        type="button"
        className="ps-row"
        aria-label="Open the site terminal"
        onClick={() => window.dispatchEvent(new CustomEvent("site-terminal:open"))}
        {...anim}
      >
        {inner}
      </motion.button>
    ) : (
      <motion.div key={l.name} {...anim}>
        <Link href={l.href!} className="ps-row">{inner}</Link>
      </motion.div>
    );
  };

  return (
    <div ref={ref} className="ps-plate overflow-hidden">
      <style dangerouslySetInnerHTML={{ __html: STRIP_CSS }} />
      <motion.div
        className="ps-cmd"
        initial={reduce ? false : { opacity: 0 }}
        animate={play ? { opacity: 1 } : {}}
        transition={{ duration: 0.3 }}
      >
        $ tail -f proof.log
      </motion.div>
      {LINES.map(row)}
    </div>
  );
}
