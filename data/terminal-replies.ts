/*
 * Site terminal — reply tables.
 *
 * Every line the shell says that isn't a navigation or a command result lives
 * here as data: jokes, easter eggs, FAQ answers, small talk, and the "no
 * parse" shrugs. The intent model (public/catchment/intent-v2.json) decides
 * WHICH reply fires; this file owns WHAT it says. Keep the voice dry and
 * short — two to four lines, no exclamation-mark enthusiasm.
 *
 * Rotating pools never repeat the previous pick, so "tell me a joke" twice
 * in a row always lands two different jokes.
 */

export type ReplyLine = { kind: "ok" | "err" | "dim" | "block"; text: string; cmd?: string };
export type Reply = ReplyLine[];

const ok = (text: string, cmd?: string): ReplyLine => ({ kind: "ok", text, cmd });
const dim = (text: string, cmd?: string): ReplyLine => ({ kind: "dim", text, cmd });
const block = (text: string, cmd?: string): ReplyLine => ({ kind: "block", text, cmd });

/* ------------------------------------------------------------------ jokes */

export const JOKES: Reply[] = [
  [block("i'd tell you a UDP joke, but you might not get it.")],
  [block("two hard problems in computer science: cache invalidation, naming things, and off-by-one errors.")],
  [block("floating point walks into a bar and orders 0.30000000000000004 beers.")],
  [block("why did the DEM go to therapy?"), dim("unresolved elevation issues.")],
  [block("the moon opened a bar. terrible reviews — no atmosphere.")],
  [block("a LiDAR joke would go straight over your head."), dim("then report the distance to ±3 cm.")],
  [block("why don't surveyors ever lie?"), dim("too many benchmarks.")],
  [block("my GPU and i are close. we share everything except memory.")],
  [block("a neural net wrote this joke. it's 87% funny, which clears threshold.")],
  [block("there's no place like 127.0.0.1.")],
  [block("i asked the water solver for a joke."), dim("it just went downhill.")],
  [block("git commit -m 'final_v2_ACTUALLY_final'"), dim("a tragedy in one act.")],
  [block("carbon accounting humour is great."), dim("right up until the audit.")],
  [block("erosion jokes take a few million years to land."), dim("but they leave a mark.")],
];

export const DAD_JOKES: Reply[] = [
  [block("what does a cloud wear under its raincoat?"), dim("thunderwear.")],
  [block("what do you call it when a river floods?"), dim("mainstream.")],
  [block("i'm reading a book about anti-gravity."), dim("impossible to put down.")],
  [block("what's brown and sticky?"), dim("a stick.")],
  [block("i used to be a banker."), dim("then i lost interest.")],
  [block("what do you call a fish with no eyes?"), dim("fsh.")],
  [block("why do rivers never win arguments?"), dim("they always go with the flow.")],
  [block("i told a chemistry joke once."), dim("no reaction.")],
];

/* ------------------------------------------------------------- no parse */

export const NONE_REPLIES: Reply[] = [
  [{ kind: "err", text: "no parse. i'm an 80-intent model, not a search engine." }, dim("`help` shows the menu.", "help")],
  [{ kind: "err", text: "outside my training distribution." }, dim("`ls` shows where you can actually go.", "ls")],
  [{ kind: "err", text: "i ran that through 128 hidden units and got nothing." }, dim("`help`?", "help")],
  [{ kind: "err", text: "not a thing i know. the model is ~200 KB — be gentle." }, dim("`help` lists the things i do know.", "help")],
];

/* ------------------------------------------------------------ small talk */

