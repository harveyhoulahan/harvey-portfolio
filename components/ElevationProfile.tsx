"use client";

/*
 * Elevation cross-section above the footer, and a secret runner.
 *
 * Idle: the hand-drawn transect from the Nightcap Range to the coast.
 * Space (or tap): you become the plotter pen and run the survey line.
 *
 * The game is built on runner fundamentals that make one button feel rich:
 *  - variable jump height (hold to float, release to cut)
 *  - coyote time + input buffering, so near-misses resolve in your favour
 *  - fast-fall (down / S) for expressive landings
 * Three obstacle families in the site's contour language: nested-loop hills
 * you clear, water channels that break the datum line, and drifting survey
 * flocks overhead that punish jumping. Patterns are curated per speed tier,
 * not pure RNG. Distance is chainage in metres; the pen draws its own path;
 * benchmarks every 250 m; personal best in localStorage.
 * Hidden on demo routes; static profile only under prefers-reduced-motion.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { SITE_TERMINAL_VISIBILITY_EVENT } from "@/components/SiteTerminal";

const PROFILE =
  "M0 96 L60 90 C 120 82 150 58 200 34 C 228 21 258 26 288 44 " +
  "C 318 62 348 70 388 66 C 428 62 466 42 508 38 C 548 35 578 52 618 64 " +
  "C 658 76 700 80 750 84 C 820 90 900 94 980 97 L1100 99 L1200 99";

type Mode = "idle" | "playing" | "over";

type ObKind = "hill" | "channel" | "flock";
interface Ob {
  kind: ObKind;
  x: number;
  w: number;
  h: number; // hill height / flock altitude
  seed: number;
  cleared?: boolean;
}
interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  text?: string;
}
interface Flag {
  x: number;
  m: number;
  passed?: boolean;
}
interface G {
  dist: number; // world px travelled
  speed: number;
  frame: number;
  // pen
  py: number; // offset above ground (<= 0 while airborne)
  vy: number;
  grounded: boolean;
  fellIn: boolean; // dropped into a channel
  coyote: number;
  buffer: number;
  holding: boolean;
  squash: number; // frames since landing
  trail: { y: number; s: number }[];
  // world
  obstacles: Ob[];
  flags: Flag[];
  sparks: Spark[];
  spawnIn: number; // px until next pattern
  nextFlagM: number;
  // meta
  best: number;
  newBest: boolean;
  dying: number; // frames since death, 0 = alive
  colors: { flow: string; ink: string; infra: string; contour: string };
  font: string;
  lastT: number;
}

const PEN_W = 10;

/** Pen anchor — ~17–24% of strip width so wide viewports don't hug the left edge. */
function penX(w: number): number {
  const min = 64;
  const target = w * 0.17;
  const max = w * 0.24;
  return Math.round(Math.min(Math.max(min, target), max));
}
const PEN_H = 14;
const GROUND_PAD = 12;
const JUMP_V = -7.4;
const G_HOLD = 0.55; // floatier while held and rising
const G_FALL = 0.95;
const CUT = 0.45; // velocity kept when releasing early
const FASTFALL = 2.6;
const COYOTE = 6;
const BUFFER = 8;
const M_PER_PX = 0.12;
const PB_KEY = "hjh-transect-pb";
const FLAG_W = 10;
const FLAG_CLEAR = 30; // min px between a flag pole and a hill / channel

function rangesOverlap(a0: number, a1: number, b0: number, b1: number) {
  return a0 < b1 && a1 > b0;
}

/** Hills and channels occupy the datum — keep benchmark flags out of their span. */
function flagNearGroundObstacle(flagX: number, obstacles: Ob[]) {
  const left = flagX - 6;
  const right = flagX + FLAG_W + 6;
  for (const o of obstacles) {
    if (o.kind === "flock") continue;
    if (rangesOverlap(left, right, o.x - FLAG_CLEAR, o.x + o.w + FLAG_CLEAR)) return true;
  }
  return false;
}

