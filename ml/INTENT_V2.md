# Site intent model — v2

The natural-language head for the site shell (`/` anywhere on the site).
v1 (`train_intent.py` → `public/catchment/intent.json`) understands Catchment
sim commands; v2 (`train_site_intent_v2.py` → `public/catchment/intent-v2.json`)
is a superset: navigation, Harvey actions, portfolio FAQ, small talk, jokes,
easter eggs, and every v1 sim intent so "chuck a meteor" still hands off to
`/catchment`. **Catchment itself stays on v1** — its grammar path and artefact
are untouched; only `components/SiteTerminal.tsx` consumes v2.

## Architecture

Same recipe as v1, scaled: FNV-1a-hashed word unigrams + padded char trigrams
+ word bigrams, L2-normalised, into a one-hidden-layer relu MLP with softmax.
Pure numpy training, no torch. The featuriser is **imported from
`train_intent.py`** — one implementation feeding both trainers, and it must
keep mirroring `lib/catchment/intent.ts` byte-for-byte (the parity probes
embedded in the export enforce this; the TS decoder refuses the model on any
mismatch, in the browser and in CI via `npm run site:intent-verify`).

| Tier | Buckets | Hidden | Classes | Artefact | How |
|------|---------|--------|---------|----------|-----|
| v1 (current, Catchment) | 512 | 48 | 31 | ~84 KB | `npm run catchment:intent` |
| **v2-default (shipped)** | 1024 | 128 | 81 | ~188 KB | `npm run site:intent` |
| v2-stretch | 2048 | 192 | 81 | ~560 KB | `python ml/train_site_intent_v2.py --stretch` |

v2 packs weights as **base64 little-endian int8** (int16 fallback if the
quantised val accuracy drops >0.5 pt), which is why 4× the parameters cost
only ~2× the bytes. The decoder (`decodeIntentModel` in
`lib/catchment/intent.ts`) accepts both kinds: `catchment-intent-v1` (plain
JSON int arrays) and `site-intent-v2` (base64).

### Flat softmax, not hierarchical — why

The brief allowed a two-stage router (coarse group → fine intent). Measured
result at 1024×128 flat: **0.985 val (int8), 50/50 on the manual phrase
script, zero confusions on all dangerous pairs** (joke↔help, hire↔email,
faq.catchment↔nav.catchment, …). Hierarchy would add a second threshold, a
second parity gate, and double decode complexity to fix a problem that
doesn't exist at this class count. If the taxonomy ever grows past ~150
intents or per-group accuracy sags, revisit; stage-1 groups fall straight
out of the intent-name prefixes.

## Taxonomy (81 intents)

- `nav.*` (14) — one per page + `nav.back`, `nav.list`
- `harvey.*` (4) — resume, email, github, linkedin ("who are you" lives in `faq.who`)
- `site.*` (6) — theme_dark / theme_light / theme_toggle, help, clear, status
- `hire.*` (2) — contact (→ /contact), availability (incl. rates → reply + email CTA)
- `faq.*` (9) — who, what, location, stack, arbormeta, catchment, genesis, site, model
- `chat.*` (5) — greeting, howareyou, thanks, bye, compliment
- `joke.tell`, `joke.dad` — separate pools, rotated (never the same line twice)
- `egg.*` (10) — barrel_roll, matrix, meaning_of_life, alive, coffee, byron,
  cotton_farm, olympus, transect — gated at confidence ≥ 0.7 in the shell
- sim (30) — every v1 intent verbatim plus `sim.reset` / `sim.controls` /
  `sim.status`; the shell hands the *raw text* to /catchment, which re-parses
  with its own grammar + v1 model, so v2 sim names never leak into the sim
- `none` — out-of-scope (weather forecasts, Spotify, homework…)

**Ultra-rare exact-phrase eggs are not model classes.** `xyzzy`, `sudo …`,
`rm -rf`, `:q!`, `42`, the konami string, `make me a sandwich`, `ping` match
by string equality in `SiteTerminal.tsx` *before* the model runs — perfect
precision for free, and `42` couldn't be a model class anyway (the tokenizer
collapses digits to `#`). Reply copy for everything lives in
`data/terminal-replies.ts`, not in components.

## Retraining (incl. on a bigger machine)

```bash
pip install numpy                      # the only dependency
npm run site:intent                    # ≈2 min on a laptop, single-threaded numpy
npm run site:intent-verify             # parity + smoke + egg-precision gate
```

Knobs: `--buckets N --hidden N --epochs N --stretch --out PATH`. The run
prints: float/int8 val accuracy, per-group accuracy, top-10 confusion pairs,
a dangerous-pair audit, a ~50-phrase manual script, and the parity probes.
Treat the manual script as the release gate — val accuracy is mostly
measuring the augmenter.

Adding an intent: add a bank (≥15 distinct *wordings*, not prefix spam) to
`SITE_BANKS`, pick a composition policy in `POLICIES` (eggs stay narrow:
low cap, no prefixes), wire the reply/action in `data/terminal-replies.ts`
+ `SiteTerminal.tsx`, retrain, and add a line to `MANUAL_SCRIPT`. Watch the
dedupe report — a phrase appearing in two banks trains neither well; first
listing wins.

Thresholds: base 0.45 (81-way softmax runs softer than v1's 30-way 0.55);
eggs 0.70 (`EGG_THRESHOLD` in SiteTerminal). If you grow the taxonomy,
re-check the low-confidence manual-script lines before shipping.

## Shipped eval (2026-07-10, seed 11)

- dataset 35,650 phrases · 81 intents · val 3,565 (10%)
- float val **0.985** · int8 val **0.984** · artefact **188 KB**
- per group: nav .994 · faq .998 · harvey .995 · sim .987 · site .982 ·
  hire .972 · chat .966 · joke .974 · egg .942 · none .878
- manual script **50/50** · dangerous pairs all zero except
  chat.greeting↔none (3 val cases — a gibberish greeting is a shrug either way)
- latency: two matvecs (~130 K MACs sparse) — well under 1 ms anywhere;
  v1 measured sub-millisecond at a quarter the size, same code path
