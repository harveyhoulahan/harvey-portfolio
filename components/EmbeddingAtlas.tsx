"use client";

/*
 * EmbeddingAtlas — "Teach the map" few-shot terrain mapping.
 *
 * A miniature, fully client-side homage to geospatial foundation models
 * (AlphaEarth Foundations, Clay, Prithvi, SatCLIP). A tiny self-supervised
 * encoder embedded every terrain cell offline; here we render that embedding
 * field as false colour ("the AI's-eye view"), then let the visitor train a
 * logistic-regression classifier *live* by clicking a few example cells —
 * embed once, label a little, map everything.
 *
 * Rendering reuses the safe projected-overlay approach from SpatialDemo
 * (no MapLibre CanvasSource). Reduced-motion / low-power -> static canvas.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  decodeTerrain,
  cellLngLat,
  type DecodedTerrain,
  type TerrainData,
  type Axis,
} from "@/lib/terrain-search";
import {
  decodeEmbeddings,
  computePCA,
  projectCell,
  trainClassifier,
  predictField,
  type DecodedEmbeddings,
  type EmbeddingData,
  type PCA,
  type Classifier,
} from "@/lib/embedding-atlas";

const T_ASSET = "/playground/terrain.json";
const E_ASSET = "/playground/embeddings.json";
const TILE = 512;

type RGB = [number, number, number];
const SAGE: RGB = [74, 103, 65];
const SAND: RGB = [196, 168, 130];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpRGB = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/* false colour: PCA(3) -> a calm, architectural duotone in the sage↔sand family.
   PC1 drives warm↔cool, PC2 drives light↔dark, PC3 a faint tint. Muted on
   purpose so the sage few-shot prediction reads clearly on top. */
function falseColor(coords: number[]): RGB {
  const a = coords[0], b = coords[1] ?? 0.5, c = coords[2] ?? 0.5;
  let col = lerpRGB([120, 134, 116], [201, 180, 150], a); // sage-grey -> warm sand
  const light = 0.8 + 0.42 * b;
  col = [col[0] * light, col[1] * light, col[2] * light];
  col = lerpRGB(col, [124, 140, 146], 0.14 * c); // faint cool wash from PC3
  return lerpRGB(col, [247, 245, 240], 0.08); // tiny lift toward concrete
}

/* paint the false-colour embedding field (+ faint streams, sea) to a tile */
function paintEmbedding(
  e: DecodedEmbeddings,
  pca: PCA,
  terr: DecodedTerrain,
  canvas: HTMLCanvasElement
) {
  const n = e.n;
  const small = document.createElement("canvas");
  small.width = n; small.height = n;
  const sctx = small.getContext("2d")!;
  const img = sctx.createImageData(n, n);
  for (let i = 0; i < n * n; i++) {
    const o = i * 4;
    if (!e.land[i]) {
      img.data[o] = 168; img.data[o + 1] = 184; img.data[o + 2] = 182; img.data[o + 3] = 255;
      continue;
    }
    let col = falseColor(projectCell(e, pca, i));
    if (terr.stream[i]) col = [col[0] * 0.78, col[1] * 0.82, col[2] * 0.84];
    img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = 255;
  }
  sctx.putImageData(img, 0, 0);
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
  ctx.clearRect(0, 0, TILE, TILE);
  ctx.drawImage(small, 0, 0, TILE, TILE);
}

/* paint the prediction probability field (sage ramp, threshold-aware) */
function paintProb(e: DecodedEmbeddings, prob: Float32Array, thresh: number, canvas: HTMLCanvasElement) {
  const n = e.n;
  const small = document.createElement("canvas");
  small.width = n; small.height = n;
  const sctx = small.getContext("2d")!;
  const img = sctx.createImageData(n, n);
  for (let i = 0; i < n * n; i++) {
    const o = i * 4;
    const p = prob[i];
    if (Number.isNaN(p)) { img.data[o + 3] = 0; continue; }
    const col = lerpRGB(SAND, SAGE, smooth(thresh - 0.25, 1, p));
    img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2];
    img.data[o + 3] = smooth(thresh - 0.08, thresh + 0.12, p) * 0.86 * 255;
  }
  sctx.putImageData(img, 0, 0);
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
  ctx.clearRect(0, 0, TILE, TILE);
  ctx.drawImage(small, 0, 0, TILE, TILE);
}

