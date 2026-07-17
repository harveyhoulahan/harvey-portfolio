"use client";

/*
 * The frontier: compute-optimal parameter count vs budget, log-log. The
 * measured power law is drawn against Chinchilla's b≈0.5 and the exponent
 * implied by the parametric L(N,D) surface, anchored at the same point.
 */

import { motion, useInView, useReducedMotion } from "framer-motion";
import { useRef, useState } from "react";
import { FRONTIER, OPTIMA, PARAMETRIC, fmtC, fmtGB, fmtN, type Optimum } from "./data";

const W = 720, H = 340;
const PAD = { top: 22, right: 200, bottom: 42, left: 52 };
const LC_MIN = 14.8, LC_MAX = 17.75; // log10 C
const LN_MIN = 4.7, LN_MAX = 7.9;    // log10 N

const VIZ_CSS = `
.gl-fr{--viz-good:#0A8A66;--viz-bad:#B23A18;}
html.dark .gl-fr{--viz-good:#2FA183;--viz-bad:#D96F45;}
`;

const x = (lc: number) => PAD.left + ((lc - LC_MIN) / (LC_MAX - LC_MIN)) * (W - PAD.left - PAD.right);
const y = (ln: number) => PAD.top + ((LN_MAX - ln) / (LN_MAX - LN_MIN)) * (H - PAD.top - PAD.bottom);

/** Line of slope b through (lcAnchor, lnAnchor), clipped to the plot box. */
function slopeLine(b: number, lcA: number, lnA: number) {
  const lnAt = (lc: number) => lnA + b * (lc - lcA);
  let lo = LC_MIN + 0.05, hi = LC_MAX - 0.05;
  // clip vertically
  for (const bound of [LN_MIN + 0.05, LN_MAX - 0.05]) {
    const lc = lcA + (bound - lnA) / b;
    if (lnAt(lo) < LN_MIN || lnAt(lo) > LN_MAX) lo = Math.max(lo, Math.min(lc, hi));
    if (lnAt(hi) < LN_MIN || lnAt(hi) > LN_MAX) hi = Math.min(hi, Math.max(lc, lo));
  }
  return { x1: x(lo), y1: y(lnAt(lo)), x2: x(hi), y2: y(lnAt(hi)), lnAt };
}

const X_TICKS = [15, 16, 17];
const Y_TICKS = [
  { ln: 5, label: "0.1M" },
  { ln: 6, label: "1M" },
  { ln: 7, label: "10M" },
];