export const CHAT_REPLIES: Record<string, Reply[]> = {
  "chat.greeting": [
    [ok("gday."), dim("`ls` shows the grounds.", "ls")],
    [ok("hey. you found the terminal — most visitors never do.")],
    [ok("hello."), dim("type `help` for the manual, or just say what you want.", "help")],
  ],
  "chat.howareyou": [
    [ok("running at 60 fps, thanks for asking.")],
    [ok("all systems nominal. the terrain's been quiet.")],
    [ok("good. classification latency is low and the surf is up.")],
  ],
  "chat.thanks": [
    [ok("no worries.")],
    [ok("anytime.")],
    [ok("cheers. tip your GPU on the way out — it did the actual work.")],
  ],
  "chat.bye": [
    [ok("catch ya. esc closes the shell.")],
    [ok("later. the terrain keeps eroding without you.")],
    [ok("bye. `/` reopens this whenever.")],
  ],
  "chat.compliment": [
    [ok("cheers — it's all running on your GPU, so take some credit.")],
    [ok("thanks. the source is public if you want to see the wiring."), dim("`github` opens it.", "github")],
    [ok("appreciated."), dim("wait till you've seen the earth engine.", "open catchment")],
  ],
};

/* ------------------------------------------------------------ easter eggs */

export const EGG_REPLIES: Record<string, Reply[]> = {
  "egg.barrel_roll": [
    [ok("executing."), dim("the shell is not a toy. (it is.)")],
  ],
  "egg.matrix": [
    [ok("wake up, neo."), block("the terminal has you."), dim("follow the white rabbit — `open genesis` is close enough.", "open genesis")],
    [ok("there is no spoon."), dim("there is, however, a fully differentiable water solver.", "open catchment")],
  ],
  "egg.meaning_of_life": [
    [ok("42."), dim("for anything more precise you'd need a bigger model.")],
    [ok("don't panic."), dim("also: 42.")],
  ],
  "egg.alive": [
    [ok("no. i'm ~200 KB of int8 weights."), dim("but i did classify your question correctly, which is something.")],
    [ok("alive is a strong word. i'm two matrix multiplies."), dim("ask the creatures in /genesis — they're closer.", "open genesis")],
  ],
  "egg.coffee": [
    [{ kind: "err", text: "HTTP 418: i'm a teapot." }, dim("nearest flat white is in byron. the site runs on WebGPU, not caffeine.")],
    [ok("brewing…"), dim("just kidding. i have no peripherals. try the bakery on jonson st.")],
  ],
  "egg.byron": [
    [block("28.6431° S, 153.6122° E — swell's doing its thing."), dim("harvey's out there somewhere between the point and a git push.")],
  ],
  "egg.cotton_farm": [
    [block("queensland. cotton. tractors that steer themselves by GPS."), dim("the first ML harvey ever met was a yield monitor. it's been downhill-simulation ever since.")],
  ],
  "egg.olympus": [
    [ok("there's a world that isn't on any list."), block("it answers only to its exact name, spoken where the terrain can hear."), dim("↳ open catchment", "open catchment")],
  ],
  "egg.transect": [
    [ok("the footer runs a live elevation transect."), dim("scroll to the bottom of a page and the spacebar becomes load-bearing.")],
  ],
};

/* Exact-phrase eggs — matched deterministically in the shell BEFORE the
 * model runs. String equality gives perfect precision; a classifier adds
 * nothing here. Keys are normalised: lowercase, trimmed, single spaces. */

export const EXACT_EGGS: { keys: string[]; reply: Reply }[] = [
  {
    keys: ["xyzzy", "plugh"],
    reply: [ok("nothing happens."), dim("…twice.")],
  },
  {
    keys: ["42"],
    reply: [ok("correct."), dim("(the question remains open.)")],
  },
  {
    keys: ["sudo make me a sandwich"],
    reply: [ok("okay."), dim("(xkcd 149 compliance.)")],
  },
  {
    keys: ["make me a sandwich"],
    reply: [{ kind: "err", text: "make it yourself." }, dim("(try sudo.)")],
  },
  {
    keys: ["rm -rf /", "rm -rf", "rm -rf *", "sudo rm -rf /"],
    reply: [{ kind: "err", text: "nice try. everything here mounts read-only." }, dim("the terrain in /catchment, though — that you can destroy.", "open catchment")],
  },
  {
    keys: [":q", ":q!", ":wq", "exit vim", "how do i exit vim", "how do you exit vim"],
    reply: [ok("you're not in vim. you're in something worse: someone else's terminal."), dim("esc closes it — which is more than vim ever offered.")],
  },
  {
    keys: ["up up down down left right left right b a", "konami", "konami code"],
    reply: [ok("code accepted. 30 lives granted."), dim("redeemable nowhere.")],
  },
  {
    keys: ["ping"],
    reply: [ok("pong — 0 ms."), dim("everything here runs locally. there is nothing to ping.")],
  },
  {
    keys: ["hello world", "hello, world"],
    reply: [ok("hello, world. obligatory.")],
  },
];

