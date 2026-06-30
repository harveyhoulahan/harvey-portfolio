import Link from "next/link";

// The Playground is now the launcher for the two flagship GPU demos. Each card
// opens the full-screen experience at its own route; the header shifts to demo
// mode there (see Navbar).
const DEMOS = [
  {
    href: "/genesis",
    kicker: "Flagship II",
    title: "Genesis",
    blurb:
      "An artificial-life lab. Continuous cellular automata evolve live on your GPU — then summon a lifeform by describing it.",
    meta: "WebGPU · Lenia · CLIP",
  },
  {
    href: "/catchment",
    kicker: "Flagship I",
    title: "Catchment",
    blurb:
      "A living catchment. Rain carves real terrain and fire runs with the wind, with a neural surrogate learning the physics.",
    meta: "WebGPU · shallow-water · neural surrogate",
  },
] as const;

export default function Playground() {
  return (
    <section className="col-shell max-w-work py-16 md:py-24">
      <span className="mono-label">Playground · live demos</span>
      <h1 className="mt-3 font-display text-3xl md:text-4xl">Things that run in your browser</h1>
      <p className="mt-3 max-w-prose text-ink/65">
        Two flagship simulations, GPU-native and entirely client-side — no servers, no API keys.
        Pick one to dive in.
      </p>

      <div className="mt-10 grid gap-5 md:grid-cols-2">
        {DEMOS.map((d) => (
          <Link
            key={d.href}
            href={d.href}
            className="group flex flex-col justify-between border border-hairline bg-surface/40 p-6 transition-colors hover:border-sage"
          >
            <div>
              <span className="mono-label">{d.kicker}</span>
              <h2 className="mt-2 font-display text-2xl text-ink">{d.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink/70">{d.blurb}</p>
            </div>
            <div className="mt-6 flex items-center justify-between gap-4">
              <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink/40">{d.meta}</span>
              <span className="font-mono text-xs uppercase tracking-[0.12em] text-sage transition-transform group-hover:translate-x-1">
                enter →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
