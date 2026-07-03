"use client";
import {
  useScroll,
  useTransform,
  motion,
  useMotionValueEvent,
  useReducedMotion,
} from "framer-motion";
import React, { useCallback, useEffect, useRef, useState } from "react";

interface TimelineEntry {
  title: string;
  content: React.ReactNode;
}

/** Mini topo loops per station — hand-drawn nested contours, no frame. */
const STATION_CONTOURS = [
  [
    "M 7 24 C 5 13, 18 4, 31 7 C 43 10, 45 21, 40 32 C 35 43, 18 44, 10 34 C 3 25, 5 25, 7 24 Z",
    "M 11 23.5 C 9.5 15, 18 9, 27 11 C 36 13, 38 20, 35 28 C 32 36, 21 37, 14 31 C 9 26, 10 24, 11 23.5 Z",
    "M 15 23 C 14 17, 20 12.5, 26 14 C 32 15.5, 34 21, 31.5 27 C 29 33, 22 34, 17 29 C 13 25, 14 23.5, 15 23 Z",
    "M 19.5 22.5 C 19 19.5, 21.5 17.5, 24.5 18.2 C 27.5 19, 28.5 21.5, 27.2 23.8 C 26 26, 22.5 26.5, 20.5 24.5 C 19 23, 19.3 22.8, 19.5 22.5 Z",
  ],
  [
    "M 9 23 C 6 12, 20 5, 33 8.5 C 44 11.5, 44 22, 38 31.5 C 32 41, 16 42, 9 32 C 4 24, 7 24, 9 23 Z",
    "M 13 22.5 C 11 16, 19 10, 28 12.5 C 37 15, 37.5 21.5, 34 28.5 C 30.5 35.5, 20 36.5, 14 30.5 C 9 25.5, 12 23, 13 22.5 Z",
    "M 17 22 C 16 17.5, 21 13.5, 27 15 C 33 16.5, 34.5 21, 32.5 26.5 C 30.5 32, 23.5 32.5, 18.5 28 C 15 24.5, 16.5 22.5, 17 22 Z",
    "M 21 21.5 C 20.3 19.2, 22.8 17.8, 25.5 18.5 C 28.2 19.2, 29 21.8, 27.8 23.8 C 26.6 25.8, 23.2 26.2, 21.2 24.2 C 19.8 22.8, 20.5 21.8, 21 21.5 Z",
  ],
  [
    "M 8 23.5 C 5.5 12.5, 19 4.5, 32 7 C 44 9.5, 46 20, 41 30.5 C 36 41, 17 41.5, 10 31 C 4 23, 6.5 23.5, 8 23.5 Z",
    "M 12 23 C 10 15.5, 18.5 9.5, 28 11.5 C 37.5 13.5, 38 20, 35 27.5 C 32 35, 20.5 35.5, 14 29.5 C 9 24.5, 11 23, 12 23 Z",
    "M 16.5 22.2 C 15.5 17, 21 13, 27.5 14.5 C 34 16, 35 21.2, 32.5 26.8 C 30 32.4, 22.5 33, 17.5 28.5 C 14 25.5, 15.5 22.8, 16.5 22.2 Z",
    "M 20.5 21.8 C 19.8 19.5, 22.5 18, 25.2 18.8 C 27.9 19.6, 28.8 22, 27.5 24 C 26.2 26, 22.8 26.3, 21 24.5 C 19.6 23.1, 20.2 22, 20.5 21.8 Z",
  ],
] as const;

const LOOP_STROKE = [0.9, 0.82, 0.74, 0.66] as const;
const LOOP_OPACITY = [0.28, 0.45, 0.62, 0.88] as const;
const LOOP_DRAW_DELAY = [0.05, 0.13, 0.21, 0.29] as const;

