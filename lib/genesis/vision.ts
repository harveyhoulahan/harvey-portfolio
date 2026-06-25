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
        dtype: "q8", // quantized → smaller download, faster inference
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
  const prompts = [
    text,
    `a photo of ${text}`,
    `an image of ${text}`,
    `a pattern that looks like ${text}`,
    `${text}, organic texture`,
  ];
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
