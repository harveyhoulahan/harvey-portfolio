"""
build_splat.py — phone video in, web-ready 3D Gaussian-splat portrait out.

The About page renders /splat/portrait.splat with a hand-written WebGL2 viewer
(lib/splat/viewer.ts). This script produces that file from a single orbit video:

    frames   video -> ~200 still frames (imageio-ffmpeg, downscaled)
    sfm      COLMAP structure-from-motion via pycolmap -> camera poses + sparse
             points (single-camera model, sequential matching for video)
    train    3D Gaussian Splatting on gsplat (DefaultStrategy densification,
             L1 + D-SSIM loss, progressive SH) -> standard 3DGS .ply
    export   prune + crop + orient (up=+Y) + centre + normalise + quantise
             -> public/splat/portrait.splat (32 B/gaussian) + portrait.json

Stages are idempotent: each writes into --work and is skipped when its output
already exists (use --force to redo). You can also enter the pipeline sideways:

    python ml/splat/build_splat.py --video capture.mp4          # full run
    python ml/splat/build_splat.py --video capture.mp4 --stage sfm   # stop after SfM
    python ml/splat/build_splat.py --from-ply cleaned.ply       # export only —
        train in ANY external tool (Postshot, Brush, nerfstudio), clean up in
        SuperSplat, then hand the .ply here for the web export.

The .splat layout is mirrored in lib/splat/parse.ts — change them together.

Requires: torch (CUDA), numpy, scipy, pillow, imageio, imageio-ffmpeg,
pycolmap, gsplat.   See ml/splat/README.md for install + capture guidance.
"""

from __future__ import annotations

import argparse
import json
import math
import struct
import sys
import time
from pathlib import Path

import numpy as np

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

SH_C0 = 0.28209479177387814
REPO = Path(__file__).resolve().parents[2]
DEFAULT_OUT = REPO / "public" / "splat" / "portrait.splat"


# ---------------------------------------------------------------------------
# Stage 1 — frames
# ---------------------------------------------------------------------------

def stage_frames(video: Path, out_dir: Path, target: int, max_side: int) -> None:
    from PIL import Image
    import imageio.v3 as iio

    out_dir.mkdir(parents=True, exist_ok=True)
    existing = sorted(out_dir.glob("*.jpg"))
    if len(existing) >= 20:
        print(f"[frames] {len(existing)} frames already in {out_dir} — skipping")
        return

    stride = 1
    try:
        meta = iio.immeta(video, plugin="FFMPEG")
        total = int(meta.get("fps", 30) * meta.get("duration", 60))
        stride = max(1, round(total / target))
    except Exception:
        stride = 6  # sensible default for 30 fps footage
    print(f"[frames] extracting every {stride}th frame → {out_dir}")

    n = 0
    for i, frame in enumerate(iio.imiter(video, plugin="FFMPEG")):
        if i % stride:
            continue
        img = Image.fromarray(frame)
        if max(img.size) > max_side:
            s = max_side / max(img.size)
            img = img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)
        img.save(out_dir / f"frame_{n:05d}.jpg", quality=95)
        n += 1
    if n < 20:
        raise SystemExit(f"[frames] only {n} frames extracted — video too short?")
    print(f"[frames] wrote {n} frames")


# ---------------------------------------------------------------------------
# Stage 2 — structure from motion (pycolmap)
# ---------------------------------------------------------------------------

def stage_sfm(images: Path, work: Path) -> Path:
    """Returns the undistorted-dataset dir (images/ + sparse/ with PINHOLE cams)."""
    import pycolmap

    undist = work / "undistorted"
    if (undist / "sparse").exists():
        print(f"[sfm] {undist} already exists — skipping")
        return undist

    db = work / "database.db"
    sparse = work / "sparse"
    sparse.mkdir(parents=True, exist_ok=True)

    print("[sfm] feature extraction (single-camera model)")
    pycolmap.extract_features(
        database_path=db, image_path=images,
        camera_mode=pycolmap.CameraMode.SINGLE,
    )
    print("[sfm] sequential matching (orbit video)")
    try:
        pycolmap.match_sequential(database_path=db)
    except AttributeError:
        pycolmap.match_exhaustive(database_path=db)

    print("[sfm] incremental mapping")
    recs = pycolmap.incremental_mapping(database_path=db, image_path=images, output_path=sparse)
    if not recs:
        raise SystemExit(
            "[sfm] reconstruction failed — usually not enough parallax or motion "
            "blur. Re-film: slower orbit, everything static, more texture in frame."
        )
    best_id = max(recs, key=lambda k: recs[k].num_reg_images())
    best = recs[best_id]
    print(f"[sfm] model {best_id}: {best.num_reg_images()} images, {len(best.points3D)} points")
    if best.num_reg_images() < 30:
        print("[sfm] WARNING: few registered images; expect a rough splat")

    print("[sfm] undistorting to PINHOLE")
    pycolmap.undistort_images(
        output_path=undist, input_path=sparse / str(best_id), image_path=images,
    )
    return undist


