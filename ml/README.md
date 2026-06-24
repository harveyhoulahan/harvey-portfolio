# Catchment — neural surrogate (local GPU training)

Train a neural network to **emulate the water simulation**, then drop the result into
the site and watch *physics vs. neural* race side-by-side. Teacher = the same
virtual-pipes shallow-water model that runs in the browser; student = a small,
resolution-invariant convolutional **neural operator**.

This is the M4 "headliner": *physics is the teacher, the net is the student, and the
student runs the world faster than physics can* — the GraphCast / NeuralGCM idea,
shrunk to a catchment and run in a browser tab.

## Run it

```bash
cd <repo>
pip install torch numpy            # use the CUDA build of torch for your GPU

# a solid default run (~15–40 min on a 4070-class GPU)
python ml/train_surrogate.py \
  --epochs 300 --iters 80 --batch 8 \
  --train-res 96 --channels 48 --dilations 1 2 4 8 1 \
  --rollout 8 --amp \
  --out public/catchment/surrogate.json

# then just reload /catchment — the engine auto-loads the new model.
```

Knobs that matter:
- `--rollout N` — pushforward unroll length. **Higher = more stable long rollouts**
  (the whole point), at more memory/time. 6–10 is a good range.
- `--channels` / `--dilations` — capacity & receptive field. Bigger dilations let the
  net "see" faster flow (more cells/step). The export stays WGSL-deployable.
- `--train-res 96` — train small; it's a *local operator*, so it runs at 160²+ in the
  browser unchanged. Bump to 128 if your GPU is happy.
- `--fno` — train a Fourier Neural Operator instead (great for the report / accuracy
  experiments). FNO needs an FFT, so it is **not** exported to the web build; use
  `--onnx` to keep it for onnxruntime-web experiments.
- `--onnx` — also export `surrogate.onnx`.

It trains over **every DEM** in `public/catchment/` (all the worlds), with randomized
rain + storm cells, so the model generalizes across maps.

## The artifact contract (`catchment-surrogate-v1`)

`public/catchment/surrogate.json` — the in-browser WGSL inference reads exactly this.

```jsonc
{
  "format": "catchment-surrogate-v1",
  "arch": {
    "type": "conv-operator",
    "inputs": ["water", "bedNorm", "rainx100"],   // 3 input channels
    "predicts": "water (residual)",               // out = relu(water + Δ)
    "trainRes": 96, "HSCALE": 80.0, "dt": 0.02,
    "channels": 48,
    "layers": [
      // executed in order; each is a conv2d in PyTorch weight layout (out,in,kh,kw)
      { "name":"inp",  "in":3,  "out":48, "k":3, "dilation":1, "act":"gelu" },
      { "name":"blk0", "in":48, "out":48, "k":3, "dilation":1, "act":"gelu",
        "residual":true, "groupnorm":true, "groups":8 },
      // blk1 d=2, blk2 d=4, blk3 d=8, blk4 d=1 ...
      { "name":"out",  "in":48, "out":1,  "k":3, "dilation":1, "act":"none" }
    ]
  },
  "weights": {
    "inp.w":"<base64 float32 (out,in,kh,kw)>", "inp.b":"<base64 float32 (out)>",
    "blk0.w":"…","blk0.b":"…","blk0.gn_w":"…","blk0.gn_b":"…",
    "out.w":"…","out.b":"…"
  }
}
```

Conventions the browser relies on (all already matched by the engine):
- `bedNorm = bed / HSCALE` (HSCALE = 80), `water` in the same units as the sim.
- `rainx100 = rainfall * 100` broadcast to a full channel.
- Residual: the model outputs Δwater; final `water_next = max(0, water + Δ)`.
- GroupNorm groups = 8; activation GELU (tanh approximation is fine in WGSL).
- Weights are PyTorch-native `conv.weight` shape `(out, in, kh, kw)`, row-major float32.

As long as the JSON matches this contract, the in-browser runtime will execute it as a
stack of WGSL compute passes (one per layer) with **no runtime dependency** — and the
demo shows physics vs. neural, a live error field, and the speed-up factor.

## What "good" looks like
- Single-step loss should fall well below the identity baseline.
- `val_rollout_rmse@40` should stay **small and roughly flat** — that's the stability the
  pushforward loss buys. If it climbs steeply, raise `--rollout`, add `--noise`, or train
  longer.

A placeholder `surrogate.json` (a weak, in-browser-trained net) ships so the pipeline is
testable end-to-end; **replace it with your GPU-trained model.**
