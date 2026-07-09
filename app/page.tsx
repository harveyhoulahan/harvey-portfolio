import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import Hero from "@/components/Hero";
import PretrainingCardArt from "@/components/PretrainingCardArt";
import WorkIndex from "@/components/WorkIndex";
import ProofStrip from "@/components/ProofStrip";
import TimezoneBand from "@/components/TimezoneBand";
import { about, profile, services } from "@/data/metadata";

/* Homepage evidence cards: production, research, playground. */
const EVIDENCE = [
  {
    kicker: "Production",
    title: "Canopy cover from orbit",
    blurb: "Satellite × LiDAR carbon pipeline, self-calibrating per station, running under real policy advice.",
    href: "/canopy",
    cta: "Read the deep-dive →",
    art: { src: "/images/projects/arbormeta/canopy-carbon.jpg", alt: "Canopy-height heatmap from paired LiDAR captures" },
  },
  {
    kicker: "Research",
    title: "1.75 to 1.18, fixed compute",
    blurb: "40M parameters, fixed compute. Every experiment kept, failures included.",
    href: "/pretraining",
    cta: "Read the report →",
    art: null,
  },
  {
    kicker: "Playground",
    title: "Worlds that run in a tab",
    blurb: "WebGPU physics, artificial life, a terminal that speaks plain english. No servers.",
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
        <div className="mx-auto max-w-prose px-6 py-10 md:py-12">
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
            Two kinds of work. Retainer, build, or advisory.
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

      {/* Production, research, playground */}
      <section className="border-t border-contour bg-terrace">
        <div className="mx-auto max-w-work px-6 py-16">
          <div className="grid gap-5 md:grid-cols-3">
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
                  <div className="border-b border-contour">
                    <PretrainingCardArt />
                  </div>
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