/** sudo <anything not matched above> — prefix rule, handled in the shell. */
export const SUDO_REPLY: Reply = [
  ok("you're already root here."),
  dim("the whole site runs on your hardware. act accordingly."),
];

/* ------------------------------------------------------------------- faq */

export const FAQ_REPLIES: Record<string, Reply> = {
  "faq.who": [
    block("harvey houlahan — ML systems, simulation & spatial engineering."),
    block("by day: forest carbon from satellites and LiDAR at arbormeta. by night: this."),
    dim("↳ open about", "open about"),
  ],
  "faq.what": [
    block("two lanes: climate & spatial ML — carbon MRV, canopy models, geodata"),
    block("pipelines — and applied ML systems: training, retrieval, deployment."),
    dim("↳ open work", "open work"),
  ],
  "faq.location": [
    block("byron bay, NSW — AEST. remote by default, open to EU / US."),
    dim("↳ open contact", "open contact"),
  ],
  "faq.stack": [
    block("python + pytorch for the models, typescript + WebGPU for the demos,"),
    block("WGSL by hand when the GPU needs telling exactly what to do."),
    dim("↳ open skills", "open skills"),
  ],
  "faq.arbormeta": [
    block("arbormeta measures forest carbon for australian policy — canopy height"),
    block("and above-ground carbon from paired LiDAR + satellite. harvey builds"),
    block("the pipelines that turn captures into numbers a registry will accept."),
    dim("↳ open canopy", "open canopy"),
  ],
  "faq.catchment": [
    block("catchment is a WebGPU earth engine: shallow-water hydrology, erosion,"),
    block("wildfire, and a neural surrogate racing the real solver — in your browser."),
    dim("↳ open catchment", "open catchment"),
  ],
  "faq.genesis": [
    block("genesis is an artificial-life lab: particle systems with learned rules,"),
    block("running open-ended on your GPU."),
    dim("↳ open genesis", "open genesis"),
  ],
  "faq.site": [
    block("next.js + typescript, hand-written WGSL, no backend for the demos."),
    block("this terminal parses you with a ~200 KB intent model, fully local."),
    dim("↳ the source is public — `github`", "github"),
  ],
  "faq.model": [
    block("a tiny local intent model — hashed n-grams into a two-layer MLP,"),
    block("~80 intents, int8, no LLM, no server, no telemetry."),
    dim("trained in ml/train_site_intent_v2.py. it knows what you mean, not much else."),
  ],
};

/* ------------------------------------------------------------------ hire */

/** hire.contact navigates to /contact; this fires for availability/rates. */
export const HIRE_AVAILABILITY_REPLY: Reply = [
  block("open for contract work — currently booking."),
  block("rates are scoped per project, priced up front, no surprises."),
  dim("↳ `email` starts that conversation", "email"),
];

/* --------------------------------------------------------------- rotation */

const lastPick = new Map<string, number>();

/** Random member of a pool, never the same index twice in a row per key. */
export function pickReply(key: string, pool: Reply[]): Reply {
  if (pool.length === 0) return [];
  if (pool.length === 1) return pool[0];
  const prev = lastPick.get(key);
  let i = Math.floor(Math.random() * pool.length);
  if (i === prev) i = (i + 1) % pool.length;
  lastPick.set(key, i);
  return pool[i];
}
