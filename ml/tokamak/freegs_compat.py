"""
FreeGS <-> modern SciPy compatibility shim (portable; no site-packages edits).

FreeGS 0.8.2's `critical.find_critical` calls `RectBivariateSpline(...)` with the
old `grid=True` default and then indexes the result `[0][0]`. SciPy >= ~1.15 changed
scalar-input return shapes, so those calls raise on modern SciPy / Python 3.14
(the only combo with 3.14 wheels). This module vendors a corrected `find_critical`
(every scalar spline eval uses `grid=False`, no `[0][0]`) and monkeypatches it in.

Usage:
    import freegs_compat; freegs_compat.apply()
    import freegs   # now safe
"""
from scipy import interpolate
import numpy as np
from numpy import zeros, dot, linspace, argmin, amax
from numpy.linalg import inv


def find_critical(R, Z, psi, discard_xpoints=True):
    """Corrected copy of freegs.critical.find_critical.

    Modern SciPy (>=~1.15) returns a 1-element array (not a Python scalar) from
    `RectBivariateSpline(scalar, scalar, grid=False)`, which breaks FreeGS's scalar
    arithmetic / `J[i,j] = ...` assignments. `sc(...)` coerces those evals to float.
    """
    f = interpolate.RectBivariateSpline(R[:, 0], Z[0, :], psi)

    def sc(*a, **k):
        k.setdefault("grid", False)
        return float(np.asarray(f(*a, **k)).reshape(-1)[0])

    Bp2 = (f(R, Z, dx=1, grid=False) ** 2 + f(R, Z, dy=1, grid=False) ** 2) / R ** 2

    dR = R[1, 0] - R[0, 0]
    dZ = Z[0, 1] - Z[0, 0]
    radius_sq = 9 * (dR ** 2 + dZ ** 2)

    J = zeros([2, 2])
    xpoint = []
    opoint = []

    nx, ny = Bp2.shape
    for i in range(2, nx - 2):
        for j in range(2, ny - 2):
            if (
                (Bp2[i, j] < Bp2[i + 1, j + 1])
                and (Bp2[i, j] < Bp2[i + 1, j])
                and (Bp2[i, j] < Bp2[i + 1, j - 1])
                and (Bp2[i, j] < Bp2[i - 1, j + 1])
                and (Bp2[i, j] < Bp2[i - 1, j])
                and (Bp2[i, j] < Bp2[i - 1, j - 1])
                and (Bp2[i, j] < Bp2[i, j + 1])
                and (Bp2[i, j] < Bp2[i, j - 1])
            ):
                R0 = R[i, j]
                Z0 = Z[i, j]
                R1 = R0
                Z1 = Z0
                count = 0
                while True:
                    Br = -sc(R1, Z1, dy=1) / R1
                    Bz = sc(R1, Z1, dx=1) / R1

                    if Br ** 2 + Bz ** 2 < 1e-6:
                        d2dr2 = (psi[i + 2, j] - 2.0 * psi[i, j] + psi[i - 2, j]) / (2.0 * dR) ** 2
                        d2dz2 = (psi[i, j + 2] - 2.0 * psi[i, j] + psi[i, j - 2]) / (2.0 * dZ) ** 2
                        d2drdz = (
                            (psi[i + 2, j + 2] - psi[i + 2, j - 2]) / (4.0 * dZ)
                            - (psi[i - 2, j + 2] - psi[i - 2, j - 2]) / (4.0 * dZ)
                        ) / (4.0 * dR)
                        D = d2dr2 * d2dz2 - d2drdz ** 2
                        if D < 0.0:
                            xpoint.append((R1, Z1, sc(R1, Z1)))
                        else:
                            opoint.append((R1, Z1, sc(R1, Z1)))
                        break

                    J[0, 0] = -Br / R1 - sc(R1, Z1, dy=1, dx=1) / R1
                    J[0, 1] = -sc(R1, Z1, dy=2) / R1
                    J[1, 0] = -Bz / R1 + sc(R1, Z1, dx=2) / R1
                    J[1, 1] = sc(R1, Z1, dx=1, dy=1) / R1

                    d = dot(inv(J), [Br, Bz])
                    R1 = R1 - d[0]
                    Z1 = Z1 - d[1]

                    count += 1
                    if ((R1 - R0) ** 2 + (Z1 - Z0) ** 2 > radius_sq) or (count > 100):
                        break

    def remove_dup(points):
        result = []
        for p in points:
            if not any((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 < 1e-5 for q in result):
                result.append(p)
        return result

    xpoint = remove_dup(xpoint)
    opoint = remove_dup(opoint)

    if len(opoint) == 0:
        print("Warning: No O points found")
        return opoint, xpoint

    Rmid = 0.5 * (R[-1, 0] + R[0, 0])
    Zmid = 0.5 * (Z[0, -1] + Z[0, 0])
    opoint.sort(key=lambda x: (x[0] - Rmid) ** 2 + (x[1] - Zmid) ** 2)

    if discard_xpoints:
        Ro, Zo, Po = opoint[0]
        xpt_keep = []
        for xpt in xpoint:
            Rx, Zx, Px = xpt
            rline = linspace(Ro, Rx, num=50)
            zline = linspace(Zo, Zx, num=50)
            pline = f(rline, zline, grid=False)
            if Px < Po:
                pline *= -1.0
            maxp = amax(pline)
            if (maxp - pline[-1]) / (maxp - pline[0]) > 0.001:
                continue
            ind = argmin(pline)
            if (rline[ind] - Ro) ** 2 + (zline[ind] - Zo) ** 2 > 1e-4:
                continue
            xpt_keep.append(xpt)
        xpoint = xpt_keep

    psi_axis = opoint[0][2]
    xpoint.sort(key=lambda x: (x[2] - psi_axis) ** 2)
    return opoint, xpoint


def apply():
    """Monkeypatch the corrected find_critical into every freegs module that uses it."""
    import freegs
    import freegs.critical as _crit
    _crit.find_critical = find_critical
    # Patch any submodule that did `from .critical import find_critical`.
    for modname in ("equilibrium", "jtor", "boundary", "control"):
        mod = getattr(freegs, modname, None)
        if mod is not None and hasattr(mod, "find_critical"):
            mod.find_critical = find_critical
