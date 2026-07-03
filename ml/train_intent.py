"""Catchment terminal — intent model trainer.

Trains the tiny natural-language head for the Catchment terminal: a hashed
bag-of-features (word + char-trigram + word-bigram, FNV-1a into BUCKETS) into
a one-hidden-layer MLP, softmax over ~30 intents. Pure numpy, no torch — the
whole model is ~100 KB quantised and runs in lib/catchment/intent.ts as two
matvecs, no runtime, no ONNX, no server.

The featuriser here MUST mirror lib/catchment/intent.ts byte-for-byte. To make
drift impossible to ship, the export embeds parity probes (phrases classified
with the exact quantised weights); the TS decoder re-runs them at load and
refuses the model on any mismatch.

Usage:  python ml/train_intent.py
Writes: public/catchment/intent.json
"""

from __future__ import annotations

import json
import random
import re
from pathlib import Path

import numpy as np

SEED = 7
BUCKETS = 512
HIDDEN = 48
EPOCHS = 90
BATCH = 256
LR = 3e-3
WEIGHT_DECAY = 1e-4
LABEL_SMOOTH = 0.03
INPUT_DROPOUT = 0.15
PER_CLASS_CAP = 700
THRESHOLD = 0.55

OUT_PATH = Path(__file__).resolve().parent.parent / "public" / "catchment" / "intent.json"

# ---------------------------------------------------------------- featuriser
# Mirrors tokenize()/featurize() in lib/catchment/intent.ts exactly.

def fnv1a(s: str) -> int:
    h = 0x811C9DC5
    for b in s.encode("utf-8"):
        h ^= b
        h = (h * 0x01000193) & 0xFFFFFFFF
    return h


def tokenize(text: str) -> list[str]:
    s = text.lower()
    s = re.sub(r"\d+(?:\.\d+)?", " # ", s)
    s = re.sub(r"[^a-z#]+", " ", s)
    return s.split()


def featurize(text: str, buckets: int = BUCKETS) -> dict[int, float]:
    toks = tokenize(text)
    acc: dict[int, float] = {}

    def bump(feat: str) -> None:
        k = fnv1a(feat) % buckets
        acc[k] = acc.get(k, 0.0) + 1.0

    for t in toks:
        bump("W:" + t)
        if t != "#":
            padded = "^" + t + "$"
            for i in range(len(padded) - 2):
                bump("T:" + padded[i : i + 3])
    for i in range(len(toks) - 1):
        bump("B:" + toks[i] + "_" + toks[i + 1])
    norm = np.sqrt(sum(v * v for v in acc.values())) or 1.0
    return {k: v / norm for k, v in acc.items()}


# ------------------------------------------------------------- phrase banks
# Base phrasings per intent. Composition with prefixes/suffixes and typo
# augmentation happens below; keep these focused on *distinct wordings*.

