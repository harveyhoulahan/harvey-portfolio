import time, sys, numpy as np, matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import freegs_compat; freegs_compat.apply()
import freegs

t0 = time.time()
tokamak = freegs.machine.TestTokamak()
eq = freegs.Equilibrium(tokamak=tokamak, Rmin=0.1, Rmax=2.0, Zmin=-1.0, Zmax=1.0,
                        nx=65, ny=65, boundary=freegs.boundary.freeBoundaryHagenow)
profiles = freegs.jtor.ConstrainPaxisIp(eq, 1e3, 2e5, 2.0)
xpoints = [(1.1, -0.6), (1.1, 0.8)]
isoflux = [(1.1, -0.6, 1.1, 0.6)]
freegs.solve(eq, profiles, freegs.control.constrain(xpoints=xpoints, isoflux=isoflux))
dt = time.time() - t0

psi = eq.psi()
print(f"[OK] solved in {dt:.2f}s  psi {psi.shape}  range[{psi.min():.3f},{psi.max():.3f}]  psi_axis={eq.psi_axis:.3f} psi_bndry={eq.psi_bndry:.3f}")
for label, coil in tokamak.coils:
    print(f"   coil {label}: {coil.current:9.1f} A")

R, Z = eq.R, eq.Z
fig, ax = plt.subplots(figsize=(5, 7))
ax.contourf(R, Z, psi, 50, cmap="plasma")
ax.contour(R, Z, psi, 30, colors="white", linewidths=0.3, alpha=0.6)
ax.contour(R, Z, psi, levels=[eq.psi_bndry], colors="cyan", linewidths=2.0)
ax.set_aspect("equal"); ax.set_xlabel("R (m)"); ax.set_ylabel("Z (m)")
ax.set_title(f"FreeGS Grad-Shafranov equilibrium\n{dt:.2f}s  cyan = last closed flux surface")
plt.savefig("_equilibrium.png", dpi=95, bbox_inches="tight")
print("wrote ml/tokamak/_equilibrium.png")
