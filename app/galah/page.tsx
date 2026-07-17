import type { Metadata } from "next";
import type { ReactNode } from "react";
import FrontierChart from "@/components/galah/FrontierChart";
import InstabilityLab from "@/components/galah/InstabilityLab";
import IsoflopExplorer from "@/components/galah/IsoflopExplorer";

export const metadata: Metadata = {
  title: "Galah: compute-optimal scaling at byte level | Harvey Houlahan",
  description:
    "A Chinchilla-style sweep on one GPU: 43 byte-level GPT runs, 0.1M–113M params, six budgets. Measured frontier b = 1.04 — and the four runs the recipe couldn't hold.",
  alternates: { canonical: "https://hjhportfolio.com/galah" },
};

// The galah study, as far as it has run. Numbers come straight from each
// run's final.json and from fits.json — see components/galah/data.ts.

const STATS = [
  { label: "Sweep", value: "39 runs · 4 diverged" },
  { label: "Ladder", value: "0.1M → 113M params" },
  { label: "Budgets", value: "1e15 → 3e17 FLOPs" },
  { label: "Frontier", value: "N_opt ∝ C^1.04" },
] as const;

const RECIPE: [string, string][] = [
  ["Objective", "Next-byte prediction · vocab 256 · no tokenizer between the data and the exponent"],
  ["Corpus", "11.9GB of bytes, local disk · every run is sub-epoch — repetition never confounds the fits"],
  ["Recipe, fixed", "AdamW (0.9, 0.95) · wd 0.1 · cosine to 10% · 2% warmup · grad clip 1.0 · bf16"],
  ["LR rule", "base LR ∝ 1/√d_model — width-aware, duration-blind. That blindness becomes the annex."],
  ["Ladder", "11 widths × 6 iso-FLOP budgets, filled where budget and size make sense · seed 1337 everywhere"],
  ["Hardware", "One shared 96GB GPU. The whole sweep is reproducible for the price of a quiet night."],
];

function Block({ kicker, children }: { kicker: string; children: ReactNode }) {
  return (
    <div className="mt-10">
      <h3 className="mb-2 font-mono text-xs uppercase tracking-[0.18em] text-sage">{kicker}</h3>
      <p className="text-base leading-prose text-ink/80">{children}</p>
    </div>
  );
}

