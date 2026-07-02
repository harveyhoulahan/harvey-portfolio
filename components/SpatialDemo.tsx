"use client";

/*
 * SpatialDemo — "Semantic Terrain Search".
 *
 * Type terrain in plain English; an in-browser semantic model (lib/terrain-search)
 * turns the sentence into an 8-axis terrain vector and ranks every cell of a
 * DEM-derived grid by similarity. Results paint live on a MapLibre map.
 *
 * Rendering: the hillshade + score heatmap are drawn to two offscreen "tile"
 * canvases, then blitted onto a normal overlay <canvas> that is kept aligned to
 * the map by projecting the terrain's geographic corners on every move. (This
 * deliberately avoids MapLibre CanvasSource, which uploads display:none canvases
 * as black textures on many GPUs.) Fully client-side: no API keys, one static
 * asset. Reduced-motion + low-power users get a static-canvas fallback.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  AXES,
  AXIS_META,
  EXAMPLES,
  embedQuery,
  decodeTerrain,
  scoreCells,
  explainCell,
  cellLngLat,
  type Axis,
  type DecodedTerrain,
  type TerrainData,
} from "@/lib/terrain-search";

const ASSET = "/playground/terrain.json";
const TILE = 512; // offscreen tile resolution

/* ---- palette (kept in sync with the site tokens) ------------------------- */
type RGB = [number, number, number];
const SAGE: RGB = [74, 103, 65];
const SAND: RGB = [196, 168, 130];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpRGB = (a: RGB, b: RGB, t: number): RGB => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];
const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/* ---- tile painters (draw the 96-grid up to a smooth TILE×TILE canvas) ----- */
function paintHillshade(t: DecodedTerrain, canvas: HTMLCanvasElement) {
  const n = t.n;
  const small = document.createElement("canvas");
  small.width = n;
  small.height = n;
  const sctx = small.getContext("2d")!;
  const img = sctx.createImageData(n, n);
  const z = 2.2;
  const lx = -0.6, ly = -0.6, lz = 0.55;
  const llen = Math.hypot(lx, ly, lz);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const i = r * n + c;
      const o = i * 4;
      if (t.ocean[i]) {
        img.data[o] = 168; img.data[o + 1] = 184; img.data[o + 2] = 182; img.data[o + 3] = 255;
        continue;
      }
      const l = t.elev[r * n + Math.max(0, c - 1)];
      const rr = t.elev[r * n + Math.min(n - 1, c + 1)];
      const up = t.elev[Math.max(0, r - 1) * n + c];
      const dn = t.elev[Math.min(n - 1, r + 1) * n + c];
      const nx = (l - rr) * z, ny = (up - dn) * z, nz = 1;
      const nl = Math.hypot(nx, ny, nz) || 1;
      let shade = (nx * lx + ny * ly + nz * lz) / (nl * llen);
      shade = 0.62 + 0.55 * Math.max(0, shade);
      const base = lerpRGB([223, 217, 201], [197, 177, 151], t.elev[i]);
      let cr = base[0] * shade, cg = base[1] * shade, cb = base[2] * shade;
      if (t.stream[i]) { cr = 138; cg = 160; cb = 156; }
      img.data[o] = Math.min(255, cr);
      img.data[o + 1] = Math.min(255, cg);
      img.data[o + 2] = Math.min(255, cb);
      img.data[o + 3] = 255;
    }
  }
  sctx.putImageData(img, 0, 0);
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.clearRect(0, 0, TILE, TILE);
  ctx.drawImage(small, 0, 0, TILE, TILE);
}

