"use client";

/*
 * Scroll-triggered replay of one production run — lines stagger in like a
 * live terminal; the predict progress bar fills; a cursor rests on [done].
 */

import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";

type LogKind = "cmd" | "ok" | "dim" | "run";

type LogLine = { kind: LogKind; text: string };

const LOG_LINES: LogLine[] = [
  { kind: "cmd", text: "$ python predict_11layer.py --delivery <station>_jilin_50cm" },
  { kind: "dim", text: "[finetune] epoch 2870 · 256/256 · 6.49 it/s · val_loss 0.01334 → checkpoint saved" },
  { kind: "dim", text: "[finetune] epoch 2974 · 256/256 · 6.49 it/s · val_loss 0.01069 → checkpoint saved" },
  { kind: "ok", text: "[finetune] epoch 3060 · 256/240 · 6.49 it/s · val_loss 0.00955 → checkpoint saved" },
  { kind: "dim", text: "[finetune] Trainer.fit stopped: max_steps reached · restoring best checkpoint" },
  { kind: "run", text: "[predict]  Predicting ━━━━━━━━━━━━━━━━ 975/975 · 0:07:24 · 7.99 it/s" },
  { kind: "dim", text: "[merge]    building VRT · merging 2,252 prediction tiles" },
  { kind: "ok", text: "[merge]    station-scale cover raster written · ZSTD · thumbnails to level 16" },
  { kind: "ok", text: "[done]     prediction completed. all resources cleaned up." },
];

const PREDICT_IDX = 5;
const BAR_LEN = 16;
const LINE_MS = 380;
const PREDICT_MS = 2400;

const COLOR: Record<LogKind, string> = {
  cmd: "#F7F5F0",
  ok: "#A9C49B",
  run: "#C4A882",
  dim: "rgba(247,245,240,0.42)",
};

function formatPredict(filled: number, total: number) {
  const pct = Math.min(1, filled / total);
  const n = Math.round(pct * total);
  const bars = Math.round(pct * BAR_LEN);
  const empty = "░".repeat(Math.max(0, BAR_LEN - bars));
  const full = "━".repeat(bars);
  const secs = Math.round(pct * 7 * 60 + 24 * pct);
  const mm = Math.floor(secs / 60);
  const ss = String(secs % 60).padStart(2, "0");
  const speed = (7.2 + pct * 0.79).toFixed(2);
  return `[predict]  Predicting ${full}${empty} ${n}/${total} · 0:${mm}:${ss} · ${speed} it/s`;
}

function PredictLine({ active, done }: { active: boolean; done: boolean }) {
  const [filled, setFilled] = useState(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!active) return;
    if (reduceMotion) {
      setFilled(975);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / PREDICT_MS);
      const eased = 1 - (1 - t) ** 2.2;
      setFilled(Math.round(eased * 975));
      if (t < 1) raf = requestAnimationFrame(tick);
      else setFilled(975);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, reduceMotion]);

  const text = done || !active
    ? LOG_LINES[PREDICT_IDX].text
    : formatPredict(filled, 975);

  return (
    <motion.span
      style={{ color: COLOR.run }}
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.28, ease: [0.2, 0.6, 0.2, 1] }}
    >
      {text}
    </motion.span>
  );
}

export default function ProductionLog() {
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { once: true, margin: "-10% 0px" });
  const reduceMotion = useReducedMotion();
  const [visibleCount, setVisibleCount] = useState(0);
  const [predictDone, setPredictDone] = useState(false);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (!inView) return;
    if (reduceMotion) {
      setVisibleCount(LOG_LINES.length);
      setPredictDone(true);
      setFinished(true);
      return;
    }

    let cancelled = false;
    let t = 0;

    const showNext = (i: number) => {
      if (cancelled) return;
      setVisibleCount(i + 1);
      if (i === PREDICT_IDX) {
        t = window.setTimeout(() => {
          if (cancelled) return;
          setPredictDone(true);
          showNext(i + 1);
        }, PREDICT_MS + 180);
        return;
      }
      if (i >= LOG_LINES.length - 1) {
        t = window.setTimeout(() => { if (!cancelled) setFinished(true); }, 320);
        return;
      }
      t = window.setTimeout(() => showNext(i + 1), LINE_MS);
    };

    t = window.setTimeout(() => showNext(0), 220);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [inView, reduceMotion]);

  const playing = inView && visibleCount > 0 && !finished;

  return (
    <motion.div
      ref={rootRef}
      className="relative overflow-hidden border border-contour bg-[#1a1a18] px-4 py-4 font-mono text-[11px] leading-relaxed"
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={inView ? { opacity: 1 } : {}}
      transition={{ duration: 0.5, ease: [0.2, 0.6, 0.2, 1] }}
    >
      {/* faint scan + left accent while the run plays */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-px bg-[#8FAE83]"
        initial={{ opacity: 0, scaleY: 0.3 }}
        animate={{ opacity: playing ? 0.55 : finished ? 0.25 : 0, scaleY: 1 }}
        transition={{ duration: 0.6 }}
        style={{ transformOrigin: "top" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(247,245,240,0.5) 2px, rgba(247,245,240,0.5) 3px)",
        }}
      />

      <div className="relative space-y-0.5" aria-live="polite">
        {LOG_LINES.map((line, i) => {
          const shown = i < visibleCount;
          const ghost =
            i === LOG_LINES.length - 1
              ? `${line.text}\u00a0█`
              : i === PREDICT_IDX
                ? LOG_LINES[PREDICT_IDX].text
                : line.text;

          return (
            <div key={i} className="relative">
              {/* reserves height so content below never shifts */}
              <div className="invisible whitespace-pre-wrap break-words" aria-hidden>
                {ghost}
              </div>
              <div
                className={`absolute inset-x-0 top-0 whitespace-pre-wrap break-words transition-opacity duration-200 ${
                  shown ? "opacity-100" : "pointer-events-none opacity-0"
                }`}
              >
                {shown && i === PREDICT_IDX && !predictDone ? (
                  <PredictLine active={shown} done={false} />
                ) : shown ? (
                  <motion.div
                    style={{ color: COLOR[line.kind] }}
                    initial={reduceMotion ? false : { opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.28, ease: [0.2, 0.6, 0.2, 1] }}
                  >
                    {line.text}
                    {finished && i === LOG_LINES.length - 1 && !reduceMotion && (
                      <motion.span
                        aria-hidden
                        className="ml-0.5 inline-block h-[1.05em] w-[0.45em] translate-y-[0.06em] bg-[#8FAE83]/70"
                        animate={{ opacity: [1, 1, 0, 0] }}
                        transition={{ duration: 1.1, repeat: Infinity, times: [0, 0.45, 0.5, 1] }}
                      />
                    )}
                  </motion.div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
