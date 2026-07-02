/*
 * vision.ts — in-browser CLIP scoring for Genesis (M4).
 *
 * The pioneering core, after ASAL (Sakana/MIT): a vision-language foundation model
 * judges the *look* of the living simulation. We embed a text prompt and a frame of
 * the running substrate into CLIP's shared space; their cosine similarity is a
 * differentiable-by-search "resonance" score. M5 will drive an evolutionary search
 * (CMA-ES) with this score to *summon* life that matches a prompt.
 *
 * transformers.js is loaded from a CDN at runtime (only on first use), so the site
 * bundle stays dependency-light and the feature is fully gated — if it fails to load
 * the simulation is unaffected.
 */

// CDN-hosted ESM build of transformers.js, loaded lazily. Kept as a variable so the
// bundler doesn't try to resolve it, plus webpackIgnore to leave the import native.
const TRANSFORMERS_CDN = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3";
const MODEL_ID = "Xenova/clip-vit-base-patch32"; // small, fast CLIP

export type VisionProgress = (label: string, frac: number) => void;
export type VisionStatus = "idle" | "loading" | "ready" | "error";

let mods: any = null;
let loadingPromise: Promise<void> | null = null;
let nullBank: Float32Array[] | null = null;

// Prompt-ensembling templates. Shared verbatim with the offline trainer
// (ml/genesis/train_summon_prior.py) so atlas embeddings and browser embeddings
// live in exactly the same space — edit both together or the prior lookup breaks.
export const PROMPT_TEMPLATES = (text: string): string[] => [
  text,
  `a photo of ${text}`,
  `an image of ${text}`,
  `${text} on a black background`,
  `glowing ${text} on a dark background`,
  `a pattern that looks like ${text}`,
  `${text}, organic texture`,
];

// The "null bank": embeddings of generic, prompt-free descriptions of what the
// substrate trivially looks like. Scoring against text − max(null) rewards frames
// that are *specifically* like the prompt, not merely bright/dotty — the standard
// contrastive-margin trick from CLIP-guidance work. Shared with the trainer.
export const NULL_PROMPTS = [
  "an image",
  "a photo",
  "a dark background",
  "colorful dots on a black background",
  "glowing particles on a dark background",
  "abstract noise",
];
export const NULL_WEIGHT = 0.5;

// Native dynamic import that the bundler can't see (so it stays a runtime CDN fetch,
// no webpack resolution, no build-time dependency). Browsers run it as import().
const nativeImport: (u: string) => Promise<any> =
  new Function("u", "return import(u)") as (u: string) => Promise<any>;

/** Lazy-load transformers.js + the CLIP text/vision towers. Safe to call repeatedly. */
export async function loadVision(onProgress?: VisionProgress): Promise<void> {
  if (mods) return;
  if (!loadingPromise) {
    loadingPromise = (async () => {
      const t: any = await nativeImport(TRANSFORMERS_CDN);
      t.env.allowLocalModels = false; // always fetch weights from the HF hub
      const device = (navigator as any).gpu ? "webgpu" : "wasm";
      const opts: any = {
        device,
        // fp16 on WebGPU gives noticeably cleaner embeddings (a stronger gradient for
        // the search) than int8; fall back to q8 on the WASM path.
        dtype: device === "webgpu" ? "fp16" : "q8",
        progress_callback: (p: any) => {
          if (onProgress && p?.status === "progress" && p?.file) {
            onProgress(String(p.file), (p.progress ?? 0) / 100);
          }
        },
      };
      const tokenizer = await t.AutoTokenizer.from_pretrained(MODEL_ID);
      const textModel = await t.CLIPTextModelWithProjection.from_pretrained(MODEL_ID, opts);
      const processor = await t.AutoProcessor.from_pretrained(MODEL_ID);
      const visionModel = await t.CLIPVisionModelWithProjection.from_pretrained(MODEL_ID, opts);
      mods = { t, tokenizer, textModel, processor, visionModel };
    })().catch((e) => { loadingPromise = null; throw e; });
  }
  await loadingPromise;
}

function l2norm(a: Float32Array): Float32Array {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * a[i];
  s = Math.sqrt(s) || 1;
  const o = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) o[i] = a[i] / s;
  return o;
}

/**
 * Embed a text prompt into a unit CLIP vector, using prompt-ensembling: several
 * templated phrasings are embedded, individually normalized, then averaged. This is
 * the standard zero-shot CLIP trick — it denoises the target and gives the search a
 * much cleaner gradient than a single raw phrase.
 */
export async function embedText(text: string): Promise<Float32Array> {
  const { tokenizer, textModel } = mods;
  // ensemble of templates; several mention a dark background to match how the
  // simulation actually renders (glowing forms on near-black), which tightens CLIP.
  const prompts = PROMPT_TEMPLATES(text);
  const inputs = tokenizer(prompts, { padding: true, truncation: true });
  const out = await textModel(inputs);
  const data = out.text_embeds.data as ArrayLike<number>;
  const dim = (data.length / prompts.length) | 0;
  const avg = new Float32Array(dim);
  for (let r = 0; r < prompts.length; r++) {
    let s = 0;
    for (let i = 0; i < dim; i++) s += (data[r * dim + i] as number) ** 2;
    s = Math.sqrt(s) || 1;
    for (let i = 0; i < dim; i++) avg[i] += (data[r * dim + i] as number) / s;
  }
  return l2norm(avg);
}