def load_colmap(undist: Path):
    """Undistorted reconstruction → (viewmats [N,4,4], Ks [N,3,3], image paths,
    sizes, sparse xyz [M,3], rgb [M,3], camera up vector in world coords)."""
    import pycolmap

    rec = pycolmap.Reconstruction(undist / "sparse")
    viewmats, Ks, paths, sizes = [], [], [], []
    ups = []
    for im in rec.images.values():
        pose = im.cam_from_world() if callable(getattr(im, "cam_from_world", None)) else im.cam_from_world
        R = np.asarray(pose.rotation.matrix(), dtype=np.float64)
        t = np.asarray(pose.translation, dtype=np.float64)
        m = np.eye(4)
        m[:3, :3] = R
        m[:3, 3] = t
        viewmats.append(m)
        ups.append(-R[1, :])  # camera up, expressed in world coordinates
        cam = rec.cameras[im.camera_id]
        fx, fy, cx, cy = cam.params[:4] if len(cam.params) >= 4 else (cam.params[0], cam.params[0], cam.params[1], cam.params[2])
        Ks.append(np.array([[fx, 0, cx], [0, fy, cy], [0, 0, 1]], dtype=np.float64))
        paths.append(undist / "images" / im.name)
        sizes.append((cam.width, cam.height))
    pts = np.array([p.xyz for p in rec.points3D.values()], dtype=np.float64)
    rgb = np.array([p.color for p in rec.points3D.values()], dtype=np.float64) / 255.0
    up = np.mean(ups, axis=0)
    up /= np.linalg.norm(up) + 1e-12
    return np.stack(viewmats), np.stack(Ks), paths, sizes, pts, rgb, up


# ---------------------------------------------------------------------------
# Stage 3 — training (gsplat)
# ---------------------------------------------------------------------------

def _ssim(a, b):
    """Gaussian-window SSIM on [1,3,H,W] tensors in [0,1]."""
    import torch
    import torch.nn.functional as F

    g = torch.exp(-((torch.arange(11, device=a.device, dtype=a.dtype) - 5) ** 2) / (2 * 1.5 ** 2))
    g = (g / g.sum())
    win = (g[:, None] * g[None, :]).expand(3, 1, 11, 11)
    mu1 = F.conv2d(a, win, padding=5, groups=3)
    mu2 = F.conv2d(b, win, padding=5, groups=3)
    s11 = F.conv2d(a * a, win, padding=5, groups=3) - mu1 * mu1
    s22 = F.conv2d(b * b, win, padding=5, groups=3) - mu2 * mu2
    s12 = F.conv2d(a * b, win, padding=5, groups=3) - mu1 * mu2
    C1, C2 = 0.01 ** 2, 0.03 ** 2
    m = ((2 * mu1 * mu2 + C1) * (2 * s12 + C2)) / ((mu1 ** 2 + mu2 ** 2 + C1) * (s11 + s22 + C2))
    return m.mean()


