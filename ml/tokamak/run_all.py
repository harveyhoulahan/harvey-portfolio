"""
TokamakLive — overnight pipeline: generate data -> train surrogate -> eval montage.
One command, runs unattended. Each stage streams progress; a failure stops the run.

    python ml/tokamak/run_all.py                 # defaults: 4000 samples, 400 epochs
    python ml/tokamak/run_all.py --n 6000 --epochs 600

Artifacts (in ml/tokamak/ unless noted):
    data.npz                         the training set (coils+profile -> psi)
    tokamak.pt                       best checkpoint
    public/tokamak/surrogate.json    web-ready model (for the WebGPU demo)
    eval.png                         pred-vs-FreeGS montage (look at this first)
"""
import argparse, os, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
PY = sys.executable


def run(name, cmd):
    print(f"\n===== {name} =====\n>>> {' '.join(cmd)}", flush=True)
    t0 = time.time()
    r = subprocess.run(cmd, cwd=HERE)
    if r.returncode != 0:
        print(f"[FAIL] {name} exited {r.returncode}", flush=True)
        sys.exit(r.returncode)
    print(f"[done] {name} in {(time.time()-t0)/60:.1f} min", flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=4000)
    ap.add_argument("--epochs", type=int, default=400)
    ap.add_argument("--seed", type=int, default=0)
    args = ap.parse_args()

    env_py = [PY, "-u"]
    out_json = os.path.join("..", "..", "public", "tokamak", "surrogate.json")
    t0 = time.time()

    run("1/3 generate data", env_py + ["gen_data.py", "--n", str(args.n), "--seed", str(args.seed), "--out", "data.npz"])
    run("2/3 train surrogate", env_py + ["train_tokamak.py", "--data", "data.npz", "--epochs", str(args.epochs),
                                         "--amp", "--ckpt", "tokamak.pt", "--out", out_json])
    run("3/3 eval montage", env_py + ["eval_tokamak.py", "--data", "data.npz", "--json", out_json, "--n", "8", "--out", "eval.png"])

    print(f"\n[ALL DONE] total {(time.time()-t0)/60:.1f} min", flush=True)
    print("  -> ml/tokamak/eval.png            (visual check)", flush=True)
    print("  -> public/tokamak/surrogate.json  (web model, ready for the WebGPU demo)", flush=True)


if __name__ == "__main__":
    main()
