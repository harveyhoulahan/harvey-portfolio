// Galah study data - generated from each run's final.json plus runs/fits.json
// on lychee (2026-07-19). Regenerate via galah's fit.py export; do not hand-edit.

export interface Run {
  name: string;
  rung: string;
  annex: boolean;
  n: number;        // non-embedding params
  c: number;        // training FLOPs budget
  tokens: number;   // bytes seen
  steps: number;
  lrScale: number;
  seed: number;
  val: number;      // final val bits/byte
  ema: number;      // final smoothed train loss (nats)
  diverged: boolean;
  firstSpike: number | null; // step where smoothed loss first left its floor
}

export interface Optimum {
  c: number;
  nOpt: number;
  lOpt: number;
  dOpt: number;
  points: number;
  edgePinned: boolean; // quadratic vertex clamped at the ladder edge
}

export const RUNS: Run[] = [
  { name: "galah-0.1m_C1e15", rung: "0.1m", annex: false, n: 98304, c: 1e+15, tokens: 462290944, steps: 3527, lrScale: 1, seed: 1337, val: 2.20027, ema: 1.53997, diverged: false, firstSpike: null },
  { name: "galah-0.1m_C3e15", rung: "0.1m", annex: false, n: 98304, c: 3e+15, tokens: 1387134976, steps: 10583, lrScale: 1, seed: 1337, val: 2.02041, ema: 1.41294, diverged: false, firstSpike: null },
  { name: "galah-0.2m_C1e15", rung: "0.2m", annex: false, n: 221184, c: 1e+15, tokens: 271187968, steps: 2069, lrScale: 1, seed: 1337, val: 2.12219, ema: 1.48813, diverged: false, firstSpike: null },
  { name: "galah-0.2m_C3e15", rung: "0.2m", annex: false, n: 221184, c: 3e+15, tokens: 813694976, steps: 6208, lrScale: 1, seed: 1337, val: 1.86875, ema: 1.30755, diverged: false, firstSpike: null },
  { name: "galah-0.3m_C1e15", rung: "0.3m", annex: false, n: 331776, c: 1e+15, tokens: 180748288, steps: 1379, lrScale: 1, seed: 1337, val: 2.27495, ema: 1.59448, diverged: false, firstSpike: null },
  { name: "galah-0.3m_C3e15", rung: "0.3m", annex: false, n: 331776, c: 3e+15, tokens: 542507008, steps: 4139, lrScale: 1, seed: 1337, val: 1.81594, ema: 1.27045, diverged: false, firstSpike: null },
  { name: "galah-0.8m_C1e15", rung: "0.8m", annex: false, n: 786432, c: 1e+15, tokens: 90701824, steps: 692, lrScale: 1, seed: 1337, val: 2.9159, ema: 2.06465, diverged: false, firstSpike: null },
  { name: "galah-0.8m_C1e16", rung: "0.8m", annex: false, n: 786432, c: 1e+16, tokens: 908197888, steps: 6929, lrScale: 1, seed: 1337, val: 1.74852, ema: 1.2207, diverged: false, firstSpike: null },
  { name: "galah-0.8m_C3e15", rung: "0.8m", annex: false, n: 786432, c: 3e+15, tokens: 272367616, steps: 2078, lrScale: 1, seed: 1337, val: 1.83208, ema: 1.28532, diverged: false, firstSpike: null },
  { name: "galah-1.5m_C1e15", rung: "1.5m", annex: false, n: 1536000, c: 1e+15, tokens: 52428800, steps: 400, lrScale: 1, seed: 1337, val: 3.43101, ema: 2.42491, diverged: false, firstSpike: null },
  { name: "galah-1.5m_C1e16", rung: "1.5m", annex: false, n: 1536000, c: 1e+16, tokens: 524943360, steps: 4005, lrScale: 1, seed: 1337, val: 1.67405, ema: 1.16785, diverged: false, firstSpike: null },
  { name: "galah-1.5m_C3e15", rung: "1.5m", annex: false, n: 1536000, c: 3e+15, tokens: 157417472, steps: 1201, lrScale: 1, seed: 1337, val: 2.14886, ema: 1.51511, diverged: false, firstSpike: null },
  { name: "galah-1.5m_C3e16", rung: "1.5m", annex: false, n: 1536000, c: 3e+16, tokens: 1575092224, steps: 12017, lrScale: 1, seed: 1337, val: 3.22106, ema: 2.26604, diverged: true, firstSpike: 4200 },
  { name: "galah-10m_C1e16", rung: "10m", annex: false, n: 9830400, c: 1e+16, tokens: 110493696, steps: 843, lrScale: 1, seed: 1337, val: 2.07897, ema: 1.46905, diverged: false, firstSpike: null },
  { name: "galah-10m_C1e17", rung: "10m", annex: false, n: 9830400, c: 1e+17, tokens: 1105592320, steps: 8435, lrScale: 1, seed: 1337, val: 1.35603, ema: 0.94348, diverged: false, firstSpike: null },
  { name: "galah-10m_C3e15", rung: "10m", annex: false, n: 9830400, c: 3e+15, tokens: 33161216, steps: 253, lrScale: 1, seed: 1337, val: 3.5611, ema: 2.52127, diverged: false, firstSpike: null },
  { name: "galah-10m_C3e16", rung: "10m", annex: false, n: 9830400, c: 3e+16, tokens: 331612160, steps: 2530, lrScale: 1, seed: 1337, val: 1.5073, ema: 1.06085, diverged: false, firstSpike: null },
  { name: "galah-10m_C3e17", rung: "10m", annex: false, n: 9830400, c: 3e+17, tokens: 3317039104, steps: 25307, lrScale: 1, seed: 1337, val: 3.62961, ema: 2.51214, diverged: true, firstSpike: 5650 },
  { name: "galah-113m_C3e17", rung: "113m", annex: false, n: 113246208, c: 3e+17, tokens: 361234432, steps: 2756, lrScale: 1, seed: 1337, val: 1.33021, ema: 0.92708, diverged: false, firstSpike: null },
  { name: "galah-38m_C1e18", rung: "38m", annex: false, n: 37748736, c: 1e+18, tokens: 3311271936, steps: 25263, lrScale: 1, seed: 1337, val: 1.19383, ema: 0.83012, diverged: false, firstSpike: null },
  { name: "galah-69m_C1e18", rung: "69m", annex: false, n: 68812800, c: 1e+18, tokens: 1912078336, steps: 14588, lrScale: 1, seed: 1337, val: 1.17341, ema: 0.8134, diverged: false, firstSpike: null },
  { name: "galah-113m_C1e18", rung: "113m", annex: false, n: 113246208, c: 1e+18, tokens: 1204027392, steps: 9186, lrScale: 1, seed: 1337, val: 1.18182, ema: 0.82143, diverged: false, firstSpike: null },
  { name: "galah-200m_C1e18", rung: "200m", annex: false, n: 199065600, c: 1e+18, tokens: 710803456, steps: 5423, lrScale: 1, seed: 1337, val: 1.22056, ema: 0.84909, diverged: false, firstSpike: null },
  { name: "galah-18m_C1e16", rung: "18m", annex: false, n: 17694720, c: 1e+16, tokens: 65142784, steps: 497, lrScale: 1, seed: 1337, val: 2.73657, ema: 1.99307, diverged: false, firstSpike: null },
  { name: "galah-18m_C1e17", rung: "18m", annex: false, n: 17694720, c: 1e+17, tokens: 652083200, steps: 4975, lrScale: 1, seed: 1337, val: 1.3391, ema: 0.93338, diverged: false, firstSpike: null },
  { name: "galah-18m_C3e16", rung: "18m", annex: false, n: 17694720, c: 3e+16, tokens: 195559424, steps: 1492, lrScale: 1, seed: 1337, val: 1.60957, ema: 1.12855, diverged: false, firstSpike: null },
  { name: "galah-18m_C3e17", rung: "18m", annex: false, n: 17694720, c: 3e+17, tokens: 1956249600, steps: 14925, lrScale: 1, seed: 1337, val: 1.28024, ema: 0.89147, diverged: false, firstSpike: null },
  { name: "galah-2.7m_C1e15", rung: "2.7m", annex: false, n: 2654208, c: 1e+15, tokens: 33161216, steps: 253, lrScale: 1, seed: 1337, val: 3.5946, ema: 2.53404, diverged: false, firstSpike: null },
  { name: "galah-2.7m_C1e16", rung: "2.7m", annex: false, n: 2654208, c: 1e+16, tokens: 332398592, steps: 2536, lrScale: 1, seed: 1337, val: 1.69872, ema: 1.18945, diverged: false, firstSpike: null },
  { name: "galah-2.7m_C1e17", rung: "2.7m", annex: false, n: 2654208, c: 1e+17, tokens: 3324248064, steps: 25362, lrScale: 1, seed: 1337, val: 1.85602, ema: 1.29721, diverged: true, firstSpike: 23700 },
  { name: "galah-2.7m_C3e15", rung: "2.7m", annex: false, n: 2654208, c: 3e+15, tokens: 99614720, steps: 760, lrScale: 1, seed: 1337, val: 2.4865, ema: 1.77015, diverged: false, firstSpike: null },
  { name: "galah-2.7m_C3e16", rung: "2.7m", annex: false, n: 2654208, c: 3e+16, tokens: 997195776, steps: 7608, lrScale: 1, seed: 1337, val: 1.51481, ema: 1.05776, diverged: false, firstSpike: null },
  { name: "galah-38m_C1e17", rung: "38m", annex: false, n: 37748736, c: 1e+17, tokens: 331087872, steps: 2526, lrScale: 1, seed: 1337, val: 1.39167, ema: 0.9735, diverged: false, firstSpike: null },
  { name: "galah-38m_C3e16", rung: "38m", annex: false, n: 37748736, c: 3e+16, tokens: 99221504, steps: 757, lrScale: 1, seed: 1337, val: 1.91783, ema: 1.3688, diverged: false, firstSpike: null },
  { name: "galah-38m_C3e17", rung: "38m", annex: false, n: 37748736, c: 3e+17, tokens: 993394688, steps: 7579, lrScale: 1, seed: 1337, val: 1.24942, ema: 0.87019, diverged: false, firstSpike: null },
  { name: "galah-5.5m_C1e15", rung: "5.5m", annex: false, n: 5505024, c: 1e+15, tokens: 18087936, steps: 138, lrScale: 1, seed: 1337, val: 3.6411, ema: 2.75974, diverged: false, firstSpike: null },
  { name: "galah-5.5m_C1e16", rung: "5.5m", annex: false, n: 5505024, c: 1e+16, tokens: 181534720, steps: 1385, lrScale: 1, seed: 1337, val: 1.79652, ema: 1.25918, diverged: false, firstSpike: null },
  { name: "galah-5.5m_C1e17", rung: "5.5m", annex: false, n: 5505024, c: 1e+17, tokens: 1816395776, steps: 13858, lrScale: 1, seed: 1337, val: 1.40986, ema: 0.98447, diverged: false, firstSpike: null },
  { name: "galah-5.5m_C3e15", rung: "5.5m", annex: false, n: 5505024, c: 3e+15, tokens: 54394880, steps: 415, lrScale: 1, seed: 1337, val: 3.1053, ema: 2.24008, diverged: false, firstSpike: null },
  { name: "galah-5.5m_C3e16", rung: "5.5m", annex: false, n: 5505024, c: 3e+16, tokens: 544866304, steps: 4157, lrScale: 1, seed: 1337, val: 1.46122, ema: 1.01948, diverged: false, firstSpike: null },
  { name: "galah-5.5m_C3e17", rung: "5.5m", annex: false, n: 5505024, c: 3e+17, tokens: 5449449472, steps: 41576, lrScale: 1, seed: 1337, val: 4.16997, ema: 2.93901, diverged: true, firstSpike: 24400 },
  { name: "galah-69m_C1e17", rung: "69m", annex: false, n: 68812800, c: 1e+17, tokens: 191102976, steps: 1458, lrScale: 1, seed: 1337, val: 1.4838, ema: 1.03784, diverged: false, firstSpike: null },
  { name: "galah-69m_C3e17", rung: "69m", annex: false, n: 68812800, c: 3e+17, tokens: 573571072, steps: 4376, lrScale: 1, seed: 1337, val: 1.28087, ema: 0.89136, diverged: false, firstSpike: null },
  { name: "galah-1.5m_C3e16-lr0.5", rung: "1.5m", annex: true, n: 1536000, c: 3e+16, tokens: 1575092224, steps: 12017, lrScale: 0.5, seed: 1337, val: 1.79138, ema: 1.25614, diverged: false, firstSpike: null },
  { name: "galah-1.5m_C3e16-seed1338", rung: "1.5m", annex: true, n: 1536000, c: 3e+16, tokens: 1575092224, steps: 12017, lrScale: 1, seed: 1338, val: 3.1622, ema: 2.20761, diverged: true, firstSpike: 2700 },
  { name: "galah-10m_C3e17-lr0.5", rung: "10m", annex: true, n: 9830400, c: 3e+17, tokens: 3317039104, steps: 25307, lrScale: 0.5, seed: 1337, val: 2.62843, ema: 1.88087, diverged: true, firstSpike: 5550 },
  { name: "galah-2.7m_C1e17-lr0.5", rung: "2.7m", annex: true, n: 2654208, c: 1e+17, tokens: 3324248064, steps: 25362, lrScale: 0.5, seed: 1337, val: 3.36941, ema: 2.28112, diverged: true, firstSpike: 4350 },
  { name: "galah-1.5m_C3e16-lr0.25", rung: "1.5m", annex: true, n: 1536000, c: 3e+16, tokens: 1575092224, steps: 12017, lrScale: 0.25, seed: 1337, val: 1.69469, ema: 1.18442, diverged: false, firstSpike: null },
  { name: "galah-2.7m_C1e17-lr0.25", rung: "2.7m", annex: true, n: 2654208, c: 1e+17, tokens: 3324248064, steps: 25362, lrScale: 0.25, seed: 1337, val: 2.12735, ema: 1.48777, diverged: true, firstSpike: 7350 },
  { name: "galah-5.5m_C3e17-lr0.5", rung: "5.5m", annex: true, n: 5505024, c: 3e+17, tokens: 5449449472, steps: 41576, lrScale: 0.5, seed: 1337, val: 1.70972, ema: 1.20699, diverged: true, firstSpike: 24650 },
  { name: "galah-5.5m_C3e17-lr0.25", rung: "5.5m", annex: true, n: 5505024, c: 3e+17, tokens: 5449449472, steps: 41576, lrScale: 0.25, seed: 1337, val: 2.20531, ema: 1.58253, diverged: true, firstSpike: 12900 },
  { name: "galah-10m_C3e17-lr0.25", rung: "10m", annex: true, n: 9830400, c: 3e+17, tokens: 3317039104, steps: 25307, lrScale: 0.25, seed: 1337, val: 1.42252, ema: 0.99249, diverged: false, firstSpike: null },
  { name: "galah-2.7m_C1e17-lr0.125", rung: "2.7m", annex: true, n: 2654208, c: 1e+17, tokens: 3324248064, steps: 25362, lrScale: 0.125, seed: 1337, val: 1.79586, ema: 1.25921, diverged: false, firstSpike: 17300 },
  { name: "galah-5.5m_C3e17-lr0.125", rung: "5.5m", annex: true, n: 5505024, c: 3e+17, tokens: 5449449472, steps: 41576, lrScale: 0.125, seed: 1337, val: 1.53792, ema: 1.07435, diverged: false, firstSpike: 35150 },
];