function paintHeat(t: DecodedTerrain, scores: Float32Array, canvas: HTMLCanvasElement) {
  const n = t.n;
  const small = document.createElement("canvas");
  small.width = n;
  small.height = n;
  const sctx = small.getContext("2d")!;
  const img = sctx.createImageData(n, n);
  for (let i = 0; i < n * n; i++) {
    const o = i * 4;
    const s = scores[i];
    if (Number.isNaN(s)) { img.data[o + 3] = 0; continue; }
    // Absolute score: only genuine matches paint, so the query is legible as
    // highlighted regions over clean hillshade. Weak cells stay transparent.
    const col = lerpRGB(SAND, SAGE, smooth(0.3, 0.95, s));
    img.data[o] = col[0];
    img.data[o + 1] = col[1];
    img.data[o + 2] = col[2];
    img.data[o + 3] = smooth(0.16, 0.7, s) * 0.95 * 255;
  }
  sctx.putImageData(img, 0, 0);
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.clearRect(0, 0, TILE, TILE);
  ctx.drawImage(small, 0, 0, TILE, TILE);
}

function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

type Status = "loading" | "ready" | "error";

export default function SpatialDemo() {
  const mapDiv = useRef<HTMLDivElement>(null);
  const overlay = useRef<HTMLCanvasElement>(null); // visible, aligned to map
  const staticCanvas = useRef<HTMLCanvasElement>(null); // visible, no-map mode
  const baseTile = useRef<HTMLCanvasElement | null>(null);
  const heatTile = useRef<HTMLCanvasElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const rafRef = useRef<number | null>(null);
  const prevScores = useRef<Float32Array | null>(null);
  const scoresRef = useRef<Float32Array | null>(null); // latest scores for hover

  const [status, setStatus] = useState<Status>("loading");
  const [terrain, setTerrain] = useState<DecodedTerrain | null>(null);
  const [useMap, setUseMap] = useState(true);
  const [query, setQuery] = useState(EXAMPLES[0]);
  const [hover, setHover] = useState<{ x: number; y: number; text: string } | null>(null);
  const [pinned, setPinned] = useState<number | null>(null); // inspected cell idx

  const reduced = useRef(false);

  const tiles = useCallback(() => {
    if (!baseTile.current) {
      const b = document.createElement("canvas"); b.width = TILE; b.height = TILE;
      baseTile.current = b;
    }
    if (!heatTile.current) {
      const h = document.createElement("canvas"); h.width = TILE; h.height = TILE;
      heatTile.current = h;
    }
    return { base: baseTile.current!, heat: heatTile.current! };
  }, []);

  /* decide render mode + load asset once */
  useEffect(() => {
    if (typeof window === "undefined") return;
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const small = window.matchMedia("(max-width: 640px)").matches;
    setUseMap(!reduced.current && !small && hasWebGL());

    let alive = true;
    fetch(ASSET)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((d: TerrainData) => {
        if (!alive) return;
        setTerrain(decodeTerrain(d));
        setStatus("ready");
      })
      .catch(() => alive && setStatus("error"));
    return () => {
      alive = false;
    };
  }, []);

  const { embedding, result } = useMemo(() => {
    if (!terrain) return { embedding: null, result: null };
    const e = embedQuery(query);
    const r = scoreCells(terrain, e.vector, 6);
    return { embedding: e, result: r };
  }, [terrain, query]);

  /* blit the prepared tiles onto the map-aligned overlay canvas */
  const drawOverlay = useCallback(() => {
    const map = mapRef.current;
    const cvs = overlay.current;
    const t = terrain;
    if (!map || !cvs || !t || !baseTile.current || !heatTile.current) return;
    const w = mapDiv.current!.clientWidth;
    const h = mapDiv.current!.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (cvs.width !== w * dpr || cvs.height !== h * dpr) {
      cvs.width = w * dpr; cvs.height = h * dpr;
      cvs.style.width = `${w}px`; cvs.style.height = `${h}px`;
    }
    const ctx = cvs.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const { west, south, east, north } = t.bounds;
    const tl = map.project([west, north]);
    const br = map.project([east, south]);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    const dx = tl.x, dy = tl.y, dw = br.x - tl.x, dh = br.y - tl.y;
    ctx.drawImage(baseTile.current, dx, dy, dw, dh);
    ctx.drawImage(heatTile.current, dx, dy, dw, dh);
  }, [terrain]);

  /* draw base+heat onto the static (no-map) canvas */
  const drawStatic = useCallback(() => {
    const cvs = staticCanvas.current;
    if (!cvs || !baseTile.current || !heatTile.current) return;
    const ctx = cvs.getContext("2d")!;
    ctx.imageSmoothingEnabled = true;
    ctx.clearRect(0, 0, TILE, TILE);
    ctx.drawImage(baseTile.current, 0, 0, TILE, TILE);
    ctx.drawImage(heatTile.current, 0, 0, TILE, TILE);
  }, []);

  /* animate heat from previous -> new scores; redraw target + markers */
  const renderScores = useCallback(
    (target: Float32Array, top: number[]) => {
      const t = terrain;
      if (!t) return;
      const { heat } = tiles();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const from = prevScores.current ?? target;
      const start = performance.now();
      const dur = reduced.current ? 0 : 520;

      const redraw = useMap ? drawOverlay : drawStatic;
      const step = (now: number) => {
        const k = dur === 0 ? 1 : Math.min(1, (now - start) / dur);
        const e = k * k * (3 - 2 * k);
        const blended = new Float32Array(target.length);
        for (let i = 0; i < target.length; i++) {
          const a = from[i], b = target[i];
          blended[i] = Number.isNaN(b) ? NaN : lerp(Number.isNaN(a) ? b : a, b, e);
        }
        paintHeat(t, blended, heat);
        redraw();
        if (k < 1) rafRef.current = requestAnimationFrame(step);
        else prevScores.current = target;
      };
      rafRef.current = requestAnimationFrame(step);

      if (useMap && mapRef.current) {
        markersRef.current.forEach((m) => m.remove());
        markersRef.current = top.slice(0, 6).map((idx, rank) => {
          const el = document.createElement("div");
          el.className = "td-marker";
          el.style.setProperty("--d", `${rank * 90}ms`);
          if (reduced.current) el.style.animation = "none";
          return new maplibregl.Marker({ element: el })
            .setLngLat(cellLngLat(t, idx))
            .addTo(mapRef.current!);
        });
      }
    },
    [terrain, useMap, tiles, drawOverlay, drawStatic]
  );

  /* init MapLibre once (map mode) */
  useEffect(() => {
    if (status !== "ready" || !terrain || !useMap) return;
    if (!mapDiv.current || mapRef.current) return;

    const { base } = tiles();
    paintHillshade(terrain, base);

    const { west, south, east, north } = terrain.bounds;
    const map = new maplibregl.Map({
      container: mapDiv.current,
      style: {
        version: 8,
        sources: {},
        layers: [{ id: "bg", type: "background", paint: { "background-color": "#E2E7E0" } }],
      },
      bounds: [west, south, east, north],
      fitBoundsOptions: { padding: 20 },
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      maxBounds: [west - 0.05, south - 0.05, east + 0.05, north + 0.05],
      minZoom: 9.5,
      maxZoom: 14,
    });
    map.scrollZoom.disable();
    map.touchZoomRotate.disableRotation();
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;

    const redraw = () => drawOverlay();
    map.on("load", () => {
      map.resize();
      redraw();
      if (result) renderScores(result.scores, result.top);
    });
    map.on("move", redraw);
    map.on("resize", redraw);

    // Keep MapLibre + the aligned overlay in sync with the container size.
    // Layout can settle after init (grid/aspect resolve late on hydration),
    // which otherwise leaves the map stuck at the wrong size with a 0-height
    // overlay that paints nothing.
    const ro = new ResizeObserver(() => {
      map.resize();
      redraw();
    });
    ro.observe(mapDiv.current);

    const cellAt = (ev: maplibregl.MapMouseEvent): number | null => {
      const { west, south, east, north } = terrain.bounds;
      const fx = (ev.lngLat.lng - west) / (east - west);
      const fy = (north - ev.lngLat.lat) / (north - south);
      if (fx < 0 || fx > 1 || fy < 0 || fy > 1) return null;
      const c = Math.min(terrain.n - 1, Math.floor(fx * terrain.n));
      const r = Math.min(terrain.n - 1, Math.floor(fy * terrain.n));
      return r * terrain.n + c;
    };

    const onMove = (ev: maplibregl.MapMouseEvent) => {
      const i = cellAt(ev);
      if (i === null) return setHover(null);
      if (terrain.ocean[i]) return setHover({ x: ev.point.x, y: ev.point.y, text: "Tasman Sea" });
      const elevM = Math.round(terrain.elev[i] * terrain.elevMaxM);
      const steep = terrain.signed.steepness[i];
      const north_ = terrain.signed.northness[i];
      const wet = terrain.signed.water[i];
      const aspect = Math.abs(north_) < 0.15 ? "—" : north_ > 0 ? "N-facing" : "S-facing";
      const slopeTxt = steep > 0.4 ? "steep" : steep > -0.2 ? "moderate" : "gentle";
      const waterTxt = wet > 0.3 ? "near water" : wet > -0.4 ? "" : "dry";
      const sc = scoresRef.current?.[i];
      const matchTxt =
        sc !== undefined && !Number.isNaN(sc) ? ` · ${Math.round(sc * 100)}% match` : "";
      setHover({
        x: ev.point.x,
        y: ev.point.y,
        text: `${elevM} m · ${slopeTxt}${aspect !== "—" ? " · " + aspect : ""}${waterTxt ? " · " + waterTxt : ""}${matchTxt}`,
      });
    };
    map.on("mousemove", onMove);
    map.on("mouseout", () => setHover(null));
    map.on("click", (ev) => {
      const i = cellAt(ev);
      setPinned(i !== null && !terrain.ocean[i] ? i : null);
    });
    map.getCanvas().style.cursor = "crosshair";

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, terrain, useMap]);

  /* static-mode initial paint */
  useEffect(() => {
    if (status !== "ready" || !terrain || useMap) return;
    const { base } = tiles();
    paintHillshade(terrain, base);
    if (result) renderScores(result.scores, result.top);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, terrain, useMap]);

  /* repaint on query change */
  useEffect(() => {
    if (status !== "ready" || !terrain || !result) return;
    scoresRef.current = result.scores;
    renderScores(result.scores, result.top);
  }, [status, terrain, result, renderScores]);

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  const ranked = result?.ranked ?? [];
  const noMatch = embedding && embedding.matches.length === 0;

  const pin =
    pinned !== null && terrain && embedding
      ? {
          score: result?.scores?.[pinned] ?? NaN,
          ll: cellLngLat(terrain, pinned),
          elevM: Math.round(terrain.elev[pinned] * terrain.elevMaxM),
          parts: explainCell(terrain, embedding.vector, pinned),
        }
      : null;

  return (
    <section className="mx-auto max-w-work px-6 py-12">
      <style>{`
        .td-marker{width:13px;height:13px;border-radius:50%;background:#14655A;
          box-shadow:0 0 0 3px rgba(236,239,234,.95),0 0 0 5px rgba(20,101,90,.4);
          animation:td-pulse 2.4s ease-out infinite;animation-delay:var(--d,0ms);}
        @keyframes td-pulse{0%{box-shadow:0 0 0 3px rgba(236,239,234,.95),0 0 0 5px rgba(20,101,90,.55)}
          70%{box-shadow:0 0 0 3px rgba(236,239,234,.95),0 0 0 18px rgba(20,101,90,0)}
          100%{box-shadow:0 0 0 3px rgba(236,239,234,.95),0 0 0 18px rgba(20,101,90,0)}}
        @media (prefers-reduced-motion: reduce){.td-marker{animation:none!important}}
      `}</style>

      <span className="mono-label">Live demo · spatial + ML</span>
      <h1 className="mt-3 font-display">Semantic terrain search</h1>
      <p className="mt-4 max-w-prose text-ink/70">
        Describe a landscape in plain English. An in-browser semantic model reads
        your words, and a DEM-derived terrain grid lights up wherever the ground
        actually matches — slope, aspect, ruggedness, exposure and water, scored
        live on the map.
      </p>

      {/* search */}
      <div className="mt-7 max-w-prose">
        <label htmlFor="td-q" className="sr-only">Describe terrain</label>
        <input
          id="td-q"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="steep north-facing slopes near water"
          autoComplete="off"
          spellCheck={false}
          className="w-full border border-contour bg-terrace px-4 py-3 font-mono text-sm text-ink outline-none transition-colors focus:border-flow"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => setQuery(ex)}
              className={`stack-tag transition-colors hover:border-flow hover:text-flow ${
                query === ex ? "border-flow text-flow" : ""
              }`}
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      {/* main grid: map + explainer */}
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="relative">
          {status === "loading" && (
            <div className="flex h-[440px] w-full items-center justify-center border border-contour bg-terrace sm:h-[500px]">
              <span className="mono-label animate-pulse">Loading terrain…</span>
            </div>
          )}
          {status === "error" && (
            <div className="flex h-[440px] w-full flex-col items-center justify-center gap-3 border border-contour bg-terrace text-center sm:h-[500px]">
              <span className="mono-label">Couldn&apos;t load terrain data</span>
              <button onClick={() => location.reload()} className="btn-secondary text-sm">Retry</button>
            </div>
          )}

          {/* MAP MODE: map div + aligned overlay canvas */}
          {status === "ready" && useMap && (
            <div className="relative h-[440px] w-full overflow-hidden border border-contour sm:h-[500px]">
              <div ref={mapDiv} className="h-full w-full" style={{ background: "#E2E7E0" }} aria-hidden />
              <canvas
                ref={overlay}
                className="pointer-events-none absolute inset-0 h-full w-full"
                aria-label="Terrain map. Stronger matches for your query are shaded green."
              />
            </div>
          )}

          {/* STATIC MODE: single composited canvas */}
          {status === "ready" && !useMap && (
            <canvas
              ref={staticCanvas}
              width={TILE}
              height={TILE}
              aria-label="Terrain map. Stronger matches for your query are shaded green."
              className="aspect-square w-full border border-contour"
              style={{ display: "block" }}
            />
          )}

          {/* hover inspector */}
          {hover && (
            <div
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[140%] whitespace-nowrap border border-contour bg-paper/95 px-2 py-1 font-mono text-[11px] text-ink shadow-sm"
              style={{ left: hover.x, top: hover.y }}
            >
              {hover.text}
            </div>
          )}

          {/* static-mode top results */}
          {status === "ready" && !useMap && terrain && result && (
            <ul className="mt-3 grid grid-cols-2 gap-2">
              {result.top.slice(0, 6).map((idx, i) => {
                const [lng, lat] = cellLngLat(terrain, idx);
                return (
                  <li key={idx} className="border border-contour bg-terrace px-3 py-2 font-mono text-[11px] text-ink/80">
                    <span className="text-flow">#{i + 1}</span> {lat.toFixed(3)}, {lng.toFixed(3)}
                  </li>
                );
              })}
            </ul>
          )}

          {/* legend */}
          {status === "ready" && (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-ink/45">weak</span>
                <span
                  className="h-2 w-28 rounded-full"
                  style={{
                    background:
                      "linear-gradient(90deg, rgba(178,58,24,0) 0%, rgba(178,58,24,.8) 35%, #14655A 100%)",
                  }}
                />
                <span className="font-mono text-[11px] text-ink/45">strong match</span>
              </div>
              {useMap && (
                <span className="font-mono text-[11px] text-ink/40">
                  hover to read a cell · click to inspect
                </span>
              )}
            </div>
          )}

          <p className="mt-2 font-mono text-[11px] text-ink/45">
            Synthetic DEM · real terrain analysis (slope · aspect · TPI · flow
            accumulation) · in-browser semantic model · no API keys
          </p>
        </div>

        {/* explainer */}
        <aside className="border-t border-contour pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <span className="mono-label">How it reads your query</span>
          {noMatch ? (
            <p className="mt-3 text-sm text-ink/60">
              No terrain words recognised yet. Try <em>steep</em>, <em>valley</em>,{" "}
              <em>north-facing</em>, <em>rocky</em>, <em>near water</em>, or{" "}
              <em>sheltered forest</em>.
            </p>
          ) : (
            <>
              {embedding && embedding.matches.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {embedding.matches.map((m, i) => (
                    <span
                      key={i}
                      title={m.fuzzy ? `≈ ${m.key}` : m.key}
                      className={`stack-tag !py-0.5 !text-[11px] ${
                        m.negated ? "border-infra text-ink/50 line-through" : "border-flow text-flow"
                      }`}
                    >
                      {m.token}
                    </span>
                  ))}
                </div>
              )}

              {result && ranked.length > 0 && (
                <div className="mt-4 flex items-center gap-5 border-y border-contour py-3 font-mono text-[11px]">
                  <div>
                    <span className="text-base font-medium text-flow">
                      {Math.round(result.best * 100)}%
                    </span>{" "}
                    <span className="text-ink/45">best match</span>
                  </div>
                  <div>
                    <span className="text-base font-medium text-ink">
                      {result.strong}
                    </span>{" "}
                    <span className="text-ink/45">strong cells</span>
                  </div>
                </div>
              )}

              <div className="mt-5 space-y-2.5">
                {ranked.length === 0 && (
                  <p className="text-sm text-ink/50">Type to see the terrain vector.</p>
                )}
                {ranked.map(({ axis, weight }) => {
                  const meta = AXIS_META[axis as Axis];
                  const pct = Math.min(100, Math.abs(weight) * 42);
                  const pos = weight >= 0;
                  return (
                    <div key={axis}>
                      <div className="flex items-baseline justify-between font-mono text-[11px]">
                        <span className="text-ink/70">{pos ? meta.pos : meta.neg}</span>
                        <span className="text-ink/40">{weight.toFixed(1)}</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full bg-terrace">
                        <div
                          className="h-full"
                          style={{
                            width: `${pct}%`,
                            background: pos ? "#14655A" : "#B23A18",
                            marginLeft: pos ? 0 : `${100 - pct}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {pin && (
                <div className="mt-5 border-t border-contour pt-4">
                  <div className="flex items-baseline justify-between">
                    <span className="mono-label">Inspected cell</span>
                    <button
                      onClick={() => setPinned(null)}
                      className="font-mono text-[11px] text-ink/40 hover:text-flow"
                    >
                      clear
                    </button>
                  </div>
                  <p className="mt-2 font-mono text-[11px] text-ink/60">
                    {pin.ll[1].toFixed(3)}, {pin.ll[0].toFixed(3)} · {pin.elevM} m ·{" "}
                    <span className="text-flow">
                      {Number.isNaN(pin.score) ? "—" : `${Math.round(pin.score * 100)}% match`}
                    </span>
                  </p>
                  <div className="mt-3 space-y-1.5">
                    {pin.parts.slice(0, 5).map(({ axis, cell, contrib }) => {
                      const meta = AXIS_META[axis as Axis];
                      const label = cell >= 0 ? meta.pos : meta.neg;
                      const good = contrib > 0.02;
                      const bad = contrib < -0.02;
                      return (
                        <div
                          key={axis}
                          className="flex items-center justify-between font-mono text-[11px]"
                        >
                          <span className="text-ink/70">{label}</span>
                          <span className={good ? "text-flow" : bad ? "text-infra" : "text-ink/35"}>
                            {contrib > 0 ? "+" : ""}
                            {contrib.toFixed(2)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-2.5 text-[11px] leading-relaxed text-ink/45">
                    Green traits pull this cell toward your query; sand traits push
                    against it.
                  </p>
                </div>
              )}
            </>
          )}

          <p className="mt-6 border-t border-contour pt-4 text-[13px] leading-relaxed text-ink/55">
            Your sentence is embedded into eight interpretable terrain axes, then
            every grid cell is ranked by similarity to that vector — the same
            language-to-features bridge I build for spatial data pipelines.
          </p>
        </aside>
      </div>
    </section>
  );
}
