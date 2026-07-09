/*
 * The Mainrun experiment ledger — transcribed 1:1 from the report
 * (public/papers/mainrun-report.pdf, Table 1). Chronological; `bracket` marks
 * deliberate overshoots and regressions kept as evidence of where each
 * technique's boundary sits.
 */

export type ExpStatus = "baseline" | "improved" | "bracket" | "submitted";

export interface Experiment {
  id: string;
  name: string;
  change: string;
  loss: number;
  status: ExpStatus;
}

export const BASELINE_LOSS = 1.7533;
export const FINAL_LOSS = 1.1754;

export const EXPERIMENTS: Experiment[] = [
  { id: "0", name: "Baseline", change: "SGD lr=6e-3, CosineAnnealingLR, 27.2M params", loss: 1.7533, status: "baseline" },
  { id: "1", name: "AdamW", change: "SGD → AdamW lr=3e-4, betas (0.9, 0.95)", loss: 1.34, status: "improved" },
  { id: "2", name: "Warmup + cosine", change: "+ 10% linear warmup, manual cosine decay", loss: 1.3195, status: "improved" },
  { id: "3", name: "Weight decay", change: "+ wd=0.1 on 2D params only", loss: 1.3194, status: "improved" },
  { id: "4", name: "Residual scaling", change: "GPT-2 init 1/√(2·n_layer) on projections", loss: 1.2746, status: "improved" },
  { id: "5", name: "Dropout 0.05", change: "dropout 0.1 → 0.05", loss: 1.2744, status: "improved" },
  { id: "6", name: "Grad accum ×2", change: "+ SDPA + gradient accumulation — regression", loss: 1.3156, status: "bracket" },
  { id: "6b", name: "SDPA only", change: "accumulation back to 1 — cause isolated", loss: 1.2744, status: "improved" },
  { id: "7", name: "LR 1e-3", change: "pushed AdamW LR above 3e-4 (underfitting)", loss: 1.2383, status: "improved" },
  { id: "7b", name: "LR 1.5e-3", change: "overshoot — brackets the optimum at 1e-3", loss: 1.2457, status: "bracket" },
  { id: "8", name: "Deeper / narrower", change: "8 layers, d_model 416 (23.4M params)", loss: 1.2352, status: "improved" },
  { id: "9", name: "WD ablation", change: "wd 0.1 → 0.0 at optimal LR (control)", loss: 1.2388, status: "bracket" },
  { id: "11", name: "Muon, default LR", change: "Muon lr=0.02 — calibrated for 124M runs, plateaus", loss: 1.3285, status: "bracket" },
  { id: "11b", name: "Muon tuned", change: "Muon lr=0.005, AdamW lr=1e-3", loss: 1.2253, status: "improved" },
  { id: "11c", name: "Muon lr=0.004", change: "confirms 0.005 as the 6-layer optimum", loss: 1.235, status: "bracket" },
  { id: "12", name: "Muon + RoPE, lr 0.02", change: "LR too high — RoPE's effect masked", loss: 1.3326, status: "bracket" },
  { id: "13", name: "WSD schedule", change: "cosine → warmup–stable–decay, cooldown 0.70", loss: 1.2209, status: "improved" },
  { id: "13b", name: "WSD cooldown 0.65", change: "earlier cooldown", loss: 1.2199, status: "improved" },
  { id: "14", name: "RoPE", change: "learned positions → rotary embeddings", loss: 1.1985, status: "improved" },
  { id: "15", name: "QK-norm", change: "parameter-free RMS-norm on q/k — regression, dropped", loss: 1.2178, status: "bracket" },
  { id: "16a", name: "Depth re-test", change: "8L / 416 on the full stack", loss: 1.1933, status: "improved" },
  { id: "16b", name: "Muon lr=0.006", change: "re-tuned for the 8-layer depth", loss: 1.1879, status: "improved" },
  { id: "16c", name: "Muon lr=0.008", change: "overshoot — brackets 0.007 (8-layer)", loss: 1.1875, status: "bracket" },
  { id: "16d", name: "Muon lr=0.007", change: "the 8-layer optimum", loss: 1.1866, status: "improved" },
  { id: "16e", name: "ReLU² MLP", change: "squared-ReLU activation (Primer)", loss: 1.1835, status: "improved" },
  { id: "16f", name: "Value-residual", change: "learnable v-mix to first layer; heads 8 → 4", loss: 1.1823, status: "improved" },
  { id: "17a", name: "16 layers", change: "n_layer 8 → 16 — the submission", loss: 1.1754, status: "submitted" },
  { id: "17b", name: "20 layers", change: "1.1745 for double the runtime — not submitted", loss: 1.1745, status: "improved" },
];
