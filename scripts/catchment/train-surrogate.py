#!/usr/bin/env python3
"""
Train the first Catchment neural surrogate and export ONNX.

Usage:
  python3 scripts/catchment/train-surrogate.py \
    --data .cache/catchment/teacher-rollouts.jsonl \
    --out public/catchment/surrogate.onnx

This script intentionally keeps the model small enough for browser inference.
It predicts the next state channels from current state + broadcast forcings.
The live demo only unlocks neural mode when the exported ONNX artifact exists.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

try:
    import torch
    from torch import nn
    from torch.utils.data import DataLoader, Dataset
except ImportError as exc:  # pragma: no cover - friendly CLI error
    raise SystemExit(
        "PyTorch is required for training. Install it in your local Python env first:\n"
        "  python3 -m pip install torch onnx\n"
    ) from exc


STATE_CHANNELS = ("bed", "water", "sediment", "fuel", "fire", "char")
FORCING_CHANNELS = ("rain", "windX", "windZ", "windSpeed")


class CatchmentPairs(Dataset):
    def __init__(self, path: Path):
        self.samples = []
        with path.open("r", encoding="utf8") as fh:
            for line in fh:
                if line.strip():
                    self.samples.append(json.loads(line))
        if not self.samples:
            raise ValueError(f"no samples found in {path}")
        self.n = int(self.samples[0]["grid"]["n"])

    def __len__(self) -> int:
        return len(self.samples)

    def _tensor(self, state: dict) -> torch.Tensor:
        chans = []
        for name in STATE_CHANNELS:
            chans.append(torch.tensor(state[name], dtype=torch.float32).view(self.n, self.n))
        forcings = state["forcings"]
        for name in FORCING_CHANNELS:
            chans.append(torch.full((self.n, self.n), float(forcings[name]), dtype=torch.float32))
        return torch.stack(chans, dim=0)

    def _target(self, state: dict) -> torch.Tensor:
        chans = []
        for name in STATE_CHANNELS:
            chans.append(torch.tensor(state[name], dtype=torch.float32).view(self.n, self.n))
        return torch.stack(chans, dim=0)

    def __getitem__(self, idx: int):
        item = self.samples[idx]
        return self._tensor(item["input"]), self._target(item["target"])


class ResidualBlock(nn.Module):
    def __init__(self, channels: int):
        super().__init__()
        self.net = nn.Sequential(
            nn.Conv2d(channels, channels, 3, padding=1),
            nn.GELU(),
            nn.Conv2d(channels, channels, 3, padding=1),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return x + self.net(x)


class CatchmentSurrogate(nn.Module):
    def __init__(self, in_channels: int, out_channels: int, width: int = 48):
        super().__init__()
        self.stem = nn.Sequential(nn.Conv2d(in_channels, width, 3, padding=1), nn.GELU())
        self.body = nn.Sequential(ResidualBlock(width), ResidualBlock(width), ResidualBlock(width))
        self.head = nn.Conv2d(width, out_channels, 1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.head(self.body(self.stem(x)))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", default=".cache/catchment/teacher-rollouts.jsonl")
    parser.add_argument("--out", default="public/catchment/surrogate.onnx")
    parser.add_argument("--epochs", type=int, default=8)
    parser.add_argument("--batch", type=int, default=16)
    parser.add_argument("--lr", type=float, default=2e-3)
    args = parser.parse_args()

    data = CatchmentPairs(Path(args.data))
    loader = DataLoader(data, batch_size=args.batch, shuffle=True, drop_last=False)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = CatchmentSurrogate(len(STATE_CHANNELS) + len(FORCING_CHANNELS), len(STATE_CHANNELS)).to(device)
    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)
    loss_fn = nn.SmoothL1Loss()

    model.train()
    for epoch in range(args.epochs):
        total = 0.0
        for x, y in loader:
            x = x.to(device)
            y = y.to(device)
            pred = model(x)
            loss = loss_fn(pred, y)
            opt.zero_grad(set_to_none=True)
            loss.backward()
            opt.step()
            total += float(loss.detach().cpu()) * x.shape[0]
        print(f"epoch {epoch + 1:02d} loss={total / len(data):.6f}")

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    model.eval()
    dummy = torch.zeros(1, len(STATE_CHANNELS) + len(FORCING_CHANNELS), data.n, data.n, device=device)
    torch.onnx.export(
        model,
        dummy,
        out,
        input_names=["state_forcings"],
        output_names=["next_state"],
        dynamic_axes={"state_forcings": {0: "batch"}, "next_state": {0: "batch"}},
        opset_version=17,
    )
    print(f"exported {out}")


if __name__ == "__main__":
    main()
