/*
 * cmaes.ts — separable CMA-ES (Ros & Hansen, 2008), ask/tell interface.
 *
 * A diagonal-covariance Evolution Strategy: it samples a population of candidate
 * vectors from N(mean, σ²·diag(C)), and from their fitnesses adapts the mean, the
 * per-coordinate variances C, and the global step σ. The separable (diagonal) form
 * skips the O(n²) eigendecomposition of full CMA-ES, so it scales cleanly to the
 * 36-D Particle-Life attraction matrix while staying ~80 lines.
 *
 * Operates in normalized [0,1]^n space (candidates clamped to the box); the caller
 * decodes to real parameter ranges. MINIMIZES — the Genesis search passes negative
 * resonance so that minimizing drives the simulation toward the prompt.
 *
 * Pure module → validated headlessly in Node before being wired to the GPU.
 */

export class CMAES {
  n: number;
  lambda: number;
  mu: number;
  weights: number[];
  mueff: number;
  cc: number; cs: number; c1: number; cmu: number; damps: number; chiN: number;
  mean: number[];
  sigma: number;
  C: number[];   // diagonal covariance
  pc: number[]; ps: number[];
  gen = 0;
  best: { x: number[]; f: number } = { x: [], f: Infinity };

  private pop: number[][] = [];
  private zs: number[][] = [];
  private spare: number | null = null;

  constructor(mean0: number[], sigma0 = 0.3, lambda?: number) {
    const n = mean0.length;
    this.n = n;
    this.lambda = lambda ?? 4 + Math.floor(3 * Math.log(n));
    this.mu = Math.floor(this.lambda / 2);
    const w: number[] = [];
    for (let i = 0; i < this.mu; i++) w.push(Math.log(this.mu + 0.5) - Math.log(i + 1));
    const sw = w.reduce((a, b) => a + b, 0);
    this.weights = w.map((x) => x / sw);
    this.mueff = 1 / this.weights.reduce((a, b) => a + b * b, 0);
    const sep = (n + 2) / 3; // separable speed-up factor on the C learning rates
    this.cc = (4 + this.mueff / n) / (n + 4 + 2 * this.mueff / n);
    this.cs = (this.mueff + 2) / (n + this.mueff + 5);
    this.c1 = Math.min(1, (2 / ((n + 1.3) ** 2 + this.mueff)) * sep);
    this.cmu = Math.min(1 - this.c1, (2 * (this.mueff - 2 + 1 / this.mueff) / ((n + 2) ** 2 + this.mueff)) * sep);
    this.damps = 1 + 2 * Math.max(0, Math.sqrt((this.mueff - 1) / (n + 1)) - 1) + this.cs;
    this.chiN = Math.sqrt(n) * (1 - 1 / (4 * n) + 1 / (21 * n * n));
    this.mean = mean0.slice();
    this.sigma = sigma0;
    this.C = new Array(n).fill(1);
    this.pc = new Array(n).fill(0);
    this.ps = new Array(n).fill(0);
  }

  private randn(): number {
    if (this.spare !== null) { const s = this.spare; this.spare = null; return s; }
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    const r = Math.sqrt(-2 * Math.log(u));
    this.spare = r * Math.sin(2 * Math.PI * v);
    return r * Math.cos(2 * Math.PI * v);
  }

  /** Draw λ candidate vectors (clamped to the [0,1] box). */
  ask(): number[][] {
    this.pop = []; this.zs = [];
    for (let k = 0; k < this.lambda; k++) {
      const z: number[] = [], x: number[] = [];
      for (let i = 0; i < this.n; i++) {
        const zi = this.randn();
        z.push(zi);
        let xi = this.mean[i] + this.sigma * Math.sqrt(this.C[i]) * zi;
        xi = xi < 0 ? 0 : xi > 1 ? 1 : xi;
        x.push(xi);
      }
      this.zs.push(z); this.pop.push(x);
    }
    return this.pop;
  }

  /** Report fitnesses (to MINIMIZE) for the candidates from the last ask(). */
  tell(fit: number[]): void {
    const idx = fit.map((f, i) => [f, i] as [number, number]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
    if (fit[idx[0]] < this.best.f) this.best = { f: fit[idx[0]], x: this.pop[idx[0]].slice() };

    const old = this.mean.slice();
    const newMean = new Array(this.n).fill(0);
    for (let m = 0; m < this.mu; m++) {
      const wi = this.weights[m], xi = this.pop[idx[m]];
      for (let i = 0; i < this.n; i++) newMean[i] += wi * xi[i];
    }
    this.mean = newMean;

    const y = new Array(this.n); // normalized mean shift
    for (let i = 0; i < this.n; i++) y[i] = (newMean[i] - old[i]) / this.sigma;

    for (let i = 0; i < this.n; i++)
      this.ps[i] = (1 - this.cs) * this.ps[i] + Math.sqrt(this.cs * (2 - this.cs) * this.mueff) * (y[i] / Math.sqrt(this.C[i]));
    const psNorm = Math.sqrt(this.ps.reduce((a, b) => a + b * b, 0));

    this.gen++;
    const hsig = psNorm / Math.sqrt(1 - Math.pow(1 - this.cs, 2 * this.gen)) / this.chiN < 1.4 + 2 / (this.n + 1) ? 1 : 0;
    for (let i = 0; i < this.n; i++)
      this.pc[i] = (1 - this.cc) * this.pc[i] + hsig * Math.sqrt(this.cc * (2 - this.cc) * this.mueff) * y[i];

    for (let i = 0; i < this.n; i++) {
      let cmuTerm = 0;
      for (let m = 0; m < this.mu; m++) {
        const d = (this.pop[idx[m]][i] - old[i]) / this.sigma;
        cmuTerm += this.weights[m] * d * d;
      }
      this.C[i] = (1 - this.c1 - this.cmu) * this.C[i]
        + this.c1 * (this.pc[i] * this.pc[i] + (1 - hsig) * this.cc * (2 - this.cc) * this.C[i])
        + this.cmu * cmuTerm;
      if (this.C[i] < 1e-9) this.C[i] = 1e-9;
    }

    this.sigma *= Math.exp((this.cs / this.damps) * (psNorm / this.chiN - 1));
    if (this.sigma > 1e3) this.sigma = 1e3;
  }
}