function SurveyBenchmark({
  index,
  active,
}: {
  index: number;
  active: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const delay = reduceMotion ? 0 : index * 0.06;
  const shown = active;
  const loops = STATION_CONTOURS[index % STATION_CONTOURS.length];

  return (
    <motion.svg
      viewBox="0 0 60 48"
      className="h-10 w-12 md:h-12 md:w-[3.75rem]"
      fill="none"
      aria-hidden
      initial={false}
      animate={
        shown
          ? { opacity: 1, scale: 1 }
          : { opacity: 0, scale: 0.7 }
      }
      transition={{
        duration: reduceMotion ? 0 : 0.38,
        delay,
        ease: [0.33, 0.02, 0.18, 1],
      }}
      style={{ transformOrigin: "44px 24px" }}
    >
      <g>
        <motion.circle
          cx="24"
          cy="24"
          r="17"
          fill="var(--flow)"
          initial={false}
          animate={{ opacity: shown ? 0.07 : 0 }}
          transition={{
            duration: reduceMotion ? 0 : 0.45,
            delay: delay + (reduceMotion ? 0 : 0.08),
          }}
        />

        {loops.map((d, i) => (
          <motion.path
            key={i}
            d={d}
            stroke="var(--flow)"
            strokeWidth={LOOP_STROKE[i]}
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            initial={false}
            animate={
              shown
                ? { pathLength: 1, opacity: LOOP_OPACITY[i] }
                : { pathLength: 0, opacity: 0 }
            }
            transition={{
              duration: reduceMotion ? 0 : 0.38 + i * 0.04,
              delay: delay + (reduceMotion ? 0 : LOOP_DRAW_DELAY[i]),
              ease: [0.4, 0.05, 0.25, 1],
            }}
          />
        ))}

        <motion.circle
          cx="24"
          cy="24"
          r="1.6"
          fill="var(--flow)"
          initial={false}
          animate={shown ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : {
                  type: "spring",
                  stiffness: 480,
                  damping: 22,
                  delay: delay + 0.38,
                }
          }
          style={{ transformOrigin: "24px 24px" }}
        />
      </g>

      <motion.path
        d="M 56 24 C 52.5 22.2, 49.5 25.2, 44.5 24"
        stroke="var(--flow)"
        strokeWidth="1.15"
        strokeLinecap="round"
        pathLength={1}
        initial={false}
        animate={
          shown
            ? { pathLength: 1, opacity: 0.7 }
            : { pathLength: 0, opacity: 0 }
        }
        transition={{
          duration: reduceMotion ? 0 : 0.28,
          delay: delay + (reduceMotion ? 0 : 0.02),
          ease: [0.4, 0.05, 0.25, 1],
        }}
      />
    </motion.svg>
  );
}

export const Timeline = ({ data }: { data: TimelineEntry[] }) => {
  const ref = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [height, setHeight] = useState(0);
  const [stationYs, setStationYs] = useState<number[]>([]);
  const [activeStations, setActiveStations] = useState<Set<number>>(new Set());

  const measure = useCallback(() => {
    if (!ref.current) return;
    setHeight(ref.current.getBoundingClientRect().height);
    setStationYs(
      rowRefs.current.map((row) => {
        if (!row || !ref.current) return 0;
        const marker = row.querySelector<HTMLElement>("[data-timeline-station]");
        const containerTop = ref.current.getBoundingClientRect().top;
        const markerRect = (marker ?? row).getBoundingClientRect();
        return markerRect.top - containerTop + markerRect.height / 2;
      }),
    );
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

  const heightTransform = useTransform(scrollYProgress, [0, 1], [0, height]);
  const opacityTransform = useTransform(scrollYProgress, [0, 0.1], [0, 1]);

  const syncStations = useCallback(
    (lineHeight: number) => {
      if (stationYs.length === 0) return;
      setActiveStations((prev) => {
        let changed = false;
        const next = new Set(prev);
        stationYs.forEach((y, i) => {
          if (lineHeight >= y - 4 && !next.has(i)) {
            next.add(i);
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    },
    [stationYs],
  );

  useMotionValueEvent(heightTransform, "change", syncStations);

  useEffect(() => {
    syncStations(heightTransform.get());
  }, [heightTransform, syncStations]);

  return (
    <div className="w-full bg-transparent font-sans" ref={containerRef}>
      <div ref={ref} className="relative w-full pb-20">
        {data.map((item, index) => (
          <div
            key={index}
            ref={(el) => {
              rowRefs.current[index] = el;
            }}
            className="flex justify-start pt-10 md:gap-10 md:pt-32"
          >
            <div className="sticky top-32 z-40 flex max-w-xs flex-col items-center self-start md:w-full md:flex-row lg:max-w-sm">
              <div
                data-timeline-station
                className="absolute -left-4 z-40 flex items-center justify-center md:-left-7"
              >
                <SurveyBenchmark
                  index={index}
                  active={activeStations.has(index)}
                />
              </div>
              <h3 className="hidden font-display text-3xl text-ink md:block md:pl-20 md:text-5xl">
                {item.title}
              </h3>
            </div>

            <div className="relative w-full pl-20 pr-2 md:pl-4">
              <h3 className="mb-4 block text-left font-display text-2xl text-ink md:hidden">
                {item.title}
              </h3>
              {item.content}
            </div>
          </div>
        ))}
        <div
          style={{ height: height + "px" }}
          className="absolute left-8 top-0 z-0 w-[2px] overflow-hidden bg-[linear-gradient(to_bottom,var(--tw-gradient-stops))] from-transparent from-[0%] via-contour to-transparent to-[99%] [mask-image:linear-gradient(to_bottom,transparent_0%,black_10%,black_90%,transparent_100%)] md:left-8"
        >
          <motion.div
            style={{
              height: heightTransform,
              opacity: opacityTransform,
            }}
            className="absolute inset-x-0 top-0 w-[2px] rounded-full bg-gradient-to-t from-flow via-flow/70 to-transparent from-[0%] via-[10%]"
          />
        </div>
      </div>
    </div>
  );
};