export const OPTIMA: Optimum[] = [
  { c: 1e+15, nOpt: 98304, lOpt: -0.692206, dOpt: 4.62388e+08, points: 7, edgePinned: true },
  { c: 3e+15, nOpt: 339131, lOpt: 1.79492, dOpt: 5.33125e+08, points: 8, edgePinned: false },
  { c: 1e+16, nOpt: 1.97555e+06, lOpt: 1.6093, dOpt: 4.25465e+08, points: 6, edgePinned: false },
  { c: 3e+16, nOpt: 5.43661e+06, lOpt: 1.45601, dOpt: 5.50632e+08, points: 5, edgePinned: false },
  { c: 1e+17, nOpt: 1.55825e+07, lOpt: 1.34003, dOpt: 7.30974e+08, points: 5, edgePinned: false },
  { c: 3e+17, nOpt: 3.52852e+07, lOpt: 1.25164, dOpt: 1.05522e+09, points: 4, edgePinned: false },
  { c: 1e+18, nOpt: 7.32489e+07, lOpt: 1.17302, dOpt: 1.80439e+09, points: 4, edgePinned: false },
];

export const FRONTIER = { a: 4.36463e-10, b: 0.96750 } as const;

export const PARAMETRIC = {
  E: 0.697667, A: 8.68909, alpha: 0.168793, B: 1.64013e+07, beta: 0.911527, impliedB: 0.843757,
} as const;

export const BUDGETS = [1e15, 3e15, 1e16, 3e16, 1e17, 3e17, 1e18] as const;

export const BUDGET_LABELS: Record<string, string> = {
  "1e+15": "1e15", "3e+15": "3e15", "1e+16": "1e16",
  "3e+16": "3e16", "1e+17": "1e17", "3e+17": "3e17", "1e+18": "1e18",
};

export const fmtN = (n: number): string =>
  n >= 1e6 ? `${(n / 1e6).toFixed(n >= 3e7 ? 0 : 1)}M` : `${(n / 1e3).toFixed(0)}K`;

export const fmtC = (c: number): string => {
  const exp = Math.floor(Math.log10(c));
  const mant = c / 10 ** exp;
  return `${mant.toFixed(0)}e${exp}`;
};

export const fmtGB = (tokens: number): string => `${(tokens / 1e9).toFixed(2)}GB`;