export default function FrontierChart() {
  const rootRef = useRef<HTMLElement>(null);
  const inView = useInView(rootRef, { once: true, margin: "-10% 0px" });
  const reduceMotion = useReducedMotion();
  const [hover, setHover] = useState<Optimum | null>(null);
  const play = inView || reduceMotion;

  // anchor comparison slopes at the largest budget's optimum
  const anchor = OPTIMA[OPTIMA.length - 1];
  const lcA = Math.log10(anchor.c), lnA = Math.log10(anchor.nOpt);

  const measured = slopeLine(FRONTIER.b, lcA, lnA);
  const chinchilla = slopeLine(0.5, lcA, lnA);
  const parametric = slopeLine(PARAMETRIC.impliedB, lcA, lnA);

  const lines = [
    { key: "measured", l: measured, dash: "none", op: 0.85, color: "var(--viz-good)", w: 2, label: `measured · b = ${FRONTIER.b.toFixed(2)}` },
    { key: "parametric", l: parametric, dash: "2 4", op: 0.6, color: "var(--ink)", w: 1.4, label: `parametric surface · b = ${PARAMETRIC.impliedB.toFixed(2)}` },
    { key: "chinchilla", l: chinchilla, dash: "6 5", op: 0.5, color: "var(--infra)", w: 1.4, label: "Chinchilla · b ≈ 0.50" },
  ];

  // The three lines share an anchor, so their right-hand endpoints cluster:
  // stack the margin labels top-down with a minimum gap instead.
  const labelY = new Map<string, number>();
  {
    let prev = -Infinity;
    for (const s of [...lines].sort((a, b) => a.l.y2 - b.l.y2)) {
      const yy = Math.max(s.l.y2, prev + 14);
      labelY.set(s.key, yy);
      prev = yy;
    }
  }

  return (
    <figure ref={rootRef} className="gl-fr relative m-0">
      <style dangerouslySetInnerHTML={{ __html: VIZ_CSS }} />

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Compute-optimal parameter count against compute budget on log-log axes. The measured frontier is far steeper than Chinchilla's square-root rule."
        onMouseLeave={() => setHover(null)}
      >
        {X_TICKS.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={PAD.top} y2={H - PAD.bottom}
              stroke="var(--contour)" strokeWidth={1} />
            <text x={x(t)} y={H - PAD.bottom + 17} textAnchor="middle" fontSize={10}
              fill="var(--ink)" opacity={0.45} fontFamily="var(--font-mono), monospace">
              1e{t}
            </text>
          </g>
        ))}
        {Y_TICKS.map((t) => (
          <g key={t.ln}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t.ln)} y2={y(t.ln)}
              stroke="var(--contour)" strokeWidth={1} />
            <text x={PAD.left - 8} y={y(t.ln) + 3.5} textAnchor="end" fontSize={10}
              fill="var(--ink)" opacity={0.45} fontFamily="var(--font-mono), monospace">
              {t.label}
            </text>
          </g>
        ))}
        <text x={W - PAD.right} y={H - 6} textAnchor="end" fontSize={10}
          fill="var(--ink)" opacity={0.45} fontFamily="var(--font-mono), monospace">
          training FLOPs (log) →
        </text>
        <text x={14} y={PAD.top - 8} fontSize={10} fill="var(--ink)" opacity={0.45}
          fontFamily="var(--font-mono), monospace">
          N_opt (log)
        </text>

        {lines.map((s, i) => (
          <g key={s.key}>
            <motion.line
              x1={s.l.x1} y1={s.l.y1} x2={s.l.x2} y2={s.l.y2}
              stroke={s.color} strokeWidth={s.w} strokeOpacity={s.op}
              strokeDasharray={s.dash === "none" ? undefined : s.dash}
              initial={reduceMotion ? false : { pathLength: 0 }}
              animate={play ? { pathLength: 1 } : {}}
              transition={{ duration: reduceMotion ? 0 : 1.2, delay: reduceMotion ? 0 : 0.3 + i * 0.25, ease: [0.65, 0, 0.35, 1] }}
            />
            <motion.text
              x={W - PAD.right + 10} y={(labelY.get(s.key) ?? s.l.y2) + 4}
              fontSize={10.5} fill={s.color} opacity={s.op}
              fontFamily="var(--font-mono), monospace"
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={play ? { opacity: s.op } : {}}
              transition={{ duration: 0.4, delay: reduceMotion ? 0 : 1 + i * 0.25 }}
            >
              {s.label}
            </motion.text>
          </g>
        ))}

        {OPTIMA.map((o, i) => {
          const px = x(Math.log10(o.c)), py = y(Math.log10(o.nOpt));
          return (
            <g key={o.c}>
              <motion.circle
                cx={px} cy={py}
                fill={o.edgePinned ? "var(--paper)" : "var(--viz-good)"}
                stroke={o.edgePinned ? "var(--ink)" : "var(--paper)"}
                strokeWidth={2}
                initial={reduceMotion ? false : { opacity: 0, r: 0 }}
                animate={play ? { opacity: 1, r: hover === o ? 7 : 5 } : {}}
                transition={{ duration: 0.3, delay: reduceMotion ? 0 : 0.15 + i * 0.1 }}
              />
              <rect x={px - 12} y={py - 12} width={24} height={24} fill="transparent"
                onMouseEnter={() => setHover(o)} />
            </g>
          );
        })}
      </svg>

      <div
        className="gl-tip"
        style={{
          position: "absolute", pointerEvents: "none", zIndex: 5, maxWidth: 250,
          padding: "8px 10px", background: "var(--paper)", border: "1px solid var(--contour)",
          boxShadow: "0 4px 18px rgba(0,0,0,0.14)", fontSize: 11, lineHeight: 1.45,
          opacity: hover ? 1 : 0, transition: "opacity .18s ease",
          left: hover ? `${(x(Math.log10(hover.c)) / W) * 100}%` : "0%",
          top: hover ? `${(y(Math.log10(hover.nOpt)) / H) * 100}%` : "0%",
          transform: "translate(8%, -110%)",
        }}
      >
        {hover && (
          <>
            <div className="font-mono text-ink/50">C = {fmtC(hover.c)} FLOPs</div>
            <div className="mt-0.5 font-mono text-ink">
              N_opt {fmtN(hover.nOpt)} · D_opt {fmtGB(hover.dOpt)}
            </div>
            <div className="mt-0.5 text-ink/70">
              {hover.edgePinned
                ? "vertex pinned at the ladder edge, treated with suspicion"
                : `${hover.points} runs on the profile · L_opt ${hover.lOpt.toFixed(3)} bpb`}
            </div>
          </>
        )}
      </div>
    </figure>
  );
}