BANKS: dict[str, list[str]] = {
    "none": [
        "hello", "hi", "hey there", "gday", "good morning", "thanks", "thank you",
        "cheers", "lol", "haha", "nice", "cool", "wow", "amazing", "who are you",
        "who made this", "what is your name", "are you alive", "tell me a joke",
        "sing a song", "open google", "google it", "play music", "what time is it",
        "weather forecast for tomorrow", "email harvey", "hire harvey",
        "how old are you", "meaning of life", "asdf", "qwerty", "foo bar",
        "lorem ipsum", "blah blah", "random words here", "the quick brown fox",
        "i like turtles", "banana", "potato", "hello world", "test", "testing",
        "do a barrel roll", "exit", "quit", "close", "save", "screenshot",
        "zoom in", "zoom out", "undo", "redo", "copy", "paste", "print",
        "download", "fullscreen", "night mode", "dark mode", "louder", "mute",
        "volume up", "next song", "go back", "scroll down", "new tab",
    ],
    "help": [
        "help", "help me", "what can i do", "what can you do", "what do i type",
        "commands", "list commands", "show commands", "instructions",
        "how does this work", "how do i use this", "what is this", "options",
        "what are my options", "manual", "docs", "usage", "what can i say",
        "how do i control this", "im lost", "i dont know what to do",
        "show me what you can do", "what commands are there",
    ],
    "controls": [
        "controls", "control panel", "show the controls", "open the controls",
        "open controls", "show sliders", "sliders", "give me sliders",
        "open the panel", "show the panel", "panel", "old controls",
        "simple controls", "gui", "show gui", "buttons", "i want buttons",
        "clicky controls", "the panel please", "bring back the sliders",
    ],
    "reset": [
        "reset", "reset it", "reset everything", "start over", "start again",
        "fresh start", "restore the terrain", "undo everything", "clean slate",
        "reset the world", "reset the map", "put it back", "restore it",
        "begin again", "wipe it", "reset the sim", "restart the simulation",
        "restart", "fix the terrain", "heal the terrain", "undo the damage",
    ],
    "status": [
        "status", "state", "current settings", "show settings",
        "what are the settings", "current values", "show status",
        "how are things", "whats running", "diagnostics", "readout", "report",
        "sitrep", "tell me the settings", "what mode am i in", "where am i",
        "what world is this", "whats the rain at", "what are the values",
    ],
    "rain.up": [
        "more rain", "rain harder", "heavier rain", "increase rain",
        "increase the rain", "turn up the rain", "crank the rain",
        "crank up the rain", "let it pour", "make it pour", "bucket down",
        "bucketing down", "more rainfall", "increase rainfall",
        "heavier rainfall", "wetter", "make it wetter", "i want rain",
        "start the rain", "bring the rain", "rain more", "add rain",
        "add more rain", "more precipitation", "increase precipitation",
        "heavy rain", "torrential rain", "really heavy rain", "drench it",
        "drench the place", "soak it", "soak the hills", "let it rain",
        "make it rain", "set rain to #", "rain at #", "rain to # percent",
        "put rain at #", "raise rain to #", "more drizzle please",
        "turn the rain up", "absolutely bucketing", "pouring rain",
    ],
    "rain.down": [
        "less rain", "lighter rain", "ease the rain", "ease off the rain",
        "turn down the rain", "decrease rain", "reduce rain", "reduce the rain",
        "lower the rain", "less rainfall", "reduce rainfall", "drier",
        "make it drier", "calm the rain", "gentle rain", "just a drizzle",
        "light drizzle", "only a drizzle", "back off the rain",
        "drop rain to #", "cut the rain back", "not so much rain",
        "too much rain", "less wet", "tone down the rain", "soften the rain",
    ],
    "rain.stop": [
        "stop the rain", "no rain", "no more rain", "kill the rain",
        "turn off the rain", "rain off", "stop raining", "make it stop raining",
        "cut the rain", "end the rain", "zero rain", "turn the rain off",
        "shut off the rain", "cancel the rain", "enough rain",
    ],
    "storm.up": [
        "storm", "make it storm", "make it stormy", "stormy", "more storm",
        "bring a storm", "summon a storm", "storm time", "big storm",
        "huge storm", "thunderstorm", "i want a thunderstorm",
        "thunder and lightning", "lightning", "give me lightning",
        "more lightning", "cyclone", "hurricane", "tempest", "whip up a storm",
        "brew a storm", "storm cell", "crank the storm", "turn up the storm",
        "max the storm", "storm to #", "set storm to #", "stormier",
        "wild weather", "bad weather", "angry sky", "angry weather",
        "unleash the storm", "severe weather", "a proper storm",
    ],
    "storm.down": [
        "less storm", "calm the storm", "ease the storm", "smaller storm",
        "weaker storm", "turn down the storm", "reduce the storm",
        "settle the storm", "less stormy", "milder weather", "calmer weather",
        "tone down the storm", "soften the storm", "storm down a bit",
    ],
    "storm.stop": [
        "stop the storm", "no storm", "kill the storm", "storm off",
        "end the storm", "no more storm", "steady rain instead",
        "back to steady rain", "turn off the storm", "disperse the storm",
        "cancel the storm", "break up the storm", "enough storm",
    ],
    "erosion.up": [
        "more erosion", "erode faster", "increase erosion", "crank erosion",
        "stronger erosion", "carve deeper", "carve harder",
        "cut deeper channels", "deeper channels", "more carving", "dig deeper",
        "aggressive erosion", "erosion up", "set erosion to #", "erosion at #",
        "make the water carve", "let the water carve harder",
        "wear it down faster", "erode the hills faster", "sharper valleys",
    ],
    "erosion.down": [
        "less erosion", "erode slower", "softer erosion", "gentle erosion",
        "reduce erosion", "erosion down", "harder rock", "tougher bedrock",
        "slow the erosion", "less carving", "stop carving so much",
        "preserve the terrain", "protect the terrain", "erode gently",
    ],
    "wind.up": [
        "more wind", "windier", "stronger wind", "crank the wind",
        "turn up the wind", "increase wind", "strong wind", "gale",
        "gale force", "howling wind", "howling gale", "big gusts", "gusty",
        "blustery", "wind to #", "set wind to #", "wind speed #",
        "faster wind", "let it blow", "blow harder", "windy", "make it windy",
        "really windy", "wind it up", "more of a breeze",
    ],
    "wind.down": [
        "less wind", "weaker wind", "calm the wind", "gentler wind",
        "turn down the wind", "reduce wind", "light breeze", "just a breeze",
        "soft breeze", "slow the wind", "not so windy", "ease the wind",
        "quieter wind", "settle the wind", "gentle breeze please",
        "too windy", "way too windy", "far too windy", "ease off the wind",
        "back off the wind", "wind back a bit", "take the edge off the wind",
        "windy enough already", "less gusty",
    ],
    "wind.stop": [
        "no wind", "stop the wind", "kill the wind", "wind off", "still air",
        "dead calm", "becalmed", "zero wind", "turn off the wind",
        "drop the wind", "cut the wind", "windless",
    ],
    "wind.dir": [
        "wind from the west", "wind from the north", "wind from the east",
        "wind from the south", "northerly wind", "southerly wind",
        "westerly wind", "easterly wind", "a northerly", "a southerly",
        "change the wind direction", "wind direction",
        "turn the wind around", "reverse the wind", "swing the wind",
        "swing the wind around", "wind direction #", "wind from #",
        "make the wind come from the north",
        "make the wind blow from the south", "wind out of the west",
        "north wind", "south wind", "east wind", "west wind",
        "blow from the north", "the wind should come from the east",
        "rotate the wind", "shift the wind", "wind from the southwest",
        "wind from the northeast",
    ],
    "sun.move": [
        "move the sun", "rotate the sun", "swing the sun",
        "sun from the west", "sun from the east", "evening light",
        "morning light", "golden hour", "sunset light", "sunrise", "sunset",
        "noon sun", "midday sun", "low sun", "change the light",
        "different light", "shift the light", "light from the east",
        "sun to #", "set sun to #", "sun at # degrees",
        "put the sun behind the ridge", "afternoon light", "dawn", "dusk",
        "change the lighting", "better lighting", "dramatic lighting",
    ],
    "relief.up": [
        "more relief", "exaggerate the terrain", "taller mountains",
        "higher mountains", "steeper terrain", "stretch the terrain",
        "more vertical exaggeration", "exaggerate the height",
        "dramatic terrain", "dramatise the terrain", "pump up the mountains",
        "raise the mountains", "make the hills taller", "more dramatic hills",
        "relief to #", "set relief to #", "bigger mountains", "taller hills",
    ],
    "relief.down": [
        "less relief", "flatter", "flatten it", "flatten the terrain",
        "lower the mountains", "subtle terrain", "less exaggeration",
        "reduce the relief", "squash the terrain", "gentler hills",
        "make it flatter", "true scale", "realistic heights",
        "realistic scale", "flatten everything", "less dramatic terrain",
    ],
    "mode.orbit": [
        "orbit", "orbit mode", "back to orbit", "just orbit", "camera mode",
        "let me look around", "look around", "stop pouring", "stop igniting",
        "put the tools away", "normal mode", "default mode", "inspect mode",
        "view mode", "just looking", "done with meteors", "hands off",
        "turn off meteors", "meteors off", "disable meteors",
        "no more meteors", "switch off meteor mode", "stop the meteors",
        "back to camera", "let me spin the view",
    ],
    "mode.pour": [
        "pour", "pour mode", "pour water", "let me pour", "let me pour water",
        "water brush", "add water", "dump water", "pour water on the terrain",
        "hose it", "hose it down", "let me add water", "water tool",
        "give me the hose", "flood a valley by hand", "pour on the hills",
        "manual water", "paint water",
    ],
    "mode.ignite": [
        "ignite", "fire", "start a fire", "light a fire", "set a fire",
        "burn", "burn it", "let me burn", "fire mode", "ignite mode",
        "arson time", "light it up", "set the hills on fire", "torch it",
        "torch the hills", "flamethrower", "let me start fires",
        "burn something", "fire tool", "set fire to it", "bushfire",
        "start a bushfire", "let me light fires", "burn the forest",
    ],
    "mode.meteor": [
        "meteor", "meteors", "meteor mode", "meteor time", "chuck a meteor",
        "throw a meteor", "drop a meteor", "launch a meteor", "meteor strike",
        "asteroid", "asteroids", "drop an asteroid", "asteroid strike",
        "give me meteors", "let me throw rocks", "throw rocks from space",
        "space rocks", "rain meteors", "impact time", "crater time",
        "make craters", "nuke it from orbit", "meteor shower",
        "enable meteors", "turn on meteors", "meteors on",
        "meteor mode for # s", "meteors for # minutes",
        "meteor for # seconds", "chuck a meteor at it", "throw a big rock",
        "hit it with an asteroid", "smash it with a meteor",
    ],
    "neural.on": [
        "neural", "neural on", "neural mode", "go neural", "switch to neural",
        "turn on the neural", "use the network", "use the neural network",
        "let the network drive", "student mode", "run the surrogate",
        "surrogate on", "use the surrogate", "ai water",
        "let the ai run the water", "neural water", "turn on the model",
        "use the model", "switch to the student", "ml mode",
        "machine learning mode", "run the neural net",
    ],
    "neural.off": [
        "neural off", "physics", "physics mode", "back to physics",
        "turn off the neural", "real physics", "use the solver",
        "teacher mode", "switch to physics", "turn off the model",
        "disable the surrogate", "stop the network", "proper physics please",
        "physics only", "solver mode", "turn the ai off",
    ],
    "scene.calm": [
        "calm", "calm it down", "calm everything down", "settle down",
        "settle everything", "peaceful", "make it peaceful", "serene",
        "tranquil", "chill", "chill it out", "relax the weather",
        "gentle weather", "nice and calm", "calm weather",
        "everything gentle", "tone it all down", "quiet weather",
        "take it easy", "soothing", "make it nice", "calm conditions",
    ],
    "scene.apocalypse": [
        "apocalypse", "armageddon", "end times", "end of the world",
        "doomsday", "chaos", "total chaos", "unleash chaos",
        "everything at once", "max everything", "crank everything",
        "all hell", "let all hell break loose", "destroy it",
        "destroy everything", "wreck it", "wreck the place", "annihilate it",
        "go nuts", "go wild", "maximum drama", "full send", "send it",
        "worst storm ever plus meteors", "biblical weather", "the works",
        "give it everything", "maximum chaos", "unleash everything",
    ],
    "scene.flood": [
        "flood", "flood it", "flood everything", "flood the valleys",
        "big flood", "massive flood", "biblical flood", "deluge",
        "inundate it", "fill the rivers", "overflow the rivers",
        "flood the plains", "drown it", "drown the valleys",
        "water everywhere", "fill it with water", "great flood",
        "flash flood", "flood the whole place", "submerge the lowlands",
    ],
    "scene.drought": [
        "drought", "a drought", "dry it out", "bone dry", "make it arid",
        "arid", "desert conditions", "dry season", "no water",
        "get rid of the water", "clear skies", "blue skies", "sunny",
        "sunny day", "sunshine", "nice day", "beautiful day", "clear weather",
        "fair weather", "dry spell", "let it dry out", "evaporate everything",
        "make it a desert", "dry everything up",
    ],
    "map.list": [
        "worlds", "list worlds", "show worlds", "what worlds are there",
        "what maps are there", "list maps", "show me the maps",
        "other worlds", "other maps", "more worlds", "different world",
        "different map", "change the map", "change the world",
        "another world", "another map", "where can i go",
        "what terrains are there", "list terrains", "show terrains",
        "switch worlds", "new map", "new world", "somewhere else",
        "take me somewhere else", "what other maps do you have",
    ],
}