def stage_train(undist: Path, work: Path, steps: int, sh_degree: int, device_str: str) -> Path:
    import torch
    from scipy.spatial import cKDTree
    from PIL import Image
    from gsplat import rasterization
    from gsplat.strategy import DefaultStrategy

    ply_out = work / "splats" / f"point_cloud_{steps}.ply"
    if ply_out.exists():
        print(f"[train] {ply_out} exists — skipping")
        return ply_out
    ply_out.parent.mkdir(parents=True, exist_ok=True)

    # Check if CUDA is available, fall back to CPU if not
    if device_str == "cuda" and not torch.cuda.is_available():
        print(f"[train] CUDA not available, falling back to CPU (this will be slow)")
        device_str = "cpu"
    device = torch.device(device_str)
    viewmats_np, Ks_np, paths, sizes, pts, rgb, _up = load_colmap(undist)
    n_img = len(paths)
    print(f"[train] {n_img} cameras, {len(pts)} seed points, device {device}")

    images = []
    for p in paths:
        im = np.asarray(Image.open(p), dtype=np.float32) / 255.0
        images.append(torch.from_numpy(im))  # kept on CPU, moved per step
    viewmats = torch.tensor(viewmats_np, dtype=torch.float32, device=device)
    Ks = torch.tensor(Ks_np, dtype=torch.float32, device=device)

    # scene scale from camera spread (drives means lr + densification thresholds)
    cams = np.linalg.inv(viewmats_np)[:, :3, 3]
    scene_scale = float(np.max(np.linalg.norm(cams - cams.mean(0), axis=1))) * 1.1

    # init gaussians on the SfM points
    N = len(pts)
    knn = cKDTree(pts).query(pts, k=4)[0][:, 1:].mean(1)
    knn = np.clip(knn, 1e-4, None)
    means = torch.tensor(pts, dtype=torch.float32, device=device)
    scales = torch.log(torch.tensor(knn[:, None].repeat(3, 1), dtype=torch.float32, device=device))
    quats = torch.zeros((N, 4), dtype=torch.float32, device=device)
    quats[:, 0] = 1.0
    opac = torch.logit(torch.full((N,), 0.1, dtype=torch.float32, device=device))
    sh0 = torch.tensor((rgb - 0.5) / SH_C0, dtype=torch.float32, device=device)[:, None, :]
    K_sh = (sh_degree + 1) ** 2
    shN = torch.zeros((N, K_sh - 1, 3), dtype=torch.float32, device=device)

    params = torch.nn.ParameterDict({
        "means": torch.nn.Parameter(means),
        "scales": torch.nn.Parameter(scales),
        "quats": torch.nn.Parameter(quats),
        "opacities": torch.nn.Parameter(opac),
        "sh0": torch.nn.Parameter(sh0),
        "shN": torch.nn.Parameter(shN),
    }).to(device)
    lrs = {
        "means": 1.6e-4 * scene_scale, "scales": 5e-3, "quats": 1e-3,
        "opacities": 5e-2, "sh0": 2.5e-3, "shN": 2.5e-3 / 20,
    }
    optimizers = {k: torch.optim.Adam([params[k]], lr=lr, eps=1e-15) for k, lr in lrs.items()}
    means_sched = torch.optim.lr_scheduler.ExponentialLR(
        optimizers["means"], gamma=0.01 ** (1.0 / steps))

    strategy = DefaultStrategy(
        refine_start_iter=500, refine_stop_iter=steps // 2,
        reset_every=3000, refine_every=100, verbose=False,
    )
    strategy.check_sanity(params, optimizers)
    state = strategy.initialize_state(scene_scale=scene_scale)

    t0 = time.time()
    rng = np.random.default_rng(0)
    for step in range(steps):
        i = int(rng.integers(n_img))
        gt = images[i].to(device)[None]  # [1,H,W,3]
        H, W = gt.shape[1], gt.shape[2]
        sh_use = min(step // 1000, sh_degree)

        renders, _alphas, info = rasterization(
            means=params["means"],
            quats=params["quats"] / params["quats"].norm(dim=-1, keepdim=True),
            scales=torch.exp(params["scales"]),
            opacities=torch.sigmoid(params["opacities"]),
            colors=torch.cat([params["sh0"], params["shN"]], 1),
            viewmats=viewmats[i][None], Ks=Ks[i][None], width=W, height=H,
            sh_degree=sh_use, packed=False,
        )
        strategy.step_pre_backward(params, optimizers, state, step, info)
        l1 = (renders - gt).abs().mean()
        ssim_l = 1.0 - _ssim(renders.permute(0, 3, 1, 2), gt.permute(0, 3, 1, 2))
        loss = 0.8 * l1 + 0.2 * ssim_l
        loss.backward()
        strategy.step_post_backward(params, optimizers, state, step, info, packed=False)
        for opt in optimizers.values():
            opt.step()
            opt.zero_grad(set_to_none=True)
        means_sched.step()

        if step % 500 == 0 or step == steps - 1:
            print(f"[train] step {step}/{steps} · loss {loss.item():.4f} · "
                  f"{len(params['means']):,} gaussians · {time.time() - t0:.0f}s")

    write_3dgs_ply(ply_out, params, sh_degree)
    print(f"[train] wrote {ply_out}")
    return ply_out


def write_3dgs_ply(path: Path, params, sh_degree: int) -> None:
    """Standard (Inria-layout) 3DGS binary PLY — openable in SuperSplat etc."""
    import torch

    with torch.no_grad():
        means = params["means"].cpu().numpy()
        scales = params["scales"].cpu().numpy()
        quats = (params["quats"] / params["quats"].norm(dim=-1, keepdim=True)).cpu().numpy()
        opac = params["opacities"].cpu().numpy()
        sh0 = params["sh0"].cpu().numpy()          # [N,1,3]
        shN = params["shN"].cpu().numpy()          # [N,K-1,3]
    n = means.shape[0]
    n_rest = shN.shape[1] * 3
    props = ["x", "y", "z", "nx", "ny", "nz", "f_dc_0", "f_dc_1", "f_dc_2"]
    props += [f"f_rest_{i}" for i in range(n_rest)]
    props += ["opacity", "scale_0", "scale_1", "scale_2", "rot_0", "rot_1", "rot_2", "rot_3"]
    header = (
        "ply\nformat binary_little_endian 1.0\n"
        f"element vertex {n}\n"
        + "".join(f"property float {p}\n" for p in props)
        + "end_header\n"
    )
    # f_rest is stored channel-major (all R coeffs, all G, all B)
    rest = shN.transpose(0, 2, 1).reshape(n, -1)
    body = np.concatenate([
        means, np.zeros((n, 3), np.float32), sh0.reshape(n, 3), rest,
        opac[:, None], scales, quats,
    ], axis=1).astype("<f4")
    with open(path, "wb") as f:
        f.write(header.encode("ascii"))
        f.write(body.tobytes())


def read_3dgs_ply(path: Path):
    """Read a standard 3DGS PLY → (means, scales(log), quats, opacity(logit), sh0rgb)."""
    raw = path.read_bytes()
    end = raw.index(b"end_header\n") + len(b"end_header\n")
    header = raw[:end].decode("ascii", "replace")
    if "format binary_little_endian" not in header:
        raise SystemExit("[export] only binary_little_endian PLY is supported")
    props = [ln.split()[-1] for ln in header.splitlines() if ln.startswith("property float")]
    n = int(next(ln.split()[-1] for ln in header.splitlines() if ln.startswith("element vertex")))
    data = np.frombuffer(raw, dtype="<f4", count=n * len(props), offset=end).reshape(n, len(props))
    col = {p: i for i, p in enumerate(props)}
    need = ["x", "y", "z", "f_dc_0", "f_dc_1", "f_dc_2", "opacity",
            "scale_0", "scale_1", "scale_2", "rot_0", "rot_1", "rot_2", "rot_3"]
    missing = [p for p in need if p not in col]
    if missing:
        raise SystemExit(f"[export] PLY missing properties: {missing} — is this a 3DGS export?")
    means = data[:, [col["x"], col["y"], col["z"]]]
    sh0 = data[:, [col["f_dc_0"], col["f_dc_1"], col["f_dc_2"]]]
    opac = data[:, col["opacity"]]
    scales = data[:, [col["scale_0"], col["scale_1"], col["scale_2"]]]
    quats = data[:, [col["rot_0"], col["rot_1"], col["rot_2"], col["rot_3"]]]
    return means, scales, quats, opac, sh0


# ---------------------------------------------------------------------------
# Stage 4 — web export  (layout mirrored in lib/splat/parse.ts)
# ---------------------------------------------------------------------------

def rot_between(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    """Rotation matrix taking unit vector a to unit vector b."""
    v = np.cross(a, b)
    c = float(np.dot(a, b))
    if c < -0.99999:  # antiparallel: rotate 180° about any perpendicular
        p = np.array([1.0, 0, 0]) if abs(a[0]) < 0.9 else np.array([0, 1.0, 0])
        v = np.cross(a, p)
        v /= np.linalg.norm(v)
        return 2 * np.outer(v, v) - np.eye(3)
    K = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])
    return np.eye(3) + K + K @ K / (1 + c)


