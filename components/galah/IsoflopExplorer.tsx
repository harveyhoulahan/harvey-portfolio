"use client";

/*
 * IsoFLOP profiles: val bits/byte vs parameter count, one profile per compute
 * budget. Select a budget to light its profile, quadratic fit and N_opt.
 * Diverged runs are drawn hollow — they are excluded from every fit.
 */

import { motion, useInView, useReducedMotion } from "framer-motion";
import { useMemo, useRef, useState } from "react";
import { BUDGETS, OPTIMA, RUNS, fmtC, fmtGB, fmtN, type Run } from "./data";

const W = 720, H = 380;
const PAD = { top: 20, right: 20, bottom: 42, left: 46 };
const LX_MIN = 4.85, LX_MAX = 8.2; // log10 N
const Y_MIN = 1.15, Y_MAX = 3.8;   // val bpb
const Y_TICKS = [1.2, 1.6, 2.0, 2.4, 2.8, 3.2, 3.6];
const X_TICKS = [
  { v: 1e5, label: "0.1M" },
  { v: 1e6, label: "1M" },
  { v: 1e7, label: "10M" },
  { v: 1e8, label: "100M" },
];

const VIZ_CSS = `
.gl-iso{--viz-good:#0A8A66;--viz-bad:#B23A18;}
html.dark .gl-iso{--viz-good:#2FA183;--viz-bad:#D96F45;}
.gl-tip{position:absolute;pointer-events:none;z-index:5;max-width:250px;padding:8px 10px;background:var(--paper);border:1px solid var(--contour);box-shadow:0 4px 18px rgba(0,0,0,0.14);font-size:11px;line-height:1.45;opacity:0;transform:translateY(4px);transition:opacity .18s ease,transform .18s ease;}
.gl-tip.is-visible{opacity:1;transform:translateY(0);}
.gl-chip{border:1px solid var(--contour);padding:3px 10px;font-size:11px;line-height:1.4;transition:all .15s ease;cursor:pointer;background:var(--paper);color:var(--ink);opacity:.6;}
.gl-chip:hover{opacity:.9;}
.gl-chip.is-on{opacity:1;border-color:var(--viz-good);color:var(--viz-good);}
`;

const x = (n: number) =>
  PAD.left + ((Math.log10(n) - LX_MIN) / (LX_MAX - LX_MIN)) * (W - PAD.left - PAD.right);
const y = (v: number) =>
  PAD.top + ((Y_MAX - Math.min(v, Y_MAX)) / (Y_MAX - Y_MIN)) * (H - PAD.top - PAD.bottom);

/** Least-squares quadratic in log10 N over a budget's clean points. */
function quadFit(pts: { lx: number; v: number }[]): [number, number, number] | null {
  if (pts.length < 3) return null;
  let s0 = 0, s1 = 0, s2 = 0, s3 = 0, s4 = 0, t0 = 0, t1 = 0, t2 = 0;
  for (const p of pts) {
    const u = p.lx, u2 = u * u;
    s0 += 1; s1 += u; s2 += u2; s3 += u2 * u; s4 += u2 * u2;
    t0 += p.v; t1 += u * p.v; t2 += u2 * p.v;
  }
  // Solve the 3x3 normal equations by Cramer's rule.
  const det = (a: number[]) =>
    a[0] * (a[4] * a[8] - a[5] * a[7]) - a[1] * (a[3] * a[8] - a[5] * a[6]) + a[2] * (a[3] * a[7] - a[4] * a[6]);
  const M = [s4, s3, s2, s3, s2, s1, s2, s1, s0];
  const d = det(M);
  if (Math.abs(d) < 1e-12) return null;
  const a2 = det([t2, s3, s2, t1, s2, s1, t0, s1, s0]) / d;
  const b2 = det([s4, t2, s2, s3, t1, s1, s2, t0, s0]) / d;
  const c2 = det([s4, s3, t2, s3, s2, t1, s2, s1, t0]) / d;
  return [a2, b2, c2];
}

