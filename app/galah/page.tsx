import type { Metadata } from "next";
import type { ReactNode } from "react";
import FrontierChart from "@/components/galah/FrontierChart";
import InstabilityLab from "@/components/galah/InstabilityLab";
import IsoflopExplorer from "@/components/galah/IsoflopExplorer";

export const metadata: Metadata = {
  title: "Galah: compute-optimal scaling at byte level | Harvey Houlahan",
  description:
    "An ongoing Chinchilla-style study on a single GPU: byte-level GPT runs from 0.1M to 113M parameters across six iso-FLOP budgets. Measured frontier exponent b = 1.04.",
  alternates: { canonical: "https://hjhportfolio.com/galah" },
};

// Numbers from each run's final.json and fits.json. See components/galah/data.ts.

const STATS = [
  { label: "Sweep", value: "39 runs + 9 annex" },
  { label: "Ladder", value: "0.1M → 113M params" },
  { label: "Budgets", value: "1e15 → 3e17 FLOPs" },
  { label: "Frontier", value: "N_opt ∝ C^1.04" },
] as const;

const CONFIG: [string, string][] = [
  ["Objective", "Next-byte prediction, vocabulary 256. No tokenizer intervenes between the data and the measured exponent."],
  ["Corpus", "11.9GB of bytes on local disk. Every run is sub-epoch, so data repetition does not confound the fits."],
  ["Configuration, fixed", "AdamW (0.9, 0.95) · weight decay 0.1 · cosine to 10% · 2% warmup · gradient clip 1.0 · bf16."],
  ["Learning rate", "Base LR ∝ 1/√d_model: width-aware but duration-blind. That property is the subject of the stability annex."],
  ["Ladder", "11 widths × 6 iso-FLOP budgets, populated where size and budget are compatible. Seed 1337 throughout."],
  ["Hardware", "A single shared 96GB GPU. The complete sweep runs in one overnight session."],
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
          Research · Independent · Ongoing · 2026
        </p>
        <h1 className="max-w-[720px] font-display text-3xl leading-tight md:text-[2.6rem]">
          Galah: compute-optimal scaling at byte level
        </h1>
        <p className="mt-4 max-w-prose text-base leading-prose text-ink/75">
          Given a compute budget C, what model size minimises loss? The
          question is posed on a single GPU: byte-level GPTs from 0.1M to 113M
          parameters, six iso-FLOP budgets, one fixed training configuration.
          The measured frontier is steep, and training destabilised on the
          longest schedules. Both observations are documented below.
        </p>
        <p className="mt-4 inline-flex items-center gap-2 border border-infra/40 bg-infra/5 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-infra">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-infra" aria-hidden />
          Active study · LR ×0.125 probes + 1e18 budget in progress · figures update as runs complete
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
            roughly 400 runs. This study reduces the apparatus to essentials:
            bytes in, bytes out, and a ladder of GPTs small enough that a full
            iso-FLOP sweep completes overnight on a single card. The
            configuration is held fixed; only N and C vary. Any structure in
            the fits therefore reflects scale, not changes to the training
            procedure.
          </Block>
        </div>

        <div className="mt-12 border border-contour bg-paper p-5 md:p-7">
          <h2 className="font-display text-xl">IsoFLOP profiles</h2>
          <p className="mb-5 mt-1 max-w-prose text-sm text-ink/60">
            All 39 sweep runs, one profile per budget. Select a budget to
            highlight its curve; the others are dimmed. Each minimum marks a
            compute-optimal size. Hollow red points diverged and are excluded
            from every fit. The 113M run is the rightmost point of the 3e17
            profile.
          </p>
          <IsoflopExplorer />
        </div>

        <div className="mx-auto max-w-prose">
          <Block kicker="Reading the minima">
            The clearest single result is at the largest budget. At C = 3e17
            the 38M model reaches 1.249 bpb — the lowest validation loss in the
            study — while the 113M model, three times larger at the same
            budget, reaches only 1.330. The profile is bracketed on both sides:
            18M (1.280) and 69M (1.281) sit just above the 38M minimum, and
            113M sits higher again. The fitted optimum is N_opt = 35M, so at
            this budget 113M is demonstrably oversized and 38M is close to
            ideal. Compute-optimal training also grows steadily more
            parameter-heavy: the optimal bytes-per-parameter ratio falls from
            215 at 1e16 to 30 at 3e17.
          </Block>

          <Block kicker="The exponent">
            Chinchilla reports b ≈ 0.5, so that doubling compute grows the
            optimal model by √2. Fitting all six budgets here returns b = 1.04,
            but that value is inflated by the two smallest budgets, whose
            minima are not bracketed — the 1e15 profile extrapolates to a
            negative loss at its vertex, which is unphysical. Restricting the
            fit to the four budgets bracketed on both sides gives b = 0.85, and
            the parametric surface below independently implies b = 0.85 from
            its own exponents. Two methods converging on 0.85 is the defensible
            reading; the headline 1.04 is what the naive six-budget fit
            returns. Both sit well above 0.5: in this byte-level regime the
            marginal FLOP is spent on parameters, not data. Kaplan et al.
            reported similarly steep exponents at small scale.
          </Block>
        </div>

        <div className="mt-12 border border-contour bg-paper p-5 md:p-7">
          <h2 className="font-display text-xl">The frontier</h2>
          <p className="mb-5 mt-1 max-w-prose text-sm text-ink/60">
            N_opt against C, log-log, with reference slopes anchored at the
            largest budget. The parametric surface is
            L(N, D) = 0.60 + 8.0·N⁻⁰·¹⁶ + 8.6e6·D⁻⁰·⁸⁷ (Huber residual 0.0015
            over 35 runs); its N and D exponents imply b = 0.85. The hollow
            point marks an unbracketed edge budget and is flagged accordingly.
          </p>
          <FrontierChart />
        </div>

        <div className="mx-auto max-w-prose">
          <Block kicker="Where training destabilised">
            Four runs diverged, and each is the longest schedule at its width:
            1.5M at 12k steps, 2.7M at 25k, 5.5M at 41k, 10M at 25k. Duration
            is the controlling variable, and the cleanest evidence is a
            controlled pair: at a fixed base learning rate of 2.1e-3, the 5.5M
            model trained cleanly for 13,858 steps (C = 1e17) but diverged at
            41,576 steps (C = 3e17), with onset at step 24,400 — beyond the
            point where the shorter run had already finished. It is not a
            simple step threshold, though: the shortest diverged run (12,017
            steps) is shorter than the longest clean one (14,925 steps). The
            separating variable is learning rate, which scales as 1/√d_model,
            so the smaller, hotter models are exactly the ones that fail — and
            only on their longest schedules. The instability is an interaction
            of high learning rate with long horizon, not either alone.
          </Block>

          <Block kicker="What the trigger is">
            One run localises the mechanism. At 10M, the ×1.0 and ×0.5 runs
            share a seed and therefore see an identical batch sequence; both
            leave their loss floor at the same step (≈5,600) despite a factor
            of two in learning rate. At ×0.25 the same batches pass without
            incident and the run holds to the end — so the trigger is
            data-order-dependent, but only fires above a rate threshold. The
            full LR ladder settles the question of a constant fix: quarter-rate
            rescued 10M (1.42 bpb) and 1.5M (1.69) but left both ≈10% above
            the trend the surface predicts for their (N, D), and the 2.7M and
            5.5M rungs diverged at every rate tried — a 4× reduction buys
            stability on some horizons, never on-trend loss. That asymmetry is
            the argument for a horizon-dependent schedule rather than a lower
            peak: the ×0.125 probes now running close out the constant-LR
            hypothesis entirely.
          </Block>
        </div>

        <div className="mt-12 border border-contour bg-paper p-5 md:p-7">
          <h2 className="font-display text-xl">The stability annex</h2>
          <p className="mb-5 mt-1 max-w-prose text-sm text-ink/60">
            Smoothed train loss for each diverged rung, at LR ×1.0, ×0.5 and
            ×0.25. Dotted verticals mark where each run first left its loss
            floor. Scrub for values.
          </p>
          <InstabilityLab />
        </div>

        <div className="mt-14 grid gap-10 md:grid-cols-2">
          <div>
            <h2 className="font-display text-xl">The apparatus</h2>
            <dl className="mt-4 space-y-3 border-l-2 border-sage pl-4">
              {CONFIG.map(([k, v]) => (
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
                <dt className="text-sm font-medium text-infra">In progress</dt>
                <dd className="mt-0.5 text-sm leading-relaxed text-ink/65">
                  A seventh budget, C = 1e18, is running tonight (38M–200M,
                  including a new 200M rung), which will extend the frontier
                  fit to four fully bracketed decades. Alongside it, LR ×0.125
                  probes on the two rungs that diverged at every rate so far.
                  This page updates as runs complete.
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-ink/85">Completed</dt>
                <dd className="mt-0.5 text-sm leading-relaxed text-ink/65">
                  Main sweep (39 runs), divergence screen, frontier and
                  parametric fits, seed-repeat control, and the LR ×0.5 and
                  ×0.25 annexes. The annex verdict: a constant reduction
                  rescues some horizons at a ≈10% loss tax and fails outright
                  on others — no annex point is clean enough to enter the
                  fits, which rest on the 35 stable main-sweep runs.
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-ink/85">Constraints</dt>
                <dd className="mt-0.5 text-sm leading-relaxed text-ink/65">
                  A single seed at nearly every point, six budgets, byte-level
                  data only. The reported exponents characterise this regime
                  specifically and are not extrapolated beyond it.
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
            Pretraining under fixed compute →
          </a>
          <a href="/pagerank" className="btn-secondary text-sm">
            PageRank as a stochastic process →
          </a>
          <span className="font-mono text-xs text-ink/45">
            Harvey Houlahan · galah · July 2026
          </span>
        </div>
      </div>
    </section>
  );
}
