"use client";

/*
 * The experiment ladder: final validation loss per run, in the order they were
 * run. Draws on scroll; dots stagger in; hover syncs with the ledger table.
 */

import { motion, useInView, useReducedMotion } from "framer-motion";
import { useMemo, useRef, useState } from "react";
import { BASELINE_LOSS, EXPERIMENTS, FINAL_LOSS, type Experiment } from "./experiments";
import { usePretrainingHighlight } from "./HighlightContext";

const W = 720, H = 300;
const PAD = { top: 18, right: 16, bottom: 30, left: 44 };
const Y_MIN = 1.15, Y_MAX = 1.8;
const TICKS = [1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8];

const LABELLED: Record<string, { dy: number; text?: string }> = {
  "0": { dy: -10 },
  "1": { dy: -10 },
  "11b": { dy: -10 },
  "14": { dy: -10 },
  "17a": { dy: 18, text: "1.1754 · submitted" },
};

const VIZ_CSS = `
.pt-chart{--viz-good:#0A8A66;--viz-bad:#B23A18;}
html.dark .pt-chart{--viz-good:#2FA183;--viz-bad:#D96F45;}
.pt-tip{position:absolute;pointer-events:none;z-index:5;width:max-content;min-width:11rem;max-width:min(18rem,calc(100vw - 2rem));padding:8px 10px;background:var(--paper);border:1px solid var(--contour);box-shadow:0 4px 18px rgba(0,0,0,0.14);font-size:11px;line-height:1.45;white-space:normal;opacity:0;transform:translateY(4px);transition:opacity .18s ease,transform .18s ease;}
.pt-tip.is-visible{opacity:1;transform:translateY(0);}
`;

