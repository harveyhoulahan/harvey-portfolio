"use client";
import {
  useScroll,
  useTransform,
  motion,
  useReducedMotion,
} from "framer-motion";
import React, { useCallback, useEffect, useRef, useState } from "react";

interface TimelineEntry {
  title: string;
  content: React.ReactNode;
}

const SPINE_X = 32;

/** Subtle freehand drift — mostly straight, not ruler-perfect. */
function pencilX(y: number, seed: number) {
  const amp = 1.75;
  return (
    SPINE_X +
    Math.sin(y * 0.055 + seed * 1.4) * amp +
    Math.sin(y * 0.018 + seed * 2.2) * (amp * 0.32)
  );
}

function freehandSegment(y0: number, y1: number, seed: number) {
  if (y1 <= y0) return "";
  const step = 16;
  let d = "";
  for (let y = y0 + step; y < y1; y += step) {
    const tremor = Math.sin(y * 0.27 + seed * 5.1) * 0.35;
    const x = pencilX(y, seed) + tremor;
    d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  const xEnd = pencilX(y1, seed + 0.2) + Math.sin(y1 * 0.27 + seed * 5.1) * 0.35;
  d += ` L ${xEnd.toFixed(1)} ${y1.toFixed(1)}`;
  return d;
}

function traceRadial(cx: number, cy: number, arms: number, r: number, tilt: number, seed: number, uneven = 0) {
  let d = ` L ${cx.toFixed(1)} ${cy.toFixed(1)}`;
  for (let i = 0; i < arms; i++) {
    const rv = 1 + Math.sin(seed + i * 1.7) * uneven;
    const wobble = Math.sin(seed + i * 2.3) * 0.12;
    const a = tilt + (i * Math.PI * 2) / arms + wobble;
    const ax = cx + Math.cos(a) * r * rv;
    const ay = cy + Math.sin(a) * r * rv;
    d += ` L ${ax.toFixed(1)} ${ay.toFixed(1)} L ${cx.toFixed(1)} ${cy.toFixed(1)}`;
  }
  return d;
}

/** A different hand-drawn station mark per milestone. */
function stationMark(index: number, cx: number, cy: number, seed: number) {
  const r = 6 + (index % 3) * 0.8;
  const tilt = seed * 0.28;

  switch (index % 5) {
    case 0:
      return traceRadial(cx, cy, 4, r, tilt, seed, 0.12);
    case 1:
      return traceRadial(cx, cy, 3, r * 1.05, tilt + 0.2, seed, 0.08);
    case 2: {
      const ry = r * 1.15;
      const rx = r * 0.85;
      return (
        ` L ${cx.toFixed(1)} ${(cy - ry).toFixed(1)}` +
        ` L ${cx.toFixed(1)} ${(cy + ry).toFixed(1)}` +
        ` L ${cx.toFixed(1)} ${cy.toFixed(1)}` +
        ` L ${(cx - rx).toFixed(1)} ${cy.toFixed(1)}` +
        ` L ${(cx + rx).toFixed(1)} ${cy.toFixed(1)}` +
        ` L ${cx.toFixed(1)} ${cy.toFixed(1)}`
      );
    }
    case 3:
      return traceRadial(cx, cy, 5, r * 0.92, tilt - 0.15, seed, 0.18);
    case 4: {
      const d = r * 0.95;
      return (
        ` L ${(cx - d).toFixed(1)} ${(cy - d).toFixed(1)}` +
        ` L ${(cx + d).toFixed(1)} ${(cy + d).toFixed(1)}` +
        ` L ${cx.toFixed(1)} ${cy.toFixed(1)}` +
        ` L ${(cx + d).toFixed(1)} ${(cy - d).toFixed(1)}` +
        ` L ${(cx - d).toFixed(1)} ${(cy + d).toFixed(1)}` +
        ` L ${cx.toFixed(1)} ${cy.toFixed(1)}`
      );
    }
    default:
      return traceRadial(cx, cy, 4, r, tilt, seed, 0);
  }
}

function buildTraversePath(stationYs: number[], height: number) {
  if (height <= 0) return `M ${SPINE_X} 0`;

  const stations = stationYs.filter((y) => y > 8);
  let d = `M ${SPINE_X} 0`;
  let y = 0;

  if (stations.length === 0) {
    return d + freehandSegment(0, height, 1.1);
  }

  for (let i = 0; i < stations.length; i++) {
    const sy = stations[i];
    const seed = i * 2.31 + 0.8;
    const approach = sy - 10;

    if (approach > y + 4) {
      d += freehandSegment(y, approach, seed);
      y = approach;
    }

    const cx = pencilX(sy, seed + 1.2);
    d += freehandSegment(y, sy - 3, seed + 0.15);
    d += stationMark(i, cx, sy, seed);
    y = sy + 8;
    d += freehandSegment(y, sy + 12, seed + 0.25);
    y = sy + 12;
  }

  if (y < height - 6) {
    d += freehandSegment(y, height, stations.length * 1.9 + 1);
  }

  return d;
}

export const Timeline = ({ data }: { data: TimelineEntry[] }) => {
  const ref = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [height, setHeight] = useState(0);
  const [traversePath, setTraversePath] = useState("");
  const reduceMotion = useReducedMotion();

  const measure = useCallback(() => {
    if (!ref.current) return;
    const h = ref.current.getBoundingClientRect().height;
    const containerTop = ref.current.getBoundingClientRect().top;
    const ys = rowRefs.current.map((row) => {
      if (!row) return 0;
      const titles = Array.from(row.querySelectorAll("h3"));
      for (let t = 0; t < titles.length; t++) {
        const rect = titles[t].getBoundingClientRect();
        if (rect.height > 0) {
          return rect.top - containerTop + rect.height / 2;
        }
      }
      return 0;
    });
    setHeight(h);
    setTraversePath(buildTraversePath(ys, h));
  }, []);

  useEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (ref.current) ro.observe(ref.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure, data.length]);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start 10%", "end 50%"],
  });

  const pathProgress = useTransform(scrollYProgress, [0, 1], [0, 1]);
  const opacityTransform = useTransform(scrollYProgress, [0, 0.1], [0, 1]);

  return (
    <div className="w-full bg-transparent font-sans" ref={containerRef}>
      <div ref={ref} className="relative w-full pb-20">
        {data.map((item, index) => (
          <div
            key={index}
            ref={(el) => {
              rowRefs.current[index] = el;
            }}
            className={`flex justify-start md:gap-8 ${
              index === 0 ? "pt-6 md:pt-10" : "pt-10 md:pt-20"
            }`}
          >
            {/* period column hugs the traverse so the content gets the width */}
            <div className="sticky top-32 z-10 hidden shrink-0 self-start md:block md:w-44 lg:w-52">
              <h3 className="font-display text-3xl leading-tight text-ink md:pl-12 lg:text-4xl">
                {item.title}
              </h3>
            </div>

            <div className="relative w-full min-w-0 pl-16 pr-2 md:pl-0 md:pr-0">
              <h3 className="mb-4 block text-left font-display text-2xl text-ink md:hidden">
                {item.title}
              </h3>
              {item.content}
            </div>
          </div>
        ))}

        {traversePath && height > 0 && (
          <svg
            aria-hidden
            className="pointer-events-none absolute left-0 top-0 z-0 w-full overflow-visible"
            height={height}
          >
            <motion.path
              d={traversePath}
              fill="none"
              stroke="var(--flow)"
              strokeWidth={1.55}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={false}
              style={{
                pathLength: reduceMotion ? 1 : pathProgress,
                opacity: opacityTransform,
              }}
            />
          </svg>
        )}
      </div>
    </div>
  );
};