function findClearFlagX(w: number, obstacles: Ob[]) {
  let fx = w + 24;
  for (let i = 0; i < 80; i++) {
    if (!flagNearGroundObstacle(fx, obstacles)) return fx;
    fx += 18;
  }
  let fallback = w + 24;
  for (const o of obstacles) {
    if (o.kind !== "flock") fallback = Math.max(fallback, o.x + o.w + FLAG_CLEAR + 8);
  }
  return fallback;
}

/** When spawning patterns, nudge hills/channels past any flags already queued. */
function clearObstacleX(x: number, w: number, kind: ObKind, flags: Flag[]) {
  if (kind === "flock") return x;
  let ox = x;
  for (const f of flags) {
    if (rangesOverlap(ox, ox + w, f.x - FLAG_CLEAR, f.x + FLAG_W + FLAG_CLEAR)) {
      ox = f.x + FLAG_W + FLAG_CLEAR + 6;
    }
  }
  return ox;
}

// Curated spawn patterns per speed tier. dx = extra px after previous item.
type P = { kind: ObKind; w: number; h: number; dx: number }[];
const hill = (h: number, w: number, dx = 0): P[number] => ({ kind: "hill", h, w, dx });
const chan = (w: number, dx = 0): P[number] => ({ kind: "channel", w, h: 0, dx });
const flock = (dx = 0): P[number] => ({ kind: "flock", w: 30, h: 38, dx });
const TIERS: P[][] = [
  [[hill(13, 26)], [hill(19, 34)], [chan(34)], [hill(15, 30)]],
  [
    [hill(26, 42)],
    [hill(13, 26), hill(13, 26, 20)],
    [chan(46)],
    [flock()],
    [hill(21, 36)],
  ],
  [
    [chan(62)],
    [hill(20, 34), chan(38, 30)],
    [flock(), hill(14, 28, 26)],
    [hill(28, 46)],
  ],
  [
    [hill(13, 26), hill(14, 26, 16), hill(13, 26, 16)],
    [chan(48), flock(28)],
    [hill(30, 48), chan(44, 24)],
    [flock(), chan(40, 24)],
  ],
];

