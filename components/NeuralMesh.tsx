"use client";

/*
 * Neural mesh — a quiet plexus strip. Square benchmark nodes drift slowly,
 * edges fade in and out with proximity, and every second or so a signal
 * fires and propagates a few hops through the network, the way activations
 * hop layers. The cursor gently excites nearby nodes.
 *
 * Zero dependencies, one 2D canvas. Colors come from the CSS custom
 * properties so light and dark themes both grade correctly. Pauses when
 * off-screen or the tab is hidden; renders one static frame under
 * prefers-reduced-motion.
 */

import { useEffect, useRef } from "react";

interface Node {
  bx: number; // base position
  by: number;
  ax: number; // drift amplitude
  ay: number;
  px: number; // phase
  py: number;
  sp: number; // drift speed
  accent: boolean;
  x: number; // resolved per-frame
  y: number;
}
interface Pulse {
  path: number[]; // node indices
  seg: number; // current segment
  t: number; // 0..1 along segment
  speed: number;
}

const NODE_AREA = 17000; // one node per this many px² — density scales with area
const EDGE_R = 132;

export default function NeuralMesh({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reducedMq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = reducedMq.matches;

    let nodes: Node[] = [];
    let pulses: Pulse[] = [];
    let raf = 0;
    let running = false;
    let inView = true;
    let visible = !document.hidden;
    let nextFire = 40;
    let frame = 0;
    let mouse: [number, number] | null = null;
    let colors = { ink: "#161f1b", flow: "#14655a", infra: "#b23a18" };

    const readColors = () => {
      const css = getComputedStyle(document.documentElement);
      const v = (n: string, fb: string) => css.getPropertyValue(n).trim() || fb;
      colors = {
        ink: v("--foreground", "#161f1b"),
        flow: v("--flow", "#14655a"),
        infra: v("--infra", "#b23a18"),
      };
    };

    const isDark = () => document.documentElement.classList.contains("dark");

    const build = (w: number, h: number) => {
      const count = Math.min(64, Math.max(12, Math.round((w * h) / NODE_AREA)));
      // jittered grid so coverage stays even at any aspect ratio
      const cols = Math.max(3, Math.round(Math.sqrt((count * w) / Math.max(1, h))));
      const rows = Math.max(2, Math.ceil(count / cols));
      nodes = [];
      for (let i = 0; i < count; i++) {
        const gx = i % cols;
        const gy = Math.floor(i / cols);
        const bx = ((gx + 0.2 + Math.random() * 0.6) / cols) * w;
        const by = ((gy + 0.2 + Math.random() * 0.6) / rows) * h;
        nodes.push({
          bx, by,
          ax: 6 + Math.random() * 10,
          ay: 5 + Math.random() * 9,
          px: Math.random() * Math.PI * 2,
          py: Math.random() * Math.PI * 2,
          sp: 0.25 + Math.random() * 0.4,
          accent: Math.random() < 0.2,
          x: bx, y: by,
        });
      }
      pulses = [];
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.floor(rect.width * dpr));
      const h = Math.max(1, Math.floor(rect.height * dpr));
      if (canvas.width !== w || canvas.height !== h || nodes.length === 0) {
        canvas.width = w;
        canvas.height = h;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        build(rect.width, rect.height);
      }
    };

    const neighbors = (i: number) => {
      const out: number[] = [];
      for (let j = 0; j < nodes.length; j++) {
        if (j === i) continue;
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        if (dx * dx + dy * dy < EDGE_R * EDGE_R) out.push(j);
      }
      return out;
    };

    const firePulse = () => {
      const start = Math.floor(Math.random() * nodes.length);
      const path = [start];
      let cur = start;
      const hops = 2 + Math.floor(Math.random() * 3);
      for (let k = 0; k < hops; k++) {
        const ns = neighbors(cur).filter((n) => !path.includes(n));
        if (!ns.length) break;
        cur = ns[Math.floor(Math.random() * ns.length)];
        path.push(cur);
      }
      if (path.length > 1) {
        pulses.push({ path, seg: 0, t: 0, speed: 0.028 + Math.random() * 0.02 });
      }
    };

    const draw = (animate: boolean) => {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      ctx.clearRect(0, 0, w, h);
      if (frame % 120 === 0) readColors();
      frame++;

      const t = frame * 0.016;

      // resolve node positions (drift + gentle cursor excitement)
      for (const n of nodes) {
        n.x = n.bx + (animate ? Math.sin(t * n.sp + n.px) * n.ax : 0);
        n.y = n.by + (animate ? Math.cos(t * n.sp * 0.8 + n.py) * n.ay : 0);
        if (mouse && animate) {
          const dx = mouse[0] - n.x;
          const dy = mouse[1] - n.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 90 * 90) {
            const k = (1 - Math.sqrt(d2) / 90) * 0.12;
            n.x += dx * k;
            n.y += dy * k;
          }
        }
      }

      // edges — readable on light paper; soft but visible on dark charcoal
      const dark = isDark();
      ctx.lineWidth = dark ? 1.05 : 1.15;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d > EDGE_R) continue;
          let alpha = (1 - d / EDGE_R) * (dark ? 0.36 : 0.52);
          if (mouse) {
            const mx = (a.x + b.x) / 2 - mouse[0];
            const my = (a.y + b.y) / 2 - mouse[1];
            if (mx * mx + my * my < 100 * 100) alpha *= 2.1;
          }
          ctx.strokeStyle = colors.ink;
          ctx.globalAlpha = Math.min(dark ? 0.68 : 0.82, alpha);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;

      // nodes: square benchmarks, a few in channel accent
      for (const n of nodes) {
        const s = n.accent ? 4 : 2.8;
        ctx.fillStyle = n.accent ? colors.flow : colors.ink;
        ctx.globalAlpha = n.accent ? 0.9 : 0.6;
        ctx.fillRect(n.x - s / 2, n.y - s / 2, s, s);
      }
      ctx.globalAlpha = 1;

      // pulses: a signal travelling hop by hop, with a short comet tail
      if (animate) {
        for (let pi = pulses.length - 1; pi >= 0; pi--) {
          const p = pulses[pi];
          const a = nodes[p.path[p.seg]];
          const b = nodes[p.path[p.seg + 1]];
          if (!a || !b) { pulses.splice(pi, 1); continue; }
          p.t += p.speed;
          if (p.t >= 1) {
            p.t = 0;
            p.seg++;
            if (p.seg >= p.path.length - 1) { pulses.splice(pi, 1); continue; }
          }
          const x = a.x + (b.x - a.x) * p.t;
          const y = a.y + (b.y - a.y) * p.t;
          const tail = Math.max(0, p.t - 0.22);
          ctx.strokeStyle = colors.infra;
          ctx.globalAlpha = 0.5;
          ctx.beginPath();
          ctx.moveTo(a.x + (b.x - a.x) * tail, a.y + (b.y - a.y) * tail);
          ctx.lineTo(x, y);
          ctx.stroke();
          ctx.globalAlpha = 0.95;
          ctx.fillStyle = colors.infra;
          ctx.fillRect(x - 1.7, y - 1.7, 3.4, 3.4);
          ctx.globalAlpha = 1;
        }
        nextFire--;
        if (nextFire <= 0 && pulses.length < 5) {
          firePulse();
          nextFire = 45 + Math.random() * 70;
        }
      }
    };

    const loop = () => {
      resize();
      draw(true);
      if (running) raf = requestAnimationFrame(loop);
    };
    const setRunning = () => {
      const should = !reduced && inView && visible;
      if (should && !running) {
        running = true;
        raf = requestAnimationFrame(loop);
      } else if (!should && running) {
        running = false;
        cancelAnimationFrame(raf);
      }
    };

    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      if (
        e.clientX >= r.left && e.clientX <= r.right &&
        e.clientY >= r.top && e.clientY <= r.bottom
      ) {
        mouse = [e.clientX - r.left, e.clientY - r.top];
      } else {
        mouse = null;
      }
    };
    if (window.matchMedia("(pointer: fine)").matches && !reduced) {
      window.addEventListener("pointermove", onMove, { passive: true });
    }

    const io = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      setRunning();
    });
    io.observe(canvas);
    const onVis = () => {
      visible = !document.hidden;
      setRunning();
    };
    document.addEventListener("visibilitychange", onVis);
    const ro = new ResizeObserver(() => {
      resize();
      if (!running) draw(!reduced);
    });
    ro.observe(canvas);
    const onReduced = () => {
      reduced = reducedMq.matches;
      setRunning();
      if (reduced) { resize(); draw(false); }
    };
    reducedMq.addEventListener("change", onReduced);

    readColors();
    resize();
    if (reduced) draw(false);
    else setRunning();

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", onVis);
      reducedMq.removeEventListener("change", onReduced);
      io.disconnect();
      ro.disconnect();
    };
  }, []);

  return <canvas ref={ref} aria-hidden className={className} />;
}
