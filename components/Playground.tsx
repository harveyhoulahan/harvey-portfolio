import ContourMotif from "@/components/ContourMotif";
import GpuBadge from "@/components/GpuBadge";
import Link from "next/link";

// The Playground is the launcher for the flagship GPU demos. Live cards open
// the full-screen experience at their own route; the header shifts to demo
// mode there (see Navbar). A third slot holds the next thing.
const DEMOS = [
  {
    href: "/catchment",
    kicker: "01 · neural earth engine",
    title: "catchment",
    blurb:
      "Rain carves real terrain and fire runs with the wind. The full solver runs on your GPU, and I trained a neural operator to imitate it. Switch between physics and neural and watch the error field live.",
    meta: "webgpu · shallow-water · neural operator",
    motif: "basin" as const,
  },
  {
    href: "/genesis",
    kicker: "02 · artificial-life lab",
    title: "genesis",
    blurb:
      "Thousands of particles flock, chase, and predate on your GPU. Describe a swarm in plain text and CLIP scores it while an evolutionary search nudges the sim toward what you asked for.",
    meta: "webgpu · particle life · CLIP · CMA-ES",
    motif: "swarm" as const,
  },
] as const;

export default function Playground() {
  return (
    <section className="col-shell max-w-work py-16 md:py-24">
      <div className="flex flex-wrap items-center gap-3">
        <span className="mono-label normal-case tracking-[0.14em]">playground · live demos</span>
        <GpuBadge />
      </div>
      <h1 className="mt-3 font-display text-3xl md:text-4xl">Things that run in your browser</h1>
      <p className="mt-3 max-w-prose text-ink/65">
        Simulations that run entirely in your browser on the GPU. No servers,
        no API keys, no libraries. Raw WGSL compute, including the neural network.{" "}
        <a
          href="https://github.com/harveyhoulahan/harvey-portfolio"
          target="_blank"
          rel="noopener noreferrer"
          className="text-flow underline-offset-4 hover:underline"
        >
          Source on GitHub
        </a>
        .
      </p>

      <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {DEMOS.map((d) => (
          <Link
            key={d.href}
            href={d.href}
            className="group survey-corners relative flex flex-col justify-between overflow-hidden border border-contour bg-terrace/40 p-6 transition-colors duration-300 hover:border-flow"
          >
            <ContourMotif variant={d.motif} />
            <div className="relative">
              <span className="mono-label normal-case tracking-[0.14em]">{d.kicker}</span>
              <h2 className="mt-2 font-display text-2xl text-ink">{d.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink/70">{d.blurb}</p>
            </div>
            <div className="relative mt-6 flex items-center justify-between gap-4">
              <span className="font-mono text-[11px] tracking-[0.06em] text-ink/40">{d.meta}</span>
              <span className="font-mono text-xs tracking-[0.06em] text-flow transition-transform duration-300 ease-out group-hover:translate-x-1 motion-reduce:transform-none">
                enter →
              </span>
            </div>
          </Link>
        ))}

        {/* Placeholder for the next demo — same card shell, no link */}
        <div
          aria-label="More demos coming"
          className="survey-corners relative flex flex-col justify-between overflow-hidden border border-dashed border-contour bg-terrace/20 p-6"
        >
          <ContourMotif
            variant="channels"
            className="contour-motif pointer-events-none absolute -right-6 -top-6 z-0 h-28 w-36 text-ink/10"
          />
          <div className="relative">
            <span className="mono-label normal-case tracking-[0.14em] text-ink/40">
              03 · watch this space
            </span>
            <h2 className="mt-2 font-display text-2xl text-ink/45">more coming</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink/45">
              Another GPU demo in the works. Same rule: runs in the tab, no servers.
            </p>
          </div>
          <div className="relative mt-6 flex items-center justify-between gap-4">
            <span className="font-mono text-[11px] tracking-[0.06em] text-ink/30">
              not shipped yet
            </span>
            <span className="font-mono text-xs tracking-[0.06em] text-ink/30">soon</span>
          </div>
        </div>
      </div>
    </section>
  );
}
