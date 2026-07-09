"use client";

/*
 * SurferLab — the paper's 6-page web, live.
 *
 * The exact weighted graph from the FIT3139 submission runs a discrete-time
 * random surfer in front of you: link-follows glide along edges, teleports
 * arc across the graph in signal red. Empirical visit frequencies accumulate
 * as bars against the exact stationary distribution (left eigenvector,
 * computed by power iteration in ~40 lines below), with live MSE so you can
 * watch the 1/K Monte Carlo convergence the report proves. Drag the damping
 * factor and the whole equilibrium reshapes; page E, which nothing links to,
 * pins itself to (1-alpha)/6 exactly, because teleportation is the only way
 * in.
 *
 * Canvas + CSS variables, no dependencies. Static exact distribution under
 * prefers-reduced-motion; pauses off-screen and when the tab is hidden.
 */

import { useEffect, useRef, useState } from "react";

const NODES = ["A", "B", "C", "D", "E", "F"] as const;
// the submission's weighted adjacency, verbatim
const ADJ: Record<string, [string, number][]> = {
  A: [["B", 2], ["C", 1]],
  B: [["C", 1], ["D", 2]],
  C: [["A", 1], ["D", 1]],
  D: [["A", 1], ["B", 1]],
  E: [["A", 1], ["F", 1]],
  F: [["D", 1]],
};
// hand-placed layout (unit space); E sits apart because nothing points at it
const POS: Record<string, [number, number]> = {
  A: [0.34, 0.2], B: [0.7, 0.16], C: [0.22, 0.52],
  D: [0.72, 0.54], E: [0.12, 0.86], F: [0.52, 0.9],
};

function buildP(alpha: number): number[][] {
  const N = NODES.length;
  const P: number[][] = NODES.map(() => Array(N).fill((1 - alpha) / N));
  NODES.forEach((u, i) => {
    const tot = ADJ[u].reduce((s, [, w]) => s + w, 0);
    for (const [v, w] of ADJ[u]) P[i][NODES.indexOf(v as typeof NODES[number])] += (alpha * w) / tot;
  });
  return P;
}

/** Stationary distribution by power iteration on the left eigenproblem. */
function stationary(alpha: number): number[] {
  const P = buildP(alpha);
  const N = NODES.length;
  let pi = Array(N).fill(1 / N);
  for (let it = 0; it < 200; it++) {
    const next = Array(N).fill(0);
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) next[j] += pi[i] * P[i][j];
    let diff = 0;
    for (let j = 0; j < N; j++) { diff += Math.abs(next[j] - pi[j]); pi[j] = next[j]; }
    if (diff < 1e-10) break;
  }
  return pi;
}

