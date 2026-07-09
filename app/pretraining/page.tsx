import type { Metadata } from "next";
import type { ReactNode } from "react";
import ExperimentLedger from "@/components/pretraining/ExperimentLedger";
import { PretrainingHighlightProvider } from "@/components/pretraining/HighlightContext";
import LossChart from "@/components/pretraining/LossChart";

export const metadata: Metadata = {
  title: "LLM pretraining under fixed compute | 1.75 → 1.18 | Harvey Houlahan",
  description:
    "40M parameters, seven epochs, one seed. Validation loss 1.7533 → 1.1754 (−33%). Muon, WSD, RoPE, ReLU², value residuals. Full ledger.",
  alternates: { canonical: "https://hjhportfolio.com/pretraining" },
};

/* The web edition of the Mainrun assessment report. Same content, same
 * numbers, no PDF between a reader and the ledger. The full original stays at
 * /papers/mainrun-report.pdf. */

const STATS = [
  { label: "Validation loss", value: "1.7533 → 1.1754" },
  { label: "Improvement, fixed budget", value: "−33.0%" },
  { label: "Model", value: "≈40M params · 16 layers" },
  { label: "Constraints", value: "7 epochs · seed 1337" },
] as const;

const FINAL_CONFIG: [string, string][] = [
  ["Architecture", "16 layers · d_model 416 · 4 heads (head_dim 104) · block_size 128"],
  ["Parameters", "≈40.0M (~47% more than the 27.2M baseline, spent on depth)"],
  ["Optimiser", "Muon (lr 0.007, momentum 0.95, 5-step Newton–Schulz) on 2D hidden matrices; AdamW (lr 1e-3) on embeddings, head, norms, mixing scalars"],
  ["Schedule", "WSD: 6% linear warmup → stable peak → (1−√t) cooldown from 0.65"],
  ["Positions", "RoPE, applied to q/k inside attention"],
  ["MLP", "Squared-ReLU (ReLU²) activation, 4× expansion"],
  ["Attention", "PyTorch SDPA, causal, dropout 0.05 · value-residual: learnable per-layer mix to first-layer values"],
  ["Other", "GPT-2 residual init 1/√(2·n_layer) · weight tying · grad clip 1.0"],
];

const ABLATIONS: [string, string][] = [
  ["Gradient accumulation", "+0.0412. Halved optimiser updates from 938 to 469 inside the fixed budget; a larger effective batch could not buy it back."],
  ["Weight decay > 0", "Negligible either way. Confirmed regularisation was not the operative constraint."],
  ["Muon at default lr 0.02", "Plateaued at 1.3285. Hyperparameters calibrated for 124M-param runs; re-tuned 4× lower to recover."],
  ["QK-norm, no learnable scale", "+0.0193. Capped attention's dynamic range without the per-head gain needed to recover it."],
  ["8L/512 width", "Worse than 8L/416 at the same step budget. Capacity was not the bottleneck; optimiser steps were."],
  ["Overshoot brackets (7b, 11c, 16c)", "Deliberate runs past each optimum, confirming every minimum was located empirically rather than assumed."],
];

function Block({ kicker, children }: { kicker: string; children: ReactNode }) {
  return (
    <div className="mt-10">
      <h3 className="mb-2 font-mono text-xs uppercase tracking-[0.18em] text-sage">{kicker}</h3>
      <p className="text-base leading-prose text-ink/80">{children}</p>
    </div>
  );
}