PREFIXES = [
    "", "please ", "can you ", "could you ", "can we ", "hey ", "yo ", "ok ",
    "now ", "i want ", "i wanna ", "id like ", "lets ", "make it ",
    "give me ", "gimme ", "how about ", "time for ", "right ",
]
SUFFIXES = [
    "", " please", " now", " a bit", " a little", " a lot", " heaps",
    " mate", " for me", " thanks", " already", " will you",
]


def typo(s: str, rng: random.Random) -> str:
    """One realistic keyboard slip: swap, drop, or double a character."""
    if len(s) < 5:
        return s
    i = rng.randrange(1, len(s) - 2)
    op = rng.random()
    if op < 0.34:
        return s[:i] + s[i + 1] + s[i] + s[i + 2:]
    if op < 0.67:
        return s[:i] + s[i + 1:]
    return s[:i] + s[i] + s[i:]


def build_dataset(rng: random.Random) -> tuple[list[str], list[int], list[str]]:
    intents = sorted(BANKS.keys())
    idx = {name: i for i, name in enumerate(intents)}
    texts: list[str] = []
    labels: list[int] = []
    for intent, bank in BANKS.items():
        seen: set[str] = set()
        samples: list[str] = []
        # every base phrase, verbatim
        for base in bank:
            if base not in seen:
                seen.add(base)
                samples.append(base)
        # composed variants until the cap
        attempts = 0
        while len(samples) < PER_CLASS_CAP and attempts < PER_CLASS_CAP * 30:
            attempts += 1
            base = rng.choice(bank)
            s = rng.choice(PREFIXES) + base + rng.choice(SUFFIXES)
            if rng.random() < 0.30:
                s = typo(s, rng)
            if s not in seen:
                seen.add(s)
                samples.append(s)
        texts.extend(samples)
        labels.extend([idx[intent]] * len(samples))
    # pure letter soup lands in `none`
    for _ in range(120):
        n = rng.randrange(3, 12)
        soup = "".join(rng.choice("abcdefghijklmnopqrstuvwxyz    ") for _ in range(n)).strip()
        if soup:
            texts.append(soup)
            labels.append(idx["none"])
    return texts, labels, intents