/** Embed the null-prompt bank (once, cached) — individual unit vectors. */
export async function getNullBank(): Promise<Float32Array[]> {
  if (nullBank) return nullBank;
  const { tokenizer, textModel } = mods;
  const inputs = tokenizer(NULL_PROMPTS, { padding: true, truncation: true });
  const out = await textModel(inputs);
  const data = out.text_embeds.data as ArrayLike<number>;
  const dim = (data.length / NULL_PROMPTS.length) | 0;
  const bank: Float32Array[] = [];
  for (let r = 0; r < NULL_PROMPTS.length; r++) {
    bank.push(l2norm(Float32Array.from({ length: dim }, (_, i) => data[r * dim + i] as number)));
  }
  nullBank = bank;
  return bank;
}

/** Draw a WebGPU canvas into a 224² RGBA RawImage (CLIP can't read a webgpu ctx directly). */
function rawFromCanvas(t: any, src: HTMLCanvasElement): any {
  const S = 224;
  const c = document.createElement("canvas");
  c.width = S; c.height = S;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(src, 0, 0, S, S);
  const id = ctx.getImageData(0, 0, S, S);
  const im = new t.RawImage(new Uint8ClampedArray(id.data.buffer), S, S, 4);
  return typeof im.rgb === "function" ? im.rgb() : im; // CLIP wants 3 channels

}

/** Embed the current canvas frame into a unit CLIP vector. */
export async function embedCanvas(canvas: HTMLCanvasElement): Promise<Float32Array> {
  const { t, processor, visionModel } = mods;
  const img = rawFromCanvas(t, canvas);
  const inputs = await processor(img);
  const out = await visionModel(inputs);
  return l2norm(Float32Array.from(out.image_embeds.data as ArrayLike<number>));
}

/** Embed raw RGBA pixels (from an offscreen GPU readback) into a unit CLIP vector. */
export async function embedPixels(rgba: Uint8ClampedArray, width: number, height: number): Promise<Float32Array> {
  const { t, processor, visionModel } = mods;
  let img = new t.RawImage(rgba, width, height, 4);
  if (typeof img.rgb === "function") img = img.rgb();
  const inputs = await processor(img);
  const out = await visionModel(inputs);
  return l2norm(Float32Array.from(out.image_embeds.data as ArrayLike<number>));
}

/** Center-crop RGBA pixels to a `frac` fraction of the frame (new buffer). */
function centerCrop(rgba: Uint8ClampedArray, w: number, h: number, frac: number): { px: Uint8ClampedArray; w: number; h: number } {
  const cw = Math.max(2, Math.round(w * frac));
  const ch = Math.max(2, Math.round(h * frac));
  const x0 = (w - cw) >> 1;
  const y0 = (h - ch) >> 1;
  const out = new Uint8ClampedArray(cw * ch * 4);
  for (let y = 0; y < ch; y++) {
    const src = ((y0 + y) * w + x0) * 4;
    out.set(rgba.subarray(src, src + cw * 4), y * cw * 4);
  }
  return { px: out, w: cw, h: ch };
}

/**
 * Multi-crop embedding: the full frame plus a zoomed center crop, embedded in a
 * single batched vision forward. Cutout averaging is the standard CLIP-guidance
 * trick — it makes the fitness see both the whole ecology and individual creatures,
 * a far denser signal for the evolutionary search than one global view.
 */
export async function embedPixelsMulti(rgba: Uint8ClampedArray, width: number, height: number): Promise<Float32Array[]> {
  const { t, processor, visionModel } = mods;
  const crop = centerCrop(rgba, width, height, 0.62);
  const mk = (px: Uint8ClampedArray, w: number, h: number) => {
    let im = new t.RawImage(px, w, h, 4);
    if (typeof im.rgb === "function") im = im.rgb();
    return im;
  };
  const inputs = await processor([mk(rgba, width, height), mk(crop.px, crop.w, crop.h)]);
  const out = await visionModel(inputs);
  const data = out.image_embeds.data as ArrayLike<number>;
  const dim = (data.length / 2) | 0;
  const embs: Float32Array[] = [];
  for (let r = 0; r < 2; r++) {
    embs.push(l2norm(Float32Array.from({ length: dim }, (_, i) => data[r * dim + i] as number)));
  }
  return embs;
}

/** Mean of unit vectors, re-normalized — a single embedding for a set of views. */
export function meanEmbed(embs: Float32Array[]): Float32Array {
  const dim = embs[0].length;
  const m = new Float32Array(dim);
  for (const e of embs) for (let i = 0; i < dim; i++) m[i] += e[i];
  return l2norm(m);
}

/**
 * Contrastive prompt-match fitness: mean over views of
 *   cos(view, prompt) − NULL_WEIGHT · max_j cos(view, null_j).
 * Subtracting the best generic-description match whitens away the "it's glowing
 * dots on black" baseline every candidate shares, so the search climbs on what is
 * *specific* to the prompt. Mirrored exactly in the offline trainer.
 */
export function matchScore(views: Float32Array[], text: Float32Array, nulls: Float32Array[]): number {
  let s = 0;
  for (const v of views) {
    let nmax = -1;
    for (const n of nulls) { const c = cosine(v, n); if (c > nmax) nmax = c; }
    s += cosine(v, text) - NULL_WEIGHT * nmax;
  }
  return s / views.length;
}

/** Cosine similarity of two unit vectors (CLIP resonance). */
export function cosine(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/**
 * Map a raw CLIP cosine (~0.12–0.34 for matches) to a friendly 0–1 "resonance" bar.
 * Relative ordering is what matters for the search; this is just for display.
 */
export function resonance(cos: number): number {
  return Math.max(0, Math.min(1, (cos - 0.15) / 0.15));
}