def quat_mul_rot(R: np.ndarray, quats: np.ndarray) -> np.ndarray:
    """Apply rotation matrix R to an array of (w,x,y,z) quaternions."""
    tr = np.trace(R)
    if tr > 0:
        s = math.sqrt(tr + 1.0) * 2
        rq = np.array([0.25 * s, (R[2, 1] - R[1, 2]) / s, (R[0, 2] - R[2, 0]) / s, (R[1, 0] - R[0, 1]) / s])
    else:
        i = int(np.argmax(np.diag(R)))
        j, k = (i + 1) % 3, (i + 2) % 3
        s = math.sqrt(max(1e-12, 1.0 + R[i, i] - R[j, j] - R[k, k])) * 2
        rq = np.empty(4)
        rq[0] = (R[k, j] - R[j, k]) / s
        rq[1 + i] = 0.25 * s
        rq[1 + j] = (R[j, i] + R[i, j]) / s
        rq[1 + k] = (R[k, i] + R[i, k]) / s
    w1, x1, y1, z1 = rq
    w2, x2, y2, z2 = quats[:, 0], quats[:, 1], quats[:, 2], quats[:, 3]
    return np.stack([
        w1 * w2 - x1 * x2 - y1 * y2 - z1 * z2,
        w1 * x2 + x1 * w2 + y1 * z2 - z1 * y2,
        w1 * y2 - x1 * z2 + y1 * w2 + z1 * x2,
        w1 * z2 + x1 * y2 - y1 * x2 + z1 * w2,
    ], axis=1)


