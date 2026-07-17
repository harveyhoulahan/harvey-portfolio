import type { Metadata } from "next";
import type { ReactNode } from "react";
import FrontierChart from "@/components/galah/FrontierChart";
import InstabilityLab from "@/components/galah/InstabilityLab";
import IsoflopExplorer from "@/components/galah/IsoflopExplorer";

export const metadata: Metadata = {
  title: "Galah: compute-optimal scaling at byte level | Harvey Houlahan",
  description:
    "Chinchilla on one GPU. 43 byte-level GPT runs, 0.1M to 113M params, six budgets. Frontier b = 1.04.",
  alternates: { canonical: "https://hjhportfolio.com/galah" },
};

// Numbers from each run's final.json and fits.json. See components/galah/data.ts.

const STATS = [
  { label: "Sweep", value: "39 runs · 4 diverged" },
  { label: "Ladder", value: "0.1M → 113M params" },
  { label: "Budgets", value: "1e15 → 3e17 FLOPs" },
  { label: "Frontier", value: "N_opt ∝ C^1.04" },
] as const;

const RECIPE: [string, string][] = [
  ["Objective", "Next-byte prediction. Vocab 256. No tokenizer between the data and the exponent."],
  ["Corpus", "11.9GB of bytes on local disk. Every run is sub-epoch, so repetition never confounds the fits."],
  ["Recipe, fixed", "AdamW (0.9, 0.95) · wd 0.1 · cosine to 10% · 2% warmup · grad clip 1.0 · bf16"],
  ["LR rule", "Base LR ∝ 1/√d_model. Width-aware, duration-blind. That blindness becomes the annex."],
  ["Ladder", "11 widths × 6 iso-FLOP budgets, filled where size and budget make sense. Seed 1337 everywhere."],
  ["Hardware", "One shared 96GB GPU. The whole sweep fits a quiet night."],
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
          Galah: compute-optimal scaling at byte level
        </h1>
        <p className="mt-4 max-w-prose text-base leading-prose text-ink/75">
          Given C FLOPs, how big should the model be? Asked where one GPU can
          answer: byte-level GPTs, 0.1M to 113M params, six budgets, one fixed
          recipe. The frontier came out steep. The recipe broke on the longest
          schedules. Both are on this page.
        </p>

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
            Hoffmann et al. fitted scaling laws with tokenizers, TPU pods and
            400 runs. This strips it down: bytes in, bytes out, a ladder of
            GPTs small enough that a full iso-FLOP sweep fits on a shared 96GB
            card overnight. The recipe is frozen. Only N and C move. Whatever
            the fits say, nothing about training changed under them.
          </Block>
        </div>

        <div className="mt-12 border border-contour bg-paper p-5 md:p-7">
          <h2 className="font-display text-xl">IsoFLOP profiles</h2>
          <p className="mb-5 mt-1 max-w-prose text-sm text-ink/60">
            All 39 sweep runs, one profile per budget. Pick a budget to light
            its curve; the rest stay dim. Each minimum is a compute-optimal
            size. Hollow red points diverged and stay out of every fit. The
            113M run is the right edge of the 3e17 profile.
          </p>
          <IsoflopExplorer />
        </div>

        <div className="mx-auto max-w-prose">
          <Block kicker="The frontier">
            Chinchilla says b ≈ 0.5: double the compute, grow the model by √2.
            This ladder measures b = 1.04. In the byte-level 0.1M to 113M regime,
            nearly every marginal FLOP wants to be a parameter. Optimal data
            barely moves (0.46GB at 1e15, 1.06GB at 3e17) while N_opt moves
            360×. The parametric surface agrees in direction, not magnitude
            (implied b = 0.85). With six budgets and a steep data term
            (β = 0.87 vs α = 0.16), that gap is the honest error bar. Kaplan
            saw steep exponents at small scale too. This is that regime, on
            bytes, with diverged runs screened out rather than averaged in.
          </Block>
        </div>

        <div className="mt-12 border border-contour bg-paper p-5 md:p-7">
          <h2 className="font-display text-xl">The frontier</h2>
          <p className="mb-5 mt-1 max-w-prose text-sm text-ink/60">
            N_opt against C, log-log. Reference slopes anchored at the largest
            budget. The hollow point sits at the ladder&apos;s edge and is
            treated that way.
          </p>
          <FrontierChart />
        </div>

        <div className="mx-auto max-w-prose">
          <Block kicker="Where the recipe broke">
            Every rung&apos;s longest run diverged: 1.5M at 12k steps, 2.7M at
            25k, 5.5M at 41k, 10M at 25k. Every clean run finished under 15k.
            Size is not the pattern; duration is. The LR rule knows width and
            nothing about horizon, and the critical learning rate falls as
            schedules stretch. A seed repeat diverged earlier than the
            original, so luck is out. Loss does not explode once and die: it
            leaves its floor mid-schedule, recovers, leaves again, and each
            recovery buys less. The last plot is the oddest fact in the study.
            At 10M, full LR and half LR share a seed, see identical batches,
            and leave the floor at the same step.
          </Block>
        </div>

        <div className="mt-12 border border-contour bg-paper p-5 md:p-7">
          <h2 className="font-display text-xl">The stability annex</h2>
          <p className="mb-5 mt-1 max-w-prose text-sm text-ink/60">
            Smoothed train loss for each diverged rung, at LR ×1.0 and ×0.5.
            Dotted verticals mark where each run first left its loss floor.
            Scrub for values.
          </p>
          <InstabilityLab />
        </div>

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
                  Same configs at LR ×0.25, plus the stopped 5.5M ×0.5 rerun.
                  If they hold and land on trend, the frontier stands on 43
                  runs. If divergence is only delayed, the schedule needs a
                  horizon term, not a smaller constant.
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-ink/85">Held honestly</dt>
                <dd className="mt-0.5 text-sm leading-relaxed text-ink/65">
                  One seed almost everywhere. Six budgets. Byte-level only.
                  The exponents measure this regime. Not a claim about yours.
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
