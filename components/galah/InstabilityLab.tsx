"use client";

/*
 * The stability annex: smoothed train loss for every rung that diverged, at
 * LR ×1.0 and ×0.5, plus the seed repeat. Pick a rung; scrub for values.
 * The 18M control that survived the same budget is available for contrast.
 */

import { motion, useInView, useReducedMotion } from "framer-motion";
import { useMemo, useRef, useState } from "react";
import curvesJson from "./curves.json";

type Pt = [number, number, number]; // step, ema train loss, val bpb
type Curve = { name: string; points: Pt[] };
const CURVES = curvesJson as unknown as Record<string, Curve>;

const W = 720, H = 340;
const PAD = { top: 20, right: 20, bottom: 40, left: 44 };
const Y_MIN = 0.8, Y_MAX = 3.7;
const Y_TICKS = [1.0, 1.5, 2.0, 2.5, 3.0, 3.5];

interface SeriesSpec {
  key: string;
  label: string;
  color: string;
  dash?: string;
  killedAt?: number;
}
interface RungSpec {
  id: string;
  tab: string;
  steps: number;
  note?: string;
  series: SeriesSpec[];
}

const RUNGS: RungSpec[] = [
  {
    id: "1.5m", tab: "1.5M · C=3e16", steps: 12017,
    note: "Two seeds diverge at ×1.0. The ×0.5 run holds — but lands at 1.79 bpb where the trend says ≈1.55.",
    series: [
      { key: "d1p5-full", label: "×1.0 · seed 1337", color: "var(--viz-bad)" },
      { key: "d1p5-seed", label: "×1.0 · seed 1338", color: "var(--viz-bad)", dash: "5 4" },
      { key: "d1p5-half", label: "×0.5", color: "var(--viz-good)" },
    ],
  },
  {
    id: "2.7m", tab: "2.7M · C=1e17", steps: 25362,
    note: "At ×0.5 this rung diverged harder than at full LR (3.37 vs 1.86 bpb). Near the stability boundary, single seeds are coin flips.",
    series: [
      { key: "d2p7-full", label: "×1.0", color: "var(--viz-bad)" },
      { key: "d2p7-half", label: "×0.5", color: "var(--viz-good)" },
    ],
  },
  {
    id: "5.5m", tab: "5.5M · C=3e17", steps: 41576,
    note: "The longest run in the study: 41.6k steps. The ×0.5 rerun was already spiking when it was stopped to free the box.",
    series: [
      { key: "d5p5-full", label: "×1.0", color: "var(--viz-bad)" },
      { key: "d5p5-half", label: "×0.5 · stopped", color: "var(--viz-good)", killedAt: 8450 },
    ],
  },
  {
    id: "10m", tab: "10M · C=3e17", steps: 25307,
    note: "×1.0 and ×0.5 share seed 1337 — identical batch order — and the raw loss leaves its floor at step 5,550 in both (the smoothed curves register it a beat apart). Halving the LR delayed nothing: the trigger sits in the data order.",
    series: [
      { key: "d10-full", label: "×1.0", color: "var(--viz-bad)" },
      { key: "d10-half", label: "×0.5", color: "var(--viz-good)" },
    ],
  },
];

const CONTROL: SeriesSpec = { key: "ctl18", label: "18M · C=3e17 · survived", color: "var(--ink)" };

const OUTCOMES: [string, string, string, string, string][] = [
  ["1.5M · C3e16", "12,017", "3.22 / 3.16 bpb · diverged", "1.79 bpb · held", "rescued, off trend"],
  ["2.7M · C1e17", "25,362", "1.86 bpb · spiked, limped in", "3.37 bpb · diverged", "worse at half LR"],
  ["5.5M · C3e17", "41,576", "4.17 bpb · diverged", "stopped at 8,450 · spiking", "unresolved"],
  ["10M · C3e17", "25,307", "3.63 bpb · diverged", "2.63 bpb · diverged", "half LR insufficient"],
];

const VIZ_CSS = `
.gl-lab{--viz-good:#0A8A66;--viz-bad:#B23A18;}
html.dark .gl-lab{--viz-good:#2FA183;--viz-bad:#D96F45;}
.gl-lab .gl-chip{border:1px solid var(--contour);padding:3px 10px;font-size:11px;line-height:1.4;transition:all .15s ease;cursor:pointer;background:var(--paper);color:var(--ink);opacity:.6;}
.gl-lab .gl-chip:hover{opacity:.9;}
.gl-lab .gl-chip.is-on{opacity:1;border-color:var(--ink);}
`;

function firstSpike(points: Pt[]): number | null {
  let runmin = 99;
  for (const [s, e] of points) {
    if (s < 300) continue;
    if (e < runmin) runmin = e;
    else if (e > runmin + 0.15) return s;
  }
  return null;
}

