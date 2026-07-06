"use client";

/*
 * Live GPU telemetry for the Playground — actually probes the browser rather
 * than decorating. Requests a WebGPU adapter and reports the real state the
 * demos will run under; falls back gracefully when the API is missing.
 */

import { useEffect, useState } from "react";

type GpuState = "probing" | "ready" | "no-adapter" | "unsupported";

export default function GpuBadge() {
  const [state, setState] = useState<GpuState>("probing");

  useEffect(() => {
    let cancelled = false;
    const nav = navigator as Navigator & {
      gpu?: { requestAdapter(): Promise<unknown | null> };
    };
    if (!nav.gpu) {
      setState("unsupported");
      return;
    }
    nav.gpu
      .requestAdapter()
      .then((adapter: unknown | null) => {
        if (!cancelled) setState(adapter ? "ready" : "no-adapter");
      })
      .catch(() => {
        if (!cancelled) setState("no-adapter");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const ok = state === "ready";
  const hint =
    state === "probing"
      ? "…"
      : state === "ready"
        ? ""
        : state === "no-adapter"
          ? "needs a gpu"
          : "not here";

  return (
    <span
      className={`inline-flex items-center gap-2 font-mono text-[10px] normal-case tracking-[0.08em] ${
        ok
          ? "text-flow"
          : state === "probing"
            ? "text-ink/50"
            : "text-infra"
      }`}
      role="status"
      aria-label={
        state === "ready"
          ? "These demos run on your device"
          : state === "probing"
            ? "Checking whether these demos can run here"
            : hint
      }
    >
      <span
        aria-hidden
        className={`h-1.5 w-1.5 ${
          ok
            ? "animate-pulse bg-flow"
            : state === "probing"
              ? "animate-pulse bg-contour"
              : "bg-infra"
        }`}
      />
      {hint}
    </span>
  );
}