def statistical_outlier_mask(points: np.ndarray, k: int, std_ratio: float) -> np.ndarray:
    """Open3D/CloudCompare-style SOR: flag points whose mean distance to their
    k nearest neighbours is more than `std_ratio` standard deviations above the
    dataset average. Strips the sparse floating "petal" gaussians that casual
    single-orbit captures scatter around the subject, without touching the
    dense reconstruction itself. O(N log N) via a KD-tree."""
    from scipy.spatial import cKDTree

    n = len(points)
    if n <= k + 1:
        return np.ones(n, dtype=bool)
    tree = cKDTree(points)
    # k+1 because the nearest neighbour of a point is itself (distance 0)
    dist, _ = tree.query(points, k=k + 1, workers=-1)
    mean_dist = dist[:, 1:].mean(axis=1)
    mu, sigma = mean_dist.mean(), mean_dist.std()
    threshold = mu + std_ratio * sigma
    return mean_dist < threshold


def stage_export(ply: Path, out: Path, up_world: np.ndarray | None, args) -> None:
    means, scales_log, quats, opac_logit, sh0 = read_3dgs_ply(ply)
    n0 = len(means)
    opacity = 1.0 / (1.0 + np.exp(-opac_logit))
    scales = np.exp(scales_log)
    quats = quats / (np.linalg.norm(quats, axis=1, keepdims=True) + 1e-12)

    # --no-clean: trust a hand-cleaned (e.g. SuperSplat) input completely and
    # skip every automated prune below — opacity/size, anisotropy, SOR, and
    # the radial crop. Each of those is a heuristic tuned for a *raw* training
    # output full of floaters; run against gaussians a human already vetted,
    # the radial crop in particular will happily slice off arms/legs/feet
    # because they're the farthest real points from the body's centroid.
    if args.no_clean:
        print(f"[export] --no-clean: trusting hand-cleaned input as-is ({n0:,} gaussians)")
    else:
        keep = opacity > args.opacity_min
        # drop grotesquely large gaussians (sky/floor sheets)
        keep &= scales.max(1) < np.percentile(scales.max(1), 99.5) * 2
        means, scales, quats, opacity, sh0 = means[keep], scales[keep], quats[keep], opacity[keep], sh0[keep]
        print(f"[export] opacity/size prune: {n0:,} → {len(means):,}")

        # anisotropy prune: kill translucent needle/streak-shaped gaussians
        # (max-axis / min-axis ratio too high AND low opacity). A live human
        # subject shot on a hand-held orbit gets motion blur + view-inconsistent
        # hair/skin regions that 3DGS "fixes" by stretching a low-opacity gaussian
        # into a long thin streak rather than fitting real geometry — these are
        # the flame/leaf-shaped artifacts. Gating on opacity too (not shape alone)
        # spares legitimately thin BUT solid geometry (jacket seams, real hair
        # strands) which are locally dense, so SOR alone won't catch them either.
        if not args.no_aniso:
            n_before = len(means)
            s_sorted = np.sort(scales, axis=1)  # ascending: [min, mid, max]
            ratio = s_sorted[:, 2] / np.maximum(s_sorted[:, 0], 1e-8)
            keep = ~((ratio > args.aniso_max) & (opacity < args.aniso_opacity))
            means, scales, quats, opacity, sh0 = means[keep], scales[keep], quats[keep], opacity[keep], sh0[keep]
            print(f"[export] anisotropy prune: {n_before:,} → {len(means):,}")

        # statistical outlier removal: strip sparse floater gaussians (the
        # scattered "petals" a noisy single-orbit reconstruction throws off away
        # from the dense subject cluster) before the radial crop below sees them —
        # otherwise a few distant floaters can bias the crop centre/radius.
        if not args.no_sor and len(means) > args.sor_k + 1:
            n_before = len(means)
            keep = statistical_outlier_mask(means, k=args.sor_k, std_ratio=args.sor_std)
            means, scales, quats, opacity, sh0 = means[keep], scales[keep], quats[keep], opacity[keep], sh0[keep]
            print(f"[export] statistical outlier removal: {n_before:,} → {len(means):,}")

        # crop to the subject: distance percentile around the opacity-weighted centre
        if not args.no_crop:
            centre = np.median(means[opacity > 0.5] if (opacity > 0.5).sum() > 1000 else means, axis=0)
            d = np.linalg.norm(means - centre, axis=1)
            r = np.percentile(d, args.crop_percentile) * args.crop_mult
            keep = d < r
            means, scales, quats, opacity, sh0 = means[keep], scales[keep], quats[keep], opacity[keep], sh0[keep]
            print(f"[export] crop r={r:.3f}: → {len(means):,}")

    # orient: camera-average up (SfM) or tallest principal axis (--from-ply) → +Y
    if not args.no_orient:
        if up_world is not None:
            up = up_world
        else:
            c = means - means.mean(0)
            up = np.linalg.svd(c[np.random.default_rng(0).choice(len(c), min(len(c), 50000), replace=False)], full_matrices=False)[2][0]
            if up[1] < 0:
                up = -up
        if args.flip_up:
            up = -up
        R = rot_between(up / np.linalg.norm(up), np.array([0.0, 1.0, 0.0]))
        means = means @ R.T
        quats = quat_mul_rot(R, quats)
    for axis, deg in (("yaw", args.yaw), ("pitch", args.pitch), ("roll", args.roll)):
        if deg:
            a = math.radians(deg)
            ca, sa = math.cos(a), math.sin(a)
            R = {"yaw": np.array([[ca, 0, sa], [0, 1, 0], [-sa, 0, ca]]),
                 "pitch": np.array([[1, 0, 0], [0, ca, -sa], [0, sa, ca]]),
                 "roll": np.array([[ca, -sa, 0], [sa, ca, 0], [0, 0, 1]])}[axis]
            means = means @ R.T
            quats = quat_mul_rot(R, quats)

    # centre at origin, longest extent → ~1.6 world units (viewer orbits at ~2.6)
    means -= np.median(means, axis=0)
    extent = np.percentile(np.abs(means), 99.0, axis=0).max() * 2
    s = 1.6 / max(extent, 1e-6)
    means *= s
    scales *= s

    # keep the most important gaussians for the web budget
    if len(means) > args.max_web:
        importance = opacity * scales.prod(1) ** (1 / 3)
        idx = np.argsort(-importance)[: args.max_web]
        means, scales, quats, opacity, sh0 = means[idx], scales[idx], quats[idx], opacity[idx], sh0[idx]
        print(f"[export] web budget: → {len(means):,}")

    rgb = np.clip(0.5 + SH_C0 * sh0, 0.0, 1.0)
    n = len(means)
    buf = bytearray(n * 32)
    for i in range(n):
        o = i * 32
        struct.pack_into("<6f", buf, o,
                         means[i, 0], means[i, 1], means[i, 2],
                         scales[i, 0], scales[i, 1], scales[i, 2])
        buf[o + 24] = int(rgb[i, 0] * 255)
        buf[o + 25] = int(rgb[i, 1] * 255)
        buf[o + 26] = int(rgb[i, 2] * 255)
        buf[o + 27] = int(np.clip(opacity[i] * 255, 0, 255))
        q = quats[i]
        for k in range(4):
            buf[o + 28 + k] = int(np.clip(round(q[k] * 127.5 + 127.5), 0, 255))
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(bytes(buf))
    manifest = {
        "count": n, "bytes": len(buf), "source": ply.name,
        "date": time.strftime("%Y-%m-%d"),
    }
    out.with_suffix(".json").write_text(json.dumps(manifest), encoding="utf-8")
    print(f"[export] wrote {out} ({len(buf) / 1e6:.1f} MB, {n:,} gaussians)")