function hasWebGL(): boolean {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); }
  catch { return false; }
}

type Status = "loading" | "ready" | "error";
type Label = { cell: number; cls: 0 | 1 };

/* preset "concepts": pick well-matched example cells from terrain features */
const PRESETS: { name: string; expr: (s: Record<Axis, Float32Array>, i: number) => number }[] = [
  { name: "Wet valleys", expr: (s, i) => s.water[i] - 0.6 * s.exposure[i] - 0.3 * s.steepness[i] },
  { name: "Exposed ridgelines", expr: (s, i) => s.exposure[i] + 0.7 * s.elevation[i] },
  { name: "Steep faces", expr: (s, i) => s.steepness[i] + 0.5 * s.ruggedness[i] },
  { name: "Sunny north slopes", expr: (s, i) => s.northness[i] + 0.3 * s.steepness[i] },
  { name: "Lush forest", expr: (s, i) => s.vegetation[i] + 0.4 * s.water[i] },
];

export default function EmbeddingAtlas() {
  const mapDiv = useRef<HTMLDivElement>(null);
  const overlay = useRef<HTMLCanvasElement>(null);
  const staticCanvas = useRef<HTMLCanvasElement>(null);
  const scatterCanvas = useRef<HTMLCanvasElement>(null);
  const embTile = useRef<HTMLCanvasElement | null>(null);
  const probTile = useRef<HTMLCanvasElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const [status, setStatus] = useState<Status>("loading");
  const [terr, setTerr] = useState<DecodedTerrain | null>(null);
  const [emb, setEmb] = useState<DecodedEmbeddings | null>(null);
  const [pca, setPca] = useState<PCA | null>(null);
  const [useMap, setUseMap] = useState(true);
  const [labels, setLabels] = useState<Label[]>([]);
  const [mode, setMode] = useState<0 | 1>(1); // 1 = positive, 0 = negative
  const [thresh, setThresh] = useState(0.5);
  const [showPred, setShowPred] = useState(true);
  const [hover, setHover] = useState<{ x: number; y: number; text: string } | null>(null);
  const reduced = useRef(false);
  const scatterPts = useRef<{ i: number; x: number; y: number }[]>([]);

  const tiles = useCallback(() => {
    if (!embTile.current) { const c = document.createElement("canvas"); c.width = TILE; c.height = TILE; embTile.current = c; }
    if (!probTile.current) { const c = document.createElement("canvas"); c.width = TILE; c.height = TILE; probTile.current = c; }
    return { e: embTile.current!, p: probTile.current! };
  }, []);

  /* load both assets */
  useEffect(() => {
    if (typeof window === "undefined") return;
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const small = window.matchMedia("(max-width: 640px)").matches;
    setUseMap(!reduced.current && !small && hasWebGL());
    let alive = true;
    Promise.all([
      fetch(T_ASSET).then((r) => { if (!r.ok) throw new Error(); return r.json(); }),
      fetch(E_ASSET).then((r) => { if (!r.ok) throw new Error(); return r.json(); }),
    ])
      .then(([td, ed]: [TerrainData, EmbeddingData]) => {
        if (!alive) return;
        const t = decodeTerrain(td);
        const e = decodeEmbeddings(ed);
        setTerr(t); setEmb(e); setPca(computePCA(e, 3)); setStatus("ready");
      })
      .catch(() => alive && setStatus("error"));
    return () => { alive = false; };
  }, []);

  /* train classifier from current labels (memoised) */
  const clf: Classifier | null = useMemo(() => {
    if (!emb) return null;
    const pos = labels.filter((l) => l.cls === 1).map((l) => l.cell);
    const neg = labels.filter((l) => l.cls === 0).map((l) => l.cell);
    if (pos.length === 0) return null;
    return trainClassifier(emb, pos, neg);
  }, [emb, labels]);

  const prob: Float32Array | null = useMemo(() => {
    if (!emb || !clf) return null;
    return predictField(emb, clf);
  }, [emb, clf]);

  /* blit tiles to the map-aligned overlay */
  const drawOverlay = useCallback(() => {
    const map = mapRef.current, cvs = overlay.current, t = terr;
    if (!map || !cvs || !t || !embTile.current) return;
    const w = mapDiv.current!.clientWidth, h = mapDiv.current!.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (cvs.width !== w * dpr || cvs.height !== h * dpr) {
      cvs.width = w * dpr; cvs.height = h * dpr; cvs.style.width = `${w}px`; cvs.style.height = `${h}px`;
    }
    const ctx = cvs.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const { west, south, east, north } = t.bounds;
    const tl = map.project([west, north]), br = map.project([east, south]);
    const dx = tl.x, dy = tl.y, dw = br.x - tl.x, dh = br.y - tl.y;
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ctx.drawImage(embTile.current, dx, dy, dw, dh);
    if (showPred && probTile.current && prob) {
      ctx.fillStyle = "rgba(243,241,235,0.5)"; // fade the embedding so the map pops
      ctx.fillRect(dx, dy, dw, dh);
      ctx.drawImage(probTile.current, dx, dy, dw, dh);
    }
  }, [terr, showPred, prob]);

  const drawStatic = useCallback(() => {
    const cvs = staticCanvas.current;
    if (!cvs || !embTile.current) return;
    const ctx = cvs.getContext("2d")!;
    ctx.imageSmoothingEnabled = true;
    ctx.clearRect(0, 0, TILE, TILE);
    ctx.drawImage(embTile.current, 0, 0, TILE, TILE);
    if (showPred && probTile.current && prob) {
      ctx.fillStyle = "rgba(243,241,235,0.5)";
      ctx.fillRect(0, 0, TILE, TILE);
      ctx.drawImage(probTile.current, 0, 0, TILE, TILE);
    }
  }, [showPred, prob]);

  /* latent-space scatter (PC1×PC2), coloured by prediction; examples marked */
  const drawScatter = useCallback(() => {
    const cvs = scatterCanvas.current;
    if (!cvs || !emb || !pca) return;
    const W = cvs.width, H = cvs.height, pad = 8;
    const ctx = cvs.getContext("2d")!;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#EFECE5"; ctx.fillRect(0, 0, W, H);
    if (scatterPts.current.length === 0) {
      const stride = Math.max(1, Math.floor(emb.landIdx.length / 1400));
      scatterPts.current = emb.landIdx.filter((_, k) => k % stride === 0).map((i) => {
        const c = projectCell(emb, pca, i);
        return { i, x: pad + c[0] * (W - 2 * pad), y: H - pad - c[1] * (H - 2 * pad) };
      });
    }
    for (const pt of scatterPts.current) {
      const p = prob ? prob[pt.i] : NaN;
      const col = Number.isNaN(p) ? [200, 196, 186] : lerpRGB(SAND, SAGE, smooth(thresh - 0.25, 1, p));
      ctx.fillStyle = `rgb(${col[0] | 0},${col[1] | 0},${col[2] | 0})`;
      ctx.fillRect(pt.x, pt.y, 2.2, 2.2);
    }
    // mark labelled examples
    for (const l of labels) {
      const c = projectCell(emb, pca, l.cell);
      const x = pad + c[0] * (W - 2 * pad), y = H - pad - c[1] * (H - 2 * pad);
      ctx.beginPath(); ctx.arc(x, y, 3.4, 0, Math.PI * 2);
      ctx.fillStyle = l.cls ? "#4A6741" : "#C4A882";
      ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = "#F7F5F0"; ctx.stroke();
    }
  }, [emb, pca, prob, labels, thresh]);

  /* repaint emb base once ready / mode change */
  const repaintBase = useCallback(() => {
    if (!emb || !pca || !terr) return;
    const { e } = tiles();
    paintEmbedding(emb, pca, terr, e);
  }, [emb, pca, terr, tiles]);

  /* repaint prob tile + redraw target + markers + scatter */
  const repaintPred = useCallback(() => {
    if (!emb) return;
    const { p } = tiles();
    if (prob) paintProb(emb, prob, thresh, p);
    (useMap ? drawOverlay : drawStatic)();
    drawScatter();
    // example markers (map mode)
    if (useMap && mapRef.current && terr) {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = labels.map((l) => {
        const el = document.createElement("div");
        el.className = l.cls ? "ea-pos" : "ea-neg";
        return new maplibregl.Marker({ element: el }).setLngLat(cellLngLat(terr, l.cell)).addTo(mapRef.current!);
      });
    }
  }, [emb, prob, thresh, useMap, drawOverlay, drawStatic, drawScatter, labels, terr, tiles]);

  /* init map once */
  useEffect(() => {
    if (status !== "ready" || !terr || !emb || !pca || !useMap || mapRef.current || !mapDiv.current) return;
    repaintBase();
    const { west, south, east, north } = terr.bounds;
    const map = new maplibregl.Map({
      container: mapDiv.current,
      style: { version: 8, sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": "#EFECE5" } }] },
      bounds: [west, south, east, north],
      fitBoundsOptions: { padding: 20 },
      attributionControl: false, dragRotate: false, pitchWithRotate: false,
      maxBounds: [west - 0.05, south - 0.05, east + 0.05, north + 0.05],
      minZoom: 9.5, maxZoom: 14,
    });
    map.scrollZoom.disable(); map.touchZoomRotate.disableRotation();
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;

    const toCell = (lng: number, lat: number): number | null => {
      const fx = (lng - west) / (east - west), fy = (north - lat) / (north - south);
      if (fx < 0 || fx > 1 || fy < 0 || fy > 1) return null;
      const c = Math.min(terr.n - 1, Math.floor(fx * terr.n));
      const r = Math.min(terr.n - 1, Math.floor(fy * terr.n));
      return r * terr.n + c;
    };

    map.on("load", () => { map.resize(); drawOverlay(); });
    map.on("move", () => drawOverlay());
    map.on("resize", () => drawOverlay());

    // Keep MapLibre + the aligned overlay in sync with the container size.
    // maplibre-gl.css forces position:relative on the map element, which can
    // collapse an absolutely-positioned container to 0px on late layout; a
    // stable height + this observer keep the canvas and overlay correctly sized.
    const ro = new ResizeObserver(() => { map.resize(); drawOverlay(); });
    ro.observe(mapDiv.current);

    map.on("click", (ev) => {
      const cell = toCell(ev.lngLat.lng, ev.lngLat.lat);
      if (cell == null || !emb.land[cell]) return;
      setLabels((prev) => {
        if (prev.some((l) => l.cell === cell)) return prev.filter((l) => l.cell !== cell); // toggle off
        return [...prev, { cell, cls: modeRef.current }];
      });
    });
    map.on("mousemove", (ev) => {
      const cell = toCell(ev.lngLat.lng, ev.lngLat.lat);
      if (cell == null) return setHover(null);
      if (terr.ocean[cell]) return setHover({ x: ev.point.x, y: ev.point.y, text: "Tasman Sea" });
      const pv = probRef.current ? probRef.current[cell] : NaN;
      const elevM = Math.round(terr.elev[cell] * terr.elevMaxM);
      setHover({ x: ev.point.x, y: ev.point.y, text: Number.isNaN(pv) ? `${elevM} m` : `${elevM} m · P=${pv.toFixed(2)}` });
    });
    map.on("mouseout", () => setHover(null));
    return () => { ro.disconnect(); map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, terr, emb, pca, useMap]);

  /* refs so the map's stable click/move handlers see fresh values */
  const modeRef = useRef<0 | 1>(1);
  const probRef = useRef<Float32Array | null>(null);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { probRef.current = prob; }, [prob]);

  /* static-mode init */
  useEffect(() => {
    if (status !== "ready" || useMap || !emb || !pca || !terr) return;
    repaintBase();
    repaintPred();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, useMap, emb, pca, terr]);

  /* repaint when prediction / threshold / view changes */
  useEffect(() => {
    if (status !== "ready") return;
    repaintPred();
  }, [status, repaintPred]);

  /* preset / clear helpers */
  const applyPreset = useCallback((name: string) => {
    if (!terr || !emb) return;
    const preset = PRESETS.find((p) => p.name === name)!;
    const scored = emb.landIdx
      .map((i) => ({ i, v: preset.expr(terr.signed, i) }))
      .sort((a, b) => b.v - a.v);
    // take 6 strong, spatially-spread examples
    const picks: number[] = [];
    for (const s of scored) {
      if (picks.every((p) => Math.abs(p - s.i) > terr.n)) picks.push(s.i);
      if (picks.length >= 6) break;
    }
    setMode(1);
    setLabels(picks.map((cell) => ({ cell, cls: 1 as const })));
  }, [terr, emb]);

  const posCount = labels.filter((l) => l.cls === 1).length;
  const negCount = labels.length - posCount;

  return (
    <section className="mx-auto max-w-work px-6 py-12">
      <style>{`
        .ea-pos{width:12px;height:12px;border-radius:50%;background:#4A6741;box-shadow:0 0 0 3px rgba(247,245,240,.95),0 0 0 4px rgba(74,103,65,.5);cursor:pointer}
        .ea-neg{width:12px;height:12px;border-radius:50%;background:#F7F5F0;border:2px solid #C4A882;box-shadow:0 0 0 2px rgba(247,245,240,.8);cursor:pointer}
      `}</style>

      <span className="mono-label">Live demo · geospatial foundation models</span>
      <h1 className="mt-3 font-display">Teach the map</h1>
      <p className="mt-4 max-w-prose text-ink/70">
        A tiny self-supervised model has already turned every cell of this terrain
        into an embedding — a learned fingerprint of the land. You see that
        embedding field below in false colour. Click a few examples of what you&apos;re
        looking for and a classifier trains in your browser, mapping it everywhere.
        This is the workflow behind models like Google DeepMind&apos;s AlphaEarth:
        <em> embed once, label a little, map everything.</em>
      </p>

      {/* controls */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <span className="mono-label !text-ink/50">Map a concept:</span>
        {PRESETS.map((p) => (
          <button key={p.name} onClick={() => applyPreset(p.name)} className="stack-tag transition-colors hover:border-sage hover:text-sage">
            {p.name}
          </button>
        ))}
        {labels.length > 0 && (
          <button onClick={() => setLabels([])} className="stack-tag !border-sand text-ink/60 transition-colors hover:text-ink">
            Clear ✕
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[11px] text-ink/55">
        <span>Click the map to add examples:</span>
        <button onClick={() => setMode(1)} className={`inline-flex items-center gap-1.5 ${mode === 1 ? "text-sage" : "hover:text-ink"}`}>
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-sage" /> positive ({posCount})
        </button>
        <button onClick={() => setMode(0)} className={`inline-flex items-center gap-1.5 ${mode === 0 ? "text-ink" : "hover:text-ink"}`}>
          <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-sand bg-concrete" /> negative ({negCount})
        </button>
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={showPred} onChange={(e) => setShowPred(e.target.checked)} className="accent-sage" />
          show prediction
        </label>
        <label className="inline-flex items-center gap-2">
          threshold
          <input type="range" min={0.3} max={0.85} step={0.01} value={thresh} onChange={(e) => setThresh(+e.target.value)} className="accent-sage" />
        </label>
      </div>

      {/* main grid */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="relative">
          {status === "loading" && (
            <div className="flex h-[440px] w-full items-center justify-center border border-hairline bg-surface sm:h-[500px]">
              <span className="mono-label animate-pulse">Loading embedding field…</span>
            </div>
          )}
          {status === "error" && (
            <div className="flex h-[440px] w-full flex-col items-center justify-center gap-3 border border-hairline bg-surface text-center sm:h-[500px]">
              <span className="mono-label">Couldn&apos;t load model assets</span>
              <button onClick={() => location.reload()} className="btn-secondary text-sm">Retry</button>
            </div>
          )}

          {status === "ready" && useMap && (
            <div className="relative h-[440px] w-full overflow-hidden border border-hairline sm:h-[500px]">
              <div ref={mapDiv} className="h-full w-full" style={{ background: "#EFECE5" }} aria-hidden />
              <canvas ref={overlay} className="pointer-events-none absolute inset-0 h-full w-full" aria-label="Embedding field map. Click to label examples; the trained class is shaded green." />
            </div>
          )}

          {status === "ready" && !useMap && (
            <StaticAtlas
              canvasRef={staticCanvas}
              onPick={(cell) => {
                if (!emb || !emb.land[cell]) return;
                setLabels((prev) => prev.some((l) => l.cell === cell) ? prev.filter((l) => l.cell !== cell) : [...prev, { cell, cls: mode }]);
              }}
              n={emb?.n ?? 96}
            />
          )}

          {hover && (
            <div className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[140%] whitespace-nowrap border border-hairline bg-concrete/95 px-2 py-1 font-mono text-[11px] text-ink shadow-sm" style={{ left: hover.x, top: hover.y }}>
              {hover.text}
            </div>
          )}

          <p className="mt-2 font-mono text-[11px] text-ink/45">
            16-d self-supervised embeddings · in-browser PCA false colour · logistic
            regression trained live on your clicks · no API keys
          </p>
        </div>

        {/* side: latent space + teaching */}
        <aside className="border-t border-hairline pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <span className="mono-label">Latent space (PCA)</span>
          <canvas
            ref={scatterCanvas}
            width={264}
            height={180}
            className="mt-3 w-full border border-hairline"
            aria-label="Scatter plot of every cell in the model's embedding space, coloured by the current prediction."
          />
          <p className="mt-2 text-[12px] leading-relaxed text-ink/55">
            Every terrain cell, placed by its embedding. Cells that sit together
            here look alike to the model — so a boundary drawn from a few clicks
            generalises across the whole map.
          </p>

          <p className="mt-5 border-t border-hairline pt-4 text-[13px] leading-relaxed text-ink/55">
            Foundation models (AlphaEarth Foundations, Clay, Prithvi, SatCLIP)
            pre-compute embeddings for all of Earth so downstream maps need only a
            handful of labels instead of millions. This is a hand-built miniature of
            that idea, running entirely on your device.
          </p>
        </aside>
      </div>
    </section>
  );
}

/* ---- static (no-WebGL / reduced-motion) canvas with click labelling ------ */
function StaticAtlas({
  canvasRef, onPick, n,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  onPick: (cell: number) => void;
  n: number;
}) {
  return (
    <canvas
      ref={canvasRef}
      width={TILE}
      height={TILE}
      className="aspect-square w-full cursor-crosshair border border-hairline"
      style={{ display: "block" }}
      aria-label="Embedding field map. Tap to label examples; the trained class is shaded green."
      onClick={(ev) => {
        const rect = (ev.target as HTMLCanvasElement).getBoundingClientRect();
        const fx = (ev.clientX - rect.left) / rect.width;
        const fy = (ev.clientY - rect.top) / rect.height;
        const c = Math.min(n - 1, Math.max(0, Math.floor(fx * n)));
        const r = Math.min(n - 1, Math.max(0, Math.floor(fy * n)));
        onPick(r * n + c);
      }}
    />
  );
}