export default function LossChart() {
  const rootRef = useRef<HTMLElement>(null);
  const inView = useInView(rootRef, { once: true, margin: "-10% 0px" });
  const reduceMotion = useReducedMotion();
  const { activeId, setActiveId } = usePretrainingHighlight();
  const [hover, setHover] = useState<number | null>(null);

  const pts = useMemo(() => {
    const span = W - PAD.left - PAD.right;
    const x = (i: number) => PAD.left + (span * (i + 0.5)) / EXPERIMENTS.length;
    const y = (v: number) => PAD.top + ((Y_MAX - v) / (Y_MAX - Y_MIN)) * (H - PAD.top - PAD.bottom);
    let best = Infinity;
    return EXPERIMENTS.map((e, i) => {
      best = Math.min(best, e.loss);
      return { e, i, x: x(i), y: y(e.loss), yBest: y(best) };
    });
  }, []);

  const stepPath = useMemo(() => {
    let d = "";
    pts.forEach((p, i) => {
      d += i === 0 ? `M ${p.x} ${p.yBest}` : ` H ${p.x} V ${p.yBest}`;
    });
    return d;
  }, [pts]);

  const yOf = (v: number) => PAD.top + ((Y_MAX - v) / (Y_MAX - Y_MIN)) * (H - PAD.top - PAD.bottom);
  const dotFill = (e: Experiment) => (e.status === "bracket" ? "var(--viz-bad)" : "var(--viz-good)");
  const hovered = hover !== null ? pts[hover] : null;
  const linked = activeId ? pts.find((p) => p.e.id === activeId) ?? null : null;
  const tip = hovered ?? linked;
  const play = inView || reduceMotion;

  const onEnter = (i: number, id: string) => {
    setHover(i);
    setActiveId(id);
  };
  const onLeave = () => {
    setHover(null);
    setActiveId(null);
  };

  return (
    <figure ref={rootRef} className="pt-chart relative m-0">
      <style dangerouslySetInnerHTML={{ __html: VIZ_CSS }} />

      <figcaption className="mb-2 flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[11px] text-ink/60">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "var(--viz-good)" }} />
          improved on prior best
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "var(--viz-bad)" }} />
          regression / bracketing overshoot
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-0.5 w-4" style={{ background: "var(--ink)", opacity: 0.5 }} />
          best so far
        </span>
      </figcaption>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Final validation loss for each of the 28 experiments, in chronological order, falling from 1.7533 at baseline to the submitted 1.1754."
        onMouseLeave={onLeave}
      >
        {TICKS.map((v, ti) => (
          <g key={v}>
            <motion.line
              x1={PAD.left} x2={W - PAD.right} y1={yOf(v)} y2={yOf(v)}
              stroke="var(--contour)" strokeWidth={1}
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={play ? { opacity: 1 } : {}}
              transition={{ duration: 0.35, delay: reduceMotion ? 0 : ti * 0.04 }}
            />
            <motion.text
              x={PAD.left - 8} y={yOf(v) + 3.5} textAnchor="end"
              fontSize={10} fill="var(--ink)" opacity={0.45}
              fontFamily="var(--font-mono), monospace"
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={play ? { opacity: 0.45 } : {}}
              transition={{ duration: 0.35, delay: reduceMotion ? 0 : ti * 0.04 }}
            >
              {v.toFixed(2)}
            </motion.text>
          </g>
        ))}
        <motion.text
          x={PAD.left} y={H - 8} fontSize={10} fill="var(--ink)"
          fontFamily="var(--font-mono), monospace"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={play ? { opacity: 0.45 } : {}}
          transition={{ duration: 0.4, delay: reduceMotion ? 0 : 0.2 }}
        >
          experiments, in the order they were run →
        </motion.text>

        <motion.path
          d={stepPath}
          fill="none"
          stroke="var(--ink)"
          strokeOpacity={0.5}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          initial={reduceMotion ? false : { pathLength: 0, opacity: 0.25 }}
          animate={play ? { pathLength: 1, opacity: 0.5 } : {}}
          transition={{ duration: reduceMotion ? 0 : 2.4, ease: [0.65, 0, 0.35, 1], delay: reduceMotion ? 0 : 0.15 }}
        />

        {pts.map((p) => {
          const lit = hover === p.i || activeId === p.e.id;
          const delay = reduceMotion ? 0 : 0.2 + (p.i / pts.length) * 2.1;
          return (
            <motion.circle
              key={p.e.id}
              cx={p.x} cy={p.y}
              fill={dotFill(p.e)}
              stroke="var(--paper)"
              strokeWidth={2}
              initial={reduceMotion ? false : { opacity: 0, r: 0 }}
              animate={
                play
                  ? p.e.status === "submitted" && !reduceMotion
                    ? { opacity: 1, r: lit ? 7 : [4.5, 5.8, 4.5] }
                    : { opacity: 1, r: lit ? 6.5 : 4.5 }
                  : {}
              }
              transition={
                p.e.status === "submitted" && play && !reduceMotion
                  ? {
                      opacity: { duration: 0.28, delay, ease: [0.2, 0.6, 0.2, 1] },
                      r: { duration: 2.2, repeat: Infinity, repeatDelay: 1.4, ease: "easeInOut" },
                    }
                  : { duration: 0.28, delay, ease: [0.2, 0.6, 0.2, 1] }
              }
            />
          );
        })}

        {pts.filter((p) => LABELLED[p.e.id]).map((p) => (
          <motion.text
            key={`l-${p.e.id}`}
            x={p.x} y={p.y + LABELLED[p.e.id].dy}
            textAnchor={p.i > EXPERIMENTS.length - 4 ? "end" : "middle"}
            fontSize={10.5} fontWeight={600}
            fill="var(--ink)" opacity={0.75}
            fontFamily="var(--font-mono), monospace"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={play ? { opacity: 0.75 } : {}}
            transition={{ duration: 0.35, delay: reduceMotion ? 0 : 2.2 + p.i * 0.02 }}
          >
            {LABELLED[p.e.id].text ?? p.e.loss.toFixed(4)}
          </motion.text>
        ))}

        {pts.map((p) => (
          <rect
            key={`h-${p.e.id}`}
            x={p.x - (W - PAD.left - PAD.right) / EXPERIMENTS.length / 2}
            y={PAD.top}
            width={(W - PAD.left - PAD.right) / EXPERIMENTS.length}
            height={H - PAD.top - PAD.bottom}
            fill="transparent"
            onMouseEnter={() => onEnter(p.i, p.e.id)}
          />
        ))}
      </svg>

      <div
        className={`pt-tip${tip ? " is-visible" : ""}`}
        style={{
          left: tip ? `${(tip.x / W) * 100}%` : "0%",
          top: tip ? `${(tip.y / H) * 100}%` : "0%",
          transform: tip
            ? `translate(${tip.i > EXPERIMENTS.length * 0.6 ? "-108%" : "8%"}, -50%)`
            : undefined,
        }}
      >
        {tip && (
          <>
            <div className="font-mono text-ink/50">exp {tip.e.id} · {tip.e.name}</div>
            <div className="mt-0.5 text-ink/80">{tip.e.change}</div>
            <div className="mt-1 font-mono text-ink">
              val {tip.e.loss.toFixed(4)}
              <span className="text-ink/50"> · Δ base {(tip.e.loss - BASELINE_LOSS).toFixed(4)}</span>
            </div>
          </>
        )}
      </div>
    </figure>
  );
}

export { BASELINE_LOSS, FINAL_LOSS };
