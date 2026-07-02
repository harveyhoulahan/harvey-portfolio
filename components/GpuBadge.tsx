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
  const label =
    state === "probing"
      ? "webgpu · probing"
      : state === "ready"
        ? "webgpu · adapter ready"
        : state === "no-adapter"
          ? "webgpu · no adapter"
          : "webgpu · unsupported";

  return (
    <span
      className={`inline-flex items-center gap-2 border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] ${
        ok
          ? "border-flow/40 text-flow"
          : state === "probing"
            ? "border-contour text-ink/50"
            : "border-infra/40 text-infra"
      }`}
      role="status"
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
      {label}
    </span>
  );
}
