import {
  BASELINE_LOSS,
  EXPERIMENTS,
  FINAL_LOSS,
  type Experiment,
} from "@/components/pretraining/experiments";

const W = 400;
const H = 160;
const PAD = { l: 34, r: 14, t: 14, b: 22 };
const Y_MIN = 1.15;
const Y_MAX = 1.78;
const TICKS = [1.2, 1.4, 1.6, 1.75];

function yOf(v: number) {
  return PAD.t + ((Y_MAX - v) / (Y_MAX - Y_MIN)) * (H - PAD.t - PAD.b);
}

function dotFill(e: Experiment) {
  return e.status === "bracket" ? "var(--infra)" : "var(--flow)";
}

export default function PretrainingCardArt() {
  const span = W - PAD.l - PAD.r;
  const xOf = (i: number) => PAD.l + (span * (i + 0.5)) / EXPERIMENTS.length;

  let best = Infinity;
  const pts = EXPERIMENTS.map((e, i) => {
    best = Math.min(best, e.loss);
    return { e, i, x: xOf(i), y: yOf(e.loss), yBest: yOf(best) };
  });

  let stepPath = "";
  pts.forEach((p, i) => {
    stepPath += i === 0 ? `M ${p.x} ${p.yBest}` : ` H ${p.x} V ${p.yBest}`;
  });

  const first = pts[0];
  const last = pts[pts.length - 1];
  const floor = H - PAD.b;
  const areaPath = `${stepPath} L ${last.x} ${floor} L ${first.x} ${floor} Z`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-40 w-full bg-terrace"
      role="img"
      aria-label={`Pretraining experiment ladder: validation loss from ${BASELINE_LOSS} to ${FINAL_LOSS}.`}
      preserveAspectRatio="xMidYMid slice"
    >
      {/* grid */}
      {TICKS.map((v) => (
        <line
          key={v}
          x1={PAD.l}
          x2={W - PAD.r}
          y1={yOf(v)}
          y2={yOf(v)}
          stroke="var(--contour)"
          strokeWidth={1}
        />
      ))}

      {/* y-axis labels */}
      {TICKS.map((v) => (
        <text
          key={`t-${v}`}
          x={PAD.l - 6}
          y={yOf(v) + 3}
          textAnchor="end"
          fontSize={9}
          fill="var(--ink)"
          opacity={0.4}
          fontFamily="var(--font-mono), monospace"
        >
          {v.toFixed(2)}
        </text>
      ))}

      {/* baseline */}
      <line
        x1={PAD.l}
        x2={W - PAD.r}
        y1={yOf(BASELINE_LOSS)}
        y2={yOf(BASELINE_LOSS)}
        stroke="var(--infra)"
        strokeOpacity={0.28}
        strokeWidth={1}
        strokeDasharray="4 4"
      />

      {/* fill under best-so-far */}
      <path d={areaPath} fill="var(--flow)" fillOpacity={0.1} stroke="none" />

      {/* best-so-far step — draws in on card hover */}
      <g className="contour-motif" style={{ ["--motif-len" as string]: 520 }}>
        <path
          d={stepPath}
          fill="none"
          stroke="var(--flow)"
          strokeWidth={2.25}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </g>

      {/* experiment dots */}
      {pts.map((p) => (
        <circle
          key={p.e.id}
          cx={p.x}
          cy={p.y}
          r={p.e.status === "submitted" ? 3.5 : 2.25}
          fill={dotFill(p.e)}
          stroke="var(--paper)"
          strokeWidth={p.e.status === "submitted" ? 1.5 : 1}
          opacity={p.e.status === "bracket" ? 0.75 : 0.9}
        />
      ))}

      {/* endpoint labels */}
      <text
        x={first.x}
        y={yOf(BASELINE_LOSS) - 6}
        textAnchor="middle"
        fontSize={9}
        fill="var(--ink)"
        opacity={0.55}
        fontFamily="var(--font-mono), monospace"
      >
        {BASELINE_LOSS.toFixed(4)}
      </text>
      <text
        x={last.x}
        y={last.yBest - 8}
        textAnchor="end"
        fontSize={10}
        fontWeight={600}
        fill="var(--flow)"
        fontFamily="var(--font-mono), monospace"
      >
        {FINAL_LOSS.toFixed(4)}
      </text>

      {/* improvement badge */}
      <text
        x={W - PAD.r}
        y={PAD.t + 10}
        textAnchor="end"
        fontSize={9}
        fill="var(--ink)"
        opacity={0.45}
        fontFamily="var(--font-mono), monospace"
      >
        −33.0%
      </text>

      <text
        x={PAD.l}
        y={H - 6}
        fontSize={8.5}
        fill="var(--ink)"
        opacity={0.35}
        fontFamily="var(--font-mono), monospace"
      >
        28 experiments →
      </text>
    </svg>
  );
}
