"use client";

/*
 * Catchment — M2: water that carves.
 *
 * On top of the M1 world, a virtual-pipes shallow-water + stream-power erosion
 * engine runs live in WebGPU compute shaders (see lib/catchment/sim-shaders).
 * Rain (global drizzle + a click-drag "pour" brush) flows downhill over the real
 * terrain, pools in hollows, threads into a drainage network, and erodes the
 * bedrock it runs over — re-shading every frame as the ground changes. A
 * translucent water surface renders on top. Physics + constants ported 1:1 from
 * a validated numpy reference. Raw WebGPU, dependency-free, graceful fallback.
 */

import { type CSSProperties, useEffect, useRef, useState } from "react";
import { decodeDEM, sampleElev, type CatchmentDEM, type CatchmentDEMRaw } from "@/lib/catchment/dem";
import { perspectiveZO, lookAt, multiply, invert, transformVec4, orbitEye, type Vec3, type Mat4 } from "@/lib/catchment/mat4";
import {
  ADDRAIN_WGSL, FLUX_WGSL, WATERVEL_WGSL, ERODE_WGSL, TRANSPORT_WGSL, FINALIZE_WGSL,
  NORMALS_WGSL, RENDER_TERRAIN_WGSL, RENDER_WATER_WGSL, RENDER_SKIRT_WGSL,
  SPREAD_WGSL, BURN_WGSL, METEOR_WGSL,
  NEURAL_ASSEMBLE_WGSL, NEURAL_CONV_WGSL, NEURAL_APPLY_WGSL, RENDER_SKY_WGSL,
  POST_BRIGHT_WGSL, POST_BLUR_WGSL, POST_COMPOSITE_WGSL,
} from "@/lib/catchment/sim-shaders";
import { decodeSurrogate } from "@/lib/catchment/surrogate";
import { useIdleUI } from "@/lib/useIdleUI";

const BASE_Y = -0.16; // pedestal base height (world units)

const HALF = 1.0;
const HSCALE = 80.0; // bedrock height units (matches the validated reference)
const DEFAULT_VSCALE = 0.5;
const SUBSTEPS = 2;
const SAMPLE_COUNT = 4;


function hasWebGL(): boolean {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); }
  catch { return false; }
}

function paintFallback(dem: CatchmentDEM, canvas: HTMLCanvasElement) {
  const n = dem.n;
  const small = document.createElement("canvas"); small.width = n; small.height = n;
  const sctx = small.getContext("2d"); if (!sctx) return;
  const img = sctx.createImageData(n, n);
  const lx = -0.6, ly = -0.6, lz = 0.55, ll = Math.hypot(lx, ly, lz);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const i = r * n + c, o = i * 4;
    if (dem.ocean[i]) { img.data[o] = 150; img.data[o + 1] = 170; img.data[o + 2] = 162; img.data[o + 3] = 255; continue; }
    const hl = dem.elev[r * n + Math.max(0, c - 1)], hr = dem.elev[r * n + Math.min(n - 1, c + 1)];
    const hu = dem.elev[Math.max(0, r - 1) * n + c], hd = dem.elev[Math.min(n - 1, r + 1) * n + c];
    const nx = (hl - hr) * 2.6, ny = (hu - hd) * 2.6, nl = Math.hypot(nx, ny, 1) || 1;
    let sh = (nx * lx + ny * ly + lz) / (nl * ll); sh = 0.5 + 0.6 * Math.max(0, sh);
    const e = dem.elev[i];
    img.data[o] = Math.min(255, (107 + 95 * e) * sh);
    img.data[o + 1] = Math.min(255, (125 + 53 * e) * sh);
    img.data[o + 2] = Math.min(255, (92 + 48 * e) * sh);
    img.data[o + 3] = 255;
    if (dem.stream[i]) { img.data[o] = 120; img.data[o + 1] = 150; img.data[o + 2] = 150; }
  }
  sctx.putImageData(img, 0, 0);
  const ctx = canvas.getContext("2d"); if (!ctx) return;
  const W = canvas.width, H = canvas.height, s = Math.max(W, H) / n;
  ctx.imageSmoothingEnabled = true; ctx.clearRect(0, 0, W, H);
  ctx.drawImage(small, (W - n * s) / 2, (H - n * s) / 2, n * s, n * s);
}

type Status = "loading" | "running" | "nogpu" | "error";
type Pick = { elevM: number; slopeDeg: number; lng: number; lat: number } | null;
type Mode = "orbit" | "pour" | "ignite" | "meteor";
type MeteorKind = 1 | 2 | 3;
type MeteorFx = { id: number; x: number; y: number; kind: MeteorKind; angle: number };
type SurrogateStatus = "idle" | "exporting" | "ready" | "error";
type RainDrop = { x: number; z: number; gx: number; gz: number; seed: number; speed: number; length: number; ocean: boolean };

function Ctl(props: {
  label: string; display: string; min: number; max: number; step: number;
  value: number; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="cm-row">
      <div className="cm-rowtop"><span className="cm-label">{props.label}</span><span className="cm-val">{props.display}</span></div>
      <input type="range" className="cm-slider" min={props.min} max={props.max} step={props.step} value={props.value} onChange={props.onChange} />
    </div>
  );
}

const PANEL_CSS = `
.cm-panel{width:250px;z-index:6;max-height:calc(100dvh - 40px);overflow-y:auto;overscroll-behavior:contain;background:rgba(247,245,240,0.82);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);border:1px solid #D8D3C8;border-left:2px solid #4A6741;padding:14px 16px 16px;font-family:var(--font-mono),"JetBrains Mono",ui-monospace,monospace;}
.cm-panel::-webkit-scrollbar{width:5px;}
.cm-panel::-webkit-scrollbar-thumb{background:rgba(74,103,65,.28);border-radius:3px;}
.cm-panel::-webkit-scrollbar-track{background:transparent;}
.cm-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:11px;}
.cm-title{font-size:0.72rem;letter-spacing:0.18em;text-transform:uppercase;color:#1A1A18;}
.cm-live{display:inline-flex;align-items:center;gap:6px;font-size:0.6rem;letter-spacing:0.14em;text-transform:uppercase;color:#4A6741;}
.cm-live i{width:6px;height:6px;border-radius:50%;background:#4A6741;display:inline-block;animation:cm-pulse 2s ease-in-out infinite;}
@keyframes cm-pulse{0%,100%{opacity:1}50%{opacity:0.25}}
.cm-seg{display:flex;border:1px solid #D8D3C8;}
.cm-seg button{flex:1;padding:7px 0;font-size:0.64rem;letter-spacing:0.12em;text-transform:uppercase;color:rgba(26,26,24,0.55);background:transparent;border-right:1px solid #D8D3C8;transition:background .15s,color .15s;cursor:pointer;}
.cm-seg button:last-child{border-right:none;}
.cm-seg button[data-active="true"]{background:#4A6741;color:#F7F5F0;}
.cm-seg button:not([data-active="true"]):hover{color:#1A1A18;background:rgba(74,103,65,0.07);}
.cm-section{font-size:0.58rem;letter-spacing:0.16em;text-transform:uppercase;color:rgba(26,26,24,0.34);margin:14px 0 5px;padding-top:11px;border-top:1px solid rgba(216,211,200,0.55);}
.cm-group{width:100%;display:flex;align-items:center;justify-content:space-between;margin:14px 0 0;padding:11px 0 1px;border-top:1px solid rgba(216,211,200,0.55);border-left:0;border-right:0;border-bottom:0;background:transparent;font-family:inherit;font-size:0.58rem;letter-spacing:0.16em;text-transform:uppercase;color:rgba(26,26,24,0.42);cursor:pointer;transition:color .15s;}
.cm-group:hover{color:rgba(26,26,24,0.66);}
.cm-chevron{font-size:0.62rem;line-height:1;color:rgba(74,103,65,0.7);}
.cm-row{margin-top:9px;}
.cm-rowtop{display:flex;align-items:baseline;justify-content:space-between;}
.cm-label{font-size:0.64rem;letter-spacing:0.1em;text-transform:uppercase;color:rgba(26,26,24,0.68);}
.cm-val{font-size:0.7rem;color:#4A6741;}
.cm-slider{-webkit-appearance:none;appearance:none;width:100%;height:2px;background:#D8D3C8;outline:none;margin:7px 0 1px;cursor:pointer;}
.cm-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:12px;height:12px;background:#4A6741;border:2px solid #F7F5F0;cursor:pointer;}
.cm-slider::-moz-range-thumb{width:12px;height:12px;background:#4A6741;border:2px solid #F7F5F0;cursor:pointer;border-radius:0;}
.cm-hint{font-size:0.58rem;letter-spacing:0.06em;color:rgba(26,26,24,0.4);margin-top:12px;line-height:1.5;}
.cm-reset-btn{width:100%;margin-top:8px;padding:6px 0;font-size:0.62rem;letter-spacing:0.14em;text-transform:uppercase;color:rgba(26,26,24,0.6);background:transparent;border:1px solid #D8D3C8;cursor:pointer;transition:background .15s,color .15s;}
.cm-reset-btn:hover{background:rgba(26,26,24,0.05);color:#1A1A18;}
.cm-neural{z-index:6;width:270px;background:rgba(247,245,240,.84);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border:1px solid #D8D3C8;border-top:2px solid #4A6741;padding:13px 15px;font-family:var(--font-mono),"JetBrains Mono",ui-monospace,monospace;}
.cm-neural-title{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:.62rem;letter-spacing:.16em;text-transform:uppercase;color:#1A1A18;}
.cm-neural-pill{font-size:.54rem;letter-spacing:.13em;color:#4A6741;border:1px solid rgba(74,103,65,.24);padding:2px 5px;background:rgba(74,103,65,.06);}
.cm-neural-copy{margin-top:8px;font-size:.62rem;line-height:1.55;color:rgba(26,26,24,.52);}
.cm-neural-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:10px;}
.cm-neural-stat{border:1px solid rgba(216,211,200,.75);padding:7px 8px;background:rgba(239,236,229,.38);}
.cm-neural-stat span{display:block;font-size:.52rem;letter-spacing:.13em;text-transform:uppercase;color:rgba(26,26,24,.34);}
.cm-neural-stat strong{display:block;margin-top:3px;font-size:.72rem;font-weight:400;color:#4A6741;}
.cm-neural-btn{width:100%;margin-top:10px;padding:7px 0;font-size:.6rem;letter-spacing:.14em;text-transform:uppercase;color:#F7F5F0;background:#4A6741;border:1px solid #4A6741;cursor:pointer;transition:opacity .15s,background .15s;}
.cm-neural-btn:disabled{cursor:wait;opacity:.58;}
.cm-neural-btn:not(:disabled):hover{background:#3f5a38;}
.cm-right{display:flex;align-items:center;gap:10px;}
.cm-collapse{width:20px;height:20px;display:flex;align-items:center;justify-content:center;border:1px solid #D8D3C8;color:rgba(26,26,24,0.6);font-size:0.9rem;line-height:1;cursor:pointer;transition:background .15s,color .15s;}
.cm-collapse:hover{background:rgba(74,103,65,0.08);color:#1A1A18;}
.cm-panel.is-collapsed{padding-bottom:14px;}
.cm-live[role="button"]{cursor:pointer;user-select:none;}
.cm-select{width:100%;margin-top:4px;padding:6px 8px;font-family:inherit;font-size:0.66rem;letter-spacing:0.08em;color:#1A1A18;background:rgba(255,255,255,0.5);border:1px solid #D8D3C8;border-radius:0;cursor:pointer;}
.cm-select:focus{outline:none;border-color:#4A6741;}
.cm-tagline{margin-top:5px;font-size:0.6rem;line-height:1.5;letter-spacing:0.02em;color:rgba(26,26,24,0.45);font-style:italic;}
.cm-rain-canvas{position:absolute;inset:0;z-index:1;pointer-events:none;mix-blend-mode:normal;}
.cm-meteor{position:absolute;width:210px;height:210px;left:var(--mx);top:var(--my);pointer-events:none;transform:translate(-50%,-50%);z-index:4;mix-blend-mode:screen;}
.cm-meteor i{position:absolute;left:50%;top:50%;display:block;border-radius:999px;transform:translate(-50%,-50%);}
.cm-meteor i:nth-child(1){width:4px;height:190px;transform-origin:50% 100%;transform:translate(-50%,-112%) rotate(var(--ma));background:linear-gradient(to top,rgba(255,252,225,1),rgba(226,119,45,.86) 32%,rgba(196,168,130,.24) 70%,transparent);filter:blur(.15px);animation:cm-meteor-streak .9s cubic-bezier(.17,.72,.13,1) forwards;}
.cm-meteor i:nth-child(2){width:72px;height:72px;background:radial-gradient(circle,rgba(255,252,225,.95),rgba(226,119,45,.52) 34%,rgba(74,103,65,.12) 58%,transparent 74%);box-shadow:0 0 42px rgba(226,119,45,.38);animation:cm-impact-core .9s ease-out forwards;}
.cm-meteor i:nth-child(3){width:8px;height:8px;background:rgba(255,250,224,.95);box-shadow:0 0 16px rgba(255,178,88,.7);animation:cm-fragment-a .9s ease-out forwards;}
.cm-meteor i:nth-child(4){width:6px;height:6px;background:rgba(239,236,229,.9);box-shadow:0 0 12px rgba(239,236,229,.55);animation:cm-fragment-b .9s ease-out forwards;}
.cm-meteor[data-kind="2"] i:nth-child(1){background:linear-gradient(to top,rgba(255,255,255,.98),rgba(130,139,143,.9) 36%,rgba(239,236,229,.2) 72%,transparent);}
.cm-meteor[data-kind="2"] i:nth-child(2){background:radial-gradient(circle,rgba(255,255,255,.96),rgba(129,137,142,.62) 38%,rgba(26,26,24,.12) 66%,transparent 78%);box-shadow:0 0 38px rgba(99,110,115,.44);}
.cm-meteor[data-kind="3"] i:nth-child(1){width:5px;background:linear-gradient(to top,rgba(255,253,222,1),rgba(255,116,45,.9) 28%,rgba(74,103,65,.35) 68%,transparent);}
.cm-meteor[data-kind="3"] i:nth-child(2){width:96px;height:96px;background:radial-gradient(circle,rgba(255,252,218,.98),rgba(255,116,45,.7) 34%,rgba(74,103,65,.25) 58%,transparent 78%);box-shadow:0 0 62px rgba(255,116,45,.55);}
@keyframes cm-meteor-streak{0%{opacity:0;transform:translate(-50%,-190%) rotate(var(--ma)) scaleY(.2)}30%{opacity:1}72%{opacity:1}100%{opacity:0;transform:translate(-50%,-16%) rotate(var(--ma)) scaleY(1.04)}}
@keyframes cm-impact-core{0%,48%{opacity:0;transform:translate(-50%,-50%) scale(.16)}60%{opacity:1}100%{opacity:0;transform:translate(-50%,-50%) scale(2.9)}}
@keyframes cm-fragment-a{0%,52%{opacity:0;transform:translate(-50%,-50%) scale(.3)}64%{opacity:1}100%{opacity:0;transform:translate(calc(-50% + 52px),calc(-50% - 34px)) scale(.8)}}
@keyframes cm-fragment-b{0%,54%{opacity:0;transform:translate(-50%,-50%) scale(.3)}68%{opacity:1}100%{opacity:0;transform:translate(calc(-50% - 42px),calc(-50% + 26px)) scale(.7)}}
.cm-panel,.cm-neural{transition:opacity .6s ease;}
.is-faded{opacity:0 !important;pointer-events:none !important;}
.cm-dot{position:absolute;bottom:22px;left:22px;width:8px;height:8px;border-radius:999px;background:rgba(74,103,65,.62);box-shadow:0 0 12px rgba(74,103,65,.5);pointer-events:none;z-index:6;}
@media (prefers-reduced-motion: reduce){.cm-live i,.cm-meteor i{animation:none;}}
`;