# ---------------------------------------------------------------------------

def main() -> None:
    ap = argparse.ArgumentParser(description="Video → web-ready Gaussian-splat portrait")
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument("--video", type=Path, help="orbit video of the (motionless) subject")
    src.add_argument("--from-ply", type=Path, help="skip capture/SfM/training; web-export this 3DGS .ply")
    ap.add_argument("--work", type=Path, default=REPO / "ml" / "splat" / "runs" / "portrait")
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    ap.add_argument("--stage", choices=["frames", "sfm", "train", "export"], default="export",
                    help="run up to and including this stage (default: all)")
    ap.add_argument("--frames", type=int, default=200, help="target frame count from the video")
    ap.add_argument("--max-side", type=int, default=1280, help="training image long side, px")
    ap.add_argument("--steps", type=int, default=15000)
    ap.add_argument("--sh-degree", type=int, default=2)
    ap.add_argument("--device", default="cuda")
    # export tuning
    ap.add_argument("--max-web", type=int, default=500_000)
    ap.add_argument("--no-clean", action="store_true",
                     help="skip ALL automated pruning (opacity/size, anisotropy, SOR, radial crop) — "
                          "use when --from-ply is already hand-cleaned (e.g. in SuperSplat), since the "
                          "radial crop especially will cut off limbs/extremities on a vetted subject")
    ap.add_argument("--opacity-min", type=float, default=0.12)
    ap.add_argument("--no-aniso", action="store_true", help="skip anisotropy (needle-shape) prune")
    ap.add_argument("--aniso-max", type=float, default=6.0, help="max long/short axis ratio (lower = more aggressive)")
    ap.add_argument("--aniso-opacity", type=float, default=0.5,
                     help="only prune needle gaussians below this opacity (spares solid thin geometry)")
    ap.add_argument("--no-sor", action="store_true", help="skip statistical outlier removal")
    ap.add_argument("--sor-k", type=int, default=16, help="SOR neighbour count")
    ap.add_argument("--sor-std", type=float, default=1.5, help="SOR std-dev threshold (lower = more aggressive)")
    ap.add_argument("--no-crop", action="store_true")
    ap.add_argument("--crop-percentile", type=float, default=75.0)
    ap.add_argument("--crop-mult", type=float, default=1.15)
    ap.add_argument("--no-orient", action="store_true")
    ap.add_argument("--flip-up", action="store_true",
                     help="invert the auto-detected up vector — use when the portrait renders upside-down")
    ap.add_argument("--yaw", type=float, default=0.0)
    ap.add_argument("--pitch", type=float, default=0.0)
    ap.add_argument("--roll", type=float, default=0.0)
    args = ap.parse_args()

    order = ["frames", "sfm", "train", "export"]
    last = order.index(args.stage)
    up_world = None

    if args.from_ply:
        stage_export(args.from_ply, args.out, None, args)
        return

    args.work.mkdir(parents=True, exist_ok=True)
    images = args.work / "images"
    stage_frames(args.video, images, args.frames, args.max_side)
    if last < 1:
        return
    undist = stage_sfm(images, args.work)
    if last < 2:
        return
    ply = stage_train(undist, args.work, args.steps, args.sh_degree, args.device)
    if last < 3:
        return
    _, _, _, _, _, _, up_world = load_colmap(undist)
    stage_export(ply, args.out, up_world, args)
    print("\nDone. Preview locally (npm run dev → /about), inspect/clean the PLY in")
    print("https://superspl.at/editor if needed, then commit public/splat/portrait.*")


if __name__ == "__main__":
    main()