export default function InstabilityLab() {
  const rootRef = useRef<HTMLElement>(null);
  const inView = useInView(rootRef, { once: true, margin: "-10% 0px" });
  const reduceMotion = useReducedMotion();
  const [rungId, setRungId] = useState("10m");
  const [showControl, setShowControl] = useState(false);
  const [scrub, setScrub] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const play = inView || reduceMotion;

  const rung = RUNGS.find((r) => r.id === rungId)!;
  const xOf = (step: number) =>
    PAD.left + (step / rung.steps) * (W - PAD.left - PAD.right);
  const yOf = (v: number) =>
    PAD.top + ((Y_MAX - Math.min(Math.max(v, Y_MIN), Y_MAX)) / (Y_MAX - Y_MIN)) * (H - PAD.top - PAD.bottom);

  const drawn = useMemo(() => {
    const specs = showControl ? [...rung.series, CONTROL] : rung.series;
    return specs
      .filter((s) => CURVES[s.key])
      .map((s) => {
        const pts = CURVES[s.key].points.filter((p) => p[0] <= rung.steps);
        const path = pts
          .map((p, i) => `${i === 0 ? "M" : "L"} ${xOf(p[0]).toFixed(1)} ${yOf(p[1]).toFixed(1)}`)
          .join(" ");
        return { spec: s, pts, path, spike: s.key === "ctl18" ? null : firstSpike(CURVES[s.key].points) };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rungId, showControl]);

  const xTicks = useMemo(() => {
    const step = rung.steps > 30000 ? 10000 : rung.steps > 15000 ? 5000 : 2500;
    const out: number[] = [];
    for (let v = step; v < rung.steps; v += step) out.push(v);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rungId]);

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const box = svgRef.current?.getBoundingClientRect();
    if (!box) return;
    const px = ((e.clientX - box.left) / box.width) * W;
    const step = Math.round(((px - PAD.left) / (W - PAD.left - PAD.right)) * rung.steps);
    setScrub(step >= 0 && step <= rung.steps ? step : null);
  };

  // spike labels: skip exact-duplicate steps (10M ×1.0 and ×0.5 both spike at
  // 5,550 — one label, two ticks), stagger the rest when they'd collide.
  const spikeLabels = useMemo(() => {
    const seen = new Set<number>();
    const placed: { x: number; dy: number }[] = [];
    const out = new Map<string, { text: string; dy: number } | null>();
    for (const d of drawn) {
      if (d.spike === null || d.spike > rung.steps) { out.set(d.spec.key, null); continue; }
      if (seen.has(d.spike)) { out.set(d.spec.key, null); continue; }
      seen.add(d.spike);
      const px = xOf(d.spike);
      const clashes = placed.filter((p) => Math.abs(p.x - px) < 52).length;
      placed.push({ x: px, dy: clashes * 11 });
      out.set(d.spec.key, { text: d.spike.toLocaleString(), dy: clashes * 11 });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawn]);

  const readouts = scrub === null ? [] : drawn.map((d) => {
    let best: Pt | null = null;
    for (const p of d.pts) {
      if (!best || Math.abs(p[0] - scrub) < Math.abs(best[0] - scrub)) best = p;
    }
    return { spec: d.spec, pt: best };
  }).filter((r) => r.pt && Math.abs(r.pt[0] - scrub) < rung.steps * 0.06);

  return (
    <figure ref={rootRef} className="gl-lab relative m-0">
      <style dangerouslySetInnerHTML={{ __html: VIZ_CSS }} />

      <figcaption className="mb-3 flex flex-wrap items-center gap-2 font-mono text-[11px] text-ink/60">
        {RUNGS.map((r) => (
          <button
            key={r.id}
            type="button"
            className={`gl-chip font-mono${rungId === r.id ? " is-on" : ""}`}
            onClick={() => { setRungId(r.id); setScrub(null); }}
          >
            {r.tab}
          </button>
        ))}
        <button
          type="button"
          className={`gl-chip ml-auto font-mono${showControl ? " is-on" : ""}`}
          onClick={() => setShowControl((v) => !v)}
        >
          {showControl ? "hide" : "show"} 18M control
        </button>
      </figcaption>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Smoothed training loss over steps for the diverged rung at learning-rate scale 1.0 and 0.5. Loss runs flat, then leaves its floor mid-schedule and never fully returns."
        onMouseMove={onMove}
        onMouseLeave={() => setScrub(null)}
      >
        {Y_TICKS.map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={yOf(v)} y2={yOf(v)}
              stroke="var(--contour)" strokeWidth={1} />
            <text x={PAD.left - 8} y={yOf(v) + 3.5} textAnchor="end" fontSize={10}
              fill="var(--ink)" opacity={0.45} fontFamily="var(--font-mono), monospace">
              {v.toFixed(1)}
            </text>
          </g>
        ))}
        {xTicks.map((v) => (
          <text key={v} x={xOf(v)} y={H - PAD.bottom + 17} textAnchor="middle" fontSize={10}
            fill="var(--ink)" opacity={0.45} fontFamily="var(--font-mono), monospace">
            {(v / 1000).toFixed(0)}k
          </text>
        ))}
        <text x={W - PAD.right} y={H - 6} textAnchor="end" fontSize={10}
          fill="var(--ink)" opacity={0.45} fontFamily="var(--font-mono), monospace">
          optimiser steps →
        </text>
        <text x={14} y={PAD.top - 6} fontSize={10} fill="var(--ink)" opacity={0.45}
          fontFamily="var(--font-mono), monospace">
          train loss (EMA)
        </text>

        {drawn.map((d, i) => (
          <g key={`${rungId}-${d.spec.key}`}>
            <motion.path
              d={d.path}
              fill="none"
              stroke={d.spec.color}
              strokeWidth={d.spec.key === "ctl18" ? 1.2 : 1.8}
              strokeOpacity={d.spec.key === "ctl18" ? 0.3 : 0.9}
              strokeDasharray={d.spec.dash}
              strokeLinejoin="round"
              initial={reduceMotion ? false : { pathLength: 0 }}
              animate={play ? { pathLength: 1 } : {}}
              transition={{ duration: reduceMotion ? 0 : 1.6, delay: reduceMotion ? 0 : i * 0.2, ease: [0.65, 0, 0.35, 1] }}
            />
            {d.spike !== null && d.spike <= rung.steps && (
              <g>
                <line x1={xOf(d.spike)} x2={xOf(d.spike)} y1={PAD.top + 4} y2={H - PAD.bottom}
                  stroke={d.spec.color} strokeOpacity={0.35} strokeWidth={1} strokeDasharray="2 3" />
                {(() => {
                  const lab = spikeLabels.get(d.spec.key);
                  return lab ? (
                    <text x={xOf(d.spike) + 4} y={PAD.top + 12 + lab.dy} fontSize={9.5}
                      fill={d.spec.color} opacity={0.8} fontFamily="var(--font-mono), monospace">
                      {lab.text}
                    </text>
                  ) : null;
                })()}
              </g>
            )}
            {d.spec.killedAt && d.pts.length > 0 && (
              <g>
                <text x={xOf(d.pts[d.pts.length - 1][0])} y={yOf(d.pts[d.pts.length - 1][1]) + 4}
                  textAnchor="middle" fontSize={13} fill={d.spec.color}
                  fontFamily="var(--font-mono), monospace">
                  ×
                </text>
                <text x={xOf(d.pts[d.pts.length - 1][0]) + 8} y={yOf(d.pts[d.pts.length - 1][1]) + 4}
                  fontSize={9.5} fill={d.spec.color} opacity={0.8}
                  fontFamily="var(--font-mono), monospace">
                  stopped @ {d.spec.killedAt.toLocaleString()}
                </text>
              </g>
            )}
          </g>
        ))}

        {scrub !== null && (
          <line x1={xOf(scrub)} x2={xOf(scrub)} y1={PAD.top} y2={H - PAD.bottom}
            stroke="var(--ink)" strokeOpacity={0.25} strokeWidth={1} />
        )}
      </svg>

      {/* legend + scrub readout */}
      <div className="mt-2 flex min-h-[22px] flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[11px] text-ink/60">
        {drawn.map((d) => (
          <span key={d.spec.key} className="inline-flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-0.5 w-4"
              style={{ background: d.spec.color, opacity: d.spec.key === "ctl18" ? 0.4 : 0.9 }} />
            {d.spec.label}
            {scrub !== null && (() => {
              const r = readouts.find((x) => x.spec.key === d.spec.key);
              return r?.pt ? <span className="text-ink">{r.pt[1].toFixed(3)}</span> : null;
            })()}
          </span>
        ))}
        {scrub !== null && <span className="ml-auto text-ink/45">step {scrub.toLocaleString()}</span>}
      </div>

      <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink/65">{rung.note}</p>

      {/* outcomes */}
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-left">
          <thead>
            <tr className="border-b border-contour font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">
              <th className="py-2 pr-4 font-medium">config</th>
              <th className="py-2 pr-4 font-medium">steps</th>
              <th className="py-2 pr-4 font-medium">LR ×1.0</th>
              <th className="py-2 pr-4 font-medium">LR ×0.5</th>
              <th className="py-2 font-medium">verdict</th>
            </tr>
          </thead>
          <tbody>
            {OUTCOMES.map(([cfg, steps, full, half, verdict]) => (
              <tr key={cfg} className="border-b border-contour/60 text-sm">
                <td className="py-2.5 pr-4 font-mono text-[12px] text-ink/85">{cfg}</td>
                <td className="py-2.5 pr-4 font-mono text-[12px] text-ink/60">{steps}</td>
                <td className="py-2.5 pr-4 text-ink/70">{full}</td>
                <td className="py-2.5 pr-4 text-ink/70">{half}</td>
                <td className="py-2.5 text-ink/85">{verdict}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
