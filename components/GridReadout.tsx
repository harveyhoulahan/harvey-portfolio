"use client";

/*
 * Live grid reference — a surveyor's readout pinned to the hero corner that
 * tracks the cursor as coordinates around Byron Bay, like the coordinate
 * strip on a GIS viewport. Decorative chrome (aria-hidden), fine pointers
 * only, rAF-throttled. Shows the true site coordinates until the cursor moves.
 *
 * Easter egg: click it to flip between decimal degrees and DMS notation.
 */

import { useEffect, useRef, useState } from "react";

const BASE = { lng: 153.6122, lat: 28.6431 };

function toDMS(v: number) {
  const d = Math.floor(v);
  const mf = (v - d) * 60;
  const m = Math.floor(mf);
  const s = Math.round((mf - m) * 60);
  return `${d}°${String(m).padStart(2, "0")}′${String(s).padStart(2, "0")}″`;
}

export default function GridReadout() {
  const [pos, setPos] = useState({ lng: BASE.lng, lat: BASE.lat });
  const [dms, setDms] = useState(false);
  const raf = useRef(0);

  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(() => {
        setPos({
          lng: BASE.lng - 0.06 + (e.clientX / window.innerWidth) * 0.12,
          lat: BASE.lat - 0.06 + (e.clientY / window.innerHeight) * 0.12,
        });
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf.current);
    };
  }, []);

  const txt = dms
    ? `${toDMS(pos.lng)}E · ${toDMS(pos.lat)}S`
    : `${pos.lng.toFixed(4)}°E · ${pos.lat.toFixed(4)}°S`;

  return (
    <div className="mt-5 flex w-full justify-center md:mt-6">
      <button
        type="button"
        aria-hidden
        tabIndex={-1}
        onClick={() => setDms((v) => !v)}
        className="flex cursor-crosshair items-center gap-2 font-mono text-[10px] tabular-nums tracking-[0.08em] text-ink/45 transition-colors hover:text-ink/70"
      >
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
          <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1" />
          <path
            d="M6 0v3M6 9v3M0 6h3M9 6h3"
            stroke="currentColor"
            strokeWidth="1"
          />
        </svg>
        {txt}
      </button>
    </div>
  );
}