# ------------------------------------------------------------------ training

def to_dense(texts: list[str]) -> np.ndarray:
    X = np.zeros((len(texts), BUCKETS), dtype=np.float32)
    for i, t in enumerate(texts):
        for k, v in featurize(t).items():
            X[i, k] += v
    return X


def train(X: np.ndarray, y: np.ndarray, C: int, rng: np.random.Generator):
    N = len(y)
    W1 = (rng.standard_normal((BUCKETS, HIDDEN)) * np.sqrt(2.0 / BUCKETS)).astype(np.float64)
    b1 = np.zeros(HIDDEN)
    W2 = (rng.standard_normal((HIDDEN, C)) * np.sqrt(2.0 / HIDDEN)).astype(np.float64)
    b2 = np.zeros(C)
    params = [W1, b1, W2, b2]
    m = [np.zeros_like(p) for p in params]
    v = [np.zeros_like(p) for p in params]
    t = 0
    Y = np.full((N, C), LABEL_SMOOTH / (C - 1))
    Y[np.arange(N), y] = 1.0 - LABEL_SMOOTH

    for epoch in range(EPOCHS):
        order = rng.permutation(N)
        lr = LR * 0.5 * (1 + np.cos(np.pi * epoch / EPOCHS))
        for s in range(0, N, BATCH):
            bi = order[s : s + BATCH]
            xb = X[bi].astype(np.float64)
            if INPUT_DROPOUT > 0:
                xb = xb * (rng.random(xb.shape) >= INPUT_DROPOUT) / (1 - INPUT_DROPOUT)
            yb = Y[bi]
            h_pre = xb @ W1 + b1
            h = np.maximum(h_pre, 0)
            logits = h @ W2 + b2
            logits -= logits.max(axis=1, keepdims=True)
            e = np.exp(logits)
            p = e / e.sum(axis=1, keepdims=True)
            g_logits = (p - yb) / len(bi)
            gW2 = h.T @ g_logits + WEIGHT_DECAY * W2
            gb2 = g_logits.sum(axis=0)
            g_h = (g_logits @ W2.T) * (h_pre > 0)
            gW1 = xb.T @ g_h + WEIGHT_DECAY * W1
            gb1 = g_h.sum(axis=0)
            t += 1
            for p_, g_, m_, v_ in zip(params, [gW1, gb1, gW2, gb2], m, v):
                m_ += (1 - 0.9) * (g_ - m_)
                v_ += (1 - 0.999) * (g_ * g_ - v_)
                mhat = m_ / (1 - 0.9**t)
                vhat = v_ / (1 - 0.999**t)
                p_ -= lr * mhat / (np.sqrt(vhat) + 1e-8)
    return W1, b1, W2, b2


