"use client";

/*
 * SplatPortrait — "STA 00 · SUBJECT": an orbitable 3D Gaussian-splat portrait
 * at the head of the About traverse. The subject of the survey is the surveyor.
 *
 * Self-gating: it probes /splat/portrait.splat and renders nothing until the
 * asset exists, so the page is unchanged until a portrait is trained and
 * committed (pipeline: ml/splat/build_splat.py — see ml/splat/README.md).
 * The renderer (lib/splat/viewer.ts) is hand-written WebGL2 and only loads
 * once the block scrolls into view; no WebGL2 → the block stays hidden.
 */

import { useEffect, useRef, useState } from "react";
import type { SplatViewer } from "@/lib/splat/viewer";

const SPLAT_URL = "/splat/portrait.splat";

type Stage = "probing" | "absent" | "idle" | "loading" | "ready" | "failed";

export default function SplatPortrait() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<SplatViewer | null>(null);
  const [stage, setStage] = useState<Stage>("probing");
  const [count, setCount] = useState(0);
  const [bytes, setBytes] = useState(0);
  const [hint, setHint] = useState(true);

  // 1) does the asset exist at all?
  useEffect(() => {
    let gone = false;
    fetch(SPLAT_URL, { method: "HEAD" })
      .then((r) => {
        if (gone) return;
        if (r.ok) {
          setBytes(+(r.headers.get("content-length") ?? 0));
          setStage("idle");
        } else setStage("absent");
      })
      .catch(() => { if (!gone) setStage("absent"); });
    return () => { gone = true; };
  }, []);

  // 2) load + start only when scrolled into view; pause when it leaves
  useEffect(() => {
    if (stage !== "idle") return;
    const shell = shellRef.current;
    if (!shell) return;
    let disposed = false;

    const io = new IntersectionObserver(async ([entry]) => {
      const v = viewerRef.current;
      if (!entry.isIntersecting) { v?.stop(); return; }
      if (v) { v.start(); return; }
      io.unobserve(shell); // build once
      setStage("loading");
      try {
        const { loadSplatViewer } = await import("@/lib/splat/viewer");
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const viewer = await loadSplatViewer(canvasRef.current!, SPLAT_URL, {
          autoRotate: !reduce,
        });
        if (!viewer || disposed) { viewer?.dispose(); if (!disposed) setStage("failed"); return; }
        viewer.setInteractionCallback(() => setHint(false));
        viewerRef.current = viewer;
        setCount(viewer.count);
        viewer.start();
        setStage("ready");
        io.observe(shell); // resume visibility-based pause/start
      } catch {
        if (!disposed) setStage("failed");
      }
    }, { rootMargin: "160px" });
    io.observe(shell);

    return () => {
      disposed = true;
      io.disconnect();
      viewerRef.current?.dispose();
      viewerRef.current = null;
    };
  }, [stage === "idle"]); // eslint-disable-line react-hooks/exhaustive-deps

  if (stage === "probing" || stage === "absent" || stage === "failed") return null;

  return (
    <div ref={shellRef} className="group relative">
      {/* traverse benchmark, matching the numbered stations below */}
      <span
        aria-hidden
        className="absolute -left-[37px] top-1 h-2.5 w-2.5 rotate-45 border border-flow bg-flow transition-colors duration-300 md:-left-[45px]"
      />
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="mono-label text-ink/40">STA 00 · SUBJECT</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/35">
          {count > 0
            ? `${count.toLocaleString()} gaussians · ${(bytes / 1e6).toFixed(1)} MB`
            : "gaussian splat"}
        </span>
      </div>

      <div className="survey-corners relative mt-3 overflow-hidden border border-contour bg-terrace/60">
        <canvas
          ref={canvasRef}
          className="block aspect-[4/5] w-full touch-none sm:aspect-[16/10]"
          style={{ cursor: "grab" }}
          aria-label="Interactive 3D portrait of Harvey Houlahan, reconstructed as a Gaussian splat. Drag to orbit."
          role="img"
        />
        {stage === "loading" && (
          <div className="absolute inset-0 grid place-items-center">
            <span className="mono-label animate-pulse text-ink/45">
              reconstructing subject…
            </span>
          </div>
        )}
        {stage === "ready" && (
          <div
            className={`pointer-events-none absolute bottom-3 left-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ink/45 transition-opacity duration-700 ${hint ? "opacity-100" : "opacity-0"}`}
          >
            drag to orbit · scroll to zoom
          </div>
        )}
        <div className="pointer-events-none absolute right-3 top-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ink/35">
          SUBJECT: H. HOULAHAN
        </div>
      </div>
      <p className="mt-2 font-mono text-xs leading-relaxed text-ink/45">
        I turn point clouds into models for a living, so here is the author as one:
        filmed on a phone, reconstructed with structure-from-motion, and trained as
        a 3D Gaussian splat on my own pipeline — rendered here by a hand-written
        WebGL2 splatter.
      </p>
    </div>
  );
}
