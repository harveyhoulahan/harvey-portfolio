"use client";

/*
 * The experiment ladder: final validation loss per run, in the order they were
 * run. Dots carry the outcome (teal = improved on the prior best, rust =
 * regression / deliberate bracketing overshoot); the ink step-line tracks
 * best-so-far. Hover any column for the run's key change. Colors are
 * validated pairs per theme (CVD ΔE > 25, contrast > 3:1 on both surfaces) —
 * not the site accents, which converge to near-identical hues in dark mode.
 */

import { useMemo, useState } from "react";
import { BASELINE_LOSS, EXPERIMENTS, FINAL_LOSS, type Experiment } from "./experiments";

const W = 720, H = 300;
const PAD = { top: 18, right: 16, bottom: 30, left: 44 };
const Y_MIN = 1.15, Y_MAX = 1.8;
const TICKS = [1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8];

// Sparse direct labels — the endpoints and the story beats; the tooltip and
// the ledger table carry everything else.
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
.pt-tip{position:absolute;pointer-events:none;z-index:5;max-width:240px;padding:8px 10px;background:var(--paper);border:1px solid var(--contour);box-shadow:0 4px 18px rgba(0,0,0,0.14);font-size:11px;line-height:1.45;}
`;

export default function LossChart() {
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

  return (
    <figure className="pt-chart relative m-0">
      <style dangerouslySetInnerHTML={{ __html: VIZ_CSS }} />

      {/* legend — identity never rides on color alone; the table below is the data view */}
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
        onMouseLeave={() => setHover(null)}
      >
        {/* recessive grid + ticks */}
        {TICKS.map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={yOf(v)} y2={yOf(v)} stroke="var(--contour)" strokeWidth={1} />
            <text x={PAD.left - 8} y={yOf(v) + 3.5} textAnchor="end" fontSize={10} fill="var(--ink)" opacity={0.45} fontFamily="var(--font-mono), monospace">
              {v.toFixed(2)}
            </text>
          </g>
        ))}
        <text x={PAD.left} y={H - 8} fontSize={10} fill="var(--ink)" opacity={0.45} fontFamily="var(--font-mono), monospace">
          experiments, in the order they were run →
        </text>

        {/* best-so-far step */}
        <path d={stepPath} fill="none" stroke="var(--ink)" strokeOpacity={0.5} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {/* per-run dots, surface-ringed */}
        {pts.map((p) => (
          <circle
            key={p.e.id}
            cx={p.x} cy={p.y}
            r={hover === p.i ? 6 : 4.5}
            fill={dotFill(p.e)}
            stroke="var(--paper)"
            strokeWidth={2}
          />
        ))}

        {/* sparse direct labels — values in text tokens, never the series color */}
        {pts.filter((p) => LABELLED[p.e.id]).map((p) => (
          <text
            key={`l-${p.e.id}`}
            x={p.x} y={p.y + LABELLED[p.e.id].dy}
            textAnchor={p.i > EXPERIMENTS.length - 4 ? "end" : "middle"}
            fontSize={10.5} fontWeight={600}
            fill="var(--ink)" opacity={0.75}
            fontFamily="var(--font-mono), monospace"
          >
            {LABELLED[p.e.id].text ?? p.e.loss.toFixed(4)}
          </text>
        ))}

        {/* hover hit columns — targets far bigger than the marks */}
        {pts.map((p) => (
          <rect
            key={`h-${p.e.id}`}
            x={p.x - (W - PAD.left - PAD.right) / EXPERIMENTS.length / 2}
            y={PAD.top}
            width={(W - PAD.left - PAD.right) / EXPERIMENTS.length}
            height={H - PAD.top - PAD.bottom}
            fill="transparent"
            onMouseEnter={() => setHover(p.i)}
          />
        ))}
      </svg>

      {hovered && (
        <div
          className="pt-tip"
          style={{
            left: `${(hovered.x / W) * 100}%`,
            top: `${(hovered.y / H) * 100}%`,
            transform: `translate(${hovered.i > EXPERIMENTS.length * 0.6 ? "-108%" : "8%"}, -50%)`,
          }}
        >
          <div className="font-mono text-ink/50">exp {hovered.e.id} · {hovered.e.name}</div>
          <div className="mt-0.5 text-ink/80">{hovered.e.change}</div>
          <div className="mt-1 font-mono text-ink">
            val {hovered.e.loss.toFixed(4)}
            <span className="text-ink/50"> · Δ base {(hovered.e.loss - BASELINE_LOSS).toFixed(4)}</span>
          </div>
        </div>
      )}
    </figure>
  );
}

export { BASELINE_LOSS, FINAL_LOSS };
