"use client";

/*
 * Genesis — M1: the substrate comes alive.
 *
 * A continuous cellular automaton (Lenia) runs live in a WebGPU compute shader and
 * fills the screen: a ring-kernel convolution + growth mapping evolves a state field
 * into self-organizing, drifting structures. Math is transcribed 1:1 from the
 * numpy/JS reference in lib/genesis/lenia.ts (validated headlessly). Click to seed
 * new life; pause/step/reset. Raw WebGPU, dependency-free, graceful fallback.
 *
 * Roadmap (see docs/GENESIS.md): M2 rendering polish + more substrates, M3 controls
 * + presets, M4 in-browser CLIP/SigLIP scoring, M5 CMA-ES "summon by prompt" search.
 */

import { type CSSProperties, useEffect, useRef, useState } from "react";
import { SIM_WGSL, LIFE_WGSL, DECAY_WGSL, RENDER_WGSL } from "@/lib/genesis/sim-shaders";
import { buildKernel, seedSoup, DEFAULT_PARAMS } from "@/lib/genesis/lenia";

const N = 192; // grid resolution (NxN)
const P = DEFAULT_PARAMS;
const SUBSTEPS = 1; // Lenia steps per animation frame
const LIFE_EVERY = 5; // Game-of-Life advances every Nth frame (legible pace)

type Status = "loading" | "ready" | "nogpu" | "error";
type Substrate = "lenia" | "life";

/** Random binary field for seeding Conway's Game of Life. */
function seedLifeField(n: number, density = 0.32): Float32Array {
  const s = new Float32Array(n * n);
  for (let i = 0; i < s.length; i++) s[i] = Math.random() < density ? 1 : 0;
  return s;
}

/* calm site tokens */
const INK = "#1A1A18";
const SAGE = "#4A6741";
const SAND = "#C4A882";
const CONCRETE = "#F7F5F0";

