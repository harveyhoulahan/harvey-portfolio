import type { Metadata } from "next";
import type { ReactNode } from "react";
import "katex/dist/katex.min.css";
import Math from "@/components/Math";
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

function Block({ kicker, children }: { kicker: string; children: ReactNode }) {
  return (
    <div className="mt-12">
      <h3 className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-sage">{kicker}</h3>
      <div className="space-y-4 text-base leading-relaxed text-ink/80 [&_.katex]:text-[1.05em] [&_.katex-display]:my-5 [&_.katex-display]:overflow-x-auto">
        {children}
      </div>
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
          <p className="text-base leading-relaxed text-ink/75 md:text-[1.02rem] lg:col-span-7 lg:col-start-6 lg:row-start-2 lg:self-end lg:max-w-[58ch]">
            PageRank imagines a surfer who follows links at random and
            sometimes teleports. <Math>\alpha</Math> is the link probability;{" "}
            <Math>{"1 - \\alpha"}</Math> is a uniform jump. That makes the chain
            irreducible and gives one equilibrium. The textbook stops at linear
            algebra. This keeps going: random click times, an exact six-page web,
            then recovering <Math>\alpha</Math> from behaviour alone.
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

        {/* the two questions — subgrid keeps the answer rules aligned */}
        <div className="mt-12 grid gap-5 md:grid-cols-2 md:grid-rows-[auto_auto_1fr]">
          {QUESTIONS.map(({ id, tech, question, answer }) => (
            <div
              key={id}
              className="survey-corners relative grid grid-rows-subgrid row-span-3 border border-contour bg-terrace/40 p-5 md:p-6"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="mono-label">{id}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-infra">{tech}</span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-ink/65">{question}</p>
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
            the tally below tracks the surfer. Drag <Math>\alpha</Math>.
          </p>
          <SurferLab />
        </div>

        <div className="mx-auto max-w-prose">
          <Block kicker="The base model">
            <p>
              At page <Math>i</Math> the surfer follows a weighted out-link with
              probability <Math>\alpha</Math>, or teleports to any page uniformly
              with probability <Math>{"1 - \\alpha"}</Math>. The transition matrix
              is
            </p>
            <Math display>{"P = \\alpha W + \\dfrac{1 - \\alpha}{N}"}</Math>
            <p>
              The ranking is its left eigenvector for eigenvalue one. Every page
              receives at least <Math>{"(1 - \\alpha)/N"}</Math>, so nothing traps
              the chain. Page E above is the degenerate case: no in-links, so its
              rank equals the teleport floor exactly{" "}
              <Math>{"(1 - \\alpha)/6"}</Math>.
            </p>
          </Block>

          <Block kicker="Question one">
            <p>
              Gillespie replaces synchronous steps with exponential waiting times
              between clicks. Across 400 runs, time-weighted occupancy at horizon{" "}
              <Math>{"T = 500"}</Math> matches deterministic PageRank; at{" "}
              <Math>{"T = 5"}</Math> the estimates scatter.
            </p>
            <p>
              Stochastic timing changes the journey, not the destination.
            </p>
          </Block>

          <Block kicker="Question two">
            <p>
              Hide a true damping factor <Math>{"\\alpha = 0.73"}</Math>, observe
              only the stationary distribution it produces, then search for the{" "}
              <Math>\alpha</Math> that explains it. Metropolis acceptance with
              geometric cooling walks the loss landscape down and stops at{" "}
              <Math>{"0.730"}</Math>.
            </p>
            <p>
              The same machinery fits link weights to real clickstreams.
            </p>
          </Block>

          <Block kicker="Monte Carlo backbone">
            <p>
              Every empirical estimate is checked against the exact eigenvector.
              Mean-squared error decays as
            </p>
            <Math display>{"\\mathrm{MSE} \\propto \\dfrac{1}{K}"}</Math>
            <p>
              Measured across chain lengths from <Math>{"10^{3}"}</Math> to{" "}
              <Math>{"2 \\times 10^{5}"}</Math>, landing at{" "}
              <Math>{"2.6 \\times 10^{-7}"}</Math>. The live tally above is that
              experiment running.
            </p>
          </Block>
        </div>

        {/* list of algorithms */}
        <div className="mt-14">
          <h2 className="font-display text-xl">The algorithms</h2>
          <dl className="mt-4 space-y-4 border-l-2 border-sage pl-4">
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">Weighted PageRank</dt>
              <dd className="mt-0.5 text-sm leading-relaxed text-ink/80">
                Power iteration with dangling-page handling. The baseline everything else is measured against.
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">Gillespie SSA</dt>
              <dd className="mt-0.5 text-sm leading-relaxed text-ink/80">
                Continuous-time surfer, exponential waits between clicks. Stationary distribution by time-weighted occupancy.
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">Chain-binomial DTMC</dt>
              <dd className="mt-0.5 text-sm leading-relaxed text-ink/80">
                Exact 6-page <Math>{"P = \\alpha W + (1 - \\alpha)/N"}</Math>, solved by left eigendecomposition.
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">Monte Carlo estimation</dt>
              <dd className="mt-0.5 text-sm leading-relaxed text-ink/80">
                Visit frequencies against the exact eigenvector; <Math>{"1/K"}</Math> error decay measured across chain lengths.
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">Simulated annealing</dt>
              <dd className="mt-0.5 text-sm leading-relaxed text-ink/80">
                Metropolis acceptance <Math>{"\\exp(-\\Delta L / T)"}</Math>, geometric cooling, minimising stationary-distribution error over <Math>\alpha</Math>.
              </dd>
            </div>
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
