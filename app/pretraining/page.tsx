import type { Metadata } from "next";
import type { ReactNode } from "react";
import LossChart from "@/components/pretraining/LossChart";
import { BASELINE_LOSS, EXPERIMENTS, FINAL_LOSS } from "@/components/pretraining/experiments";

export const metadata: Metadata = {
  title: "LLM pretraining under fixed compute — 1.75 → 1.18 | Harvey Houlahan",
  description:
    "A ~40M-parameter transformer pretraining study under a fixed seven-epoch budget: validation loss 1.7533 → 1.1754 (−33.0%) via Muon, WSD scheduling, RoPE, ReLU² and value residuals — every experiment in the ledger, including the failures.",
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
  ["Parameters", "≈40.0M — ~47% more than the 27.2M baseline, spent on depth"],
  ["Optimiser", "Muon (lr 0.007, momentum 0.95, 5-step Newton–Schulz) on 2D hidden matrices; AdamW (lr 1e-3) on embeddings, head, norms, mixing scalars"],
  ["Schedule", "WSD — 6% linear warmup → stable peak → (1−√t) cooldown from 0.65"],
  ["Positions", "RoPE, applied to q/k inside attention"],
  ["MLP", "Squared-ReLU (ReLU²) activation, 4× expansion"],
  ["Attention", "PyTorch SDPA, causal, dropout 0.05 · value-residual: learnable per-layer mix to first-layer values"],
  ["Other", "GPT-2 residual init 1/√(2·n_layer) · weight tying · grad clip 1.0"],
];

const ABLATIONS: [string, string][] = [
  ["Gradient accumulation", "+0.0412 — halved optimiser updates from 938 to 469 inside the fixed budget; a larger effective batch couldn't buy it back."],
  ["Weight decay > 0", "negligible either way — confirmed regularisation was not the operative constraint."],
  ["Muon at default lr 0.02", "plateaued at 1.3285 — hyperparameters calibrated for 124M-param runs; re-tuned 4× lower to recover."],
  ["QK-norm, no learnable scale", "+0.0193 — capped attention's dynamic range without the per-head gain needed to recover it."],
  ["8L/512 width", "worse than 8L/416 at the same step budget — capacity wasn't the bottleneck, optimiser steps were."],
  ["Overshoot brackets (7b, 11c, 16c)", "deliberate runs past each optimum, confirming every minimum was located empirically rather than assumed."],
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
          Seven epochs, one seed, an untouchable <code>evaluate()</code> — and a
          GPT-2-style baseline stuck at 1.7533. Twenty-eight single-variable
          experiments later, the same budget lands at 1.1754. The ledger below
          keeps every run, including the failures: the overshoots and regressions
          are the evidence that each optimum was found, not assumed.
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

        {/* the ladder */}
        <div className="mt-12 border border-contour bg-paper p-5 md:p-7">
          <h2 className="font-display text-xl">The experiment ladder</h2>
          <p className="mb-5 mt-1 max-w-prose text-sm text-ink/60">
            Final validation loss per run, chronological. Hover a column for the
            run&apos;s single change.
          </p>
          <LossChart />
        </div>

        <div className="mx-auto max-w-prose">
          <Block kicker="The diagnosis">
            The baseline underfits — training loss stays high (9.77 → 8.18) while
            validation plateaus after step 352, and warmup, weight-decay and
            dropout tuning all move the fourth decimal. A model unresponsive to
            regularisation isn&apos;t overfitting; the operative constraint is
            learning per step. That single hypothesis drove every decision after it.
          </Block>

          <Block kicker="The big lever">
            Swapping SGD for AdamW (lr 3e-4, β 0.9/0.95) collapsed validation loss
            from 1.7533 to 1.3400 — roughly 73% of the total improvement in one
            move. Transformers carry heterogeneous gradient scales across attention
            and MLP weights; per-parameter adaptive rates address what uniform SGD
            updates cannot. Everything else in the ledger stands on this.
          </Block>

          <Block kicker="Frontier methods, re-tuned to fit">
            Muon (from the nanoGPT-speedrun literature) orthogonalises 2D weight
            updates via Newton–Schulz iteration — but at its published lr of 0.02,
            calibrated for 124M-parameter GPU runs, it plateaued <em>above</em> the
            AdamW line. Re-tuned 4× lower it took the lead; warmup–stable–decay
            then removed the late-training rise cosine left behind, RoPE was worth
            a further 0.0214, and ReLU² and value-residual connections stacked the
            last thousandths. The recurring lesson: frontier methods transfer in
            direction, not magnitude.
          </Block>

          <Block kicker="Depth over width">
            Extra width (8L/512) made things worse — more parameters per layer than
            938 optimiser steps can train. Extra depth compounded: 8 layers beat 6,
            and once Muon, residual scaling, ReLU² and value residuals had made a
            deeper stack trainable, 16 layers took the submission to 1.1754 at
            ~40M parameters and 9.1 minutes. Twenty layers bought 0.0009 more for
            double the runtime — measured, and declined.
          </Block>
        </div>

        {/* the ledger */}
        <div className="mt-14">
          <h2 className="font-display text-xl">The complete ledger</h2>
          <p className="mb-4 mt-1 max-w-prose text-sm text-ink/60">
            Every experiment, kept — the bracketing overshoots and regressions
            included. Single-variable protocol against the current best.
          </p>
          <div className="overflow-x-auto border border-contour">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-contour bg-terrace text-left font-mono text-[10px] uppercase tracking-[0.14em] text-ink/50">
                  <th className="px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Experiment</th>
                  <th className="px-3 py-2 font-medium">Key change</th>
                  <th className="px-3 py-2 text-right font-medium">Val loss</th>
                  <th className="px-3 py-2 text-right font-medium">Δ base</th>
                </tr>
              </thead>
              <tbody>
                {EXPERIMENTS.map((e) => (
                  <tr
                    key={e.id}
                    className={`border-b border-contour/60 last:border-b-0 ${
                      e.status === "submitted" ? "bg-sage/10 font-medium" : e.status === "bracket" ? "bg-sand/[0.07]" : ""
                    }`}
                  >
                    <td className="px-3 py-1.5 font-mono text-xs text-ink/50">{e.id}</td>
                    <td className="px-3 py-1.5 text-ink/85">
                      {e.name}
                      {e.status === "bracket" && <span className="ml-1.5 font-mono text-[10px] text-sand">▾ bracket</span>}
                      {e.status === "submitted" && <span className="ml-1.5 font-mono text-[10px] text-sage">▸ submitted</span>}
                    </td>
                    <td className="px-3 py-1.5 text-ink/65">{e.change}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-xs text-ink/85 [font-variant-numeric:tabular-nums]">{e.loss.toFixed(4)}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-xs text-ink/55 [font-variant-numeric:tabular-nums]">
                      {e.status === "baseline" ? "—" : (e.loss - BASELINE_LOSS).toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

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
            One seed (1337, fixed by the rules) — differences under ~0.005 sit
            inside run-to-run noise and were never treated as signal. The
            submission optimises the compute budget, not parameter count: a
            parameter-constrained variant would keep the 8-layer stack and give
            back 0.012. QK-norm with a learnable scale, vocabulary sweeps and bf16
            were deprioritised once the remaining reductions fell to the fourth
            decimal. The response surface hadn&apos;t flattened at submission —
            this was built alongside full-time work.
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
