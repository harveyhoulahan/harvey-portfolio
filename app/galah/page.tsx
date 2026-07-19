import type { Metadata } from "next";
import type { ReactNode } from "react";
import FrontierChart from "@/components/galah/FrontierChart";
import InstabilityLab from "@/components/galah/InstabilityLab";
import IsoflopExplorer from "@/components/galah/IsoflopExplorer";

export const metadata: Metadata = {
  title: "Galah: compute-optimal scaling at byte level | Harvey Houlahan",
  description:
    "An ongoing Chinchilla-style study on a single GPU: byte-level GPT runs from 0.1M to 200M parameters across seven iso-FLOP budgets. The frontier exponent bends from ~0.9 toward Chinchilla's 0.5 within the measured range.",
  alternates: { canonical: "https://hjhportfolio.com/galah" },
};

// Numbers from each run's final.json and fits.json. See components/galah/data.ts.

const STATS = [
  { label: "Sweep", value: "43 runs + 11 annex" },
  { label: "Ladder", value: "0.1M → 200M params" },
  { label: "Budgets", value: "1e15 → 1e18 FLOPs" },
  { label: "Frontier", value: "local b: 0.92 → 0.61" },
] as const;

const CONFIG: [string, string][] = [
  ["Objective", "Next-byte prediction, vocabulary 256. No tokenizer intervenes between the data and the measured exponent."],
  ["Corpus", "11.9GB of bytes on local disk. Every run is sub-epoch, so data repetition does not confound the fits."],
  ["Configuration, fixed", "AdamW (0.9, 0.95) · weight decay 0.1 · cosine to 10% · 2% warmup · gradient clip 1.0 · bf16."],
  ["Learning rate", "Base LR ∝ 1/√d_model: width-aware but duration-blind. That property is the subject of the stability annex."],
  ["Ladder", "13 widths × 7 iso-FLOP budgets, populated where size and budget are compatible. Seed 1337 throughout."],
  ["Hardware", "A single shared 96GB GPU. Each budget's profile completes in one overnight session."],
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
          question is posed on a single GPU: byte-level GPTs from 0.1M to 200M
          parameters, seven iso-FLOP budgets, one fixed training configuration.
          The measured frontier starts steep and bends toward Chinchilla as
          compute grows, and training destabilised on the longest schedules.
          Both observations are documented below.
        </p>
        <p className="mt-4 inline-flex items-center gap-2 border border-infra/40 bg-infra/5 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-infra">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-infra" aria-hidden />
          Active study · intervention pre-registered 20 July · qk-norm vs horizon-LR runs tonight
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
            All 43 sweep runs, one profile per budget. Select a budget to
            highlight its curve; the others are dimmed. Each minimum marks a
            compute-optimal size. Hollow red points diverged and are excluded
            from every fit. The seventh budget, 1e18, runs 38M to a new 200M
            rung and is the deepest profile in the study.
          </p>
          <IsoflopExplorer />
        </div>

        <div className="mx-auto max-w-prose">
          <Block kicker="Reading the minima">
            The clearest single result is at the largest budget. At C = 1e18
            the 69M model reaches 1.173 bpb — the lowest validation loss in
            the study — with the profile bracketed on both sides: 38M (1.194)
            and 113M (1.182) sit just above it, and the new 200M rung (1.221)
            confirms the right arm. The fitted optimum is N_opt = 73M. The
            same structure held one budget down, where 38M (1.249) beat both
            18M and 69M at C = 3e17. Every point of the 1e18 profile also
            landed within 5% of what the previous surface extrapolated for it,
            a half-decade beyond its fitted range. Compute-optimal training
            grows steadily more parameter-heavy: the optimal
            bytes-per-parameter ratio falls from 215 at 1e16 to 25 at 1e18 —
            approaching the ≈20 Chinchilla reports for BPE tokens.
          </Block>

          <Block kicker="The exponent">
            Chinchilla reports b ≈ 0.5, so that doubling compute grows the
            optimal model by √2. A single power law fitted across all seven
            budgets here returns b = 0.97 — but the more interesting result is
            that no single exponent fits. The local slope between consecutive
            bracketed budgets falls monotonically: 0.92 (1e16→3e16), 0.87,
            0.74, then 0.61 across the final decade (3e17→1e18). The frontier
            is not a straight line in log-log; it starts in the steep
            Kaplan-like regime that small-scale studies report and bends
            toward Chinchilla&apos;s 0.5 within this study&apos;s own measured
            range. The parametric surface, which averages over the whole grid,
            lands between the extremes at an implied b = 0.84. The practical
            reading: at byte level the marginal FLOP buys parameters early and
            data late, and any single-exponent summary of this regime is an
            artifact of where you truncate the sweep.
          </Block>
        </div>

        <div className="mt-12 border border-contour bg-paper p-5 md:p-7">
          <h2 className="font-display text-xl">The frontier</h2>
          <p className="mb-5 mt-1 max-w-prose text-sm text-ink/60">
            N_opt against C, log-log, with reference slopes anchored at the
            largest budget. The parametric surface is
            L(N, D) = 0.70 + 8.7·N⁻⁰·¹⁷ + 1.6e7·D⁻⁰·⁹¹ (Huber residual 0.0016
            over 39 runs); its N and D exponents imply b = 0.84. The visible
            flattening at the top of the measured points is the bend toward
            Chinchilla. The hollow point marks an unbracketed edge budget and
            is flagged accordingly.
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
            of high learning rate with long horizon, not either alone. The
            1e18 budget sharpened this: 38M ran 25,263 steps without incident
            at d=512&apos;s colder rate — almost exactly the horizon (25,362
            steps) that kills 2.7M at every constant rate tried.
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
            5.5M rungs needed ×0.125 before a run first survived — and even
            then the spike still fired (steps 17.3k and 35.2k) and both landed
            18–24% off trend. Across an 8× range of constant rates, no long
            horizon ever produced an on-trend point: colder rates change
            whether the model survives its spike, not whether the spike
            happens. That is the closed case for a horizon-dependent schedule
            rather than a lower peak.
          </Block>
        </div>

        <div className="mt-12 border border-contour bg-paper p-5 md:p-7">
          <h2 className="font-display text-xl">The stability annex</h2>
          <p className="mb-5 mt-1 max-w-prose text-sm text-ink/60">
            Smoothed train loss for each diverged rung, at LR ×1.0 down to
            ×0.125. Dotted verticals mark where each run first left its loss
            floor. Scrub for values.
          </p>
          <InstabilityLab />
        </div>

        <div className="mt-12 border border-contour bg-paper p-5 md:p-7">
          <h2 className="font-display text-xl">The intervention log</h2>
          <p className="mb-6 mt-1 max-w-prose text-sm text-ink/60">
            A running record of every deliberate change to the study&apos;s
            apparatus — what was changed, when, and what was predicted before
            the results existed. Fits never mix across entries: the 43-run
            main sweep stands as measured, and every intervention below is an
            annex against it.
          </p>
          <dl className="space-y-5 border-l-2 border-sage pl-4">
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">16–17 July · divergence isolated</dt>
              <dd className="mt-1 max-w-prose text-sm leading-relaxed text-ink/80">
                The four longest-schedule runs fail the smoothed-loss
                criterion and are excluded from every fit. A seed repeat
                reproduces the failure — systematic, not seed luck.
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">18–19 July · constant-LR ladder closed</dt>
              <dd className="mt-1 max-w-prose text-sm leading-relaxed text-ink/80">
                LR ×0.5, ×0.25 and ×0.125 across the failed configs. Colder
                rates trade divergence for an off-trend tax that shrinks but
                never clears; no constant rate produces an on-trend point on
                any 25k+-step horizon. A uniform rescale is ruled out.
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">19 July · frontier extended to 1e18</dt>
              <dd className="mt-1 max-w-prose text-sm leading-relaxed text-ink/80">
                A seventh budget lands fully bracketed (69M optimum, 200M
                rung). The local exponent falls to 0.61 across the final
                decade — the bend toward Chinchilla, measured in-study.
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-infra">20 July · pre-registered tonight — two arms</dt>
              <dd className="mt-1 max-w-prose text-sm leading-relaxed text-ink/80">
                Registered before any run executes.{" "}
                <strong className="font-medium text-ink">Arm A, qk-norm:</strong>{" "}
                per-head LayerNorm on q and k, on the four failed configs plus
                two clean controls, at the full ×1.0 rate.{" "}
                <a href="https://arxiv.org/abs/2309.14322" target="_blank" rel="noopener noreferrer" className="underline decoration-contour underline-offset-2 hover:decoration-sage">
                  Wortsman et al. (ICLR 2024)
                </a>{" "}
                identify attention-logit growth as the spike mechanism and
                show this intervention cures it at small scale and high LR —
                precisely this study&apos;s failing corner. Prediction: no
                spikes at ×1.0, losses on or near trend, controls unmoved.{" "}
                <strong className="font-medium text-ink">Arm B, horizon-aware LR:</strong>{" "}
                peak rate scaled by (T_clean/T_target)^0.5 per rung, model
                untouched —{" "}
                <a href="https://arxiv.org/abs/2410.05838" target="_blank" rel="noopener noreferrer" className="underline decoration-contour underline-offset-2 hover:decoration-sage">
                  recent theory
                </a>{" "}
                has the optimal rate decaying ≈1/√κ as the horizon grows κ×,
                the term the width-only rule is missing. Prediction: stable
                and nearer trend than any constant scale.{" "}
                <strong className="font-medium text-ink">Decision rule, fixed now:</strong>{" "}
                if Arm A lands on trend, the deployment model trains with
                qk-norm and the paper closes on &ldquo;one normalization
                changes the measured law.&rdquo; If only Arm B holds, the
                width-only LR rule was the artifact and the schedule is the
                fix. Results append here as they land.
              </dd>
            </div>
          </dl>
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
                <dt className="text-sm font-medium text-infra">Next</dt>
                <dd className="mt-0.5 text-sm leading-relaxed text-ink/65">
                  The two pre-registered arms in the intervention log run
                  tonight: qk-norm at full rate against the horizon-aware
                  peak. Whichever holds decides the recipe for the
                  deployment-optimal slice of the surface and the WebGPU
                  build of the winning model.
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-ink/85">Completed</dt>
                <dd className="mt-0.5 text-sm leading-relaxed text-ink/65">
                  Main sweep across seven budgets (43 runs, 1e15–1e18, with
                  the 1e18 profile bracketed 38M–200M), divergence screen,
                  frontier and parametric fits, seed-repeat control, and the
                  full LR annex ladder ×0.5 → ×0.125. The annex verdict: no
                  constant rate yields an on-trend point on any 25k+-step
                  horizon — annex points never enter the fits, which rest on
                  the 39 stable main-sweep runs.
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-ink/85">Constraints</dt>
                <dd className="mt-0.5 text-sm leading-relaxed text-ink/65">
                  A single seed at nearly every point, seven budgets,
                  byte-level data only. The reported exponents characterise
                  this regime specifically and are not extrapolated beyond it.
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
