import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import Hero from "@/components/Hero";
import WorkIndex from "@/components/WorkIndex";
import ProofStrip from "@/components/ProofStrip";
import TimezoneBand from "@/components/TimezoneBand";
import { about, profile, services } from "@/data/metadata";

/* The evidence trilogy: three kinds of proof, one card each. The research
 * card draws its own miniature of the pretraining ladder. */
const LADDER = [1.7533, 1.34, 1.3195, 1.2746, 1.2383, 1.2352, 1.2253, 1.2209, 1.1985, 1.1933, 1.1866, 1.1823, 1.1754];

function MiniLadder() {
  const W = 300, H = 160, PAD = 22;
  const x = (i: number) => PAD + (i / (LADDER.length - 1)) * (W - PAD * 2);
  const y = (v: number) => PAD + ((1.78 - v) / (1.78 - 1.15)) * (H - PAD * 2);
  let d = "";
  LADDER.forEach((v, i) => { d += i === 0 ? `M ${x(0)} ${y(v)}` : ` H ${x(i)} V ${y(v)}`; });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-40 w-full bg-terrace" aria-hidden preserveAspectRatio="xMidYMid slice">
      {[1.2, 1.4, 1.6].map((v) => (
        <line key={v} x1={PAD} x2={W - PAD} y1={y(v)} y2={y(v)} stroke="var(--contour)" strokeWidth={1} />
      ))}
      <path d={d} fill="none" stroke="var(--flow)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(LADDER.length - 1)} cy={y(LADDER[LADDER.length - 1])} r={4.5} fill="var(--flow)" stroke="var(--paper)" strokeWidth={2} />
      <text x={W - PAD} y={y(1.1754) - 12} textAnchor="end" fontSize={11} fontWeight={600} fill="var(--ink)" opacity={0.7} fontFamily="var(--font-mono), monospace">
        1.1754
      </text>
    </svg>
  );
}

const EVIDENCE = [
  {
    kicker: "Production",
    title: "Canopy cover from orbit",
    blurb: "A satellite × LiDAR carbon pipeline, self-calibrating per station and running underneath real policy advice.",
    href: "/canopy",
    cta: "Read the deep-dive →",
    art: { src: "/images/projects/arbormeta/canopy-carbon.jpg", alt: "Canopy-height heatmap from paired LiDAR captures" },
  },
  {
    kicker: "Research",
    title: "1.75 to 1.18, fixed compute",
    blurb: "A 40M-parameter pretraining study with every experiment kept — the failures are the evidence.",
    href: "/pretraining",
    cta: "Read the report →",
    art: null,
  },
  {
    kicker: "Craft",
    title: "Worlds that run in a tab",
    blurb: "Hand-written WebGPU physics, artificial life, and a terminal that speaks english — no servers, no libraries.",
    href: "/playground",
    cta: "Enter the playground →",
    art: { src: "/catchment/poster.jpg", alt: "Simulated terrain from the Catchment engine, mid-storm" },
  },
] as const;

export default function Home() {
  return (
    <>
      <Hero />

      {/* Positioning line */}
      <section className="graticule-grid border-y border-contour bg-terrace">
        <div className="mx-auto max-w-prose px-6 py-16">
          <p className="font-display text-2xl leading-snug md:text-3xl">
            {about.paragraphs[1]}
          </p>
        </div>
      </section>

      {/* Proof strip — stats with receipts; every line is a live artifact */}
      <section className="mx-auto max-w-work px-6 py-16">
        <span className="mono-label">Proof of work</span>
        <div className="mt-6">
          <ProofStrip />
        </div>
      </section>

      {/* The offer — two lanes, three ways in, and the timezone answered */}
      <section className="border-y border-contour bg-terrace">
        <div className="mx-auto max-w-work px-6 py-16">
          <span className="mono-label">Working together</span>
          <h2 className="mt-3 font-display text-2xl md:text-3xl">
            Two lanes. Three ways in.
          </h2>

          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {services.lanes.map((lane) => (
              <div key={lane.name} className="survey-corners relative border border-contour bg-paper/40 p-6">
                <h3 className="font-display text-xl text-ink">{lane.name}</h3>
                <p className="mt-1 font-mono text-xs text-ink/50">{lane.pitch}</p>
                <ul className="mt-4 space-y-2">
                  {lane.items.map((item) => (
                    <li key={item} className="flex gap-2 text-sm leading-relaxed text-ink/75">
                      <span className="mt-2 h-1 w-2.5 shrink-0 bg-flow" aria-hidden />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-3">
            {services.models.map((m) => (
              <div key={m.name} className="border-l-2 border-flow bg-paper/40 py-4 pl-4 pr-3">
                <div className="font-mono text-xs uppercase tracking-[0.12em] text-ink/80">{m.name}</div>
                <p className="mt-2 text-sm leading-relaxed text-ink/65">{m.detail}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 border-t border-contour pt-10">
            <span className="mono-label">The timezone question</span>
            <div className="mt-5">
              <TimezoneBand />
            </div>
            <a href={profile.startProject} className="btn-primary mt-8 inline-flex">
              Start a project <ArrowRight size={16} />
            </a>
          </div>
        </div>
      </section>

      {/* Selected work */}
      <section className="mx-auto max-w-work px-6 py-20">
        <div className="flex items-baseline justify-between">
          <span className="mono-label">Selected work</span>
          <Link
            href="/projects"
            className="inline-flex items-center gap-1 font-mono text-xs uppercase tracking-[0.12em] text-ink/60 hover:text-flow"
          >
            All work <ArrowRight size={13} />
          </Link>
        </div>

        <WorkIndex />
      </section>

      {/* The evidence — production, research, craft */}
      <section className="border-t border-contour bg-terrace">
        <div className="mx-auto max-w-work px-6 py-16">
          <span className="mono-label">The evidence</span>
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {EVIDENCE.map((e) => (
              <Link
                key={e.href}
                href={e.href}
                className="group survey-corners relative flex flex-col overflow-hidden border border-contour bg-paper/40 transition-colors duration-300 hover:border-flow"
              >
                {e.art ? (
                  <div className="relative h-40 w-full overflow-hidden border-b border-contour">
                    <Image
                      src={e.art.src}
                      alt={e.art.alt}
                      fill
                      sizes="(min-width: 768px) 33vw, 100vw"
                      className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transform-none"
                    />
                  </div>
                ) : (
                  <div className="border-b border-contour"><MiniLadder /></div>
                )}
                <div className="flex flex-1 flex-col p-6">
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/45">{e.kicker}</span>
                  <h3 className="mt-2 font-display text-xl text-ink">{e.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-ink/70">{e.blurb}</p>
                  <span className="mt-5 font-mono text-xs uppercase tracking-[0.12em] text-flow transition-transform duration-300 ease-out group-hover:translate-x-1 motion-reduce:transform-none">
                    {e.cta}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="graticule-grid border-t border-contour bg-terrace">
        <div className="mx-auto max-w-prose px-6 py-20 text-center">
          <span className="mono-label inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 animate-pulse bg-flow" aria-hidden />
            {profile.availability}
          </span>
          <h2 className="mt-4 font-display">Let&apos;s build something.</h2>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <a href={profile.startProject} className="btn-primary">
              Start a project <ArrowRight size={15} />
            </a>
            <Link href="/playground" className="btn-secondary">
              Live demos
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
