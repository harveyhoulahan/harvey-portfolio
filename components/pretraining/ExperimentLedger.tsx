"use client";

/*
 * The full experiment ledger — rows reveal on scroll; hover syncs with the
 * ladder chart via PretrainingHighlightProvider.
 */

import { motion, useInView, useReducedMotion } from "framer-motion";
import { useRef } from "react";
import { BASELINE_LOSS, EXPERIMENTS } from "./experiments";
import { usePretrainingHighlight } from "./HighlightContext";

export default function ExperimentLedger() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-8% 0px" });
  const reduceMotion = useReducedMotion();
  const { activeId, setActiveId } = usePretrainingHighlight();

  return (
    <div ref={ref} className="overflow-x-auto border border-contour">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-contour bg-terrace text-left font-mono text-[10px] uppercase tracking-[0.14em] text-ink/50">
            <th className="px-3 py-2 font-medium">#</th>
            <th className="px-3 py-2 font-medium">Experiment</th>
            <th className="px-3 py-2 font-medium">Key change</th>
            <th className="px-3 py-2 text-right font-medium">Val loss</th>
            <th className="px-3 py-2 text-right font-medium">Δ base</th>
          </tr>
        </thead>
        <motion.tbody
          initial={reduceMotion ? false : "hidden"}
          animate={inView || reduceMotion ? "visible" : "hidden"}
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.028, delayChildren: 0.12 } },
          }}
        >
          {EXPERIMENTS.map((e) => {
            const lit = activeId === e.id;
            return (
              <motion.tr
                key={e.id}
                id={`exp-${e.id}`}
                className={`border-b border-contour/60 last:border-b-0 transition-colors duration-200 ${
                  e.status === "submitted"
                    ? "bg-sage/10 font-medium"
                    : e.status === "bracket"
                      ? "bg-sand/[0.07]"
                      : ""
                } ${lit ? "bg-flow/8 ring-1 ring-inset ring-flow/25" : ""}`}
                variants={
                  reduceMotion
                    ? undefined
                    : {
                        hidden: { opacity: 0, x: -8 },
                        visible: { opacity: 1, x: 0, transition: { duration: 0.32, ease: [0.2, 0.6, 0.2, 1] } },
                      }
                }
                onMouseEnter={() => setActiveId(e.id)}
                onMouseLeave={() => setActiveId(null)}
              >
                <td className="px-3 py-1.5 font-mono text-xs text-ink/50">{e.id}</td>
                <td className="px-3 py-1.5 text-ink/85">
                  {e.name}
                  {e.status === "bracket" && (
                    <span className="ml-1.5 font-mono text-[10px] text-sand">▾ bracket</span>
                  )}
                  {e.status === "submitted" && (
                    <span className="ml-1.5 font-mono text-[10px] text-sage">▸ submitted</span>
                  )}
                </td>
                <td className="px-3 py-1.5 text-ink/65">{e.change}</td>
                <td className="px-3 py-1.5 text-right font-mono text-xs text-ink/85 [font-variant-numeric:tabular-nums]">
                  {e.loss.toFixed(4)}
                </td>
                <td className="px-3 py-1.5 text-right font-mono text-xs text-ink/55 [font-variant-numeric:tabular-nums]">
                  {e.status === "baseline" ? "—" : (e.loss - BASELINE_LOSS).toFixed(4)}
                </td>
              </motion.tr>
            );
          })}
        </motion.tbody>
      </table>
    </div>
  );
}