def evaluate(X, y, W1, b1, W2, b2) -> float:
    h = np.maximum(X.astype(np.float64) @ W1 + b1, 0)
    logits = h @ W2 + b2
    return float((logits.argmax(axis=1) == y).mean())


def quantize(W: np.ndarray, bits: int) -> tuple[np.ndarray, float]:
    lim = 2 ** (bits - 1) - 1
    s = float(np.abs(W).max()) / lim or 1.0
    return np.clip(np.round(W / s), -lim, lim).astype(np.int32), s


def main() -> None:
    rng_py = random.Random(SEED)
    rng_np = np.random.default_rng(SEED)

    texts, labels, intents = build_dataset(rng_py)
    y = np.array(labels)
    X = to_dense(texts)
    C = len(intents)
    print(f"dataset: {len(texts)} phrases · {C} intents · {BUCKETS} buckets · hidden {HIDDEN}")

    order = rng_np.permutation(len(y))
    n_val = max(1, len(y) // 10)
    val_i, tr_i = order[:n_val], order[n_val:]

    W1, b1, W2, b2 = train(X[tr_i], y[tr_i], C, rng_np)
    acc_tr = evaluate(X[tr_i], y[tr_i], W1, b1, W2, b2)
    acc_va = evaluate(X[val_i], y[val_i], W1, b1, W2, b2)
    print(f"float:  train {acc_tr:.4f} · val {acc_va:.4f}")

    for bits in (8, 16):
        q1, s1 = quantize(W1, bits)
        q2, s2 = quantize(W2, bits)
        dW1, dW2 = q1 * s1, q2 * s2
        acc_q = evaluate(X[val_i], y[val_i], dW1, b1, dW2, b2)
        print(f"int{bits}:   val {acc_q:.4f}")
        if acc_q >= acc_va - 0.005:
            break

    def predict(text: str) -> tuple[str, float]:
        x = np.zeros(BUCKETS)
        for k, v in featurize(text).items():
            x[k] += v
        h = np.maximum(x @ dW1 + b1, 0)
        logits = h @ dW2 + b2
        logits -= logits.max()
        e = np.exp(logits)
        p = e / e.sum()
        c = int(p.argmax())
        return intents[c], float(p[c])

    parity_texts = [
        "make it storm",
        "chuck a meteor at it",
        "more rain please",
        "calm everything down",
        "flatten the terrain",
        "let the network drive",
        "flood the valleys",
        "what can i do",
        "hello there",
        "make the wind come from the north",
    ]
    parity = []
    for txt in parity_texts:
        intent, conf = predict(txt)
        parity.append({"text": txt, "intent": intent, "conf": round(conf, 6)})
        print(f'probe: "{txt}" -> {intent} @ {conf:.3f}')

    out = {
        "kind": "catchment-intent-v1",
        "version": 1,
        "buckets": BUCKETS,
        "hidden": HIDDEN,
        "intents": intents,
        "w1": q1.flatten().tolist(),
        "b1": [round(float(x), 6) for x in b1],
        "w2": q2.flatten().tolist(),
        "b2": [round(float(x), 6) for x in b2],
        "s1": s1,
        "s2": s2,
        "threshold": THRESHOLD,
        "parity": parity,
    }
    OUT_PATH.write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
    kb = OUT_PATH.stat().st_size / 1024
    print(f"wrote {OUT_PATH.name}: {kb:.0f} KB")


if __name__ == "__main__":
    main()