export default function PretrainingPage() {
  return (
    <section className="bg-concrete text-ink">
      <div className="mx-auto max-w-work px-6 py-16 md:py-24">
        <p className="mb-4 font-mono text-xs uppercase tracking-[0.22em] text-sage">
          Research · Mainrun assessment · 2026
        </p>
        <h1 className="max-w-[720px] font-display text-3xl leading-tight md:text-[2.6rem]">
          Adapting frontier LLM-pretraining techniques under fixed compute
        </h1>
        <p className="mt-4 max-w-prose text-base leading-prose text-ink/75">
          Seven epochs, one seed, baseline at 1.7533. Twenty-eight single-variable
          runs later: 1.1754. The ledger records every one, failures included.
          The overshoots are how you know the minimums were found, not assumed.
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

        {/* the ladder + ledger — shared hover highlight */}
        <PretrainingHighlightProvider>
        <div className="mt-12 border border-contour bg-paper p-5 md:p-7">
          <h2 className="font-display text-xl">The experiment ladder</h2>
          <p className="mb-5 mt-1 max-w-prose text-sm text-ink/60">
            Final validation loss per run. Hover a column for the change, or
            find it in the ledger.
          </p>
          <LossChart />
        </div>

        <div className="mx-auto max-w-prose">
          <Block kicker="The diagnosis">
            Baseline underfits. Training loss falls; validation plateaus after
            step 352. Warmup, weight decay, dropout move the fourth decimal.
            Regularisation is not the constraint. Learning per step is.
          </Block>

          <Block kicker="The big lever">
            AdamW (lr 3e-4) took validation from 1.7533 to 1.3400 — roughly
            73% of the total gain in one swap. Heterogeneous gradient scales
            across attention and MLP; everything else in the ledger stands on
            this.
          </Block>

          <Block kicker="Frontier methods, re-tuned">
            Muon orthogonalises 2D updates via Newton–Schulz. At its published
            lr (0.02, tuned for 124M-param runs) it plateaued above AdamW.
            Four times lower it took the lead. WSD removed the late rise cosine
            left behind; RoPE, ReLU² and value residuals stacked the rest.
            Frontier methods transfer in direction, not magnitude.
          </Block>

          <Block kicker="Depth over width">
            Extra width (8L/512) made things worse at the same step budget.
            Extra depth compounded: 16 layers landed at 1.1754 (~40M params, 9.1
            min). Twenty layers bought 0.0009 for double the runtime. Declined.
          </Block>
        </div>

        {/* the ledger */}
        <div className="mt-14">
          <h2 className="font-display text-xl">The complete ledger</h2>
          <p className="mb-4 mt-1 max-w-prose text-sm text-ink/60">
            Every experiment, kept. Overshoots and regressions included.
          </p>
          <ExperimentLedger />
        </div>
        </PretrainingHighlightProvider>

        {/* final config + kept ablations */}
        <div className="mt-14 grid gap-10 md:grid-cols-2">
          <div>
            <h2 className="font-display text-xl">Final configuration</h2>
            <dl className="mt-4 space-y-3 border-l-2 border-sage pl-4">
              {FINAL_CONFIG.map(([k, v]) => (
                <div key={k}>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">{k}</dt>
                  <dd className="mt-0.5 text-sm leading-relaxed text-ink/80">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div>
            <h2 className="font-display text-xl">What the failures bought</h2>
            <dl className="mt-4 space-y-3 border-l-2 border-sand pl-4">
              {ABLATIONS.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-sm font-medium text-ink/85">{k}</dt>
                  <dd className="mt-0.5 text-sm leading-relaxed text-ink/65">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <div className="mx-auto max-w-prose">
          <Block kicker="Honest limits">
            One seed (1337, fixed by the rules). Differences under ~0.005 sit
            in run-to-run noise. The submission optimises compute, not parameter
            count; a parameter cap would keep 8 layers and give back 0.012. Built
            alongside full-time work. The surface had not flattened at submission.
          </Block>
        </div>

        <div className="mt-12 flex flex-wrap items-center gap-4 border-t border-contour pt-8">
          <a href="/papers/mainrun-report.pdf" className="btn-secondary text-sm">
            Original report (PDF)
          </a>
          <a href="/catchment" className="btn-secondary text-sm">
            The same discipline, as a demo →
          </a>
          <span className="font-mono text-xs text-ink/45">
            Harvey Houlahan · Mainrun assessment · June 2026
          </span>
        </div>
      </div>
    </section>
  );
}