export default function SurferLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [alpha, setAlpha] = useState(0.85);
  const [stats, setStats] = useState({ steps: 0, mse: 0, teleports: 0 });
  const [reduced, setReduced] = useState(false);
  const alphaRef = useRef(alpha);
  const resetRef = useRef(false);
  alphaRef.current = alpha;

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reducedMq = window.matchMedia("(prefers-reduced-motion: reduce)");

    let raf = 0;
    let running = false;
    let inView = true;
    let visible = !document.hidden;
    let frame = 0;

    // surfer state
    let P = buildP(alphaRef.current);
    let piExact = stationary(alphaRef.current);
    let lastAlpha = alphaRef.current;
    let cur = 0;
    let counts = new Array(6).fill(0);
    let steps = 0;
    let teleports = 0;
    // animation: interpolate between hops
    let from = 0, to = 0, hopT = 1, wasTeleport = false;
    const HOP_FRAMES = 14;

    let colors = { ink: "#161f1b", flow: "#14655a", infra: "#b23a18", contour: "#c3ccc2", paper: "#ecefea" };
    const readColors = () => {
      const css = getComputedStyle(document.documentElement);
      const v = (n: string, fb: string) => css.getPropertyValue(n).trim() || fb;
      colors = {
        ink: v("--foreground", colors.ink), flow: v("--flow", colors.flow),
        infra: v("--infra", colors.infra), contour: v("--contour", colors.contour),
        paper: v("--background", colors.paper),
      };
    };

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.floor(r.width * dpr));
      const h = Math.max(1, Math.floor(r.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w; canvas.height = h;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    };

    const hop = () => {
      const r = Math.random();
      let acc = 0;
      let next = 0;
      for (let j = 0; j < 6; j++) { acc += P[cur][j]; if (r < acc) { next = j; break; } }
      // classify: was it achievable via a link? teleports land where no link goes
      const isLink = ADJ[NODES[cur]].some(([v]) => NODES.indexOf(v as typeof NODES[number]) === next);
      wasTeleport = !isLink;
      if (wasTeleport) teleports++;
      from = cur; to = next; hopT = 0;
      cur = next;
      counts[next]++;
      steps++;
    };

    const draw = () => {
      const r = canvas.getBoundingClientRect();
      const w = r.width;
      const h = r.height;
      if (frame % 120 === 0) readColors();
      frame++;

      // live alpha changes rebuild the chain and restart the tally
      if (alphaRef.current !== lastAlpha || resetRef.current) {
        lastAlpha = alphaRef.current;
        resetRef.current = false;
        P = buildP(lastAlpha);
        piExact = stationary(lastAlpha);
        counts = new Array(6).fill(0);
        steps = 0; teleports = 0;
      }

      const graphH = h - 92;
      const px = (n: string) => POS[n][0] * (w - 60) + 30;
      const py = (n: string) => POS[n][1] * (graphH - 40) + 20;

      ctx.clearRect(0, 0, w, h);
      ctx.lineCap = "round";

      // edges, weighted
      for (const u of NODES) {
        for (const [v, wt] of ADJ[u]) {
          const x1 = px(u), y1 = py(u), x2 = px(v), y2 = py(v);
          const dx = x2 - x1, dy = y2 - y1;
          const L = Math.hypot(dx, dy) || 1;
          const ux = dx / L, uy = dy / L;
          const sx = x1 + ux * 12, sy = y1 + uy * 12;
          const ex = x2 - ux * 14, ey = y2 - uy * 14;
          ctx.strokeStyle = colors.ink;
          ctx.globalAlpha = 0.22 + wt * 0.08;
          ctx.lineWidth = wt;
          ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
          // arrowhead
          ctx.beginPath();
          ctx.moveTo(ex, ey);
          ctx.lineTo(ex - ux * 6 - uy * 3.4, ey - uy * 6 + ux * 3.4);
          ctx.lineTo(ex - ux * 6 + uy * 3.4, ey - uy * 6 - ux * 3.4);
          ctx.closePath();
          ctx.fillStyle = colors.ink;
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }

      // the surfer: glide along links, arc on teleports
      if (!reducedMq.matches) {
        if (hopT >= 1) hop();
        hopT = Math.min(1, hopT + 1 / HOP_FRAMES);
        const t = hopT * hopT * (3 - 2 * hopT);
        const x1 = px(NODES[from]), y1 = py(NODES[from]);
        const x2 = px(NODES[to]), y2 = py(NODES[to]);
        let sxp = x1 + (x2 - x1) * t;
        let syp = y1 + (y2 - y1) * t;
        if (wasTeleport) {
          // teleports leave the page: arc high above the graph
          syp -= Math.sin(Math.PI * t) * 34;
          ctx.strokeStyle = colors.infra;
          ctx.globalAlpha = 0.5 * (1 - Math.abs(t - 0.5) * 2) + 0.15;
          ctx.setLineDash([3, 5]);
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.quadraticCurveTo((x1 + x2) / 2, Math.min(y1, y2) - 44, x2, y2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
        }
        ctx.fillStyle = wasTeleport ? colors.infra : colors.flow;
        ctx.fillRect(sxp - 4, syp - 4, 8, 8);
      }

      // nodes: benchmark squares sized by exact rank, labels + rank values
      NODES.forEach((n, i) => {
        const x = px(n), y = py(n);
        const s = 9 + piExact[i] * 34;
        ctx.fillStyle = colors.paper;
        ctx.strokeStyle = i === cur && !reducedMq.matches ? colors.flow : colors.contour;
        ctx.lineWidth = i === cur && !reducedMq.matches ? 2 : 1;
        ctx.fillRect(x - s / 2, y - s / 2, s, s);
        ctx.strokeRect(x - s / 2, y - s / 2, s, s);
        ctx.fillStyle = colors.ink;
        ctx.font = "600 11px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.fillText(n, x, y + 3.5);
        ctx.globalAlpha = 0.55;
        ctx.font = "9px ui-monospace, monospace";
        ctx.fillText(piExact[i].toFixed(3), x, y + s / 2 + 11);
        ctx.globalAlpha = 1;
      });

      // bars: exact (flow) vs empirical (ink), with MSE for the caption
      const bw = (w - 40) / 6;
      const baseY = h - 14;
      const barMax = 56;
      let mse = 0;
      NODES.forEach((n, i) => {
        const cx = 20 + bw * i + bw / 2;
        const emp = steps > 0 ? counts[i] / steps : 0;
        mse += (emp - piExact[i]) ** 2 / 6;
        ctx.fillStyle = colors.flow;
        ctx.globalAlpha = 0.85;
        ctx.fillRect(cx - 9, baseY - piExact[i] * barMax * 3, 8, piExact[i] * barMax * 3);
        ctx.fillStyle = colors.ink;
        ctx.globalAlpha = 0.5;
        ctx.fillRect(cx + 1, baseY - emp * barMax * 3, 8, emp * barMax * 3);
        ctx.globalAlpha = 0.55;
        ctx.font = "9px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.fillText(n, cx, baseY + 10);
        ctx.globalAlpha = 1;
      });
      ctx.strokeStyle = colors.contour;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(14, baseY); ctx.lineTo(w - 14, baseY); ctx.stroke();

      if (frame % 24 === 0) setStats({ steps, mse, teleports });
    };

    const loop = () => {
      resize();
      draw();
      if (running) raf = requestAnimationFrame(loop);
    };
    const setRunning = () => {
      const should = !reducedMq.matches && inView && visible;
      if (should && !running) { running = true; raf = requestAnimationFrame(loop); }
      else if (!should && running) { running = false; cancelAnimationFrame(raf); }
    };

    const io = new IntersectionObserver(([e]) => { inView = e.isIntersecting; setRunning(); });
    io.observe(canvas);
    const onVis = () => { visible = !document.hidden; setRunning(); };
    document.addEventListener("visibilitychange", onVis);
    const ro = new ResizeObserver(() => { resize(); if (!running) draw(); });
    ro.observe(canvas);
    const onReduced = () => { setReduced(reducedMq.matches); setRunning(); if (reducedMq.matches) { resize(); draw(); } };
    reducedMq.addEventListener("change", onReduced);

    readColors();
    resize();
    if (reducedMq.matches) draw();
    else setRunning();

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVis);
      reducedMq.removeEventListener("change", onReduced);
      io.disconnect();
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <canvas ref={canvasRef} className="block h-[360px] w-full md:h-[400px]" aria-label="Live random surfer on the paper's six-page web" />
      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3">
        <label className="flex items-center gap-3 font-mono text-xs text-ink/70">
          <span className="uppercase tracking-[0.12em] text-ink/50">damping α</span>
          <input
            type="range"
            min={0.05}
            max={0.98}
            step={0.01}
            value={alpha}
            onChange={(e) => setAlpha(+e.target.value)}
            className="w-36 accent-[var(--flow)]"
          />
          <span className="tabular-nums text-flow">{alpha.toFixed(2)}</span>
        </label>
        <button
          type="button"
          onClick={() => { resetRef.current = true; }}
          className="border border-contour px-3 py-1 font-mono text-[0.7rem] uppercase tracking-[0.12em] text-ink/60 transition-colors hover:border-flow hover:text-flow"
        >
          reset tally
        </button>
        <span className="font-mono text-[0.7rem] tabular-nums text-ink/50">
          {stats.steps.toLocaleString()} steps · {stats.teleports.toLocaleString()} teleports · mse {stats.mse.toExponential(1)}
        </span>
      </div>
      <p className="mt-2 font-mono text-[0.68rem] leading-relaxed text-ink/45">
        {reduced
          ? "exact stationary distribution shown; the live surfer respects your reduced-motion setting."
          : "teal bars: exact eigenvector. dark bars: where the surfer has actually been. red arcs are teleports. note E holding at (1−α)/6: nothing links to it."}
      </p>
    </div>
  );
}
