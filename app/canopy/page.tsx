import type { Metadata } from "next";
import type { ReactNode } from "react";
import FinetuneChart from "@/components/canopy/FinetuneChart";
import ProductionLog from "@/components/canopy/ProductionLog";

export const metadata: Metadata = {
  title: "Canopy cover from orbit | satellite × LiDAR fusion | Harvey Houlahan",
  description:
    "How ArborMeta measures forest canopy at 0.5 m from satellite imagery: a wavelength-aware Swin-UNet trained on airborne-LiDAR canopy-cover labels, self-calibrated per station on its own ALS data, plus the geospatial platform built around it.",
  alternates: { canonical: "https://hjhportfolio.com/canopy" },
};

/* The day-job deep dive: the satellite→LiDAR canopy ML pipeline and the
 * platform around it. Client and property identifiers are stripped; every
 * number is from a real production run. */

const STATS = [
  { label: "Ground resolution", value: "0.5 m" },
  { label: "Cover layers predicted", value: "11 · 1.0–2.0 m" },
  { label: "Self-calibration val loss", value: "0.0133 → 0.0096" },
  { label: "One station, predicted", value: "975 tiles · 7 m 24 s" },
] as const;

const PLATFORM: [string, string][] = [
  ["The map", "MapLibre workspace over every domain (ALS, TLS, satellite, carbon-project boundaries) as filterable vector-tile layers with AOI drawing, zonal statistics and QGIS export."],
  ["The 3D globe", "A token-free Three.js globe that streams terrestrial-LiDAR point clouds of individual trees in one WebGL context: eye-dome lighting, classification filters, rescan-vs-parent growth comparison."],
  ["Per-tree science", "DBH, height, volume, biomass and QSM model uncertainty for every reconstructed stem; colour any plot by any metric."],
  ["Pipeline operations", "Ingestion timeline, processing queue, throughput and backlog, storage health, data-quality checks, and an admin audit log."],
  ["Collaboration", "Typed, shareable workspaces, threaded comments, snapshot messaging, and real-time notifications over Postgres LISTEN/NOTIFY → Server-Sent Events."],
  ["FieldLink", "An air-gap-friendly delivery channel for field crews: X25519 + Ed25519, sign-then-encrypt, replay protection, per-device sealed packages. The transport only ever sees ciphertext."],
];

function Block({ kicker, children }: { kicker: string; children: ReactNode }) {
  return (
    <div className="mt-10">
      <h3 className="mb-2 font-mono text-xs uppercase tracking-[0.18em] text-sage">{kicker}</h3>
      <p className="text-base leading-prose text-ink/80">{children}</p>
    </div>
  );
}