export default function Catchment() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rainCanvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [err, setErr] = useState("");
  const [sunDeg, setSunDeg] = useState(135);
  const [exag, setExag] = useState(DEFAULT_VSCALE);
  const [rain, setRain] = useState(0.003);
  const [ero, setEro] = useState(0.6);
  const [mode, setMode] = useState<Mode>("orbit");
  const [pick, setPick] = useState<Pick>(null);
  const [collapsed, setCollapsed] = useState(true); // opens minimised — one tap to expand
  const [neuralCollapsed, setNeuralCollapsed] = useState(true);
  const [openGroups, setOpenGroups] = useState({ water: false, wind: false, light: false });
  const toggleGroup = (k: "water" | "wind" | "light") => setOpenGroups((g) => ({ ...g, [k]: !g[k] }));
  const [windDeg, setWindDeg] = useState(90);
  const [windSpeed, setWindSpeed] = useState(1.2);
  const [meteors, setMeteors] = useState<MeteorFx[]>([]);
  const [surrogateStatus, setSurrogateStatus] = useState<SurrogateStatus>("idle");
  const [surrogateMsg, setSurrogateMsg] = useState("Teacher export ready");
  const [teacherFrames, setTeacherFrames] = useState(0);
  const [modelAvailable, setModelAvailable] = useState(false);
  const [neuralOn, setNeuralOn] = useState(false);
  // let the animation breathe: title retires on first interaction, controls fade when idle
  const { everInteracted, idle } = useIdleUI({ timeout: 3500 });
  const uiVisible = everInteracted && !idle;
  type MapInfo = { id: string; file: string; name: string; tagline: string; rain?: number; wind?: number; secret?: boolean };
  const [maps, setMaps] = useState<MapInfo[]>([]);
  const [mapId, setMapId] = useState("hinterland");
  const [secretUnlocked, setSecretUnlocked] = useState(false);
  const liveClicks = useRef(0);
  const activeMap = maps.find((m) => m.id === mapId);
  const mapFile = activeMap ? `/catchment/${activeMap.file}` : "/catchment/dem.json";
  const visibleMaps = maps.filter((m) => !m.secret || secretUnlocked);

  const sunRef = useRef(135), exagRef = useRef(DEFAULT_VSCALE), rainRef = useRef(0.003), eroRef = useRef(0.6);
  const modeRef = useRef<Mode>("orbit");
  const pourRef = useRef({ gx: 0, gz: 0, on: false });
  const resetRef = useRef(false);
  const resetNowRef = useRef<(() => void) | null>(null);
  const windRef = useRef({ deg: 90, speed: 1.2 });
  const igniteRef = useRef<{ gx: number; gz: number } | null>(null);
  const meteorRef = useRef<{ gx: number; gz: number; radius: number; kind: MeteorKind } | null>(null);
  const meteorIdRef = useRef(0);
  const exportTeacherFrameRef = useRef<(() => Promise<void>) | null>(null);
  const neuralOnRef = useRef(false);
  const neuralReseedRef = useRef(false);
  useEffect(() => { neuralOnRef.current = neuralOn; }, [neuralOn]);
  useEffect(() => { sunRef.current = sunDeg; }, [sunDeg]);
  useEffect(() => { exagRef.current = exag; }, [exag]);
  useEffect(() => { rainRef.current = rain; }, [rain]);
  useEffect(() => { eroRef.current = ero; }, [ero]);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { windRef.current = { deg: windDeg, speed: windSpeed }; }, [windDeg, windSpeed]);
  // Load the map manifest once (a future-proof world list; secret worlds gated below).
  useEffect(() => {
    let alive = true;
    fetch("/catchment/maps.json").then((r) => (r.ok ? r.json() : null)).then((j) => {
      if (alive && j?.maps) setMaps(j.maps as MapInfo[]);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);
  // When you switch worlds, adopt that world's suggested rainfall + wind once.
  useEffect(() => {
    if (activeMap?.rain !== undefined) setRain(activeMap.rain / 1000);
    if (activeMap?.wind !== undefined) setWindDeg(activeMap.wind);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapId]);

  useEffect(() => {
    let disposed = false, raf = 0;
    let cleanupInput: (() => void) | null = null;
    let device: any = null;
    const fail = (m: string) => { if (!disposed) { setErr(m); setStatus("error"); } };

    (async () => {
      const canvas = canvasRef.current; if (!canvas) return;
      if (!disposed) setStatus("loading");
      let dem: CatchmentDEM;
      try {
        const res = await fetch(mapFile);
        if (!res.ok) throw new Error(`asset ${res.status}`);
        dem = decodeDEM((await res.json()) as CatchmentDEMRaw);
      } catch { fail("Couldn't load the catchment DEM."); return; }
      if (disposed) return;

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const n = dem.n, total = n * n, WG = Math.ceil(total / 64);
      const { west, south, east, north } = dem.bounds;
      const latMid = (south + north) / 2;
      const cellMx = ((east - west) * 111320 * Math.cos((latMid * Math.PI) / 180)) / (n - 1);
      const cellWorld = (2 * HALF) / (n - 1);
      const rainCells: RainDrop[] = [];
      for (let r = 1; r < n - 1; r += 2) {
        for (let c = 1; c < n - 1; c += 2) {
          const i = r * n + c;
          const seed = ((Math.sin((c * 12.9898 + r * 78.233) * 437.53) + 1) * 0.5) % 1;
          rainCells.push({
            gx: c,
            gz: r,
            x: (c / (n - 1)) * 2 * HALF - HALF,
            z: (r / (n - 1)) * 2 * HALF - HALF,
            seed,
            speed: 0.8 + seed * 0.55,
            length: 0.08 + seed * 0.05,
            ocean: dem.ocean[i] !== 0,    // rain over the sea ripples the surface too
          });
        }
      }
      const rainDrops = rainCells.sort((a, b) => a.seed - b.seed).slice(0, 820);

      const drawFallback = () => requestAnimationFrame(() => {
        const cv = canvasRef.current; if (!cv) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        cv.width = Math.round(cv.clientWidth * dpr); cv.height = Math.round(cv.clientHeight * dpr);
        paintFallback(dem, cv);
      });
      if (!navigator.gpu) { setStatus("nogpu"); drawFallback(); return; }
      try {
        const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
        if (!adapter) { setStatus("nogpu"); drawFallback(); return; }
        device = await adapter.requestDevice();
      } catch { fail("WebGPU device request failed."); return; }
      if (disposed) { device?.destroy?.(); return; }
      device.lost?.then((info: any) => { if (!disposed) fail(`GPU device lost: ${info?.message ?? ""}`); });

      const ctx = (canvas as any).getContext("webgpu");
      if (!ctx) { fail("Couldn't get a WebGPU canvas context."); return; }
      const format = navigator.gpu.getPreferredCanvasFormat();
      ctx.configure({ device, format, alphaMode: "premultiplied" });

      const ST = GPUBufferUsage.STORAGE;
      const SIM_ST = ST | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST;
      const mkBuf = (arr: Float32Array | Uint32Array, usage: number) => {
        const b = device.createBuffer({ size: arr.byteLength, usage, mappedAtCreation: true });
        const Ctor = arr.constructor as { new (x: ArrayBuffer): Float32Array | Uint32Array };
        new Ctor(b.getMappedRange()).set(arr as any); b.unmap(); return b;
      };
      const zeroBuf = (bytes: number) => device.createBuffer({ size: bytes, usage: SIM_ST });

      // Beach: distance (in cells) from every land cell to the nearest ocean, via a
      // multi-source BFS, then ramp the coastal band down to a gentle sandy foreshore
      // so the shoreline reads as a beach instead of a sharp cliff.
      const SEA_ELEV = 0.06;                       // normalised sea level (matches vs*0.06)
      // Wide enough to ramp the tall coastal escarpment (elev ~0.5–0.8) down to the
      // waterline as a gentle beach rather than a sliver that still reads as a cliff.
      const BEACH_CELLS = Math.max(14, Math.round(n * 0.11));
      const distOcean = new Int32Array(total).fill(-1);
      const bfsQ = new Int32Array(total);
      let qh = 0, qt = 0;
      for (let i = 0; i < total; i++) if (dem.ocean[i]) { distOcean[i] = 0; bfsQ[qt++] = i; }
      while (qh < qt) {
        const i = bfsQ[qh++], r = (i / n) | 0, c = i % n, d = distOcean[i];
        if (d >= BEACH_CELLS) continue;            // only need the band, stop expanding past it
        if (c > 0 && distOcean[i - 1] < 0) { distOcean[i - 1] = d + 1; bfsQ[qt++] = i - 1; }
        if (c < n - 1 && distOcean[i + 1] < 0) { distOcean[i + 1] = d + 1; bfsQ[qt++] = i + 1; }
        if (r > 0 && distOcean[i - n] < 0) { distOcean[i - n] = d + 1; bfsQ[qt++] = i - n; }
        if (r < n - 1 && distOcean[i + n] < 0) { distOcean[i + n] = d + 1; bfsQ[qt++] = i + n; }
      }
      const elevField = Float32Array.from(dem.elev);
      const beachStrength = new Float32Array(total); // 0..1, strongest at the waterline
      for (let i = 0; i < total; i++) {
        const d = distOcean[i];
        if (dem.ocean[i] || d <= 0 || d > BEACH_CELLS) continue;
        const orig = dem.elev[i];
        if (orig <= SEA_ELEV) continue;            // already at/below the water — leave it
        const t = d / BEACH_CELLS;                 // 0 near water → 1 at the inner edge
        const s = t * t * (3 - 2 * t);             // smoothstep → gentle slope by the water
        elevField[i] = SEA_ELEV + (orig - SEA_ELEV) * s;
        beachStrength[i] = 1 - s;
      }

      const bedInit = new Float32Array(total);
      for (let i = 0; i < total; i++) {
        const r = Math.floor(i / n), c = i % n;
        const dist = Math.min(Math.min(c, n - 1 - c), Math.min(r, n - 1 - r)) / (n - 1);
        const t = Math.min(1, dist / 0.10);
        const fade = t * t * (3 - 2 * t); // smoothstep: 0 at edges, 1 beyond 10% inward
        bedInit[i] = elevField[i] * HSCALE * fade;
      }

      // Ocean-side shoreline: distance (in cells) from each ocean cell back to land,
      // so the sea can shallow to turquoise and break into surf as it nears the sand.
      const SHORE_CELLS = 6;
      const distLand = new Int32Array(total).fill(-1);
      qh = 0; qt = 0;
      for (let i = 0; i < total; i++) if (!dem.ocean[i]) { distLand[i] = 0; bfsQ[qt++] = i; }
      while (qh < qt) {
        const i = bfsQ[qh++], r = (i / n) | 0, c = i % n, dd = distLand[i];
        if (dd >= SHORE_CELLS) continue;           // only the surf band needs filling
        if (c > 0 && distLand[i - 1] < 0 && dem.ocean[i - 1]) { distLand[i - 1] = dd + 1; bfsQ[qt++] = i - 1; }
        if (c < n - 1 && distLand[i + 1] < 0 && dem.ocean[i + 1]) { distLand[i + 1] = dd + 1; bfsQ[qt++] = i + 1; }
        if (r > 0 && distLand[i - n] < 0 && dem.ocean[i - n]) { distLand[i - n] = dd + 1; bfsQ[qt++] = i - n; }
        if (r < n - 1 && distLand[i + n] < 0 && dem.ocean[i + n]) { distLand[i + n] = dd + 1; bfsQ[qt++] = i + n; }
      }

      // flags bits 2–5 carry a 0–15 "shore strength": beach proximity on land cells,
      // surf proximity on ocean cells. The terrain shader reads it only for land, the
      // water shader only for ocean, so the same nibble serves both with no clash.
      const flags = new Uint32Array(total);
      for (let i = 0; i < total; i++) {
        let q4: number;
        if (dem.ocean[i]) {
          const dl = distLand[i];
          q4 = dl > 0 && dl <= SHORE_CELLS ? Math.round((1 - (dl - 1) / SHORE_CELLS) * 15) : 0;
        } else {
          q4 = Math.round(Math.min(1, beachStrength[i]) * 15);
        }
        flags[i] = (dem.ocean[i] ? 1 : 0) | (dem.stream[i] ? 2 : 0) | (q4 << 2);
      }
      const oceanU = new Uint32Array(total);
      for (let i = 0; i < total; i++) oceanU[i] = dem.ocean[i] ? 1 : 0;

      const bedBuf = mkBuf(bedInit, SIM_ST);
      const bed0Buf = mkBuf(bedInit, SIM_ST);
      const watBuf = zeroBuf(total * 4);
      const fluxBuf = zeroBuf(total * 16);
      const velBuf = zeroBuf(total * 8);
      const sedABuf = zeroBuf(total * 4);
      const sedBBuf = zeroBuf(total * 4);
      const oceanBuf = mkBuf(oceanU, SIM_ST);
      const flagsBuf = mkBuf(flags, SIM_ST);
      const nrmBuf = zeroBuf(total * 16);

      // M3 ecology: fuel (vegetation) init from slope — gentle ground carries more.
      const fuelInit = new Float32Array(total);
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
        const i = r * n + c;
        if (dem.ocean[i]) { fuelInit[i] = 0; continue; }
        const hl = dem.elev[r * n + Math.max(0, c - 1)], hr = dem.elev[r * n + Math.min(n - 1, c + 1)];
        const hu = dem.elev[Math.max(0, r - 1) * n + c], hd = dem.elev[Math.min(n - 1, r + 1) * n + c];
        const sl = Math.min(1, Math.hypot(hl - hr, hu - hd) * 6);
        fuelInit[i] = Math.max(0.05, 1 - sl * 0.8) * (1 - beachStrength[i] * 0.85); // bare sand barely burns
      }
      const fuelBuf = mkBuf(fuelInit, SIM_ST);
      const fireBuf = zeroBuf(total * 4);
      const charBuf = zeroBuf(total * 4);
      const heatBuf = zeroBuf(total * 4);

      const simBuf = device.createBuffer({ size: 144, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      const ruBuf = device.createBuffer({ size: 144, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      const simData = new Float32Array(36), ruData = new Float32Array(36);

      const cs = (code: string) => device.createShaderModule({ code });
      let mods: any;
      try {
        mods = {
          addRain: cs(ADDRAIN_WGSL), flux: cs(FLUX_WGSL), waterVel: cs(WATERVEL_WGSL),
          erode: cs(ERODE_WGSL), transport: cs(TRANSPORT_WGSL), finalize: cs(FINALIZE_WGSL),
          normals: cs(NORMALS_WGSL), terrain: cs(RENDER_TERRAIN_WGSL), water: cs(RENDER_WATER_WGSL),
          skirt: cs(RENDER_SKIRT_WGSL), spread: cs(SPREAD_WGSL), burn: cs(BURN_WGSL),
          meteor: cs(METEOR_WGSL),
        };
        const checks = await Promise.all(Object.values(mods).map((m: any) => m.getCompilationInfo?.() ?? Promise.resolve({ messages: [] })));
        const errs = checks.flatMap((ci: any) => (ci.messages ?? []).filter((m: any) => m.type === "error"));
        if (errs.length) throw new Error(errs.map((m: any) => m.message).join(" | "));
      } catch (e: any) { fail(`Shader error: ${e?.message ?? e}`); return; }

      const cpipe = (m: any) => device.createComputePipeline({ layout: "auto", compute: { module: m, entryPoint: "main" } });
      let P: any;
      try {
        P = {
          addRain: cpipe(mods.addRain), flux: cpipe(mods.flux), waterVel: cpipe(mods.waterVel),
          erode: cpipe(mods.erode), transport: cpipe(mods.transport), finalize: cpipe(mods.finalize),
          normals: cpipe(mods.normals), spread: cpipe(mods.spread), burn: cpipe(mods.burn), meteor: cpipe(mods.meteor),
          terrain: device.createRenderPipeline({
            layout: "auto",
            vertex: { module: mods.terrain, entryPoint: "vs" },
            fragment: { module: mods.terrain, entryPoint: "fs", targets: [{ format }] },
            primitive: { topology: "triangle-list", cullMode: "none" },
            multisample: { count: SAMPLE_COUNT },
            depthStencil: { format: "depth24plus", depthWriteEnabled: true, depthCompare: "less" },
          }),
          water: device.createRenderPipeline({
            layout: "auto",
            vertex: { module: mods.water, entryPoint: "vs" },
            fragment: {
              module: mods.water, entryPoint: "fs",
              targets: [{
                format,
                blend: {
                  color: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
                  alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
                },
              }],
            },
            primitive: { topology: "triangle-list", cullMode: "none" },
            multisample: { count: SAMPLE_COUNT },
            depthStencil: { format: "depth24plus", depthWriteEnabled: false, depthCompare: "less" },
          }),
          skirt: device.createRenderPipeline({
            layout: "auto",
            vertex: { module: mods.skirt, entryPoint: "vs" },
            fragment: { module: mods.skirt, entryPoint: "fs", targets: [{ format }] },
            primitive: { topology: "triangle-list", cullMode: "none" },
            multisample: { count: SAMPLE_COUNT },
            depthStencil: { format: "depth24plus", depthWriteEnabled: true, depthCompare: "less" },
          }),
        };
      } catch (e: any) { fail(`Pipeline error: ${e?.message ?? e}`); return; }

      const bg = (pipe: any, entries: any[]) => device.createBindGroup({ layout: pipe.getBindGroupLayout(0), entries: entries.map((buffer, binding) => ({ binding, resource: { buffer } })) });
      const BG = {
        addRain: bg(P.addRain, [simBuf, watBuf]),
        flux: bg(P.flux, [simBuf, bedBuf, watBuf, fluxBuf]),
        waterVel: bg(P.waterVel, [simBuf, fluxBuf, watBuf, velBuf]),
        erode: bg(P.erode, [simBuf, bedBuf, velBuf, sedABuf]),
        transport: bg(P.transport, [simBuf, sedABuf, velBuf, sedBBuf]),
        finalize: bg(P.finalize, [simBuf, oceanBuf, bed0Buf, bedBuf, watBuf, sedABuf, sedBBuf]),
        normals: bg(P.normals, [simBuf, bedBuf, nrmBuf]),
        spread: bg(P.spread, [simBuf, fireBuf, bedBuf, heatBuf, fuelBuf, watBuf, oceanBuf]),
        burn: bg(P.burn, [simBuf, heatBuf, fuelBuf, fireBuf, charBuf, watBuf, oceanBuf]),
        meteor: bg(P.meteor, [simBuf, bedBuf, watBuf, velBuf, fuelBuf, fireBuf, charBuf, oceanBuf]),
        terrain: bg(P.terrain, [ruBuf, bedBuf, nrmBuf, flagsBuf, sedABuf, fuelBuf, charBuf, fireBuf]),
        water: bg(P.water, [ruBuf, bedBuf, watBuf, flagsBuf, velBuf]),
      };

      let colorTex: any = null, depthTex: any = null, attachmentW = 0, attachmentH = 0;
      // Bloom resources (assigned later in the gated post-setup block; null = no bloom).
      let bloomOK = false, Ppost: any = null, bloomSamp: any = null;
      let brightBuf: any = null, blurHBuf: any = null, blurVBuf: any = null, compBuf: any = null;
      let sceneTex: any = null, bloomA: any = null, bloomB: any = null;
      let bgBright: any = null, bgBlurH: any = null, bgBlurV: any = null, bgComp: any = null;
      const sizeCanvas = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = Math.max(1, Math.round(canvas.clientWidth * dpr)), h = Math.max(1, Math.round(canvas.clientHeight * dpr));
        if (canvas.width !== w) canvas.width = w;
        if (canvas.height !== h) canvas.height = h;
        return { w, h };
      };
      const ensureAttachments = (w: number, h: number) => {
        if (colorTex && depthTex && attachmentW === w && attachmentH === h) return;
        colorTex?.destroy?.();
        depthTex?.destroy?.();
        colorTex = device.createTexture({
          size: [w, h],
          sampleCount: SAMPLE_COUNT,
          format,
          usage: GPUTextureUsage.RENDER_ATTACHMENT,
        });
        depthTex = device.createTexture({
          size: [w, h],
          sampleCount: SAMPLE_COUNT,
          format: "depth24plus",
          usage: GPUTextureUsage.RENDER_ATTACHMENT,
        });
        if (bloomOK) {
          sceneTex?.destroy?.(); bloomA?.destroy?.(); bloomB?.destroy?.();
          const RA = GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING;
          sceneTex = device.createTexture({ size: [w, h], format, usage: RA });
          const bw = Math.max(1, w >> 1), bh = Math.max(1, h >> 1);
          bloomA = device.createTexture({ size: [bw, bh], format, usage: RA });
          bloomB = device.createTexture({ size: [bw, bh], format, usage: RA });
          const sv = sceneTex.createView(), av = bloomA.createView(), bv = bloomB.createView();
          bgBright = device.createBindGroup({ layout: Ppost.bright.getBindGroupLayout(0), entries: [{ binding: 0, resource: bloomSamp }, { binding: 1, resource: sv }, { binding: 2, resource: { buffer: brightBuf } }] });
          bgBlurH = device.createBindGroup({ layout: Ppost.blur.getBindGroupLayout(0), entries: [{ binding: 0, resource: bloomSamp }, { binding: 1, resource: av }, { binding: 2, resource: { buffer: blurHBuf } }] });
          bgBlurV = device.createBindGroup({ layout: Ppost.blur.getBindGroupLayout(0), entries: [{ binding: 0, resource: bloomSamp }, { binding: 1, resource: bv }, { binding: 2, resource: { buffer: blurVBuf } }] });
          bgComp = device.createBindGroup({ layout: Ppost.composite.getBindGroupLayout(0), entries: [{ binding: 0, resource: bloomSamp }, { binding: 1, resource: sv }, { binding: 2, resource: av }, { binding: 3, resource: { buffer: compBuf } }] });
          // blur step = one texel of the half-res target
          device.queue.writeBuffer(blurHBuf, 0, new Float32Array([1 / bw, 0, 0, 0]));
          device.queue.writeBuffer(blurVBuf, 0, new Float32Array([0, 1 / bh, 0, 0]));
        }
        attachmentW = w; attachmentH = h;
      };

      const zeroBig = new Float32Array(total * 4);
      const doReset = () => {
        device.queue.writeBuffer(bedBuf, 0, bedInit);
        device.queue.writeBuffer(watBuf, 0, zeroBig.subarray(0, total));
        device.queue.writeBuffer(fluxBuf, 0, zeroBig.subarray(0, total * 4));
        device.queue.writeBuffer(velBuf, 0, zeroBig.subarray(0, total * 2));
        device.queue.writeBuffer(sedABuf, 0, zeroBig.subarray(0, total));
        device.queue.writeBuffer(sedBBuf, 0, zeroBig.subarray(0, total));
        device.queue.writeBuffer(fuelBuf, 0, fuelInit);
        device.queue.writeBuffer(fireBuf, 0, zeroBig.subarray(0, total));
        device.queue.writeBuffer(charBuf, 0, zeroBig.subarray(0, total));
        device.queue.writeBuffer(heatBuf, 0, zeroBig.subarray(0, total));
      };
      resetNowRef.current = () => {
        doReset();
        pourRef.current.on = false;
        igniteRef.current = null;
        meteorRef.current = null;
        pickU.on = 0;
        setPick(null);
        setMeteors([]);
      };
      const copyFloatBuffer = async (buffer: any, floats: number) => {
        const bytes = floats * 4;
        const readback = device.createBuffer({ size: bytes, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
        const enc = device.createCommandEncoder();
        enc.copyBufferToBuffer(buffer, 0, readback, 0, bytes);
        device.queue.submit([enc.finish()]);
        await readback.mapAsync(GPUMapMode.READ);
        const mapped = readback.getMappedRange();
        const out = new Float32Array(mapped.slice(0));
        readback.unmap();
        readback.destroy?.();
        return out;
      };
      const downsampleScalar = (field: Float32Array, stride: number) => {
        const out: number[] = [];
        for (let r = 0; r < n; r += stride) {
          for (let c = 0; c < n; c += stride) out.push(+field[r * n + c].toFixed(5));
        }
        return out;
      };
      const downsampleVec2 = (field: Float32Array, stride: number) => {
        const out: number[] = [];
        for (let r = 0; r < n; r += stride) {
          for (let c = 0; c < n; c += stride) {
            const i = (r * n + c) * 2;
            out.push(+field[i].toFixed(5), +field[i + 1].toFixed(5));
          }
        }
        return out;
      };
      exportTeacherFrameRef.current = async () => {
        try {
          setSurrogateStatus("exporting");
          setSurrogateMsg("Reading GPU state");
          const stride = Math.max(1, Math.floor(n / 40));
          const sampleN = Math.ceil(n / stride);
          const [bed, water, velocity, sediment, fuel, fire, charr] = await Promise.all([
            copyFloatBuffer(bedBuf, total),
            copyFloatBuffer(watBuf, total),
            copyFloatBuffer(velBuf, total * 2),
            copyFloatBuffer(sedABuf, total),
            copyFloatBuffer(fuelBuf, total),
            copyFloatBuffer(fireBuf, total),
            copyFloatBuffer(charBuf, total),
          ]);
          const wd = windRef.current;
          const payload = {
            version: 1,
            kind: "catchment-teacher-frame",
            createdAt: new Date().toISOString(),
            source: "WebGPU physics teacher",
            grid: { n, sampleN, stride, half: HALF, hscale: HSCALE },
            forcings: {
              rain: rainRef.current,
              erosion: eroRef.current,
              relief: exagRef.current,
              windDeg: wd.deg,
              windSpeed: wd.speed,
            },
            channels: {
              bed: downsampleScalar(bed, stride),
              water: downsampleScalar(water, stride),
              velocity: downsampleVec2(velocity, stride),
              sediment: downsampleScalar(sediment, stride),
              fuel: downsampleScalar(fuel, stride),
              fire: downsampleScalar(fire, stride),
              char: downsampleScalar(charr, stride),
            },
          };
          const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `catchment-teacher-frame-${Date.now()}.json`;
          a.click();
          URL.revokeObjectURL(url);
          setTeacherFrames((v) => v + 1);
          setSurrogateStatus("ready");
          setSurrogateMsg(`Exported ${sampleN}x${sampleN} teacher frame`);
        } catch {
          setSurrogateStatus("error");
          setSurrogateMsg("Teacher export failed");
        }
      };

      const target: Vec3 = [0, DEFAULT_VSCALE * 0.32, 0];
      const cam = { az: -0.85, el: 0.62, dist: 3.0 }, camT = { az: -0.85, el: 0.62, dist: 3.0 };
      let dragging = false, lastX = 0, lastY = 0, downX = 0, downY = 0;
      let lastInteractTime = performance.now();
      const pickU = { x: 0, z: 0, on: 0 };
      let lastMVP: Mat4 = new Float32Array(16);

      const elevAt = (wx: number, wz: number) => {
        const gx = ((wx + HALF) / (2 * HALF)) * (n - 1), gz = ((wz + HALF) / (2 * HALF)) * (n - 1);
        const c = Math.max(0, Math.min(n - 1, Math.round(gx))), r = Math.max(0, Math.min(n - 1, Math.round(gz)));
        if (dem.ocean[r * n + c]) return DEFAULT_VSCALE * 0.06;
        return sampleElev(dem, gx, gz) * exagRef.current;
      };
      const worldUnder = (clientX: number, clientY: number): Vec3 | null => {
        const rect = canvas.getBoundingClientRect();
        const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1, ndcY = 1 - ((clientY - rect.top) / rect.height) * 2;
        const inv = invert(lastMVP);
        const a = transformVec4(inv, [ndcX, ndcY, 0, 1]), b = transformVec4(inv, [ndcX, ndcY, 1, 1]);
        const o: Vec3 = [a[0] / a[3], a[1] / a[3], a[2] / a[3]], f: Vec3 = [b[0] / b[3], b[1] / b[3], b[2] / b[3]];
        let dx = f[0] - o[0], dy = f[1] - o[1], dz = f[2] - o[2]; const dl = Math.hypot(dx, dy, dz) || 1; dx /= dl; dy /= dl; dz /= dl;
        let prevAbove = true;
        for (let t = 0; t < 9; t += 0.012) {
          const px = o[0] + dx * t, py = o[1] + dy * t, pz = o[2] + dz * t;
          if (px < -HALF || px > HALF || pz < -HALF || pz > HALF) { prevAbove = true; continue; }
          if (py <= elevAt(px, pz) && prevAbove) return [px, py, pz];
          prevAbove = py > elevAt(px, pz);
        }
        return null;
      };
      const projectToScreen = (m: Mat4, point: Vec3, w: number, h: number): [number, number, number] | null => {
        const p = transformVec4(m, [point[0], point[1], point[2], 1]);
        if (p[3] <= 0.0001) return null;
        const nx = p[0] / p[3], ny = p[1] / p[3], nz = p[2] / p[3];
        if (nx < -1.15 || nx > 1.15 || ny < -1.15 || ny > 1.15 || nz < 0 || nz > 1.1) return null;
        return [(nx * 0.5 + 0.5) * w, (0.5 - ny * 0.5) * h, nz];
      };
      const drawRain = (m: Mat4, w: number, h: number, vs: number) => {
        const rc = rainCanvasRef.current;
        if (!rc) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        if (rc.width !== w || rc.height !== h) { rc.width = w; rc.height = h; }
        const ctx2 = rc.getContext("2d");
        if (!ctx2) return;
        ctx2.setTransform(1, 0, 0, 1, 0, 0);
        ctx2.clearRect(0, 0, w, h);
        const rainAmt = rainRef.current;
        if (rainAmt < 0.0005 || reduced) return;

        const wind = windRef.current;
        const windRad = (wind.deg * Math.PI) / 180;
        const wx = Math.cos(windRad), wz = Math.sin(windRad);
        const intensity = Math.min(1, rainAmt / 0.02);
        const active = Math.floor(rainDrops.length * (0.14 + intensity * 0.84));
        const now = performance.now() * 0.001;
        ctx2.lineCap = "round";

        for (let k = 0; k < active; k++) {
          const drop = rainDrops[(k * 37) % rainDrops.length];
          // depth layering: seed sorts drops near→far. Near drops fall faster, streak
          // longer and brighter; far drops are short, faint and slow → parallax depth.
          const depth = drop.seed;                                  // 0 far .. 1 near
          const fall = 0.6 + depth * 0.95;
          const phase = (drop.seed + now * drop.speed * fall * (0.8 + wind.speed * 0.06)) % 1;
          const surfaceY = drop.ocean ? vs * 0.06 : sampleElev(dem, drop.gx, drop.gz) * vs;
          const groundY = surfaceY + 0.004;
          const lean = (0.03 + wind.speed * 0.02) * phase;
          const skyY = groundY + 0.42 + intensity * 0.18 + depth * 0.14;
          const tipY = groundY + (skyY - groundY) * (1 - phase);
          const tip: Vec3 = [drop.x - wx * lean, tipY, drop.z - wz * lean];
          const fallLen = drop.length * (0.5 + depth * 0.7 + intensity * 0.2);
          const tail: Vec3 = [
            tip[0] - wx * (drop.length * (0.16 + wind.speed * 0.08)),
            tip[1] + fallLen,
            tip[2] - wz * (drop.length * (0.16 + wind.speed * 0.08)),
          ];
          const a = projectToScreen(m, tail, w, h);
          const b = projectToScreen(m, tip, w, h);
          if (!a || !b) continue;
          const vx2 = b[0] - a[0];
          const vy2 = b[1] - a[1];
          const len2 = Math.hypot(vx2, vy2) || 1;
          const maxLen = dpr * (10 + depth * 16 + intensity * 10 + wind.speed * 1.6);
          const drawn = Math.min(len2, maxLen);
          const sx = b[0] - (vx2 / len2) * drawn;
          const sy = b[1] - (vy2 / len2) * drawn;
          // motion-blurred streak: fully transparent tail fading up to a cool head,
          // so each drop reads as a soft streak of falling water, not a hard scratch
          // a slate blue-grey, dark enough to read against the bright sky yet still
          // cool over the terrain; alpha pushed up so the rain is clearly present
          const headA = (0.30 + intensity * 0.4) * (0.5 + depth * 0.5) * (0.5 + Math.sin(phase * Math.PI) * 0.5);
          const grad = ctx2.createLinearGradient(sx, sy, b[0], b[1]);
          grad.addColorStop(0, "rgba(82,104,128,0)");
          grad.addColorStop(0.55, `rgba(88,110,134,${headA * 0.5})`);
          grad.addColorStop(1, `rgba(96,120,146,${headA})`);
          ctx2.strokeStyle = grad;
          ctx2.lineWidth = Math.max(0.6, dpr * (0.55 + depth * 0.65 + intensity * 0.25));
          ctx2.beginPath();
          ctx2.moveTo(sx, sy);
          ctx2.lineTo(b[0], b[1]);
          ctx2.stroke();

          // impact: a bright splash core then an expanding ripple ring on the surface
          // it lands on — wider and cooler on water, tight and pale on the ground
          if (phase > 0.86) {
            const g = projectToScreen(m, [drop.x, groundY, drop.z], w, h);
            if (!g) continue;
            const pulse = (phase - 0.86) / 0.14;                    // 0 → 1 over the impact
            const fade = 1 - pulse;
            const ringR = dpr * (0.8 + pulse * (drop.ocean ? 5.4 : 3.2));
            ctx2.strokeStyle = drop.ocean
              ? `rgba(206,226,236,${fade * (0.16 + intensity * 0.22)})`
              : `rgba(230,236,232,${fade * (0.12 + intensity * 0.18)})`;
            ctx2.lineWidth = Math.max(0.5, dpr * 0.3);
            ctx2.beginPath();
            ctx2.ellipse(g[0], g[1], ringR, ringR * 0.36, -0.42, 0, Math.PI * 2);
            ctx2.stroke();
            if (pulse < 0.45) {
              ctx2.fillStyle = `rgba(242,247,245,${(0.45 - pulse) * (0.5 + intensity * 0.5)})`;
              ctx2.beginPath();
              ctx2.arc(g[0], g[1], Math.max(0.6, dpr * (0.6 + pulse * 0.8)), 0, Math.PI * 2);
              ctx2.fill();
            }
          }
        }
      };
      const setPour = (clientX: number, clientY: number) => {
        const w = worldUnder(clientX, clientY);
        if (!w) { pourRef.current.on = false; return; }
        pourRef.current = {
          gx: ((w[0] + HALF) / (2 * HALF)) * (n - 1),
          gz: ((w[2] + HALF) / (2 * HALF)) * (n - 1),
          on: true,
        };
        pickU.x = w[0]; pickU.z = w[2]; pickU.on = 1; // show a ring where water lands
      };
      const launchMeteor = (clientX: number, clientY: number, w: Vec3) => {
        const kind = (1 + Math.floor(Math.random() * 3)) as MeteorKind;
        const radius = kind === 2 ? 8.5 : kind === 3 ? 7.0 : 5.5;
        meteorRef.current = {
          gx: ((w[0] + HALF) / (2 * HALF)) * (n - 1),
          gz: ((w[2] + HALF) / (2 * HALF)) * (n - 1),
          radius,
          kind,
        };
        pickU.x = w[0]; pickU.z = w[2]; pickU.on = 1;
        const rect = canvas.getBoundingClientRect();
        const id = ++meteorIdRef.current;
        const angle = -36 + Math.random() * 20;
        setMeteors((items) => [...items.slice(-5), { id, x: clientX - rect.left, y: clientY - rect.top, kind, angle }]);
        window.setTimeout(() => {
          setMeteors((items) => items.filter((item) => item.id !== id));
        }, 900);
      };

      const onDown = (e: PointerEvent) => {
        lastInteractTime = performance.now();
        dragging = true; lastX = e.clientX; lastY = e.clientY; downX = e.clientX; downY = e.clientY;
        try { canvas.setPointerCapture?.(e.pointerId); } catch { /* Synthetic pointer events may not have an active capture target. */ }
        if (modeRef.current === "pour") setPour(e.clientX, e.clientY);
      };
      const onUp = (e: PointerEvent) => {
        dragging = false; pourRef.current.on = false;
        try {
          if (canvas.hasPointerCapture?.(e.pointerId)) canvas.releasePointerCapture?.(e.pointerId);
        } catch { /* Ignore synthetic events that were never captured. */ }
      };
      const onMove = (e: PointerEvent) => {
        lastInteractTime = performance.now();
        if (!dragging) return;
        if (modeRef.current === "pour") { setPour(e.clientX, e.clientY); return; }
        camT.az -= (e.clientX - lastX) * 0.005;
        camT.el = Math.max(0.1, Math.min(1.45, camT.el + (e.clientY - lastY) * 0.005));
        lastX = e.clientX; lastY = e.clientY;
      };
      const onWheel = (e: WheelEvent) => { e.preventDefault(); lastInteractTime = performance.now(); camT.dist = Math.max(1.7, Math.min(6, camT.dist * (1 + e.deltaY * 0.0012))); };
      const onClick = (e: PointerEvent) => {
        if (modeRef.current === "pour") return;
        if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return;
        const w = worldUnder(e.clientX, e.clientY);
        if (!w) { pickU.on = 0; setPick(null); return; }
        if (modeRef.current === "ignite") {
          igniteRef.current = { gx: ((w[0] + HALF) / (2 * HALF)) * (n - 1), gz: ((w[2] + HALF) / (2 * HALF)) * (n - 1) };
          pickU.x = w[0]; pickU.z = w[2]; pickU.on = 1;
          return;
        }
        if (modeRef.current === "meteor") {
          launchMeteor(e.clientX, e.clientY, w);
          return;
        }
        pickU.x = w[0]; pickU.z = w[2]; pickU.on = 1;
        const gx = ((w[0] + HALF) / (2 * HALF)) * (n - 1), gz = ((w[2] + HALF) / (2 * HALF)) * (n - 1);
        const c = Math.max(1, Math.min(n - 2, Math.round(gx))), r = Math.max(1, Math.min(n - 2, Math.round(gz)));
        const ddx = (dem.elev[r * n + c + 1] - dem.elev[r * n + c - 1]) * dem.elevMaxM / (2 * cellMx);
        const ddz = (dem.elev[(r + 1) * n + c] - dem.elev[(r - 1) * n + c]) * dem.elevMaxM / (2 * cellMx);
        setPick({
          elevM: Math.round(sampleElev(dem, gx, gz) * dem.elevMaxM),
          slopeDeg: Math.round((Math.atan(Math.hypot(ddx, ddz)) * 180) / Math.PI),
          lng: west + (gx / (n - 1)) * (east - west), lat: north - (gz / (n - 1)) * (north - south),
        });
      };
      canvas.addEventListener("pointerdown", onDown);
      canvas.addEventListener("pointerup", onUp);
      canvas.addEventListener("pointerleave", onUp);
      canvas.addEventListener("pointermove", onMove);
      canvas.addEventListener("wheel", onWheel, { passive: false });
      canvas.addEventListener("click", onClick);
      cleanupInput = () => {
        canvas.removeEventListener("pointerdown", onDown); canvas.removeEventListener("pointerup", onUp);
        canvas.removeEventListener("pointerleave", onUp); canvas.removeEventListener("pointermove", onMove);
        canvas.removeEventListener("wheel", onWheel); canvas.removeEventListener("click", onClick);
      };

      setStatus("running");

      // grid index buffer (two triangles per quad)
      const quads = (n - 1) * (n - 1);
      const idx = new Uint32Array(quads * 6);
      let p = 0;
      for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) {
        const a = r * n + c, b = a + 1, d = a + n, e = d + 1;
        idx[p++] = a; idx[p++] = d; idx[p++] = b; idx[p++] = b; idx[p++] = d; idx[p++] = e;
      }
      const indexBuf = mkBuf(idx, GPUBufferUsage.INDEX);

      // Pedestal skirt: a thin vertical wall, a softened bevel, and a wider base
      // so the terrain reads as an intentional physical land model, not a cut-off cube.
      const packSkirt = (cell: number, band: number) => cell | (band << 28);
      const sk: number[] = [];
      const strip = (a: number, b: number, bandA: number, bandB: number) => {
        const a0 = packSkirt(a, bandA), b0 = packSkirt(b, bandA), a1 = packSkirt(a, bandB), b1 = packSkirt(b, bandB);
        sk.push(a0, a1, b0, b0, a1, b1);
      };
      const wall = (a: number, b: number) => {
        strip(a, b, 0, 1); // top edge into softened vertical wall
        strip(a, b, 1, 2); // wall into outward bevel
        strip(a, b, 2, 3); // bevel into low base plinth
      };
      for (let c = 0; c < n - 1; c++) wall(c, c + 1);                                   // north (r=0)
      for (let c = 0; c < n - 1; c++) wall((n - 1) * n + c + 1, (n - 1) * n + c);       // south
      for (let r = 0; r < n - 1; r++) wall((r + 1) * n, r * n);                         // west (c=0)
      for (let r = 0; r < n - 1; r++) wall(r * n + (n - 1), (r + 1) * n + (n - 1));     // east
      const TL = 0, TR = n - 1, BL = (n - 1) * n, BR = n * n - 1;                       // base face
      sk.push(packSkirt(TL, 3), packSkirt(BL, 3), packSkirt(TR, 3), packSkirt(TR, 3), packSkirt(BL, 3), packSkirt(BR, 3));
      const skirtBuf = mkBuf(new Uint32Array(sk), ST);
      const skirtCount = sk.length;
      const BGskirt = device.createBindGroup({ layout: P.skirt.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: ruBuf } }, { binding: 1, resource: { buffer: bedBuf } }, { binding: 2, resource: { buffer: skirtBuf } }] });

      // ---- M4: neural surrogate (GPU inference). Fully gated + isolated: if a
      // valid catchment-surrogate-v2 model is absent or anything fails, the
      // physics engine is completely untouched. Mirrors lib/catchment/surrogate.ts.
      let neuralOK = false;
      let neuralWatBuf: any = null;
      let bgWaterNeural: any = null;
      let runNeural: ((encoder: any) => void) | null = null;
      try {
        const sres = await fetch("/catchment/surrogate.json");
        if (sres.ok && !disposed) {
          const model = decodeSurrogate(await sres.json());
          if (model && model.arch.layers.length > 1) {
            const layers = model.arch.layers;
            const maxC = Math.max(3, ...layers.map((l) => l.out));
            const featA = zeroBuf(maxC * total * 4);
            const featB = zeroBuf(maxC * total * 4);
            neuralWatBuf = zeroBuf(total * 4);
            const auBuf = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
            const puBuf = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
            // PU = { n:u32, rain:f32, dt:f32, evap:f32 }. n/dt/evap are constant; rain
            // is refreshed each frame in runNeural. dt/evap come from the model JSON so
            // the WGSL apply matches canonical_step in the trainer exactly.
            const nDt = model.arch.dt ?? 0.02;
            const nEvap = model.arch.evap ?? 0.012;
            const nMods = { asm: cs(NEURAL_ASSEMBLE_WGSL), conv: cs(NEURAL_CONV_WGSL), apply: cs(NEURAL_APPLY_WGSL) };
            const Pn = { asm: cpipe(nMods.asm), conv: cpipe(nMods.conv), apply: cpipe(nMods.apply) };
            const actCode = (a: string) => (a === "gelu" ? 1 : a === "relu" ? 2 : 0);
            let cur = featA, nxt = featB;
            const convBGs: { bg: any; count: number }[] = [];
            for (const l of layers) {
              const wBuf = mkBuf(model.weights[l.name + ".w"], ST);
              const bBuf = mkBuf(model.weights[l.name + ".b"], ST);
              const cuBuf = device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
              const cub = new ArrayBuffer(32); const u32 = new Uint32Array(cub);
              u32[0] = n; u32[1] = l.in; u32[2] = l.out; u32[3] = l.dilation; u32[4] = actCode(l.act); u32[5] = l.residual ? 1 : 0;
              device.queue.writeBuffer(cuBuf, 0, cub);
              convBGs.push({ bg: bg(Pn.conv, [cuBuf, cur, nxt, wBuf, bBuf]), count: Math.ceil((l.out * total) / 64) });
              const t = cur; cur = nxt; nxt = t;
            }
            const fluxBufN = cur; // last layer (out=2) edge flux (gx,gy) lives here
            // bedNorm input uses the STATIC edge-faded bed (bed0Buf), matching the
            // bed the model trains on. (The live bedBuf erodes over time; the model
            // was trained on a static bed, so feeding it the live bed would drift the
            // input off-distribution.)
            const bgAsm = bg(Pn.asm, [auBuf, neuralWatBuf, bed0Buf, featA]);
            const bgApply = bg(Pn.apply, [puBuf, fluxBufN, neuralWatBuf, oceanBuf]);
            bgWaterNeural = bg(P.water, [ruBuf, bedBuf, neuralWatBuf, flagsBuf, velBuf]);
            const WGc = Math.ceil(total / 64);
            runNeural = (encoder: any) => {
              const ab = new ArrayBuffer(16); new Uint32Array(ab)[0] = n; const af = new Float32Array(ab); af[2] = HSCALE; af[3] = rainRef.current;
              device.queue.writeBuffer(auBuf, 0, ab);
              // PU: refresh rain each frame (n/dt/evap constant across the run).
              const pb = new ArrayBuffer(16); new Uint32Array(pb)[0] = n; const pf = new Float32Array(pb); pf[1] = rainRef.current; pf[2] = nDt; pf[3] = nEvap;
              device.queue.writeBuffer(puBuf, 0, pb);
              const cp2 = encoder.beginComputePass();
              cp2.setPipeline(Pn.asm); cp2.setBindGroup(0, bgAsm); cp2.dispatchWorkgroups(WGc);
              for (const c of convBGs) { cp2.setPipeline(Pn.conv); cp2.setBindGroup(0, c.bg); cp2.dispatchWorkgroups(c.count); }
              cp2.setPipeline(Pn.apply); cp2.setBindGroup(0, bgApply); cp2.dispatchWorkgroups(WGc);
              cp2.end();
            };
            neuralOK = true;
            if (!disposed) setModelAvailable(true);
            const params = layers.reduce((s, l) => s + l.in * l.out * 9 + l.out, 0);
            console.log(`[catchment] neural surrogate ready · ${layers.length} layers · ~${params.toLocaleString()} params`);
          }
        }
      } catch (e) { console.warn("[catchment] neural surrogate unavailable:", e); neuralOK = false; }

      // ---- Sky / atmosphere (gated: failure simply skips the sky) ----
      let skyPipe: any = null, bgSky: any = null, skyBuf: any = null;
      try {
        const skyMod = cs(RENDER_SKY_WGSL);
        skyPipe = device.createRenderPipeline({
          layout: "auto",
          vertex: { module: skyMod, entryPoint: "vs" },
          fragment: { module: skyMod, entryPoint: "fs", targets: [{ format }] },
          primitive: { topology: "triangle-list" },
          multisample: { count: SAMPLE_COUNT },
          depthStencil: { format: "depth24plus", depthWriteEnabled: false, depthCompare: "always" },
        });
        skyBuf = device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        bgSky = device.createBindGroup({ layout: skyPipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: skyBuf } }] });
      } catch (e) { console.warn("[catchment] sky unavailable:", e); skyPipe = null; }

      // ---- Bloom (gated: failure ⇒ resolve straight to canvas, no post) ----
      try {
        const mk = (code: string) => device.createShaderModule({ code });
        const brightMod = mk(POST_BRIGHT_WGSL), blurMod = mk(POST_BLUR_WGSL), compMod = mk(POST_COMPOSITE_WGSL);
        const rp1 = (m: any) => device.createRenderPipeline({ layout: "auto", vertex: { module: m, entryPoint: "vs" }, fragment: { module: m, entryPoint: "fs", targets: [{ format }] }, primitive: { topology: "triangle-list" } });
        Ppost = { bright: rp1(brightMod), blur: rp1(blurMod), composite: rp1(compMod) };
        bloomSamp = device.createSampler({ magFilter: "linear", minFilter: "linear", addressModeU: "clamp-to-edge", addressModeV: "clamp-to-edge" });
        brightBuf = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        blurHBuf = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        blurVBuf = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        compBuf = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        device.queue.writeBuffer(brightBuf, 0, new Float32Array([0.62, 0, 0, 0])); // luminance threshold
        device.queue.writeBuffer(compBuf, 0, new Float32Array([0.7, 0, 0, 0]));    // bloom intensity
        bloomOK = true;
      } catch (e) { console.warn("[catchment] bloom unavailable:", e); bloomOK = false; }

      // Real frame loop (uses indexBuf). Overrides the placeholder above. Neural water
      // is a standalone autoregressive rollout (no auto-resync): the flux-divergence
      // operator is mass-conserving, so it stays stable without periodic reseeding.
      const realFrame = () => {
        if (disposed) return;
        const { w, h } = sizeCanvas(); ensureAttachments(w, h);
        if (resetRef.current) { doReset(); resetRef.current = false; }
        if (!dragging && !reduced && (performance.now() - lastInteractTime > 7500)) camT.az += 0.0011;
        cam.az += (camT.az - cam.az) * 0.12; cam.el += (camT.el - cam.el) * 0.12; cam.dist += (camT.dist - cam.dist) * 0.12;

        const vs = exagRef.current;
        simData[0] = n; simData[1] = 0.02; simData[2] = 1.0; simData[3] = HSCALE;
        // evap is the key to physical-looking water: a strong sink so rain runs off
        // slopes and only collects where it genuinely ponds (valleys, basins, channels)
        // instead of blanketing every cell. Equilibrium film ≈ rain/evap.
        simData[4] = 9.81; simData[5] = 1.0; simData[6] = rainRef.current; simData[7] = 0.06;
        const k = eroRef.current;
        simData[8] = 0.08 * k; simData[9] = 0.10 * k; simData[10] = 0.05 * k; simData[11] = 1.2;
        const pr = pourRef.current;
        simData[12] = pr.gx; simData[13] = pr.gz; simData[14] = 4.0; simData[15] = pr.on ? 1.4 : 0.0;
        simData[16] = vs; simData[17] = HALF; simData[18] = cellWorld; simData[19] = vs * 0.06;
        // fire params
        simData[20] = 0.16; simData[21] = 1.8; simData[22] = 2.2; simData[23] = 0.06;       // R0, phiW, phiS, burn
        simData[24] = 0.05; simData[25] = 0.004; simData[26] = 0.0016; simData[27] = 0.5;   // wet, regrow, charFade, ignThresh
        const wd = (windRef.current.deg * Math.PI) / 180;
        simData[28] = Math.cos(wd); simData[29] = Math.sin(wd); simData[30] = windRef.current.speed; simData[31] = 1.0; // wx, wz, wspeed, fireDt
        const ig = igniteRef.current;
        const met = meteorRef.current;
        simData[32] = met ? met.gx : ig ? ig.gx : 0;
        simData[33] = met ? met.gz : ig ? ig.gz : 0;
        simData[34] = met ? met.radius : ig ? 5.0 : 0;
        simData[35] = met ? met.kind : ig ? 1 : 0;
        igniteRef.current = null;
        meteorRef.current = null;
        device.queue.writeBuffer(simBuf, 0, simData);

        const proj = perspectiveZO((50 * Math.PI) / 180, w / h, 0.05, 20);
        const eye = orbitEye(target, cam.az, cam.el, cam.dist);
        const view = lookAt(eye, target, [0, 1, 0]);
        const mvp = multiply(proj, view); lastMVP = mvp;
        const sa = (sunRef.current * Math.PI) / 180, se = 0.62;
        ruData.set(mvp, 0);
        ruData[16] = Math.cos(se) * Math.cos(sa); ruData[17] = Math.sin(se); ruData[18] = Math.cos(se) * Math.sin(sa); ruData[19] = 0;
        ruData[20] = n; ruData[21] = vs; ruData[22] = HALF; ruData[23] = vs * 0.06;
        ruData[24] = pickU.x; ruData[25] = pickU.z; ruData[26] = 0.05; ruData[27] = pickU.on;
        ruData[28] = eye[0]; ruData[29] = eye[1]; ruData[30] = eye[2]; ruData[31] = 0.5;
        ruData[32] = HSCALE; ruData[33] = BASE_Y; ruData[34] = performance.now() / 1000; ruData[35] = windRef.current.speed;
        device.queue.writeBuffer(ruBuf, 0, ruData);

        const enc = device.createCommandEncoder();
        if (neuralOK && neuralWatBuf && neuralReseedRef.current) {
          enc.copyBufferToBuffer(watBuf, 0, neuralWatBuf, 0, total * 4); // seed neural state = physics
          neuralReseedRef.current = false;
        }
        const cp = enc.beginComputePass();
        for (let s = 0; s < SUBSTEPS; s++) {
          cp.setPipeline(P.addRain); cp.setBindGroup(0, BG.addRain); cp.dispatchWorkgroups(WG);
          cp.setPipeline(P.flux); cp.setBindGroup(0, BG.flux); cp.dispatchWorkgroups(WG);
          cp.setPipeline(P.waterVel); cp.setBindGroup(0, BG.waterVel); cp.dispatchWorkgroups(WG);
          cp.setPipeline(P.erode); cp.setBindGroup(0, BG.erode); cp.dispatchWorkgroups(WG);
          cp.setPipeline(P.transport); cp.setBindGroup(0, BG.transport); cp.dispatchWorkgroups(WG);
          cp.setPipeline(P.finalize); cp.setBindGroup(0, BG.finalize); cp.dispatchWorkgroups(WG);
        }
        cp.setPipeline(P.spread); cp.setBindGroup(0, BG.spread); cp.dispatchWorkgroups(WG);
        cp.setPipeline(P.burn); cp.setBindGroup(0, BG.burn); cp.dispatchWorkgroups(WG);
        if (met) {
          cp.setPipeline(P.meteor); cp.setBindGroup(0, BG.meteor); cp.dispatchWorkgroups(WG);
        }
        cp.setPipeline(P.normals); cp.setBindGroup(0, BG.normals); cp.dispatchWorkgroups(WG);
        cp.end();

        // neural surrogate steps its own water state forward — run SUBSTEPS times to
        // match the physics step rate (physics also runs SUBSTEPS per frame). The
        // model is trained to be a STANDALONE stable operator (long-horizon rollout +
        // mass/bias conservation), so there is no auto-resync band-aid: it predicts
        // the water dynamics itself. The Neural button seeds it from physics once at
        // switch-on; "Resync to physics" is an optional manual control.
        if (neuralOK && neuralOnRef.current && runNeural) {
          for (let ns = 0; ns < SUBSTEPS; ns++) runNeural(enc);
        }

        const canvasView = ctx.getCurrentTexture().createView();
        const rp = enc.beginRenderPass({
          colorAttachments: [{
            view: colorTex.createView(),
            resolveTarget: bloomOK ? sceneTex.createView() : canvasView,
            clearValue: { r: 0.969, g: 0.961, b: 0.941, a: 1 },
            loadOp: "clear",
            storeOp: "discard",
          }],
          depthStencilAttachment: { view: depthTex.createView(), depthClearValue: 1, depthLoadOp: "clear", depthStoreOp: "discard" },
        });
        if (skyPipe && bgSky && skyBuf) {
          const ssa = (sunRef.current * Math.PI) / 180, sse = 0.62;
          const sdir = [Math.cos(sse) * Math.cos(ssa), Math.sin(sse), Math.cos(sse) * Math.sin(ssa)];
          const sclip = transformVec4(mvp, [eye[0] + sdir[0] * 10, eye[1] + sdir[1] * 10, eye[2] + sdir[2] * 10, 1]);
          const sb = new Float32Array(8);
          if (sclip[3] > 0) { sb[0] = (sclip[0] / sclip[3]) * 0.5 + 0.5; sb[1] = (sclip[1] / sclip[3]) * 0.5 + 0.5; sb[2] = 1; }
          sb[4] = w / h; sb[5] = performance.now() / 1000;
          device.queue.writeBuffer(skyBuf, 0, sb);
          rp.setPipeline(skyPipe); rp.setBindGroup(0, bgSky); rp.draw(3);
        }
        rp.setPipeline(P.terrain); rp.setBindGroup(0, BG.terrain);
        rp.setIndexBuffer(indexBuf, "uint32"); rp.drawIndexed(idx.length);
        rp.setPipeline(P.skirt); rp.setBindGroup(0, BGskirt); rp.draw(skirtCount);
        rp.setPipeline(P.water);
        rp.setBindGroup(0, (neuralOK && neuralOnRef.current && bgWaterNeural) ? bgWaterNeural : BG.water);
        rp.setIndexBuffer(indexBuf, "uint32"); rp.drawIndexed(idx.length);
        rp.end();

        if (bloomOK && bgBright && bgComp) {
          const pass = (view: any, bgp: any, pipe: any, clear: any) => {
            const p = enc.beginRenderPass({ colorAttachments: [{ view, clearValue: clear, loadOp: "clear", storeOp: "store" }] });
            p.setPipeline(pipe); p.setBindGroup(0, bgp); p.draw(3); p.end();
          };
          const black = { r: 0, g: 0, b: 0, a: 1 };
          pass(bloomA.createView(), bgBright, Ppost.bright, black);          // bright-pass → bloomA
          pass(bloomB.createView(), bgBlurH, Ppost.blur, black);            // blur H → bloomB
          pass(bloomA.createView(), bgBlurV, Ppost.blur, black);            // blur V → bloomA
          pass(canvasView, bgComp, Ppost.composite, { r: 0.969, g: 0.961, b: 0.941, a: 1 }); // scene+bloom → canvas
        }

        device.queue.submit([enc.finish()]);
        drawRain(mvp, w, h, vs);
        raf = requestAnimationFrame(realFrame);
      };
      raf = requestAnimationFrame(realFrame);
    })().catch((e) => fail(`Init error: ${e?.message ?? e}`));

    return () => { disposed = true; resetNowRef.current = null; exportTeacherFrameRef.current = null; cancelAnimationFrame(raf); cleanupInput?.(); device?.destroy?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapFile]);

  return (
    <div className="relative h-[calc(100svh-4rem)] w-full overflow-hidden bg-concrete">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none"
        style={{ display: "block", cursor: status === "running" ? (mode === "orbit" ? "grab" : "crosshair") : "default" }}
        aria-label="Interactive 3D catchment with live water and fire simulation." />
      <canvas ref={rainCanvasRef} className="cm-rain-canvas h-full w-full" aria-hidden="true" />
      {meteors.map((meteor) => (
        <span
          key={meteor.id}
          className="cm-meteor"
          data-kind={meteor.kind}
          style={{
            "--mx": `${meteor.x}px`,
            "--my": `${meteor.y}px`,
            "--ma": `${meteor.angle}deg`,
          } as CSSProperties}
          aria-hidden="true"
        >
          <i />
          <i />
          <i />
          <i />
        </span>
      ))}

      <div className="pointer-events-none absolute left-0 top-0 z-[5] p-6"
        style={{ opacity: everInteracted ? 0 : 1, transition: "opacity .7s ease" }}>
        <span className="mono-label">catchment · live</span>
        <h1 className="mt-2 font-display text-3xl text-ink md:text-4xl">A living catchment</h1>
        <p className="mt-2 max-w-sm text-sm text-ink/60">
          Real terrain, live on your GPU. Rain carves it, fire runs with the wind.
          Drag to orbit; pour, ignite, watch them fight.
        </p>
      </div>

      {status === "running" && (
        <div className={`cm-panel pointer-events-auto absolute bottom-0 left-0 m-5${collapsed ? " is-collapsed" : ""}${uiVisible ? "" : " is-faded"}`}>
          <style>{PANEL_CSS}</style>
          <div className="cm-head">
            <span className="cm-title">Controls</span>
            <div className="cm-right">
              {!collapsed && (
                <span
                  className="cm-live"
                  role="button"
                  tabIndex={0}
                  title="live"
                  onClick={() => {
                    liveClicks.current += 1;
                    if (liveClicks.current >= 5 && !secretUnlocked) setSecretUnlocked(true);
                  }}
                ><i />{secretUnlocked ? "✦ live" : "live"}</span>
              )}
              <button className="cm-collapse" aria-label={collapsed ? "Expand controls" : "Collapse controls"} onClick={() => setCollapsed((v) => !v)}>{collapsed ? "+" : "–"}</button>
            </div>
          </div>
          {!collapsed && (
            <>
              {visibleMaps.length > 1 && (
                <>
                  <div className="cm-section">World</div>
                  <select className="cm-select" value={mapId} onChange={(e) => { setMapId(e.target.value); setPick(null); }}>
                    {visibleMaps.map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}
                  </select>
                  {activeMap?.tagline && <p className="cm-tagline">{activeMap.tagline}</p>}
                </>
              )}
              <div className="cm-seg">
                <button data-active={mode === "orbit"} onClick={() => setMode("orbit")}>Orbit</button>
                <button data-active={mode === "pour"} onClick={() => setMode("pour")}>Pour</button>
                <button data-active={mode === "ignite"} onClick={() => setMode("ignite")}>Ignite</button>
                <button data-active={mode === "meteor"} onClick={() => setMode("meteor")}>Meteor</button>
              </div>
              <button className="cm-reset-btn" onClick={() => { resetNowRef.current?.(); resetRef.current = true; setPick(null); }}>Reset</button>
              <button className="cm-group" onClick={() => toggleGroup("water")} aria-expanded={openGroups.water}>
                <span>Water</span><span className="cm-chevron">{openGroups.water ? "▾" : "▸"}</span>
              </button>
              {openGroups.water && (
                <>
                  <Ctl label="rain" display={`${Math.round((rain / 0.02) * 100)}`} min={0} max={0.02} step={0.0005}
                    value={rain} onChange={(e) => setRain(+e.target.value)} />
                  <Ctl label="erosion" display={`${Math.round((ero / 1.5) * 100)}`} min={0} max={1.5} step={0.02}
                    value={ero} onChange={(e) => setEro(+e.target.value)} />
                </>
              )}
              <button className="cm-group" onClick={() => toggleGroup("wind")} aria-expanded={openGroups.wind}>
                <span>Wind</span><span className="cm-chevron">{openGroups.wind ? "▾" : "▸"}</span>
              </button>
              {openGroups.wind && (
                <>
                  <Ctl label="strength" display={`${Math.round((windSpeed / 3) * 100)}`} min={0} max={3} step={0.05}
                    value={windSpeed} onChange={(e) => setWindSpeed(+e.target.value)} />
                  <Ctl label="bearing" display={`${Math.round(windDeg)}°`} min={0} max={360} step={1}
                    value={windDeg} onChange={(e) => setWindDeg(+e.target.value)} />
                </>
              )}
              <button className="cm-group" onClick={() => toggleGroup("light")} aria-expanded={openGroups.light}>
                <span>Light</span><span className="cm-chevron">{openGroups.light ? "▾" : "▸"}</span>
              </button>
              {openGroups.light && (
                <>
                  <Ctl label="sun" display={`${Math.round(sunDeg)}°`} min={0} max={360} step={1}
                    value={sunDeg} onChange={(e) => setSunDeg(+e.target.value)} />
                  <Ctl label="relief" display={`${Math.round(((exag - 0.2) / 0.7) * 100)}`} min={0.2} max={0.9} step={0.01}
                    value={exag} onChange={(e) => setExag(+e.target.value)} />
                </>
              )}
              <p className="cm-hint">
                {mode === "pour" ? "Drag the terrain to pour water."
                  : mode === "ignite" ? "Click to start a fire — wind and slope steer it; water stops it."
                    : mode === "meteor" ? "Click to call a meteor — crater, splash, heat, and fire all feed the sim."
                  : "Drag to orbit · click to inspect."}
              </p>
            </>
          )}
        </div>
      )}

      {status === "running" && (
        <div className={`cm-neural pointer-events-auto absolute bottom-0 right-0 m-5 mb-12${uiVisible ? "" : " is-faded"}`}>
          <div className="cm-neural-title">
            <span>M4 neural surrogate</span>
            <div className="cm-right">
              {!neuralCollapsed && (
                <span className="cm-neural-pill">{modelAvailable ? (neuralOn ? "neural live" : "physics") : "teacher"}</span>
              )}
              <button
                className="cm-collapse"
                aria-label={neuralCollapsed ? "Expand surrogate" : "Collapse surrogate"}
                onClick={() => setNeuralCollapsed((v) => !v)}
              >{neuralCollapsed ? "+" : "–"}</button>
            </div>
          </div>
          {!neuralCollapsed && (modelAvailable ? (
            <>
              <p className="cm-neural-copy">
                A neural operator runs its own water on the GPU. Flip teacher (physics) ↔ student
                (neural) and watch where it drifts.
              </p>
              <div className="cm-seg" style={{ marginTop: 8 }}>
                <button data-active={!neuralOn} onClick={() => setNeuralOn(false)}>Physics</button>
                <button data-active={neuralOn} onClick={() => { neuralReseedRef.current = true; setNeuralOn(true); }}>Neural</button>
              </div>
              <button className="cm-neural-btn" onClick={() => { neuralReseedRef.current = true; }}>Resync to physics</button>
              <p className="cm-neural-copy">{neuralOn ? "Student: the network is stepping the water forward." : "Teacher: virtual-pipes shallow water."}</p>
            </>
          ) : (
            <>
              <p className="cm-neural-copy">
                Export live physics frames, train with <code>ml/train_surrogate.py</code>, then drop
                <code>surrogate.json</code> in <code>public/catchment/</code> to unlock live inference.
              </p>
              <div className="cm-neural-grid">
                <div className="cm-neural-stat"><span>Frames</span><strong>{teacherFrames}</strong></div>
                <div className="cm-neural-stat"><span>Model</span><strong>{surrogateStatus}</strong></div>
              </div>
              <button
                className="cm-neural-btn"
                disabled={surrogateStatus === "exporting"}
                onClick={() => void exportTeacherFrameRef.current?.()}
              >
                {surrogateStatus === "exporting" ? "Exporting" : "Export Teacher Frame"}
              </button>
              <p className="cm-neural-copy">{surrogateMsg}</p>
            </>
          ))}
        </div>
      )}

      {status === "running" && pick && (
        <div className="absolute right-0 top-0 m-4 border border-hairline bg-concrete/90 px-4 py-3 backdrop-blur-sm"
          style={{ opacity: uiVisible ? 1 : 0, pointerEvents: uiVisible ? "auto" : "none", transition: "opacity .6s ease" }}>
          <span className="mono-label">Inspected point</span>
          <dl className="mt-2 space-y-1 font-mono text-xs text-ink/75">
            <div className="flex justify-between gap-6"><dt className="text-ink/45">Elevation</dt><dd>{pick.elevM} m</dd></div>
            <div className="flex justify-between gap-6"><dt className="text-ink/45">Slope</dt><dd>{pick.slopeDeg}°</dd></div>
            <div className="flex justify-between gap-6"><dt className="text-ink/45">Coords</dt><dd>{pick.lat.toFixed(3)}, {pick.lng.toFixed(3)}</dd></div>
          </dl>
        </div>
      )}

      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center"><span className="mono-label animate-pulse">Initialising engine…</span></div>
      )}
      {status === "nogpu" && (
        <div className="absolute inset-x-0 bottom-0 border-t border-hairline bg-concrete/85 p-6 backdrop-blur-sm">
          <span className="mono-label">WebGPU required</span>
          <p className="mt-2 max-w-prose text-sm text-ink/70">The live engine needs WebGPU — Chrome &amp; Edge, or Safari on iOS&nbsp;26 / macOS&nbsp;26+. You&apos;re seeing a static relief instead.</p>
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-x-0 bottom-0 border-t border-hairline bg-concrete/85 p-6 backdrop-blur-sm">
          <span className="mono-label">Engine error</span>
          <p className="mt-2 max-w-prose text-sm text-ink/70">{err}</p>
          <button onClick={() => location.reload()} className="btn-secondary mt-3 text-sm">Reload</button>
        </div>
      )}
      {/* faint affordance: controls live here, move to reveal */}
      {status === "running" && everInteracted && idle && <div className="cm-dot" />}
    </div>
  );
}
