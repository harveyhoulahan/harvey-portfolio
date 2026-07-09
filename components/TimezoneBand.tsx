"use client";

/*
 * The timezone question, answered before it's asked. A 24-hour band drawn in
 * the visitor's own clock: their working day, my working day mapped into it,
 * and the live overlap counted. Auto-detects their timezone via Intl, with
 * city presets. Renders after mount only — the server can't know their clock.
 */

import { useEffect, useMemo, useState } from "react";

const MY_TZ = "Australia/Sydney";
const MY_DAY: [number, number] = [8 * 60, 18 * 60];      // 08:00–18:00 my time
const THEIR_DAY: [number, number] = [9 * 60, 17 * 60];   // 09:00–17:00 theirs

const PRESETS: { label: string; tz: string }[] = [
  { label: "London", tz: "Europe/London" },
  { label: "Berlin", tz: "Europe/Berlin" },
  { label: "New York", tz: "America/New_York" },
  { label: "San Francisco", tz: "America/Los_Angeles" },
];

/** Current UTC offset of a timezone, in minutes (DST-correct for "now"). */
function offsetMin(tz: string): number {
  const now = new Date();
  const loc = new Date(now.toLocaleString("en-US", { timeZone: tz }));
  const utc = new Date(now.toLocaleString("en-US", { timeZone: "UTC" }));
  return Math.round((loc.getTime() - utc.getTime()) / 60000);
}

function clockIn(tz: string): string {
  return new Date().toLocaleTimeString("en-AU", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false });
}

/** A window shifted into another clock, split into segments within [0, 1440). */
function shifted(win: [number, number], shift: number): [number, number][] {
  const a = ((win[0] + shift) % 1440 + 1440) % 1440;
  const b = ((win[1] + shift) % 1440 + 1440) % 1440;
  return a < b ? [[a, b]] : [[a, 1440], [0, b]];
}

function overlapMinutes(mine: [number, number][], theirs: [number, number]): number {
  let total = 0;
  for (const [a, b] of mine) total += Math.max(0, Math.min(b, theirs[1]) - Math.max(a, theirs[0]));
  return total;
}

const W = 640, H = 64, PAD = 24;
const x = (m: number) => PAD + (m / 1440) * (W - PAD * 2);

export default function TimezoneBand() {
  const [mounted, setMounted] = useState(false);
  const [tz, setTz] = useState<string>("Europe/London");
  const [auto, setAuto] = useState<string | null>(null);

  useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (detected) { setAuto(detected); setTz(detected); }
    setMounted(true);
  }, []);

  const view = useMemo(() => {
    if (!mounted) return null;
    const shift = offsetMin(tz) - offsetMin(MY_TZ);
    const mine = shifted(MY_DAY, shift);
    const overlap = overlapMinutes(mine, THEIR_DAY);
    return { mine, overlap, yourClock: clockIn(tz), myClock: clockIn(MY_TZ) };
  }, [mounted, tz]);

  const label = auto === tz ? "your timezone" : PRESETS.find((p) => p.tz === tz)?.label ?? tz;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {auto && (
          <button
            type="button"
            onClick={() => setTz(auto)}
            className={`border px-2.5 py-1 font-mono text-[11px] tracking-[0.06em] transition-colors ${
              tz === auto ? "border-flow text-flow" : "border-contour text-ink/55 hover:text-ink"
            }`}
          >
            your timezone
          </button>
        )}
        {PRESETS.map((p) => (
          <button
            key={p.tz}
            type="button"
            onClick={() => setTz(p.tz)}
            className={`border px-2.5 py-1 font-mono text-[11px] tracking-[0.06em] transition-colors ${
              tz === p.tz && tz !== auto ? "border-flow text-flow" : "border-contour text-ink/55 hover:text-ink"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {view ? (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 w-full" role="img"
            aria-label={`Working-hours overlap between ${label} and Byron Bay: about ${Math.round(view.overlap / 60)} hours of shared time on a normal day.`}>
            {/* track + ticks */}
            <rect x={x(0)} y={26} width={x(1440) - x(0)} height={14} fill="var(--terrace)" stroke="var(--contour)" strokeWidth={1} />
            {[0, 6, 12, 18, 24].map((h) => (
              <g key={h}>
                <line x1={x(h * 60)} x2={x(h * 60)} y1={24} y2={42} stroke="var(--contour)" strokeWidth={1} />
                <text x={x(h * 60)} y={56} textAnchor="middle" fontSize={9.5} fill="var(--ink)" opacity={0.45} fontFamily="var(--font-mono), monospace">
                  {String(h).padStart(2, "0")}:00
                </text>
              </g>
            ))}
            {/* their day */}
            <rect x={x(THEIR_DAY[0])} y={26} width={x(THEIR_DAY[1]) - x(THEIR_DAY[0])} height={14} fill="var(--ink)" opacity={0.14} />
            {/* my day, in their clock */}
            {view.mine.map(([a, b]) => (
              <rect key={a} x={x(a)} y={26} width={x(b) - x(a)} height={14} fill="var(--flow)" opacity={0.32} />
            ))}
            {/* the overlap, solid */}
            {view.mine.map(([a, b]) => {
              const oa = Math.max(a, THEIR_DAY[0]), ob = Math.min(b, THEIR_DAY[1]);
              return ob > oa ? <rect key={`o-${a}`} x={x(oa)} y={26} width={x(ob) - x(oa)} height={14} fill="var(--flow)" /> : null;
            })}
            <text x={x(0)} y={16} fontSize={10} fill="var(--ink)" opacity={0.55} fontFamily="var(--font-mono), monospace">
              {label}, hour by hour
            </text>
          </svg>

          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[11px] text-ink/60">
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="inline-block h-2.5 w-2.5" style={{ background: "var(--ink)", opacity: 0.14 }} />
              your 9–5
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="inline-block h-2.5 w-2.5" style={{ background: "var(--flow)", opacity: 0.32 }} />
              my day, in your clock
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="inline-block h-2.5 w-2.5" style={{ background: "var(--flow)" }} />
              live overlap
            </span>
          </div>

          <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink/70">
            Right now it&apos;s {view.yourClock} for you and {view.myClock} for me.{" "}
            {view.overlap >= 360
              ? "We share most of a working day — this is effectively local collaboration."
              : view.overlap > 0
                ? `That's ${(view.overlap / 60).toFixed(view.overlap % 60 === 0 ? 0 : 1)} hour${view.overlap === 60 ? "" : "s"} of live overlap on a normal day — and the rest lands async, so you wake up to finished work.`
                : "Our standard days don't cross — which means a full day's work lands in your inbox every morning, and I keep evenings open for calls."}
          </p>
        </>
      ) : (
        <div aria-hidden className="mt-4 h-[140px]" />
      )}
    </div>
  );
}
