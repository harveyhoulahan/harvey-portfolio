# The splat portrait — capture → train → ship

The About page opens with **STA 00 · SUBJECT**: an orbitable 3D Gaussian-splat
portrait, rendered by a hand-written WebGL2 splatter
([lib/splat/viewer.ts](../../lib/splat/viewer.ts)). The block renders
**nothing** until `public/splat/portrait.splat` exists, so everything below can
be done whenever — the site is unchanged until the file lands.

## 1 · Film the capture (10 minutes)

You are a statue; the phone moves. That's the whole trick — any subject motion
breaks structure-from-motion.

- **Pose**: stand, full body, arms relaxed (slightly away from the torso scans
  better than pressed against it). Pick a stance you can hold for ~90 seconds.
  Fix your gaze on one point; don't track the camera. Breathe shallow.
- **Camera person**: someone orbits you slowly, twice — one lap at chest
  height, one at waist/knee height — taking 40–50 s per lap, ~1.5–2.5 m away,
  keeping your whole body in frame. Smooth, boring movement; no fast pans.
- **Settings**: 4K 30 fps, landscape or portrait (doesn't matter), lock
  exposure/focus if the camera app allows (tap-hold on iPhone → AE/AF LOCK).
- **Scene**: even, diffuse light (bright overcast outside is perfect). Avoid
  mirrors, glass, harsh sun. A visually textured background (garden, shed,
  paddock) *helps* SfM — don't film against a blank wall.
- Trees/grass moving gently in the background is tolerable; people walking
  through frame is not.

## 2 · Train

### Path A — this repo's pipeline (the "trained it myself" story)

```powershell
pip install numpy scipy pillow imageio imageio-ffmpeg pycolmap
pip install gsplat   # needs the CUDA torch you already have; see note below
python ml/splat/build_splat.py --video path\to\capture.mp4
```

~200 frames are extracted, pycolmap solves the cameras (few minutes), gsplat
trains 15k steps (~20–40 min on the 16 GB card), and the exporter writes
`public/splat/portrait.splat` + `.json`. Stages are resumable — rerunning skips
whatever already exists in `ml/splat/runs/portrait/`.

> **gsplat on Windows**: if `pip install gsplat` tries to compile CUDA (needs
> MSVC + CUDA toolkit), install a prebuilt wheel from
> https://docs.gsplat.studio/whl matching your torch/CUDA instead. If Python
> 3.14 wheels don't exist for `gsplat`/`pycolmap` yet, make a 3.11 env just for
> this and everything installs clean. If it still fights you → Path B.

### Path B — escape hatch (any external trainer)

Train with any 3DGS tool that eats a video/photos and exports a standard `.ply`
— [Postshot](https://www.jawset.com) (Windows app, drag the video in) or
[Brush](https://github.com/ArthurBrussee/brush) both work — then only the web
export runs here:

```powershell
python ml/splat/build_splat.py --from-ply path\to\export.ply
```

## 3 · Clean up (recommended)

Drag the trained `.ply` (from `ml/splat/runs/portrait/splats/`) into the
[SuperSplat editor](https://superspl.at/editor), delete floaters / floor /
background chunks you don't want, export, and re-run the `--from-ply` export.
The exporter also auto-crops around the subject; `--crop-percentile`,
`--crop-mult`, `--no-crop` tune it, and `--yaw/--pitch/--roll` fix orientation
if the auto up-vector guess is off.

## 4 · Ship

```powershell
npm run dev            # → http://localhost:3000/about — STA 00 appears
git add public/splat/portrait.splat public/splat/portrait.json
git commit -m "add splat portrait" && git push
```

Aim for ≤ ~12 MB (the default `--max-web 350000` keeps it around there). The
viewer lazy-loads only when the block scrolls into view, so the page's initial
payload is untouched.

## Dev without a portrait

`node scripts/splat/make-test-splat.mjs` writes a synthetic contour-hill splat
to `public/splat/portrait.splat` so the viewer can be exercised — **don't
commit that file**; it's a placeholder.

## Format contract

`.splat` = 32 bytes/gaussian: `f32 x y z | f32 sx sy sz | u8 rgba | u8 quat(wxyz)`,
subject centred at origin, up = +Y, longest extent ≈ 1.6 units. Written by
`build_splat.py::stage_export`, read by `lib/splat/parse.ts` — **change both
together**.