/* The pipeline, drawn: two instruments converge on one model. */
function PipelineDiagram() {
  const box = (x: number, y: number, w: number, label: string, sub?: string, accent = false) => (
    <g key={label}>
      <rect x={x} y={y} width={w} height={46} fill="var(--terrace)" stroke={accent ? "var(--flow)" : "var(--contour)"} strokeWidth={accent ? 1.5 : 1} />
      <text x={x + w / 2} y={y + (sub ? 20 : 27)} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--ink)" fontFamily="var(--font-mono), monospace">
        {label}
      </text>
      {sub && (
        <text x={x + w / 2} y={y + 35} textAnchor="middle" fontSize={9} fill="var(--ink)" opacity={0.5} fontFamily="var(--font-mono), monospace">
          {sub}
        </text>
      )}
    </g>
  );
  const arrow = (x1: number, y1: number, x2: number, y2: number) => (
    <path key={`${x1}-${y1}-${x2}-${y2}`} d={`M ${x1} ${y1} L ${x2} ${y2}`} stroke="var(--ink)" strokeOpacity={0.4} strokeWidth={1.5} markerEnd="url(#cv-arr)" fill="none" />
  );
  return (
    <div className="overflow-x-auto">
      <svg viewBox="0 0 880 210" className="min-w-[720px] w-full" role="img"
        aria-label="Pipeline diagram: airborne LiDAR becomes canopy-height and cover labels; satellite imagery becomes calibrated radiance chips; both feed a wavelength-conditioned Swin-UNet, which is fine-tuned per station, predicts tiled, and is mosaicked to a station-scale raster.">
        <defs>
          <marker id="cv-arr" viewBox="0 0 8 8" refX={7} refY={4} markerWidth={7} markerHeight={7} orient="auto">
            <path d="M 0 0 L 8 4 L 0 8 z" fill="var(--ink)" opacity={0.4} />
          </marker>
        </defs>
        {/* labels lane */}
        {box(10, 20, 140, "ALS point clouds", "airborne LiDAR")}
        {box(190, 20, 140, "CHM, smoothed", "canopy height model")}
        {box(370, 20, 150, "11 cover rasters", "fraction > 1.0…2.0 m")}
        {/* imagery lane */}
        {box(10, 144, 140, "Jilin-1 PAN+MSS", "5 bands · 0.5 m")}
        {box(190, 144, 140, "DN → radiance", "λ, bandwidth, angles")}
        {box(370, 144, 150, "768 px HDF5 chips", "int16 + metadata")}
        {/* convergence */}
        {box(575, 82, 150, "DOFA Swin-UNet", "wavelength-conditioned", true)}
        {box(760, 20, 110, "fine-tune", "per station")}
        {box(760, 144, 110, "predict + mosaic", "GDAL · ZSTD")}
        {arrow(150, 43, 188, 43)}
        {arrow(330, 43, 368, 43)}
        {arrow(150, 167, 188, 167)}
        {arrow(330, 167, 368, 167)}
        {arrow(520, 43, 573, 95)}
        {arrow(520, 167, 573, 115)}
        {arrow(725, 95, 758, 50)}
        {arrow(725, 115, 758, 160)}
      </svg>
    </div>
  );
}

