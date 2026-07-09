import type { Metadata } from "next";
import type { ReactNode } from "react";
import SurferLab from "@/components/pagerank/SurferLab";

export const metadata: Metadata = {
  title: "Web navigation as a stochastic process | PageRank three ways | Harvey Houlahan",
  description:
    "Google's random surfer, taken past linear algebra: Gillespie stochastic simulation of click-time dynamics, an exact 6-page Markov chain solved by eigendecomposition, and simulated annealing that recovers a hidden damping factor to three decimal places. With a live surfer you can drive.",
  alternates: { canonical: "https://hjhportfolio.com/pagerank" },
};

/* The web edition of the FIT3139 final project (assessed 87/100). Same graph,
 * same algorithms, same numbers as the submission; the framing incorporates
 * the marker's feedback, so the questions are stated once and stated
 * explicitly, and the damping factor gets a proper introduction. */

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
      "When click times are random events rather than synchronous updates, does the surfer still converge to the deterministic PageRank, and how fast?",
    answer:
      "Yes. Time-weighted occupancy over 400 runs matches the eigenvector by T = 500. At T = 5 the estimates scatter widely, which is exactly the variability the deterministic model hides.",
  },
  {
    id: "Q2 · calibration",
    tech: "Simulated annealing",
    question:
      "Given only an observed stationary distribution, can the damping factor that produced it be recovered?",
    answer:
      "Yes. With a Metropolis acceptance rule and geometric cooling, the search lands on α = 0.730 against a hidden true value of 0.73, final loss 1.35e-8, in ~3,400 evaluations over a 991-point grid.",
  },
] as const;

const ALGORITHMS: [string, string][] = [
  ["Weighted PageRank", "Power iteration with dangling-page handling. The deterministic baseline every extension is measured against."],
  ["Gillespie SSA", "Continuous-time surfer with exponential waiting times between clicks. Stationary distribution estimated by time-weighted occupancy across runs."],
  ["Chain-binomial DTMC", "The exact 6-page transition matrix P = αW + (1−α)/N, solved by left eigendecomposition for the stationary distribution."],
  ["Monte Carlo estimation", "Long-run visit frequencies against the exact eigenvector, with the expected 1/K error decay measured across chain lengths."],
  ["Simulated annealing", "Metropolis–Hastings acceptance exp(−ΔL/T) with T ← 0.95T, minimising squared stationary-distribution error over α."],
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
            Google&apos;s PageRank imagines a surfer who follows links at random
            and occasionally jumps to a page out of nowhere. The damping factor
            α is the probability of following a link; with probability 1&minus;α
            the surfer teleports uniformly. That trick makes the chain
            irreducible, aperiodic, and possessed of exactly one equilibrium.
            The textbook treatment stops at the linear algebra. This project
            keeps going: it makes the clicks genuinely random in time, solves a
            small web exactly, and then recovers α from observed behaviour alone.
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
            The submission&apos;s exact six-page web. Teal squares scale with
            the exact stationary rank; the surfer&apos;s tally accumulates
            against it below. Drag α and watch the equilibrium reshape.
          </p>
          <SurferLab />
        </div>

        <div className="mx-auto max-w-prose">
          <Block kicker="The base model, properly introduced">
            A surfer at page i follows one of its weighted out-links with
            probability α, choosing among them in proportion to weight, or
            teleports to any of the N pages uniformly with probability
            1&minus;α. The transition matrix is P = αW + (1&minus;α)/N, and
            the ranking is its stationary distribution: the left eigenvector
            for eigenvalue one. Every page receives at least (1&minus;α)/N
            from anywhere, so no subgraph can trap the surfer and no cycle can
            trap the chain. Page E in the graph above is the degenerate case
            made visible: nothing links to it, so its entire rank is the
            teleportation floor, exactly (1&minus;α)/6.
          </Block>

          <Block kicker="Question one, answered">
            The Gillespie algorithm replaces synchronous steps with exponential
            waiting times, so each click is an event in continuous time.
            Estimating the stationary distribution by time-weighted occupancy,
            400 runs at horizon T = 500 reproduce the deterministic PageRank.
            At T = 5 the estimates scatter widely around it. Stochastic click
            timing changes the journey, not the destination. The short horizon
            is where real analytics actually live.
          </Block>

          <Block kicker="Question two, answered">
            Calibration inverts the model. Hide a true α of 0.73, observe only
            the stationary distribution it produces, and search for the damping
            factor that explains it: propose a candidate, compute its
            equilibrium by eigendecomposition, accept or reject by the
            Metropolis rule exp(&minus;ΔL/T), cool geometrically. The search
            walks the loss landscape down eight orders of magnitude and stops
            at 0.730. The same machinery generalises to fitting link weights
            against real clickstream data.
          </Block>

          <Block kicker="The Monte Carlo backbone">
            Everything empirical in the project is checked against the exact
            eigenvector, and the error behaves exactly as theory says it
            should: mean-squared error of the visit-frequency estimate decays
            as 1/K in chain length, measured across K from 10³ to 2×10⁵,
            landing at 2.6×10⁻⁷. The live tally above is running that
            experiment in front of you.
          </Block>

          <Block kicker="Honest limits">
            The assessed version of this report (87/100, including a one-day
            late penalty) stated its first modelling question two different
            ways, once about short-horizon variability, once about
            convergence; the marker caught it. This edition states each
            question once, names its technique, and answers both readings of
            Q1 in the same block. The web is six pages because six is small
            enough to solve exactly. Every stochastic estimate in the project
            has a closed-form answer to check against.
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