export default function Genesis() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [err, setErr] = useState<string>("");
  const [paused, setPaused] = useState(false);
  const [substrate, setSubstrate] = useState<Substrate>("lenia");

  // control hooks the render loop reads without re-subscribing
  const pausedRef = useRef(false);
  const seedRef = useRef<{ x: number; y: number } | null>(null);
  const resetRef = useRef(false);
  const substrateRef = useRef<Substrate>("lenia");
  const switchRef = useRef(false); // substrate changed -> reseed
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => {
    if (substrateRef.current !== substrate) { substrateRef.current = substrate; switchRef.current = true; }
  }, [substrate]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let disposed = false;
    let raf = 0;
    let device: any = null;
    let roRef: any = null;

    const fail = (m: string) => { if (!disposed) { setErr(m); setStatus("error"); } };

    (async () => {
      if (!navigator.gpu) { setStatus("nogpu"); return; }
      let ctx: any;
      try {
        const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
        if (!adapter) { setStatus("nogpu"); return; }
        device = await adapter.requestDevice();
        if (disposed) return;
        device.lost?.then((info: any) => { if (!disposed) fail(`GPU device lost: ${info?.message ?? ""}`); });

        ctx = (canvas as any).getContext("webgpu");
        if (!ctx) { setStatus("nogpu"); return; }
        const format = navigator.gpu.getPreferredCanvasFormat();

        // size the backing store to the displayed size (DPR-capped) so the
        // field renders smooth + full-resolution rather than blocky.
        const resize = () => {
          const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
          const w = Math.max(2, Math.floor(canvas.clientWidth * dpr));
          const h = Math.max(2, Math.floor(canvas.clientHeight * dpr));
          if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
        };
        resize();
        ctx.configure({ device, format, alphaMode: "opaque" });
        const ro = new ResizeObserver(resize);
        ro.observe(canvas);
        roRef = ro;

        /* ---- buffers ---------------------------------------------------- */
        const ST = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST;
        const mkBuf = (arr: Float32Array, usage: number) => {
          const b = device.createBuffer({ size: arr.byteLength, usage, mappedAtCreation: true });
          new Float32Array(b.getMappedRange()).set(arr);
          b.unmap();
          return b;
        };

        const kernel = buildKernel(P.R, P.kSigma);
        const kw = 2 * P.R + 1;
        const soup = seedSoup(N);
        const bufs = [mkBuf(soup, ST), mkBuf(new Float32Array(N * N), ST)];
        const histBuf = mkBuf(new Float32Array(N * N), ST); // motion-trail memory
        const kernBuf = mkBuf(kernel, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
        const uni = device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        device.queue.writeBuffer(uni, 0, new Float32Array([
          N, P.R, P.dt, P.mu,        // p0
          P.sigma, kw, 0, 0,          // p1
        ]));

        /* ---- pipelines -------------------------------------------------- */
        const simMod = device.createShaderModule({ code: SIM_WGSL });
        const lifeMod = device.createShaderModule({ code: LIFE_WGSL });
        const decMod = device.createShaderModule({ code: DECAY_WGSL });
        const renMod = device.createShaderModule({ code: RENDER_WGSL });
        // surface shader-compile errors early (blind-dev safety net)
        for (const m of [simMod, lifeMod, decMod, renMod]) {
          const ci = await (m.getCompilationInfo?.() ?? Promise.resolve({ messages: [] }));
          const e = (ci.messages ?? []).filter((x: any) => x.type === "error");
          if (e.length) throw new Error(e.map((x: any) => x.message).join(" | "));
        }
        const simPipe = device.createComputePipeline({ layout: "auto", compute: { module: simMod, entryPoint: "main" } });
        const lifePipe = device.createComputePipeline({ layout: "auto", compute: { module: lifeMod, entryPoint: "main" } });
        const decPipe = device.createComputePipeline({ layout: "auto", compute: { module: decMod, entryPoint: "main" } });
        const renPipe = device.createRenderPipeline({
          layout: "auto",
          vertex: { module: renMod, entryPoint: "vs" },
          fragment: { module: renMod, entryPoint: "fs", targets: [{ format }] },
          primitive: { topology: "triangle-list" },
        });

        const cl = simPipe.getBindGroupLayout(0);
        const ll = lifePipe.getBindGroupLayout(0);
        const dl = decPipe.getBindGroupLayout(0);
        const rl = renPipe.getBindGroupLayout(0);
        // Lenia compute bind groups: src -> dst (+ ring kernel)
        const cbg = [
          device.createBindGroup({ layout: cl, entries: [
            { binding: 0, resource: { buffer: uni } },
            { binding: 1, resource: { buffer: bufs[0] } },
            { binding: 2, resource: { buffer: bufs[1] } },
            { binding: 3, resource: { buffer: kernBuf } },
          ]}),
          device.createBindGroup({ layout: cl, entries: [
            { binding: 0, resource: { buffer: uni } },
            { binding: 1, resource: { buffer: bufs[1] } },
            { binding: 2, resource: { buffer: bufs[0] } },
            { binding: 3, resource: { buffer: kernBuf } },
          ]}),
        ];
        // Game-of-Life compute bind groups: src -> dst (no kernel)
        const lbg = [
          device.createBindGroup({ layout: ll, entries: [
            { binding: 0, resource: { buffer: uni } },
            { binding: 1, resource: { buffer: bufs[0] } },
            { binding: 2, resource: { buffer: bufs[1] } },
          ]}),
          device.createBindGroup({ layout: ll, entries: [
            { binding: 0, resource: { buffer: uni } },
            { binding: 1, resource: { buffer: bufs[1] } },
            { binding: 2, resource: { buffer: bufs[0] } },
          ]}),
        ];
        // decay bind groups: read latest state -> update hist in place
        const dbg = [
          device.createBindGroup({ layout: dl, entries: [
            { binding: 0, resource: { buffer: uni } },
            { binding: 1, resource: { buffer: bufs[0] } },
            { binding: 2, resource: { buffer: histBuf } },
          ]}),
          device.createBindGroup({ layout: dl, entries: [
            { binding: 0, resource: { buffer: uni } },
            { binding: 1, resource: { buffer: bufs[1] } },
            { binding: 2, resource: { buffer: histBuf } },
          ]}),
        ];
        // render bind groups: read state buffer i + the shared hist buffer
        const rbg = [
          device.createBindGroup({ layout: rl, entries: [
            { binding: 0, resource: { buffer: uni } },
            { binding: 1, resource: { buffer: bufs[0] } },
            { binding: 2, resource: { buffer: histBuf } },
          ]}),
          device.createBindGroup({ layout: rl, entries: [
            { binding: 0, resource: { buffer: uni } },
            { binding: 1, resource: { buffer: bufs[1] } },
            { binding: 2, resource: { buffer: histBuf } },
          ]}),
        ];

        const groups = Math.ceil(N / 8);
        let cur = 0; // index of buffer holding the latest state

        const stepOnce = () => {
          const life = substrateRef.current === "life";
          const enc = device.createCommandEncoder();
          const pass = enc.beginComputePass();
          pass.setPipeline(life ? lifePipe : simPipe);
          pass.setBindGroup(0, (life ? lbg : cbg)[cur]); // src=cur, dst=1-cur
          pass.dispatchWorkgroups(groups, groups);
          pass.end();
          device.queue.submit([enc.finish()]);
          cur = 1 - cur;
        };

        const decayOnce = () => {
          const enc = device.createCommandEncoder();
          const pass = enc.beginComputePass();
          pass.setPipeline(decPipe);
          pass.setBindGroup(0, dbg[cur]); // read latest state (bufs[cur])
          pass.dispatchWorkgroups(groups, groups);
          pass.end();
          device.queue.submit([enc.finish()]);
        };

        const renderFrame = () => {
          const enc = device.createCommandEncoder();
          const view = ctx.getCurrentTexture().createView();
          const pass = enc.beginRenderPass({
            colorAttachments: [{
              view, loadOp: "clear", storeOp: "store",
              clearValue: { r: 0.1, g: 0.1, b: 0.094, a: 1 },
            }],
          });
          pass.setPipeline(renPipe);
          pass.setBindGroup(0, rbg[cur]);
          pass.draw(3);
          pass.end();
          device.queue.submit([enc.finish()]);
        };

        /* ---- click-to-seed: read back current state, stamp a soft blob --- */
        const applySeed = async (gx: number, gy: number) => {
          const bytes = N * N * 4;
          const staging = device.createBuffer({ size: bytes, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
          const enc = device.createCommandEncoder();
          enc.copyBufferToBuffer(bufs[cur], 0, staging, 0, bytes);
          device.queue.submit([enc.finish()]);
          await staging.mapAsync(GPUMapMode.READ);
          const mirror = new Float32Array(N * N);
          mirror.set(new Float32Array(staging.getMappedRange()));
          staging.unmap();
          staging.destroy?.();
          const life = substrateRef.current === "life";
          const rad = life ? P.R * 1.2 : P.R * 2.0;
          for (let dy = -rad; dy <= rad; dy++) {
            for (let dx = -rad; dx <= rad; dx++) {
              const d = Math.hypot(dx, dy);
              if (d > rad) continue;
              const x = ((gx + dx) % N + N) % N | 0;
              const y = ((gy + dy) % N + N) % N | 0;
              const idx = y * N + x;
              if (life) {
                // Game of Life: scatter live cells so a click sparks activity
                if (Math.random() < 0.55) mirror[idx] = 1;
              } else {
                // Lenia: a smooth bump nucleates a viable, persistent creature
                const f = 1 - d / rad;
                const bump = f * f * (3 - 2 * f); // smoothstep falloff
                mirror[idx] = Math.min(1, mirror[idx] + bump * 0.95);
              }
            }
          }
          device.queue.writeBuffer(bufs[cur], 0, mirror);
        };

        const doReset = () => {
          const seed = substrateRef.current === "life" ? seedLifeField(N) : seedSoup(N);
          device.queue.writeBuffer(bufs[cur], 0, seed);
          device.queue.writeBuffer(histBuf, 0, new Float32Array(N * N));
        };

        setStatus("ready");

        if (reduce) {
          // static-ish: evolve briefly into structure, then hold one frame
          for (let i = 0; i < 80; i++) stepOnce();
          decayOnce();
          renderFrame();
          return;
        }

        let frame = 0;
        const loop = async () => {
          if (disposed) return;
          frame++;
          if (switchRef.current) { switchRef.current = false; doReset(); }
          if (resetRef.current) { resetRef.current = false; doReset(); }
          if (seedRef.current) { const s = seedRef.current; seedRef.current = null; await applySeed(s.x, s.y); }
          if (!pausedRef.current) {
            const life = substrateRef.current === "life";
            // Game of Life steps slowly so generations are legible; Lenia every frame
            if (!life) { for (let i = 0; i < SUBSTEPS; i++) stepOnce(); }
            else if (frame % LIFE_EVERY === 0) { stepOnce(); }
          }
          decayOnce();
          renderFrame();
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      } catch (e: any) {
        fail(e?.message ?? String(e));
      }
    })();

    /* map a pointer event to a grid cell and queue a seed */
    const onPointer = (ev: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      const gx = Math.floor(((ev.clientX - r.left) / r.width) * N);
      const gy = Math.floor(((ev.clientY - r.top) / r.height) * N);
      if (gx >= 0 && gx < N && gy >= 0 && gy < N) seedRef.current = { x: gx, y: gy };
    };
    canvas.addEventListener("pointerdown", onPointer);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onPointer);
      try { roRef?.disconnect?.(); } catch { /* noop */ }
      try { device?.destroy?.(); } catch { /* noop */ }
    };
  }, []);

  const wrap: CSSProperties = {
    position: "relative", width: "100%", height: "calc(100svh - 4rem)",
    background: INK, overflow: "hidden",
  };
  const cvs: CSSProperties = {
    position: "absolute", inset: 0, width: "100%", height: "100%",
    display: "block", cursor: "crosshair",
  };

  return (
    <div style={wrap}>
      <canvas ref={canvasRef} style={cvs} />

      {/* title plate — frosted dark card so it stays legible over any structure */}
      <div style={{
        position: "absolute", top: 22, left: 22, maxWidth: 430, color: CONCRETE,
        pointerEvents: "none",
        background: "linear-gradient(135deg, rgba(20,20,18,0.62), rgba(20,20,18,0.40))",
        backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
        border: "1px solid rgba(196,168,130,0.28)", borderRadius: 14,
        padding: "16px 20px", boxShadow: "0 10px 40px rgba(0,0,0,0.35)",
      }}>
        <div style={{ fontSize: 11, letterSpacing: 2.5, textTransform: "uppercase", color: SAND, fontWeight: 600 }}>
          Genesis · flagship II
        </div>
        <h1 style={{ fontSize: 27, margin: "7px 0 5px", fontWeight: 600, letterSpacing: -0.3, color: "#FBFAF7" }}>
          An artificial-life lab
        </h1>
        <p style={{ fontSize: 13.5, lineHeight: 1.55, color: "rgba(247,245,240,0.78)", margin: 0 }}>
          A continuous cellular automaton <span style={{ color: SAND }}>(Lenia)</span> evolving live on your GPU.
          Click anywhere to seed new life.
        </p>
      </div>

      {/* controls */}
      {status === "ready" && (
        <div style={{ position: "absolute", bottom: 24, left: 24, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={seg}>
            <button onClick={() => setSubstrate("lenia")} style={segBtn(substrate === "lenia")}>Lenia</button>
            <button onClick={() => setSubstrate("life")} style={segBtn(substrate === "life")}>Game of Life</button>
          </div>
          <button onClick={() => setPaused((p) => !p)} style={btn}>{paused ? "Play" : "Pause"}</button>
          <button onClick={() => { resetRef.current = true; }} style={btn}>Reset</button>
        </div>
      )}

      {/* status overlays */}
      {status === "loading" && <Center>Spinning up the GPU…</Center>}
      {status === "nogpu" && (
        <Center>
          This live simulation needs WebGPU, which your browser/device doesn’t expose.
          Try the latest Chrome, Edge, or Safari. (A static gallery fallback lands in M2.)
        </Center>
      )}
      {status === "error" && <Center>Couldn’t start the simulation: {err}</Center>}
    </div>
  );
}

const btn: CSSProperties = {
  background: "rgba(247,245,240,0.10)", color: "#F7F5F0",
  border: "1px solid rgba(247,245,240,0.25)", borderRadius: 8,
  padding: "8px 14px", fontSize: 13, cursor: "pointer", backdropFilter: "blur(6px)",
};

const seg: CSSProperties = {
  display: "flex", gap: 2, padding: 2, borderRadius: 10,
  background: "rgba(20,20,18,0.5)", border: "1px solid rgba(247,245,240,0.18)",
  backdropFilter: "blur(6px)",
};
const segBtn = (active: boolean): CSSProperties => ({
  background: active ? "rgba(196,168,130,0.92)" : "transparent",
  color: active ? "#1A1A18" : "rgba(247,245,240,0.78)",
  border: "none", borderRadius: 8, padding: "7px 13px", fontSize: 13,
  fontWeight: active ? 600 : 400, cursor: "pointer", transition: "background 0.15s",
});

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      position: "absolute", inset: 0, display: "grid", placeItems: "center",
      color: "#F7F5F0", textAlign: "center", padding: 24, pointerEvents: "none",
    }}>
      <div style={{ maxWidth: 460, fontSize: 15, lineHeight: 1.6, opacity: 0.9 }}>{children}</div>
    </div>
  );
}