export default function CanopyPage() {
  return (
    <section className="bg-concrete text-ink">
      <div className="mx-auto max-w-work px-6 py-16 md:py-24">
        <p className="mb-4 font-mono text-xs uppercase tracking-[0.22em] text-sage">
          Field work · ArborMeta · 2026
        </p>
        <h1 className="max-w-[720px] font-display text-3xl leading-tight md:text-[2.6rem]">
          Canopy cover from orbit
        </h1>
        <p className="mt-4 max-w-prose text-base leading-prose text-ink/75">
          Airborne LiDAR measures forest structure honestly, but only over thin
          flightlines. Satellites cover whole stations but cannot see in 3D.
          This pipeline learns the mapping between them: a wavelength-aware
          transformer trained on LiDAR-derived canopy-cover labels, self-calibrated
          on each station&apos;s own flightlines, then run across the entire
          property from satellite alone. Client and site identifiers are stripped;
          every number below is from a real production run.
        </p>

        <div className="mt-10 grid grid-cols-2 gap-px border border-contour bg-contour md:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="bg-paper px-4 py-4">
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">{s.label}</div>
              <div className="mt-1.5 font-sans text-lg font-semibold text-ink">{s.value}</div>
            </div>
          ))}
        </div>

        <div className="mt-12 border border-contour bg-paper p-5 md:p-7">
          <h2 className="font-display text-xl">The pipeline</h2>
          <p className="mb-5 mt-1 max-w-prose text-sm text-ink/60">
            Two instruments, one model. Labels flow from the LiDAR lane; imagery
            flows from the satellite lane; they meet in a wavelength-conditioned
            encoder.
          </p>
          <PipelineDiagram />
        </div>

        <div className="mx-auto max-w-prose">
          <Block kicker="The two instruments">
            The label side starts as raw airborne-LiDAR point clouds, becomes a
            smoothed canopy-height model, and is rasterised into eleven
            cover-fraction layers: the fraction of ground covered by vegetation
            taller than 1.0 m, 1.1 m, … 2.0 m. The imagery side is Jilin-1, a
            panchromatic band plus four multispectral bands at 0.5 m. Nothing is
            fed to the model as raw pixels. Per-band calibration gain and bias
            from the scene metadata convert digital numbers to radiance, and each
            band travels with its centre wavelength, bandwidth, and the sun and
            satellite geometry at capture.
          </Block>

          <Block kicker="A wavelength-aware model">
            The encoder is a Swin-UNet with a DOFA-style dynamic patch embedding:
            a hypernetwork generates the input-layer weights from the band
            wavelengths themselves, so the network is conditioned on what its
            channels physically <em>are</em> rather than hard-wired to one sensor.
            Acquisition angles, location, and a capture-to-prediction date delta
            enter as learned embeddings with fallback tokens when metadata is
            missing. The same weights serve imagery from different constellations
            with different band counts.
          </Block>
        </div>

        <div className="mt-12 border border-contour bg-paper p-5 md:p-7">
          <h2 className="font-display text-xl">Self-calibration, per station</h2>
          <p className="mb-5 mt-1 max-w-prose text-sm text-ink/60">
            Before predicting a station, the base model fine-tunes on that
            station&apos;s own LiDAR chips. Every dot is a saved checkpoint from
            one production run. Hover for the numbers.
          </p>
          <FinetuneChart />
        </div>

        <div className="mx-auto max-w-prose">
          <Block kicker="The last mile">
            Prediction tiles the scene with a single-grid sampler: 768-pixel
            patches with 128 pixels of overlap so tile edges can be cropped away.
            Each tile runs under mixed precision, the output is georeferenced, and
            thousands of tiles merge through a GDAL VRT into one ZSTD-compressed,
            station-scale cover raster. One model run&apos;s outputs for one
            delivery: 18 rasters, 119.6 GB.
          </Block>
        </div>

        {/* the run, as it looked */}
        <div className="mx-auto mt-12 max-w-prose">
          <h2 className="font-display text-xl">One run, end to end</h2>
          <p className="mb-4 mt-1 text-sm text-ink/60">
            The production log, trimmed to its skeleton.
          </p>
          <ProductionLog />
        </div>

        {/* the platform */}
        <div className="mt-14">
          <h2 className="font-display text-xl">The platform around it</h2>
          <p className="mt-2 max-w-prose text-base leading-prose text-ink/80">
            The pipeline feeds a full geospatial platform: a single-handed
            build used by the team, government stakeholders and visiting
            researchers. A FastAPI + PostGIS backend (~35 route modules, ~40
            tables) sits under a React 18 + TypeScript frontend (14 pages),
            serving vector tiles, cloud-optimised point clouds and rasters from
            terabyte-scale archives.
          </p>
          <div className="mt-6 grid gap-x-10 gap-y-5 md:grid-cols-2">
            {PLATFORM.map(([k, v]) => (
              <div key={k} className="border-l-2 border-sage pl-4">
                <div className="text-sm font-medium text-ink/85">{k}</div>
                <div className="mt-0.5 text-sm leading-relaxed text-ink/65">{v}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="mx-auto max-w-prose">
          <Block kicker="Why it matters">
            These rasters are not decorative. Canopy growth measured between
            repeat LiDAR captures, extended across whole stations by satellite,
            is the evidence base under Australian carbon-credit policy advice.
            The same discipline as the demos on this site, pointed at country.
          </Block>
        </div>

        <div className="mt-12 flex flex-wrap items-center gap-4 border-t border-contour pt-8">
          <a href="/projects" className="btn-secondary text-sm">
            The ArborMeta case study →
          </a>
          <a href="/pretraining" className="btn-secondary text-sm">
            The pretraining report →
          </a>
          <span className="font-mono text-xs text-ink/45">
            Harvey Houlahan · ArborMeta · 2026
          </span>
        </div>
      </div>
    </section>
  );
}
