import type { Metadata } from "next";
import type { ReactNode } from "react";
import SurferLab from "@/components/pagerank/SurferLab";

export const metadata: Metadata = {
  title: "Web navigation as a stochastic process | PageRank three ways | Harvey Houlahan",
  description:
    "PageRank past linear algebra: Gillespie click-time simulation, exact six-page Markov chain, simulated annealing to recover α. Live surfer included.",
  alternates: { canonical: "https://hjhportfolio.com/pagerank" },
};

/* The web edition of the FIT3139 final project. Same graph, same algorithms,
 * same numbers as the submission; questions stated once, damping factor
 * introduced properly. */

const STATS = [
  { label: "The web", value: "6 pages · 11 weighted links" },
  { label: "Hidden α recovered", value: "0.730 / 0.730" },
  { label: "SA final loss", value: "1.35e-8 · 3,376 evals" },
  { label: "Monte Carlo error", value: "MSE ∝ 1/K" },
] as const;

const QUESTIONS = [
  {
    id: "Q1 · stochasticity",
    tech: "Gillespie SSA",
    question:
      "With random click times instead of synchronous updates, does the surfer still converge to deterministic PageRank, and how fast?",
    answer:
      "Yes. Time-weighted occupancy over 400 runs matches the eigenvector by T = 500. At T = 5 the estimates scatter. The deterministic model hides that.",
  },
  {
    id: "Q2 · calibration",
    tech: "Simulated annealing",
    question:
      "Given only an observed stationary distribution, can the damping factor be recovered?",
    answer:
      "Yes. Metropolis acceptance, geometric cooling. Lands on α = 0.730 against a hidden 0.73, loss 1.35e-8, ~3,400 evals.",
  },
] as const;

const ALGORITHMS: [string, string][] = [
  ["Weighted PageRank", "Power iteration with dangling-page handling. The baseline everything else is measured against."],
  ["Gillespie SSA", "Continuous-time surfer, exponential waits between clicks. Stationary distribution by time-weighted occupancy."],
  ["Chain-binomial DTMC", "Exact 6-page P = αW + (1−α)/N, solved by left eigendecomposition."],
  ["Monte Carlo estimation", "Visit frequencies against the exact eigenvector; 1/K error decay measured across chain lengths."],
  ["Simulated annealing", "Metropolis acceptance exp(−ΔL/T), geometric cooling, minimising stationary-distribution error over α."],
];

function Block({ kicker, children }: { kicker: string; children: ReactNode }) {
  return (
    <div className="mt-10">
      <h3 className="mb-2 font-mono text-xs uppercase tracking-[0.18em] text-sage">{kicker}</h3>
      <p className="text-base leading-prose text-ink/80">{children}</p>
    </div>
  );
}

export default function PageRankPage() {
  return (
    <section className="bg-concrete text-ink">
      <div className="mx-auto max-w-work px-6 py-16 md:px-8 md:py-24 lg:px-10">
        <header className="grid gap-5 lg:grid-cols-12 lg:gap-x-12 lg:gap-y-4">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-sage lg:col-span-12">
            Research · Computational modelling · Monash FIT3139
          </p>
          <h1 className="font-display text-[clamp(2rem,4.2vw,2.75rem)] leading-[1.08] tracking-[-0.015em] text-balance lg:col-span-5 lg:row-start-2">
            Web navigation as a stochastic process
          </h1>
          <p className="text-base leading-prose text-ink/75 md:text-[1.02rem] lg:col-span-7 lg:col-start-6 lg:row-start-2 lg:self-end lg:max-w-[58ch]">
            PageRank imagines a surfer who follows links at random and
            sometimes teleports. α is the link probability; 1&minus;α is uniform
            jump. That makes the chain irreducible and gives one equilibrium.
            The textbook stops at linear algebra. This keeps going: random
            click times, an exact six-page web, then recovering α from behaviour
            alone.
          </p>
        </header>

        {/* stat tiles */}
        <div className="mt-10 grid grid-cols-2 gap-px border border-contour bg-contour md:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="bg-paper px-4 py-4">
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">{s.label}</div>
              <div className="mt-1.5 font-sans text-lg font-semibold text-ink">{s.value}</div>
            </div>
          ))}
        </div>

        {/* the two questions, stated once, each named with its technique */}
        <div className="mt-12 grid gap-5 md:grid-cols-2 md:items-stretch">
          {QUESTIONS.map(({ id, tech, question, answer }) => (
            <div key={id} className="survey-corners relative flex h-full min-h-0 flex-col border border-contour bg-terrace/40 p-5 md:p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="mono-label">{id}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-infra">{tech}</span>
              </div>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-ink/65">{question}</p>
              <div className="mt-5 border-t border-contour/70 pt-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-flow">Answer</p>
                <p className="mt-2 text-sm leading-relaxed text-ink/85">{answer}</p>
              </div>
            </div>
          ))}
        </div>

        {/* the live lab */}
        <div className="mt-12 border border-contour bg-paper p-5 md:p-7">
          <h2 className="font-display text-xl">The surfer, live</h2>
          <p className="mb-5 mt-1 max-w-prose text-sm text-ink/60">
            The exact six-page web from the submission. Squares scale with rank;
            the tally below tracks the surfer. Drag α.
          </p>
          <SurferLab />
        </div>

        <div className="mx-auto max-w-prose">
          <Block kicker="The base model">
            At page i the surfer follows a weighted out-link with probability α
            or teleports uniformly with 1&minus;α. P = αW + (1&minus;α)/N; the
            rank is its left eigenvector. Every page gets at least
            (1&minus;α)/N, so nothing traps the chain. Page E above is the
            degenerate case: no in-links, rank equals the teleport floor exactly
            (1&minus;α)/6.
          </Block>

          <Block kicker="Question one">
            Gillespie replaces synchronous steps with exponential waits. 400 runs
            at T = 500 match deterministic PageRank; at T = 5 they scatter.
            Stochastic timing changes the journey, not the destination.
          </Block>

          <Block kicker="Question two">
            Hide α = 0.73, observe only the stationary distribution, search for
            the damping factor that explains it. Metropolis acceptance,
            geometric cooling. Stops at 0.730. Same machinery fits link weights
            to real clickstreams.
          </Block>

          <Block kicker="Monte Carlo backbone">
            Every empirical estimate checked against the exact eigenvector. MSE
            decays as 1/K; measured from 10³ to 2×10⁵, landing at 2.6×10⁻⁷.
            The live tally above is that experiment running.
          </Block>
        </div>

        {/* list of algorithms */}
        <div className="mt-14">
          <h2 className="font-display text-xl">The algorithms</h2>
          <dl className="mt-4 space-y-3 border-l-2 border-sage pl-4">
            {ALGORITHMS.map(([k, v]) => (
              <div key={k}>
                <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">{k}</dt>
                <dd className="mt-0.5 text-sm leading-relaxed text-ink/80">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-12 flex flex-wrap items-center gap-4 border-t border-contour pt-8">
          <a
            href="https://github.com/harveyhoulahan/Web-Page-Navigation-Model-with-AI-ML-Extensions"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary text-sm"
          >
            Source on GitHub
          </a>
          <a href="/pretraining" className="btn-secondary text-sm">
            The pretraining report →
          </a>
          <a href="/canopy" className="btn-secondary text-sm">
            The canopy deep-dive →
          </a>
          <span className="font-mono text-xs text-ink/45">
            Harvey Houlahan · FIT3139 final project · Monash
          </span>
        </div>
      </div>
    </section>
  );
}
