"use client";

// Live Byron Bay wall clock — real telemetry, not decoration. Brisbane zone
// (AEST year-round, no DST). Renders nothing until mounted so the server
// HTML never carries a stale time.
import { useEffect, useState } from "react";

export default function LocalClock() {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    const tick = () =>
      setTime(
        new Date().toLocaleTimeString("en-AU", {
          timeZone: "Australia/Brisbane",
          hour12: false,
        })
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  if (!time) return null;
  return (
    <span className="font-mono text-sm tabular-nums text-flow" aria-hidden>
      {time}
    </span>
  );
}