export default function GalahPage() {
  return (
    <section className="bg-concrete text-ink">
      <div className="mx-auto max-w-work px-6 py-16 md:py-24">
        <p className="mb-4 font-mono text-xs uppercase tracking-[0.22em] text-sage">
          Research · Independent · 2026
        </p>
        <h1 className="max-w-[720px] font-display text-3xl leading-tight md:text-[2.6rem]">
          Galah: compute-optimal scaling, remeasured at byte level
        </h1>
        <p className="mt-4 max-w-prose text-base leading-prose text-ink/75">
          The Chinchilla question — given C FLOPs, how big should the model
          be? — asked where one GPU can answer it: byte-level GPTs, 0.1M to
          113M parameters, six budgets, one fixed recipe. The frontier came
          out steep. The recipe came apart on the longest schedules. Both
          results are on this page.
        </p>

        {/* stat tiles */}
        <div className="mt-10 grid grid-cols-2 gap-px border border-contour bg-contour md:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="bg-paper px-4 py-4">
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">{s.label}</div>
              <div className="mt-1.5 font-sans text-lg font-semibold text-ink">{s.value}</div>
            </div>
          ))}
        </div>

        <div className="mx-auto max-w-prose">
          <Block kicker="The setup">
            Hoffmann et al. fit scaling laws with tokenizers, TPU pods and 400
            runs. Strip it to the studs: bytes in, bytes out, a ladder of GPTs
            small enough that a full iso-FLOP sweep fits on a shared 96GB
            card overnight. The recipe is frozen across every run — the only
            things that move are N and C. Whatever the fits say, nothing about
            the training changed under them.
          </Block>
        </div>

        {/* isoflop explorer */}
        <div className="mt-12 border border-contour bg-paper p-5 md:p-7">
          <h2 className="font-display text-xl">IsoFLOP profiles</h2>
          <p className="mb-5 mt-1 max-w-prose text-sm text-ink/60">
            All 39 sweep runs, one profile per budget — pick a budget to light
            its profile; the rest stay dimmed. Each minimum is a
            compute-optimal size. Hollow red points diverged and are excluded
            from every fit. The 113M run is the right-most point of the 3e17
            profile.
          </p>
          <IsoflopExplorer />
        </div>

        <div className="mx-auto max-w-prose">
          <Block kicker="The frontier">
            Chinchilla&apos;s answer is b ≈ 0.5: double the compute, grow the
            model by √2. This ladder measures b = 1.04 — in the byte-level
            0.1M–113M regime, nearly every marginal FLOP wants to be a
            parameter. Optimal data barely moves: 0.46GB at 1e15, 1.06GB at
            3e17, while N_opt moves 360×. The parametric surface agrees in
            direction and not in magnitude (implied b = 0.85); with six
            budgets and a data term this steep (β = 0.87 vs α = 0.16), the gap
            between the two estimates is the honest error bar. Kaplan saw
            steep exponents at small scale too. This is that regime, measured
            on bytes, with the diverged runs screened out rather than
            averaged in.
          </Block>
        </div>

        {/* frontier */}
        <div className="mt-12 border border-contour bg-paper p-5 md:p-7">
          <h2 className="font-display text-xl">The frontier</h2>
          <p className="mb-5 mt-1 max-w-prose text-sm text-ink/60">
            N_opt against C, log-log, with the two reference slopes anchored
            at the largest budget. The hollow point sits at the ladder&apos;s
            edge and is treated accordingly.
          </p>
          <FrontierChart />
        </div>

        <div className="mx-auto max-w-prose">
          <Block kicker="Where the recipe broke">
            Every rung&apos;s longest run diverged — 1.5M at 12k steps, 2.7M at
            25k, 5.5M at 41k, 10M at 25k — while every clean run in the study
            finished under 15k. Size is not the pattern; duration is. The LR
            rule knows about width and nothing about horizon, and the critical
            learning rate falls as schedules stretch. A seed repeat diverged
            earlier than the original, which rules out luck. Loss doesn&apos;t
            explode once and die, either: it leaves its floor mid-schedule,
            recovers, leaves again, and each recovery buys less. The last
            plot below is the strangest fact in the study — at 10M, full LR
            and half LR share a seed, see identical batches, and leave the
            floor at the same step.
          </Block>
        </div>

        {/* instability lab */}
        <div className="mt-12 border border-contour bg-paper p-5 md:p-7">
          <h2 className="font-display text-xl">The stability annex</h2>
          <p className="mb-5 mt-1 max-w-prose text-sm text-ink/60">
            Smoothed train loss for each diverged rung, at LR ×1.0 and ×0.5.
            Dotted verticals mark where each run first left its loss floor.
            Scrub for values.
          </p>
          <InstabilityLab />
        </div>

        {/* recipe + status */}
        <div className="mt-14 grid gap-10 md:grid-cols-2">
          <div>
            <h2 className="font-display text-xl">The apparatus</h2>
            <dl className="mt-4 space-y-3 border-l-2 border-sage pl-4">
              {RECIPE.map(([k, v]) => (
                <div key={k}>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">{k}</dt>
                  <dd className="mt-0.5 text-sm leading-relaxed text-ink/80">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div>
            <h2 className="font-display text-xl">Status</h2>
            <dl className="mt-4 space-y-3 border-l-2 border-sand pl-4">
              <div>
                <dt className="text-sm font-medium text-ink/85">Done</dt>
                <dd className="mt-0.5 text-sm leading-relaxed text-ink/65">
                  Main sweep (39 runs), divergence screen, frontier and
                  parametric fits, seed repeat, LR ×0.5 annex on all four
                  diverged rungs.
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-ink/85">Queued</dt>
                <dd className="mt-0.5 text-sm leading-relaxed text-ink/65">
                  The same configs at LR ×0.25, plus the stopped 5.5M ×0.5
                  rerun. If they hold and land on trend, the frontier stands
                  on 43 runs. If divergence is merely delayed, the finding
                  changes shape: the schedule needs a horizon term, not a
                  smaller constant.
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-ink/85">Held honestly</dt>
                <dd className="mt-0.5 text-sm leading-relaxed text-ink/65">
                  One seed almost everywhere. Six budgets. Byte-level only.
                  The exponents are measurements of this regime, not claims
                  about yours.
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="mt-12 flex flex-wrap items-center gap-4 border-t border-contour pt-8">
          <a
            href="https://github.com/harveyhoulahan/galah"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary text-sm"
          >
            Code on GitHub ↗
          </a>
          <a href="/pretraining" className="btn-secondary text-sm">
            Fixed compute, different question →
          </a>
          <a href="/pagerank" className="btn-secondary text-sm">
            Stochastic processes, smaller stakes →
          </a>
          <span className="font-mono text-xs text-ink/45">
            Harvey Houlahan · galah · July 2026
          </span>
        </div>
      </div>
    </section>
  );
}