export default function IsoflopExplorer() {
  const rootRef = useRef<HTMLElement>(null);
  const inView = useInView(rootRef, { once: true, margin: "-10% 0px" });
  const reduceMotion = useReducedMotion();
  const [budget, setBudget] = useState<number>(3e17);
  const [hover, setHover] = useState<Run | null>(null);
  const play = inView || reduceMotion;

  const sweep = useMemo(() => RUNS.filter((r) => !r.annex), []);

  const series = useMemo(
    () =>
      BUDGETS.map((c) => {
        const pts = sweep
          .filter((r) => r.c === c)
          .sort((a, b) => a.n - b.n);
        const clean = pts.filter((r) => !r.diverged).map((r) => ({ lx: Math.log10(r.n), v: r.val }));
        const fit = quadFit(clean);
        let fitPath = "";
        if (fit) {
          const lo = Math.min(...clean.map((p) => p.lx)) - 0.08;
          const hi = Math.max(...clean.map((p) => p.lx)) + 0.08;
          const seg: string[] = [];
          for (let i = 0; i <= 48; i++) {
            const u = lo + ((hi - lo) * i) / 48;
            const v = fit[0] * u * u + fit[1] * u + fit[2];
            if (v < Y_MIN - 0.1 || v > Y_MAX + 0.4) { continue; }
            const px = PAD.left + ((u - LX_MIN) / (LX_MAX - LX_MIN)) * (W - PAD.left - PAD.right);
            seg.push(`${seg.length === 0 ? "M" : "L"} ${px.toFixed(1)} ${y(v).toFixed(1)}`);
          }
          fitPath = seg.join(" ");
        }
        return { c, pts, fitPath, opt: OPTIMA.find((o) => o.c === c) ?? null };
      }),
    [sweep],
  );

  const linePath = (pts: Run[]) =>
    pts.map((r, i) => `${i === 0 ? "M" : "L"} ${x(r.n).toFixed(1)} ${y(r.val).toFixed(1)}`).join(" ");

  return (
    <figure ref={rootRef} className="gl-iso relative m-0">
      <style dangerouslySetInnerHTML={{ __html: VIZ_CSS }} />

      <figcaption className="mb-3 flex flex-wrap items-center gap-2 font-mono text-[11px] text-ink/60">
        <span className="mr-1">budget</span>
        {BUDGETS.map((c) => (
          <button
            key={c}
            type="button"
            className={`gl-chip font-mono${budget === c ? " is-on" : ""}`}
            onClick={() => setBudget(c)}
            onMouseEnter={() => setBudget(c)}
          >
            {fmtC(c)}
          </button>
        ))}
        <span className="ml-auto inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full border-2" style={{ borderColor: "var(--viz-bad)" }} />
          diverged · excluded from fits
        </span>
      </figcaption>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="IsoFLOP profiles: final validation bits per byte against parameter count for six compute budgets. Each budget traces a U-shape whose minimum is the compute-optimal size."
        onMouseLeave={() => setHover(null)}
      >
        {Y_TICKS.map((v, ti) => (
          <g key={v}>
            <motion.line
              x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)}
              stroke="var(--contour)" strokeWidth={1}
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={play ? { opacity: 1 } : {}}
              transition={{ duration: 0.35, delay: reduceMotion ? 0 : ti * 0.04 }}
            />
            <text x={PAD.left - 8} y={y(v) + 3.5} textAnchor="end" fontSize={10}
              fill="var(--ink)" opacity={0.45} fontFamily="var(--font-mono), monospace">
              {v.toFixed(1)}
            </text>
          </g>
        ))}
        {X_TICKS.map((t) => (
          <g key={t.v}>
            <line x1={x(t.v)} x2={x(t.v)} y1={H - PAD.bottom} y2={H - PAD.bottom + 5}
              stroke="var(--ink)" strokeOpacity={0.35} strokeWidth={1} />
            <text x={x(t.v)} y={H - PAD.bottom + 17} textAnchor="middle" fontSize={10}
              fill="var(--ink)" opacity={0.45} fontFamily="var(--font-mono), monospace">
              {t.label}
            </text>
          </g>
        ))}
        <text x={W - PAD.right} y={H - 6} textAnchor="end" fontSize={10}
          fill="var(--ink)" opacity={0.45} fontFamily="var(--font-mono), monospace">
          non-embedding parameters (log) →
        </text>
        <text x={14} y={PAD.top - 6} fontSize={10} fill="var(--ink)" opacity={0.45}
          fontFamily="var(--font-mono), monospace">
          val bits/byte
        </text>

        {/* resting profiles */}
        {series.map((s) => {
          const active = s.c === budget;
          const last = s.pts[s.pts.length - 1];
          return (
            <g key={s.c}>
              <motion.path
                d={linePath(s.pts)}
                fill="none"
                stroke={active ? "var(--viz-good)" : "var(--ink)"}
                strokeWidth={active ? 2 : 1.2}
                strokeOpacity={active ? 0.9 : 0.35}
                strokeLinejoin="round"
                initial={reduceMotion ? false : { pathLength: 0 }}
                animate={play ? { pathLength: 1 } : {}}
                transition={{ duration: reduceMotion ? 0 : 1.4, ease: [0.65, 0, 0.35, 1] }}
              />
              {active && s.fitPath && (
                <motion.path
                  d={s.fitPath}
                  fill="none"
                  stroke="var(--viz-good)"
                  strokeWidth={1.4}
                  strokeDasharray="5 4"
                  strokeOpacity={0.55}
                  initial={reduceMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 0.55 }}
                  transition={{ duration: 0.4 }}
                />
              )}
              {active && s.opt && !s.opt.edgePinned && (
                <motion.path
                  d={`M ${x(s.opt.nOpt)} ${y(s.opt.lOpt) - 7} l 6 7 l -6 7 l -6 -7 Z`}
                  fill="var(--infra)"
                  initial={reduceMotion ? false : { opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.35, delay: 0.25 }}
                />
              )}
              {last && (
                <text
                  x={x(last.n) + 8} y={y(last.val) + 3.5}
                  fontSize={9.5}
                  fill={active ? "var(--viz-good)" : "var(--ink)"}
                  opacity={active ? 0.95 : 0.5}
                  fontFamily="var(--font-mono), monospace"
                >
                  {fmtC(s.c)}
                </text>
              )}
            </g>
          );
        })}

        {/* points */}
        {series.map((s) =>
          s.pts.map((r) => {
            const active = s.c === budget;
            const clipped = r.val > Y_MAX;
            return (
              <g key={r.name}>
                <motion.circle
                  cx={x(r.n)} cy={y(r.val)}
                  fill={r.diverged ? "var(--paper)" : active ? "var(--viz-good)" : "var(--ink)"}
                  stroke={r.diverged ? "var(--viz-bad)" : "var(--paper)"}
                  strokeWidth={r.diverged ? 2 : 1.5}
                  fillOpacity={r.diverged ? 1 : active ? 1 : 0.55}
                  initial={reduceMotion ? false : { opacity: 0, r: 0 }}
                  animate={play ? { opacity: 1, r: hover?.name === r.name ? 6.5 : active ? 4.5 : 3.4 } : {}}
                  transition={{ duration: 0.3 }}
                />
                {r.diverged && clipped && (
                  <text x={x(r.n)} y={y(r.val) - 10} textAnchor="middle" fontSize={9.5}
                    fill="var(--viz-bad)" fontFamily="var(--font-mono), monospace">
                    ↑ {r.val.toFixed(2)}
                  </text>
                )}
                <rect
                  x={x(r.n) - 11} y={y(r.val) - 11} width={22} height={22} fill="transparent"
                  onMouseEnter={() => { setHover(r); setBudget(r.c); }}
                />
              </g>
            );
          }),
        )}
      </svg>

      <div
        className={`gl-tip${hover ? " is-visible" : ""}`}
        style={{
          left: hover ? `${(x(hover.n) / W) * 100}%` : "0%",
          top: hover ? `${(y(hover.val) / H) * 100}%` : "0%",
          transform: hover
            ? `translate(${Math.log10(hover.n) > 6.9 ? "-108%" : "8%"}, -50%)`
            : undefined,
        }}
      >
        {hover && (
          <>
            <div className="font-mono text-ink/50">{hover.name}</div>
            <div className="mt-0.5 text-ink/80">
              {fmtN(hover.n)} params · {fmtGB(hover.tokens)} · {hover.steps.toLocaleString()} steps
            </div>
            <div className="mt-1 font-mono text-ink">
              val {hover.val.toFixed(3)} bpb
              {hover.diverged && (
                <span style={{ color: "var(--viz-bad)" }}> · diverged @ {hover.firstSpike?.toLocaleString()}</span>
              )}
            </div>
          </>
        )}
      </div>
    </figure>
  );
}
