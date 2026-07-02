"""
TokamakLive dataset generator.

The surrogate learns the FORWARD control map that the demo needs:
    inputs  = [coil currents, Ip, paxis]  ->  output = psi(R,Z) flux field.

Naively perturbing coil currents and forward-solving mostly fails to confine a
plasma (~11% yield). Instead we SAMPLE PLASMA SHAPES (X-point position, minor
radius, Ip, paxis) and let FreeGS's inverse solver find the coil currents that
produce them. Every solve is a valid diverted equilibrium (~100% yield), and the
SOLVED coil currents become the surrogate's inputs — a realistic manifold of
(coils -> psi) pairs, exactly what the demo's coil sliders explore.

Run:  python ml/tokamak/gen_data.py --n 4000 --out data.npz
"""
import argparse, time, sys, warnings
import numpy as np
import freegs_compat; freegs_compat.apply()
import freegs

NX = NY = 65
RMIN, RMAX, ZMIN, ZMAX = 0.1, 2.0, -1.0, 1.0


def nominal_coils():
    """Shape-constrained solve -> a realistic diverted coil configuration."""
    tok = freegs.machine.TestTokamak()
    eq = freegs.Equilibrium(tokamak=tok, Rmin=RMIN, Rmax=RMAX, Zmin=ZMIN, Zmax=ZMAX,
                            nx=NX, ny=NY, boundary=freegs.boundary.freeBoundaryHagenow)
    profiles = freegs.jtor.ConstrainPaxisIp(eq, 1e3, 2e5, 2.0)
    xpoints = [(1.1, -0.6), (1.1, 0.8)]
    isoflux = [(1.1, -0.6, 1.1, 0.6)]
    freegs.solve(eq, profiles, freegs.control.constrain(xpoints=xpoints, isoflux=isoflux))
    labels = [lab for lab, _ in tok.coils]
    I0 = np.array([coil.current for _, coil in tok.coils], float)
    return labels, I0


def shape_solve(labels, Rx, Zx, Rin, Rout, Ip, paxis, fvac=2.0):
    """Inverse (shape-constrained) solve: FreeGS finds coil currents that put a
    single lower X-point at (Rx,Zx) and pass the separatrix through the inner/outer
    midplane points (Rin,0) and (Rout,0). Returns (eq, solved coil-current vector)."""
    tok = freegs.machine.TestTokamak()
    eq = freegs.Equilibrium(tokamak=tok, Rmin=RMIN, Rmax=RMAX, Zmin=ZMIN, Zmax=ZMAX,
                            nx=NX, ny=NY, boundary=freegs.boundary.freeBoundaryHagenow)
    profiles = freegs.jtor.ConstrainPaxisIp(eq, paxis, Ip, fvac)
    xpoints = [(Rx, Zx)]
    isoflux = [(Rx, Zx, Rout, 0.0), (Rx, Zx, Rin, 0.0), (Rx, Zx, Rx, -Zx)]
    freegs.solve(eq, profiles, freegs.control.constrain(xpoints=xpoints, isoflux=isoflux))
    I = np.array([coil.current for _, coil in tok.coils], float)
    return eq, I


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=4000)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--out", default="data.npz")
    args = ap.parse_args()
    rng = np.random.default_rng(args.seed)

    labels, I0 = nominal_coils()
    print(f"nominal coils {labels}\n  I0 = {np.round(I0).astype(int)}", flush=True)

    X, Psi, meta = [], [], []
    t0 = time.time(); tried = 0
    while len(X) < args.n:
        tried += 1
        Rx = rng.uniform(1.00, 1.25)      # lower X-point radius
        Zx = rng.uniform(-0.75, -0.50)    # lower X-point height (single-null divertor)
        Rout = rng.uniform(1.35, 1.55)    # outer-midplane separatrix
        Rin = rng.uniform(0.30, 0.55)     # inner-midplane separatrix
        Ip = rng.uniform(1.3e5, 2.6e5)    # plasma current
        paxis = rng.uniform(7e2, 1.5e3)   # pressure on axis
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                eq, I = shape_solve(labels, Rx, Zx, Rin, Rout, Ip, paxis)
            psi = eq.psi().astype(np.float32)
            axis, bnd = eq.psi_axis, eq.psi_bndry
            if not (np.isfinite(axis) and np.isfinite(bnd) and abs(axis - bnd) > 1e-3):
                continue
            if not np.all(np.isfinite(I)):
                continue
        except Exception:
            continue
        X.append(np.concatenate([I, [Ip, paxis]]).astype(np.float32))
        Psi.append(psi)
        meta.append([axis, bnd, Rx, Zx, Rin, Rout])
        if len(X) % max(1, args.n // 40) == 0:
            rate = len(X) / (time.time() - t0)
            eta = (args.n - len(X)) / max(rate, 1e-6)
            print(f"  {len(X)}/{args.n}  yield={len(X)/tried:.0%}  {rate:.2f}/s  ETA {eta/60:.0f}m", flush=True)

    X = np.stack(X); Psi = np.stack(Psi); meta = np.array(meta, np.float32)
    np.savez_compressed(args.out, X=X, psi=Psi, meta=meta, labels=np.array(labels),
                        I0=I0.astype(np.float32),
                        grid=np.array([NX, NY, RMIN, RMAX, ZMIN, ZMAX], np.float32))
    print(f"[OK] wrote {args.out}  X{X.shape}  psi{Psi.shape}  "
          f"yield={len(X)/tried:.0%}  {time.time()-t0:.0f}s", flush=True)


if __name__ == "__main__":
    main()
