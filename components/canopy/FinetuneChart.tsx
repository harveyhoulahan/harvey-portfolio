"use client";

/*
 * The self-calibration curve: every checkpointed improvement during one
 * delivery's fine-tune, straight from the training log. Single series — the
 * title carries identity (no legend box); dots are the saved checkpoints,
 * the step line is best-so-far. Chart tokens are the same validated pairs
 * as /pretraining (CVD + contrast checked on both surfaces).
 */

import { useMemo, useState } from "react";

// [epoch, best val_loss at that checkpoint] — BestMetricCheckpoint saves from
// a production fine-tune run (identifiers stripped, numbers untouched).
const CHECKPOINTS: [number, number][] = [
  [2870, 0.01334], [2894, 0.01191], [2913, 0.01169], [2925, 0.01161],
  [2929, 0.01118], [2945, 0.01111], [2974, 0.01069], [2995, 0.01067],
  [3010, 0.01031], [3021, 0.00966], [3060, 0.00955],
];

const W = 720, H = 260;
const PAD = { top: 20, right: 20, bottom: 32, left: 52 };
const X_MIN = 2860, X_MAX = 3070;
const Y_MIN = 0.009, Y_MAX = 0.014;
const Y_TICKS = [0.009, 0.010, 0.011, 0.012, 0.013, 0.014];
const X_TICKS = [2875, 2925, 2975, 3025];

const VIZ_CSS = `
.cv-chart{--viz-good:#0A8A66;}
html.dark .cv-chart{--viz-good:#2FA183;}
.cv-tip{position:absolute;pointer-events:none;z-index:5;padding:7px 9px;background:var(--paper);border:1px solid var(--contour);box-shadow:0 4px 18px rgba(0,0,0,0.14);font-size:11px;line-height:1.45;white-space:nowrap;}
`;

export default function FinetuneChart() {
  const [hover, setHover] = useState<number | null>(null);

  const x = (e: number) => PAD.left + ((e - X_MIN) / (X_MAX - X_MIN)) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + ((Y_MAX - v) / (Y_MAX - Y_MIN)) * (H - PAD.top - PAD.bottom);

  const pts = useMemo(() => CHECKPOINTS.map(([e, v], i) => ({ e, v, i, px: x(e), py: y(v) })), []);
  const stepPath = useMemo(
    () => pts.map((p, i) => (i === 0 ? `M ${p.px} ${p.py}` : ` H ${p.px} V ${p.py}`)).join(""),
    [pts],
  );
  const hovered = hover !== null ? pts[hover] : null;

  return (
    <figure className="cv-chart relative m-0">
      <style dangerouslySetInnerHTML={{ __html: VIZ_CSS }} />
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Validation loss during one delivery's self-calibration fine-tune, stepping down from 0.01334 at epoch 2870 to 0.00955 at epoch 3060 across eleven saved checkpoints."
        onMouseLeave={() => setHover(null)}
      >
        {Y_TICKS.map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="var(--contour)" strokeWidth={1} />
            <text x={PAD.left - 8} y={y(v) + 3.5} textAnchor="end" fontSize={10} fill="var(--ink)" opacity={0.45} fontFamily="var(--font-mono), monospace">
              {v.toFixed(3)}
            </text>
          </g>
        ))}
        {X_TICKS.map((e) => (
          <text key={e} x={x(e)} y={H - 10} textAnchor="middle" fontSize={10} fill="var(--ink)" opacity={0.45} fontFamily="var(--font-mono), monospace">
            {e}
          </text>
        ))}
        <text x={W - PAD.right} y={H - 10} textAnchor="end" fontSize={10} fill="var(--ink)" opacity={0.45} fontFamily="var(--font-mono), monospace">
          epoch →
        </text>

        <path d={stepPath} fill="none" stroke="var(--viz-good)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {pts.map((p) => (
          <circle key={p.e} cx={p.px} cy={p.py} r={hover === p.i ? 6 : 4.5} fill="var(--viz-good)" stroke="var(--paper)" strokeWidth={2} />
        ))}

        {/* endpoints only — the tooltip carries the rest */}
        <text x={pts[0].px} y={pts[0].py - 10} textAnchor="middle" fontSize={10.5} fontWeight={600} fill="var(--ink)" opacity={0.75} fontFamily="var(--font-mono), monospace">
          0.01334
        </text>
        <text x={pts[pts.length - 1].px} y={pts[pts.length - 1].py - 10} textAnchor="end" fontSize={10.5} fontWeight={600} fill="var(--ink)" opacity={0.75} fontFamily="var(--font-mono), monospace">
          0.00955 · best
        </text>

        {pts.map((p, i) => {
          // hit column spans midpoint-to-midpoint between neighbouring checkpoints
          const x0 = i === 0 ? PAD.left : (pts[i - 1].px + p.px) / 2;
          const x1 = i === pts.length - 1 ? W - PAD.right : (p.px + pts[i + 1].px) / 2;
          return (
            <rect
              key={`h-${p.e}`}
              x={x0} y={PAD.top} width={x1 - x0} height={H - PAD.top - PAD.bottom}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
          );
        })}
      </svg>

      {hovered && (
        <div
          className="cv-tip"
          style={{
            left: `${(hovered.px / W) * 100}%`,
            top: `${(hovered.py / H) * 100}%`,
            transform: `translate(${hovered.i > pts.length / 2 ? "-110%" : "10%"}, -60%)`,
          }}
        >
          <div className="font-mono text-ink/50">epoch {hovered.e} · checkpoint saved</div>
          <div className="mt-0.5 font-mono text-ink">
            val {hovered.v.toFixed(5)}
            <span className="text-ink/50"> · {((1 - hovered.v / CHECKPOINTS[0][1]) * 100).toFixed(1)}% below start</span>
          </div>
        </div>
      )}
    </figure>
  );
}