export default function ElevationProfile() {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const g = useRef<G | null>(null);
  const rafRef = useRef(0);
  const terminalOpenRef = useRef(false);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("idle");
  const [inView, setInView] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [result, setResult] = useState({ m: 0, pb: 0, newBest: false });
  const [coarse, setCoarse] = useState(false);

  useEffect(() => {
    setCoarse(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  const readTheme = () => {
    const css = getComputedStyle(document.documentElement);
    const v = (name: string, fb: string) => css.getPropertyValue(name).trim() || fb;
    const fam = v("--font-mono", "") || "ui-monospace, monospace";
    return {
      colors: {
        flow: v("--flow", "#14655a"),
        ink: v("--foreground", "#161f1b"),
        infra: v("--infra", "#b23a18"),
        contour: v("--contour", "#c3ccc2"),
      },
      font: `10px ${fam}`,
    };
  };

  const startGame = useCallback(() => {
    if (reduceMotion) return;
    const theme = readTheme();
    let best = 0;
    try { best = Number(localStorage.getItem(PB_KEY) || 0); } catch { /* private mode */ }
    g.current = {
      dist: 0, speed: 4.1, frame: 0,
      py: -64, vy: 0, grounded: false, fellIn: false, // drop in from the sky
      coyote: 0, buffer: 0, holding: false, squash: 99,
      trail: [], obstacles: [], flags: [], sparks: [],
      spawnIn: 320, nextFlagM: 250,
      best, newBest: false, dying: 0,
      ...theme, lastT: performance.now(),
    };
    setMode("playing");
    setShowHint(false);
  }, [reduceMotion]);

  const pressJump = useCallback(() => {
    const s = g.current;
    if (!s || s.dying) return;
    s.holding = true;
    if (s.grounded || s.coyote > 0) {
      s.vy = JUMP_V;
      s.grounded = false;
      s.coyote = 0;
    } else {
      s.buffer = BUFFER;
    }
  }, []);

  const releaseJump = useCallback(() => {
    const s = g.current;
    if (!s) return;
    s.holding = false;
    if (s.vy < 0) s.vy *= CUT; // jump cut = variable height
  }, []);

  const exitGame = useCallback(() => {
    setMode("idle");
    g.current = null;
    cancelAnimationFrame(rafRef.current);
  }, []);

  // Footer runner yields to the site shell — space is for typing, not jumping.
  useEffect(() => {
    const onVis = (e: Event) => {
      const open = (e as CustomEvent<{ open: boolean }>).detail.open;
      terminalOpenRef.current = open;
      setTerminalOpen(open);
      if (open) {
        exitGame();
        setShowHint(false);
      }
    };
    window.addEventListener(SITE_TERMINAL_VISIBILITY_EVENT, onVis);
    return () => window.removeEventListener(SITE_TERMINAL_VISIBILITY_EVENT, onVis);
  }, [exitGame]);

  const gameInputBlocked = useCallback((e?: { target?: EventTarget | null }) => {
    if (terminalOpenRef.current) return true;
    const t = e?.target as HTMLElement | null;
    return !!(t?.closest(".st-root") || t?.closest("input, textarea, [contenteditable='true']"));
  }, []);

  // in-view gate for the space hint + start
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting && entry.intersectionRatio > 0.3),
      { threshold: [0, 0.3, 0.55] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!inView || mode !== "idle" || reduceMotion || terminalOpen) {
      setShowHint(false);
      return;
    }
    const t = window.setTimeout(() => setShowHint(true), 900);
    return () => window.clearTimeout(t);
  }, [inView, mode, reduceMotion, terminalOpen]);

  // keyboard
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (reduceMotion || gameInputBlocked(e)) return;
      if (e.code === "Escape" && mode !== "idle") {
        e.preventDefault();
        exitGame();
        return;
      }
      const isJump = e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW";
      const isDive = e.code === "ArrowDown" || e.code === "KeyS";
      if (mode === "playing" && isDive) {
        e.preventDefault();
        const s = g.current;
        if (s && !s.grounded && !s.dying) s.vy = Math.max(s.vy, 0) + FASTFALL;
        return;
      }
      if (!isJump) return;
      if (e.repeat) { e.preventDefault(); return; }
      if (mode === "idle" && inView && e.code === "Space") {
        e.preventDefault();
        startGame();
      } else if (mode === "playing") {
        e.preventDefault();
        pressJump();
      } else if (mode === "over" && e.code === "Space") {
        e.preventDefault();
        startGame();
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (gameInputBlocked(e)) return;
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") releaseJump();
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [inView, mode, startGame, pressJump, releaseJump, exitGame, reduceMotion, gameInputBlocked]);

  // game loop
  useEffect(() => {
    if (mode !== "playing") return;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const die = (s: G, px: number) => {
      if (s.dying) return;
      s.dying = 1;
      const m = Math.floor(s.dist * M_PER_PX);
      s.newBest = m > s.best;
      if (s.newBest) {
        try { localStorage.setItem(PB_KEY, String(m)); } catch { /* private mode */ }
      }
      // the pen shatters into survey ticks
      for (let i = 0; i < 7; i++) {
        s.sparks.push({
          x: px + PEN_W / 2, y: 0, // y resolved at draw time (ground-relative)
          vx: -2.2 + Math.random() * 4.4, vy: -3.4 - Math.random() * 2.4,
          age: 0, life: 26 + Math.random() * 14,
        });
      }
    };

    const spawnPattern = (s: G, w: number) => {
      const tier = s.speed < 5.2 ? 0 : s.speed < 6.4 ? 1 : s.speed < 7.6 ? 2 : 3;
      const pool = TIERS[Math.min(tier, TIERS.length - 1)];
      const pat = pool[Math.floor(Math.random() * pool.length)];
      let x = w + 30;
      for (const item of pat) {
        x += item.dx;
        x = clearObstacleX(x, item.w, item.kind, s.flags);
        s.obstacles.push({ kind: item.kind, x, w: item.w, h: item.h, seed: Math.random() * 100 });
        x += item.w;
      }
      // breathing room scales with speed so patterns stay clearable
      s.spawnIn = x - w + 120 + s.speed * 26 + Math.random() * 90;
    };

    const loop = () => {
      const s = g.current;
      if (!s) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      const px = penX(w);
      const groundY = h - GROUND_PAD;
      const now = performance.now();
      const dt = Math.min(2, Math.max(0.5, (now - s.lastT) / 16.7)); // 120 Hz fair
      s.lastT = now;
      const { flow, ink, infra, contour } = s.colors;

      // ---- update ------------------------------------------------------
      if (!s.dying) {
        s.frame += dt;
        s.dist += s.speed * dt;
        s.speed = Math.min(9.4, 4.1 + s.dist * 0.00042);
        s.spawnIn -= s.speed * dt;
        if (s.spawnIn <= 0) spawnPattern(s, w);

        // benchmark flags every 250 m — never on top of a hill or channel
        const m = s.dist * M_PER_PX;
        if (m + w * M_PER_PX > s.nextFlagM) {
          s.flags.push({ x: findClearFlagX(w, s.obstacles), m: s.nextFlagM });
          s.nextFlagM += 250;
        }

        // pen physics
        const wasGrounded = s.grounded;
        s.vy += (s.holding && s.vy < 0 ? G_HOLD : G_FALL) * dt;
        s.py += s.vy * dt;

        // channel under the pen?
        const overChannel = s.obstacles.some(
          (o) => o.kind === "channel" && px + PEN_W - 3 > o.x && px + 3 < o.x + o.w,
        );
        if (s.py >= 0 && !overChannel && !s.fellIn) {
          if (!wasGrounded) {
            s.squash = 0;
            for (let i = 0; i < 3; i++) {
              s.sparks.push({
                x: px + PEN_W / 2 + (Math.random() * 10 - 5), y: -1,
                vx: (Math.random() - 0.5) * 2.6, vy: -0.8 - Math.random(),
                age: 0, life: 12 + Math.random() * 6,
              });
            }
          }
          s.py = 0; s.vy = 0; s.grounded = true; s.coyote = COYOTE;
          if (s.buffer > 0) { s.buffer = 0; s.vy = JUMP_V; s.grounded = false; }
        } else {
          if (wasGrounded && !overChannel) s.coyote = COYOTE;
          s.grounded = false;
          if (overChannel && s.py >= 0) s.fellIn = true;
          if (s.fellIn && s.py > 16) die(s, px);
        }
        if (s.coyote > 0 && !s.grounded) s.coyote -= dt;
        if (s.buffer > 0) s.buffer -= dt;
        s.squash += dt;

        // move world + collide
        for (const o of s.obstacles) o.x -= s.speed * dt;
        for (const f of s.flags) f.x -= s.speed * dt;
        s.obstacles = s.obstacles.filter((o) => o.x + o.w > -40);
        s.flags = s.flags.filter((f) => f.x > -40);

        const penBottom = groundY + s.py;
        const penTop = penBottom - PEN_H;
        for (const o of s.obstacles) {
          if (o.kind === "hill") {
            const cx = o.x + o.w / 2;
            const over = px + PEN_W - 2 > o.x + 2 && px + 2 < o.x + o.w - 2;
            if (over) {
              // crest-shaped hitbox: flanks are forgiving, the summit is not
              const t = 1 - Math.min(1, Math.abs(px + PEN_W / 2 - cx) / (o.w / 2));
              const surface = groundY - o.h * t;
              if (penBottom > surface + 2) { die(s, px); break; }
              if (!o.cleared && penBottom <= surface + 8) {
                o.cleared = true;
                if (penBottom > surface - 7) {
                  // near-miss bonus: grazed the summit and lived
                  s.dist += 4 / M_PER_PX * 0.01 * 100; // +4 m
                  s.sparks.push({ x: cx, y: -(o.h + 14), vx: 0, vy: -0.5, age: 0, life: 30, text: "+4" });
                }
              }
            }
          } else if (o.kind === "flock") {
            const fy = groundY - o.h; // flock centre altitude
            const over = px + PEN_W - 2 > o.x && px + 2 < o.x + o.w;
            if (over && penTop < fy + 7 && penBottom > fy - 7) { die(s, px); break; }
          }
        }
        for (const f of s.flags) {
          if (!f.passed && f.x < px) {
            f.passed = true;
            s.sparks.push({ x: px + 16, y: -PEN_H - 10, vx: 0.3, vy: -0.4, age: 0, life: 34, text: `${f.m}m` });
          }
        }

        // pen trail (the plotter line you draw by playing)
        s.trail.unshift({ y: s.py - PEN_H / 2, s: s.speed * dt });
        if (s.trail.length > 46) s.trail.pop();
      } else {
        s.dying += dt;
        if (s.dying > 34) {
          setResult({
            m: Math.floor(s.dist * M_PER_PX),
            pb: Math.max(s.best, Math.floor(s.dist * M_PER_PX)),
            newBest: s.newBest,
          });
          setMode("over");
          return;
        }
      }
      for (const p of s.sparks) {
        p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt;
        if (!p.text) p.vy += 0.22 * dt;
      }
      s.sparks = s.sparks.filter((p) => p.age < p.life);

      // ---- draw --------------------------------------------------------
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      if (s.dying && s.dying < 12) {
        const a = (1 - s.dying / 12) * 3;
        ctx.translate((Math.random() - 0.5) * a * 2, (Math.random() - 0.5) * a * 2);
      }
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // parallax ridgelines, two layers of faint memory-terrain
      const ridge = (par: number, base: number, amp: number, alpha: number) => {
        ctx.beginPath();
        for (let x = -8; x <= w + 8; x += 14) {
          const wx = x + s.dist * par;
          const y = groundY - base - amp * Math.sin(wx * 0.011) - amp * 0.6 * Math.sin(wx * 0.027 + 2);
          if (x === -8) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = ink; ctx.globalAlpha = alpha; ctx.lineWidth = 1;
        ctx.stroke(); ctx.globalAlpha = 1;
      };
      ridge(0.32, 26, 7, 0.07);
      ridge(0.55, 16, 5, 0.1);

      // datum line with scrolling survey ticks, broken at channels
      const gaps = s.obstacles.filter((o) => o.kind === "channel");
      ctx.strokeStyle = contour; ctx.lineWidth = 1;
      let cursor = 0;
      const segs: [number, number][] = [];
      for (const o of gaps.sort((a, b) => a.x - b.x)) {
        segs.push([cursor, Math.max(cursor, o.x)]);
        cursor = Math.max(cursor, o.x + o.w);
      }
      segs.push([cursor, w]);
      ctx.beginPath();
      for (const [a, b] of segs) { if (b > a) { ctx.moveTo(a, groundY); ctx.lineTo(b, groundY); } }
      ctx.stroke();
      const tickOff = s.dist % 50;
      for (let x = -tickOff; x < w; x += 50) {
        const idx = Math.round((x + s.dist) / 50);
        const inGap = gaps.some((o) => x > o.x && x < o.x + o.w);
        if (inGap || x < 0) continue;
        ctx.beginPath();
        ctx.moveTo(x, groundY);
        ctx.lineTo(x, groundY - (idx % 4 === 0 ? 7 : 4));
        ctx.stroke();
      }

      // obstacles
      for (const o of s.obstacles) {
        if (o.kind === "hill") {
          // nested contour loops, one ring per ~10px of height
          const rings = Math.max(1, Math.round(o.h / 10));
          for (let r = 0; r < rings; r++) {
            const k = 1 - r * (0.55 / rings);
            const hw = (o.w / 2) * k;
            const hh = o.h * k;
            const cx = o.x + o.w / 2 + Math.sin(o.seed + r) * 1.5;
            ctx.beginPath();
            ctx.moveTo(cx - hw, groundY);
            ctx.quadraticCurveTo(cx, groundY - hh * 2, cx + hw, groundY);
            ctx.strokeStyle = flow;
            ctx.globalAlpha = r === 0 ? 0.9 : 0.45;
            ctx.lineWidth = r === 0 ? 1.5 : 1;
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
        } else if (o.kind === "channel") {
          // water squiggles in the break
          ctx.strokeStyle = flow; ctx.globalAlpha = 0.6; ctx.lineWidth = 1;
          for (let l = 0; l < 2; l++) {
            ctx.beginPath();
            const wy = groundY + 4 + l * 4;
            for (let x = o.x + 4; x <= o.x + o.w - 4; x += 6) {
              const y = wy + Math.sin(x * 0.5 + s.frame * 0.12 + l * 2) * 1.6;
              if (x === o.x + 4) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
        } else {
          // flock: three drifting dashes, the survey drones
          ctx.strokeStyle = ink; ctx.globalAlpha = 0.55; ctx.lineWidth = 1.4;
          for (let d = 0; d < 3; d++) {
            const bob = Math.sin(s.frame * 0.09 + o.seed + d * 1.8) * 2.2;
            const dx = o.x + d * 10;
            const dy = groundY - o.h + d * 3 - 3 + bob;
            ctx.beginPath(); ctx.moveTo(dx, dy); ctx.lineTo(dx + 9, dy - 2); ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }
      }

      // benchmark flags
      for (const f of s.flags) {
        ctx.strokeStyle = ink; ctx.globalAlpha = 0.5; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(f.x, groundY); ctx.lineTo(f.x, groundY - 14); ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = infra;
        ctx.beginPath();
        ctx.moveTo(f.x, groundY - 14); ctx.lineTo(f.x + 8, groundY - 11.5); ctx.lineTo(f.x, groundY - 9);
        ctx.closePath(); ctx.fill();
      }

      // pen trail: the line your run draws
      if (s.trail.length > 2 && !s.dying) {
        ctx.beginPath();
        let tx = px + PEN_W / 2;
        ctx.moveTo(tx, groundY + s.trail[0].y);
        for (let i = 1; i < s.trail.length; i++) {
          tx -= s.trail[i].s;
          ctx.lineTo(tx, groundY + s.trail[i].y);
        }
        ctx.strokeStyle = infra; ctx.globalAlpha = 0.28; ctx.lineWidth = 1.2;
        ctx.stroke(); ctx.globalAlpha = 1;
      }

      // the pen: a benchmark square with squash & stretch
      if (!s.dying) {
        const stretch = Math.max(-0.16, Math.min(0.24, -s.vy * 0.024));
        const land = s.squash < 6 ? (1 - s.squash / 6) * 0.28 : 0;
        const sy = 1 + stretch - land;
        const sx = 1 - stretch + land;
        const pw = PEN_W * sx, ph = PEN_H * sy;
        const bottom = groundY + s.py;
        ctx.fillStyle = infra;
        ctx.fillRect(px + (PEN_W - pw) / 2, bottom - ph, pw, ph);
        ctx.fillStyle = ink;
        ctx.globalAlpha = 0.5;
        ctx.fillRect(px + (PEN_W - pw) / 2 + pw * 0.28, bottom - ph + ph * 0.26, pw * 0.42, ph * 0.2);
        ctx.globalAlpha = 1;
      }

      // sparks + floating text
      for (const p of s.sparks) {
        const fade = 1 - p.age / p.life;
        if (p.text) {
          ctx.font = s.font;
          ctx.fillStyle = flow; ctx.globalAlpha = 0.85 * fade;
          ctx.fillText(p.text, p.x, groundY + p.y);
        } else {
          ctx.fillStyle = infra; ctx.globalAlpha = 0.9 * fade;
          ctx.fillRect(p.x, groundY + p.y, 2.4, 2.4);
        }
        ctx.globalAlpha = 1;
      }

      // HUD: chainage right, PB left, both quiet
      ctx.font = s.font;
      const mNow = Math.floor(s.dist * M_PER_PX);
      ctx.fillStyle = s.best > 0 && mNow > s.best ? flow : ink;
      ctx.globalAlpha = 0.6;
      ctx.textAlign = "right";
      ctx.fillText(`${mNow}m`, w - 12, 14);
      ctx.textAlign = "left";
      if (s.best > 0) {
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = ink;
        ctx.fillText(`pb ${s.best}m`, 12, 14);
      }
      ctx.globalAlpha = 1;

      ctx.restore();
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [mode]);

  // pointer: press = jump (hold for height), release = cut
  const onPointerDown = useCallback(() => {
    if (reduceMotion || terminalOpenRef.current) return;
    if (mode === "idle" && inView) startGame();
    else if (mode === "playing") pressJump();
    else if (mode === "over") startGame();
  }, [mode, inView, startGame, pressJump, reduceMotion]);
  const onPointerUp = useCallback(() => releaseJump(), [releaseJump]);

  if (pathname === "/genesis" || pathname === "/catchment") return null;

  const active = mode === "playing" || mode === "over";

  return (
    <div
      ref={containerRef}
      className={`relative h-20 w-full md:h-24 ${active ? "cursor-pointer" : ""}`}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      role={active ? "application" : undefined}
      aria-label={
        active
          ? "Transect runner. Jump with space or tap, fast-fall with down, escape to quit."
          : showHint
            ? "Press space to play the transect runner"
            : undefined
      }
    >
      <svg
        viewBox="0 0 1200 110"
        preserveAspectRatio="none"
        className={`pointer-events-none block h-full w-full select-none transition-opacity duration-500 ${active ? "opacity-0" : "opacity-100"}`}
        fill="none"
        aria-hidden
      >
        <line x1="0" y1="100" x2="1200" y2="100" stroke="var(--contour)" strokeWidth="1" />
        {Array.from({ length: 24 }, (_, i) => (
          <line
            key={i}
            x1={i * 50 + 25}
            y1="100"
            x2={i * 50 + 25}
            y2={i % 4 === 0 ? 93 : 96}
            stroke="var(--contour)"
            strokeWidth="1"
          />
        ))}
        <motion.path
          d={PROFILE}
          stroke="var(--flow)"
          strokeWidth="1.6"
          strokeLinecap="round"
          initial={reduceMotion ? { pathLength: 1 } : { pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 1.8, ease: [0.65, 0, 0.35, 1] }}
        />
        <motion.g
          initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ delay: reduceMotion ? 0 : 1.1, duration: 0.5 }}
        >
          <rect x="197" y="27" width="6" height="6" fill="var(--infra)" />
        </motion.g>
      </svg>

      <canvas
        ref={canvasRef}
        className={`absolute inset-0 touch-manipulation ${active ? "opacity-100" : "pointer-events-none opacity-0"}`}
        aria-hidden={!active}
      />

      {showHint && mode === "idle" && !reduceMotion && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="pointer-events-none absolute bottom-2 right-3 md:right-5"
        >
          <div className="transect-hint">
            <span className="transect-hint-key transect-hint-key--glow">
              {coarse ? "tap" : "space"}
            </span>
            <span className="transect-hint-label">run the transect</span>
          </div>
        </motion.div>
      )}

      {mode === "over" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-paper/55 backdrop-blur-[1px]">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/70">
            {result.m}m
            {result.newBest ? (
              <span className="text-flow"> · new record</span>
            ) : (
              ` · pb ${result.pb}m`
            )}{" "}
            · space to retry · esc to quit
          </p>
        </div>
      )}
    </div>
  );
}
