"use client";

/*
 * Elevation cross-section above the footer — a hand-drawn transect from the
 * Nightcap Range to the coast. Scroll into view and press space (or tap) to
 * play a tiny transect runner: jump contour bumps along the sea-level datum.
 * Hidden on demo routes; static profile only when prefers-reduced-motion.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";

const PROFILE =
  "M0 96 L60 90 C 120 82 150 58 200 34 C 228 21 258 26 288 44 " +
  "C 318 62 348 70 388 66 C 428 62 466 42 508 38 C 548 35 578 52 618 64 " +
  "C 658 76 700 80 750 84 C 820 90 900 94 980 97 L1100 99 L1200 99";

type Mode = "idle" | "playing" | "over";

interface Obstacle {
  x: number;
  w: number;
  h: number;
}

interface GameState {
  playerY: number;
  vy: number;
  grounded: boolean;
  obstacles: Obstacle[];
  speed: number;
  score: number;
  frame: number;
  nextSpawn: number;
}

const PLAYER_W = 10;
const PLAYER_H = 14;
const PLAYER_X = 52;
const GROUND_PAD = 10;
const GRAVITY = 0.52;
const JUMP_V = -9.2;

export default function ElevationProfile() {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameState | null>(null);
  const rafRef = useRef(0);
  const [mode, setMode] = useState<Mode>("idle");
  const [inView, setInView] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [score, setScore] = useState(0);

  const initGame = useCallback((): GameState => {
    const state: GameState = {
      playerY: 0,
      vy: 0,
      grounded: true,
      obstacles: [],
      speed: 4,
      score: 0,
      frame: 0,
      nextSpawn: 70,
    };
    gameRef.current = state;
    return state;
  }, []);

  const startGame = useCallback(() => {
    if (reduceMotion) return;
    initGame();
    setScore(0);
    setMode("playing");
    setShowHint(false);
  }, [initGame, reduceMotion]);

  const jump = useCallback(() => {
    const g = gameRef.current;
    if (!g || !g.grounded) return;
    g.vy = JUMP_V;
    g.grounded = false;
  }, []);

  const endGame = useCallback(() => {
    const g = gameRef.current;
    if (g) setScore(Math.floor(g.score));
    setMode("over");
    cancelAnimationFrame(rafRef.current);
  }, []);

  const exitGame = useCallback(() => {
    setMode("idle");
    gameRef.current = null;
    cancelAnimationFrame(rafRef.current);
  }, []);

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
    if (!inView || mode !== "idle" || reduceMotion) {
      setShowHint(false);
      return;
    }
    const t = window.setTimeout(() => setShowHint(true), 900);
    return () => window.clearTimeout(t);
  }, [inView, mode, reduceMotion]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (reduceMotion) return;

      if (e.code === "Escape") {
        if (mode !== "idle") {
          e.preventDefault();
          exitGame();
        }
        return;
      }

      if (e.code !== "Space") return;

      if (mode === "idle" && inView) {
        e.preventDefault();
        startGame();
        return;
      }
      if (mode === "playing") {
        e.preventDefault();
        jump();
        return;
      }
      if (mode === "over") {
        e.preventDefault();
        startGame();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inView, mode, startGame, jump, exitGame, reduceMotion]);

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

    const spawn = (g: GameState, width: number) => {
      g.obstacles.push({
        x: width + 24,
        w: 12 + Math.random() * 20,
        h: 9 + Math.random() * 16,
      });
      g.nextSpawn = 58 + Math.random() * 42;
    };

    const loop = () => {
      const g = gameRef.current;
      if (!g) return;

      const w = container.clientWidth;
      const h = container.clientHeight;
      const groundY = h - GROUND_PAD;
      const flow = getComputedStyle(document.documentElement)
        .getPropertyValue("--flow")
        .trim();
      const ink = getComputedStyle(document.documentElement)
        .getPropertyValue("--foreground")
        .trim();

      g.frame += 1;
      g.score += g.speed * 0.1;
      if (g.frame % 120 === 0) g.speed = Math.min(g.speed + 0.2, 8.5);

      g.nextSpawn -= 1;
      if (g.nextSpawn <= 0) spawn(g, w);

      g.vy += GRAVITY;
      g.playerY += g.vy;
      if (g.playerY >= 0) {
        g.playerY = 0;
        g.vy = 0;
        g.grounded = true;
      }

      g.obstacles.forEach((o) => {
        o.x -= g.speed;
      });
      g.obstacles = g.obstacles.filter((o) => o.x + o.w > -12);

      const playerTop = groundY - PLAYER_H + g.playerY;
      const playerBottom = groundY + g.playerY;

      for (const o of g.obstacles) {
        const hillTop = groundY - o.h;
        const hitX = PLAYER_X + PLAYER_W > o.x + 2 && PLAYER_X < o.x + o.w - 2;
        const hitY = playerBottom > hillTop + 2 && playerTop < groundY;
        if (hitX && hitY) {
          endGame();
          return;
        }
      }

      ctx.clearRect(0, 0, w, h);

      for (const o of g.obstacles) {
        ctx.beginPath();
        ctx.moveTo(o.x, groundY);
        ctx.quadraticCurveTo(o.x + o.w / 2, groundY - o.h * 1.25, o.x + o.w, groundY);
        ctx.strokeStyle = flow;
        ctx.lineWidth = 1.5;
        ctx.lineCap = "round";
        ctx.stroke();
        ctx.fillStyle = flow;
        ctx.globalAlpha = 0.1;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      ctx.fillStyle = flow;
      ctx.fillRect(PLAYER_X, playerTop, PLAYER_W, PLAYER_H);
      ctx.fillStyle = ink;
      ctx.globalAlpha = 0.55;
      ctx.fillRect(PLAYER_X + 3, playerTop + 4, 4, 3);
      ctx.globalAlpha = 1;

      ctx.font = '10px var(--font-mono), "JetBrains Mono", ui-monospace, monospace';
      ctx.fillStyle = ink;
      ctx.globalAlpha = 0.45;
      ctx.fillText(`${Math.floor(g.score)}m`, w - 52, 13);
      ctx.globalAlpha = 1;

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [mode, endGame]);

  const handlePointer = useCallback(() => {
    if (reduceMotion) return;
    if (mode === "idle" && inView) startGame();
    else if (mode === "playing") jump();
    else if (mode === "over") startGame();
  }, [mode, inView, startGame, jump, reduceMotion]);

  if (pathname === "/genesis" || pathname === "/catchment") return null;

  const playing = mode === "playing" || mode === "over";

  return (
    <div
      ref={containerRef}
      className={`relative h-16 w-full md:h-20 ${playing ? "cursor-pointer" : ""}`}
      onPointerDown={handlePointer}
      role={playing ? "application" : undefined}
      aria-label={
        playing
          ? "Transect runner — tap or press space to jump"
          : showHint
            ? "Press space to play transect runner"
            : undefined
      }
    >
      <svg
        viewBox="0 0 1200 110"
        preserveAspectRatio="none"
        className="pointer-events-none block h-full w-full select-none"
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
        className={`absolute inset-0 touch-manipulation ${playing ? "opacity-100" : "pointer-events-none opacity-0"}`}
        aria-hidden={!playing}
      />

      {showHint && mode === "idle" && !reduceMotion && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="pointer-events-none absolute bottom-1.5 right-3 font-mono text-[9px] uppercase tracking-[0.14em] text-ink/40"
        >
          space · run transect
        </motion.p>
      )}

      {mode === "over" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-paper/55 backdrop-blur-[1px]">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/70">
            {score}m · space to retry · esc to quit
          </p>
        </div>
      )}
    </div>
  );
}
