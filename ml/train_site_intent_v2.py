"""Site terminal — intent model trainer, v2.

The wider natural-language head for the site shell (press `/`): navigation,
Harvey actions, portfolio FAQ, chit-chat, jokes, easter eggs — plus every
Catchment sim intent from v1, so "chuck a meteor" still hands off. Same recipe
as ml/train_intent.py, scaled up: hashed bag-of-features (word + char-trigram
+ word-bigram, FNV-1a) into a one-hidden-layer MLP, softmax over ~80 intents.
Pure numpy; the export is base64-packed int8 so 4x the parameters ship in
~2x the bytes of v1.

The featuriser is imported from train_intent.py — one implementation, zero
drift — and MUST keep mirroring lib/catchment/intent.ts byte-for-byte. The
export embeds parity probes; the TS decoder refuses the model on any mismatch.

Ultra-rare exact-phrase eggs (xyzzy, sudo, konami…) are deliberately NOT model
classes — they live in a deterministic table in components/SiteTerminal.tsx.
A classifier buys nothing over string equality there.

Usage:  python ml/train_site_intent_v2.py [--buckets 1024] [--hidden 128]
        python ml/train_site_intent_v2.py --stretch     # 2048 x 192
Writes: public/catchment/intent-v2.json
"""

from __future__ import annotations

import argparse
import base64
import json
import random
import sys
from collections import Counter
from pathlib import Path

import numpy as np

# Windows consoles often default to cp1252; the report uses arrows and dots.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

sys.path.insert(0, str(Path(__file__).resolve().parent))
from train_intent import (  # noqa: E402  (featuriser + v1 sim banks, single source)
    BANKS as V1_BANKS,
    PREFIXES,
    SUFFIXES,
    featurize,
    typo,
)

SEED = 11
EPOCHS = 90
BATCH = 256
LR = 3e-3
WEIGHT_DECAY = 1e-4
LABEL_SMOOTH = 0.03
INPUT_DROPOUT = 0.15
THRESHOLD = 0.45

OUT_PATH = Path(__file__).resolve().parent.parent / "public" / "catchment" / "intent-v2.json"

# ---------------------------------------------------------------- v2 banks
# Site-side intents. Sim intents are merged in from train_intent.BANKS below.
# Keep bases focused on *distinct wordings*; composition + typos fill volume.

SITE_BANKS: dict[str, list[str]] = {
    # ---- navigation --------------------------------------------------------
    "nav.home": [
        "home", "go home", "take me home", "home page", "the front door",
        "front page", "main page", "back to the start", "back to home",
        "start page", "landing page", "open home", "go to the homepage",
        "the homepage", "take me to the front page", "root", "index",
    ],
    "nav.work": [
        "work", "open work", "show me your work", "your work", "projects",
        "open projects", "show me the projects", "case studies", "your projects",
        "the case studies", "what have you built", "what have you shipped",
        "show me what you have built", "portfolio pieces", "client work",
        "past projects", "see the work", "your best work", "show me the goods",
        "step one", "fibretrace", "the step one project",
    ],
    "nav.playground": [
        "playground", "open the playground", "the playground", "demos",
        "show me the demos", "live demos", "gpu demos", "the lab",
        "open the lab", "interactive demos", "the demo page", "see the demos",
        "webgpu demos", "show me something cool", "the fun stuff",
        "where are the toys", "show me the experiments", "the sandbox",
    ],
    "nav.catchment": [
        "open catchment", "catchment", "go to catchment", "the earth engine",
        "open the earth engine", "launch catchment", "the terrain sim",
        "open the terrain simulator", "take me to catchment",
        "the catchment demo", "the water sim", "erosion sim",
        "the hydrology demo", "load catchment", "boot up catchment",
    ],
    "nav.genesis": [
        "open genesis", "genesis", "go to genesis", "launch genesis",
        "the artificial life lab", "artificial life", "the alife demo",
        "particle life", "open particle life", "the life sim",
        "take me to genesis", "the genesis lab", "summon a creature",
        "summon something", "open ended evolution", "the evolution demo",
        "load genesis", "show me genesis",
    ],
    "nav.pretraining": [
        "open pretraining", "pretraining", "the pretraining report",
        "the report", "the paper", "the research", "open the paper",
        "llm pretraining", "the llm report", "the pretraining study",
        "read the report", "the fixed compute study", "show me the research",
        "the training report", "open the research page", "scaling laws",
    ],
    "nav.canopy": [
        "open canopy", "canopy", "the canopy page", "canopy cover",
        "the day job deep dive", "forest from orbit", "the lidar work",
        "the satellite work", "canopy from orbit", "the forest page",
        "show me the canopy project", "tree cover from space",
        "the remote sensing page", "go to canopy",
    ],
    "nav.pagerank": [
        "open pagerank", "pagerank", "the pagerank demo", "page rank",
        "the markov chain demo", "random surfer", "the surfer demo",
        "web navigation demo", "the monash project", "stochastic process demo",
        "go to pagerank", "the graph demo", "show me pagerank",
    ],
    "nav.about": [
        "about", "open about", "the about page", "go to about",
        "about page", "about harvey", "the bio", "your bio", "read the bio",
        "more about you", "take me to the about page", "background",
        "your background", "your story", "the story",
    ],
    "nav.experience": [
        "experience", "open experience", "the timeline", "your timeline",
        "work history", "employment history", "career history",
        "show me the timeline", "where have you worked", "past roles",
        "your career", "job history", "go to experience", "career so far",
        "previous jobs", "work experience",
    ],
    "nav.skills": [
        "skills", "open skills", "the skills page", "your skills",
        "the toolbox", "open the toolbox", "show me the stack page",
        "the stack", "tech skills", "skill set", "skillset",
        "go to skills", "list your skills", "capabilities page",
    ],
    "nav.contact": [
        "contact", "open contact", "the contact page", "go to contact",
        "contact page", "how do i contact you", "how do i reach you",
        "get in touch", "reach out", "start a conversation",
        "take me to contact", "contact details", "contact info",
        "how to reach harvey", "talk to you", "talk to harvey",
    ],
    "nav.back": [
        "back", "go back", "take me back", "previous page", "last page",
        "back up", "back one", "return", "go to the previous page",
        "backtrack", "one page back", "navigate back",
    ],
    "nav.list": [
        "ls", "pages", "sitemap", "site map", "list pages", "list the pages",
        "what pages are there", "show me the pages", "show me around",
        "where can i go", "what is on this site", "menu", "show the menu",
        "navigation", "what sections are there", "give me the tour",
        "tour", "what else is here", "what can i see here",
        "show me everything", "directory", "table of contents",
    ],

    # ---- harvey actions ----------------------------------------------------
    "harvey.resume": [
        "resume", "cv", "your resume", "your cv", "the resume", "the cv",
        "show me your resume", "show me your cv", "can i see your resume",
        "can i see your cv", "download resume", "download your cv",
        "resume pdf", "grab your cv", "see the resume", "curriculum vitae",
        "open your resume", "get the resume", "read your cv",
        "where is your resume", "send me your cv", "resume please",
    ],
    "harvey.email": [
        "email", "your email", "email address", "whats your email",
        "email harvey", "email you", "send you an email", "mail you",
        "how do i email you", "shoot you an email", "drop you a line",
        "your email address", "give me your email", "send an email",
        "flick you an email", "whats your email address", "mail",
        "write to you", "send you a message",
    ],
    "harvey.github": [
        "github", "your github", "the github", "github profile",
        "open github", "see the code", "the source code", "source code",
        "where is the code", "show me the source", "the repo", "git repo",
        "code for this site", "is this open source", "your repos",
        "link to github", "show me your code", "the source",
    ],
    "harvey.linkedin": [
        "linkedin", "your linkedin", "linkedin profile", "open linkedin",
        "connect on linkedin", "add you on linkedin", "the linkedin",
        "find you on linkedin", "linkedin link", "are you on linkedin",
        "your linkedin profile", "link to your linkedin",
    ],

    # ---- site controls -----------------------------------------------------
    "site.theme_dark": [
        "dark", "dark mode", "dark theme", "go dark", "make it dark",
        "night mode", "lights off", "switch to dark", "turn off the lights",
        "darker please", "dark mode on", "enable dark mode", "night theme",
        "too bright", "its too bright", "dim the site", "goth mode",
    ],
    "site.theme_light": [
        "light", "light mode", "light theme", "go light", "make it light",
        "day mode", "lights on", "switch to light", "turn on the lights",
        "bright mode", "light mode on", "enable light mode", "day theme",
        "too dark", "its too dark", "brighten it up", "brighter please",
    ],
    "site.theme_toggle": [
        "toggle theme", "switch theme", "change theme", "flip the theme",
        "other theme", "swap the theme", "change the theme", "toggle the theme",
        "invert the colors", "switch the colors", "theme", "swap colors",
        "change the colours", "flip colours",
    ],
    "site.help": [
        "what is this terminal", "how does this shell work",
        "what does this terminal do", "shell help", "terminal help",
        "what commands does this shell have", "how do i use this terminal",
        "what can i type", "what can i type here", "what do i type here",
        "what can i say here", "what works here", "what can i do here",
        "what can i ask you", "what do you understand",
        # v1 help bank is merged in below.
    ],
    "site.clear": [
        "clear the screen", "clear the terminal", "clear this",
        "wipe the terminal", "clean this up", "clear the console",
        "clear the history", "wipe the screen", "clean the terminal",
        "erase all this", "clear it",
    ],
    "site.status": [
        "where am i", "what page is this", "what page am i on",
        "current page", "which page is this", "what is this page",
        "where are we", "what am i looking at", "current location",
    ],

    # ---- hire --------------------------------------------------------------
    "hire.contact": [
        "hire harvey", "hire you", "can i hire you", "are you for hire",
        "i want to hire you", "work with you", "work together",
        "lets work together", "start a project", "book a call",
        "schedule a call", "set up a call", "i have a project",
        "i have a project for you", "got a project", "need a contractor",
        "looking for a contractor", "need an ml engineer", "consulting",
        "do you consult", "freelance work", "do you freelance",
        "commission a project", "got a gig for you", "we have a role",
        "we are hiring", "join our team", "interested in a role",
        "can we work together", "engage you", "bring you on",
        "contract work", "take on a contract",
    ],
    "hire.availability": [
        "are you available", "availability", "your availability",
        "when are you free", "are you taking new clients",
        "taking on new work", "open for work", "are you open to work",
        "current availability", "do you have capacity", "got capacity",
        "when could you start", "how soon can you start",
        "are you available next month", "available for contract work",
        "are you free for new projects", "when are you next available",
        "any availability this quarter", "do you have availability",
        "got room for another project", "are you booked out",
        "how booked are you", "are you free at the moment",
        "whats your rate", "rates", "your rates", "how much do you charge",
        "day rate", "hourly rate", "pricing", "what do you cost",
        "how much would it cost", "ballpark cost", "what would you charge",
    ],

    # ---- faq ---------------------------------------------------------------
    "faq.who": [
        "who are you", "who is harvey", "who is harvey houlahan",
        "who made this", "who built this", "who built this site",
        "whos behind this", "whos behind this site", "who owns this site",
        "tell me about yourself", "tell me about harvey",
        "introduce yourself", "whats your name", "who", "about the author",
        "who is this guy", "who is this person", "who runs this",
        "who created this website", "whose site is this", "who dis",
    ],
    "faq.what": [
        "what do you do", "what does harvey do", "what do you build",
        "what kind of work do you do", "what do you work on",
        "what are you good at", "what services do you offer",
        "what is your specialty", "areas of expertise", "what do you offer",
        "what sort of engineer are you", "what field are you in",
        "what is your job", "what do you actually do", "your specialty",
        "what problems do you solve", "what kind of ml do you do",
    ],
    "faq.location": [
        "where are you based", "where do you live", "where are you",
        "where are you located", "what timezone are you in", "timezone",
        "your timezone", "are you in australia", "are you australian",
        "would you relocate", "open to relocation", "can you relocate",
        "do you work remote", "do you work remotely", "remote ok",
        "are you remote", "where in australia", "what country are you in",
        "would you move overseas", "would you work in the us",
        "would you work in europe",
    ],
    "faq.stack": [
        "what stack do you use", "what is your stack", "tech stack",
        "what languages do you use", "what languages do you know",
        "what tools do you use", "do you know pytorch", "do you use python",
        "python or typescript", "what frameworks", "favourite language",
        "what technologies", "what do you code in", "do you know rust",
        "what ml frameworks do you use", "do you write cuda",
        "what is this site built with actually",
    ],
    "faq.arbormeta": [
        "what is arbormeta", "tell me about arbormeta", "arbormeta",
        "what do you do at arbormeta", "the day job", "your day job",
        "what is your day job", "forest carbon", "carbon mrv",
        "what is carbon mrv", "the carbon work", "carbon policy work",
        "what is the carbon project", "measuring forests",
        "the forestry job", "who do you work for", "where do you work",
        "your employer", "current job",
    ],
    "faq.catchment": [
        "what is catchment", "whats catchment", "tell me about catchment",
        "explain catchment", "how does catchment work",
        "what is the earth engine", "what is the catchment demo",
        "how does the terrain sim work", "what does catchment do",
        "how did you build catchment", "what powers catchment",
        "is catchment real physics", "how does the water sim work",
    ],
    "faq.genesis": [
        "what is genesis", "whats genesis", "tell me about genesis",
        "explain genesis", "how does genesis work", "what does genesis do",
        "what is particle life about", "what is the alife thing",
        "how does the life sim work", "what is open ended evolution",
        "how did you build genesis", "what powers genesis",
    ],
    "faq.site": [
        "what is this", "what is this site", "what is this website",
        "how was this site built", "how did you make this",
        "what is this site built with", "what powers this site",
        "is this nextjs", "is this react", "how does this site work",
        "what is this place", "what am i on", "what website is this",
        "tell me about this site", "did you build this yourself",
    ],
    "faq.model": [
        "are you an ai", "are you a bot", "are you chatgpt", "are you an llm",
        "are you gpt", "is this an llm", "what model are you",
        "what are you", "are you a language model", "who made you",
        "what made you", "are you claude", "is this ai", "are you a robot",
        "what kind of ai is this", "how do you understand me",
        "how does this parsing work", "is a neural net reading this",
        "are you intelligent", "how smart are you",
    ],

    # ---- chat --------------------------------------------------------------
    "chat.greeting": [
        "hello", "hi", "hey", "hey there", "hi there", "gday", "g'day",
        "gday mate", "good morning", "good arvo", "good evening", "morning",
        "evening", "yo", "howdy", "hiya", "sup", "whats up", "oi", "ahoy",
        "hello there", "hey hey", "greetings", "salutations",
    ],
    "chat.howareyou": [
        "how are you", "how are you going", "how you going", "hows it going",
        "how you doing", "how are things", "hows things", "you good",
        "you right", "how are ya", "hows life", "how goes it",
        "everything ok", "you doing alright", "hows your day",
    ],
    "chat.thanks": [
        "thanks", "thank you", "cheers", "ta", "thanks mate", "cheers mate",
        "thank you so much", "appreciate it", "much appreciated", "legend",
        "youre a legend", "nice one", "thanks heaps", "ta muchly",
        "thanks a lot", "good stuff thanks",
    ],
    "chat.bye": [
        "bye", "goodbye", "see ya", "see you", "later", "catch ya",
        "catch you later", "im off", "gotta go", "cya", "good night",
        "goodnight", "im out", "peace", "farewell", "see you round",
        "gotta run", "im heading off",
    ],
    "chat.compliment": [
        "this is cool", "this is awesome", "this is amazing", "nice site",
        "great site", "love this", "love this site", "sick website",
        "great work", "impressive", "very impressive", "wow this is good",
        "coolest portfolio", "best portfolio ive seen", "this is sick",
        "this rules", "really cool", "so cool", "beautiful site",
        "this is very cool", "well done", "nailed it", "top notch",
        "mad respect", "this slaps",
    ],

    # ---- jokes -------------------------------------------------------------
    "joke.tell": [
        "tell me a joke", "joke", "a joke", "another joke", "one more joke",
        "got any jokes", "know any jokes", "make me laugh",
        "say something funny", "be funny", "tell me something funny",
        "entertain me", "amuse me", "got jokes", "hit me with a joke",
        "give us a joke", "tell us a joke", "any good jokes",
        "do you know any jokes", "humour me", "crack a joke",
    ],
    "joke.dad": [
        "dad joke", "tell me a dad joke", "got any dad jokes",
        "worst joke you know", "corniest joke you have", "corny joke",
        "anti joke", "tell me an anti joke", "groaner", "make me groan",
        "pun please", "give me a pun", "terrible joke please",
        "your worst joke", "cheesiest joke", "bad joke", "tell me a bad joke",
        "lamest joke you know",
    ],

    # ---- easter eggs (model-based; exact-phrase eggs live in TS) -----------
    "egg.barrel_roll": [
        "do a barrel roll", "barrel roll", "do a flip", "backflip",
        "spin around", "do a spin", "spin the terminal", "roll over",
        "do a trick", "front flip", "do a somersault",
    ],
    "egg.matrix": [
        "enter the matrix", "the matrix", "matrix mode", "red pill",
        "blue pill", "take the red pill", "follow the white rabbit",
        "wake up neo", "there is no spoon", "im in the matrix",
        "free your mind", "knock knock neo",
    ],
    "egg.meaning_of_life": [
        "meaning of life", "the meaning of life",
        "what is the meaning of life", "what is the point of it all",
        "why are we here", "the answer to everything",
        "life the universe and everything",
        "the ultimate question", "dont panic",
        "so long and thanks for all the fish", "what is the answer",
        "whats it all about",
    ],
    "egg.alive": [
        "are you alive", "are you sentient", "are you conscious",
        "do you dream", "do you have feelings", "are you real",
        "can you think", "do you sleep", "are you self aware",
        "do you get bored", "are you happy", "do you feel anything",
    ],
    "egg.coffee": [
        "coffee", "make me a coffee", "make coffee", "brew some coffee",
        "flat white", "long black", "wheres the coffee", "coffee break",
        "need caffeine", "i need coffee", "espresso", "make me a latte",
        "brew me a cuppa", "cup of tea", "put the kettle on",
    ],
    "egg.byron": [
        "byron bay", "byron", "hows byron", "whats byron like",
        "hows the beach", "gone surfing", "surf report", "hows the surf",
        "do you surf", "whats the surf like", "beach report",
        "is the water warm", "byron bay eh",
    ],
    "egg.cotton_farm": [
        "cotton farm", "the cotton farm", "tell me about the farm",
        "did you grow up on a farm", "farm life", "the farm",
        "cotton farming", "life on the farm", "queensland farm",
        "do you miss the farm", "tractors", "how was farm life",
    ],
    "egg.olympus": [
        "olympus", "mount olympus", "the secret world", "secret map",
        "hidden world", "the hidden map", "is there a secret",
        "any secrets", "easter egg", "easter eggs", "any easter eggs",
        "whats hidden here", "secret level", "hidden level",
        "are there any secrets here", "show me a secret",
        "whats the secret",
    ],
    "egg.transect": [
        "run the transect", "the transect", "transect", "footer game",
        "the footer game", "spacebar game", "play the game",
        "is there a game", "the runner", "elevation runner",
        "the little runner", "wheres the game", "can i play a game",
        "the running game",
    ],

    # ---- out of scope ------------------------------------------------------
    "none": [
        "whats the weather in sydney", "weather in melbourne tomorrow",
        "will it rain tomorrow in brisbane", "weather forecast for tomorrow",
        "open google", "google it", "search the web", "open youtube",
        "play a video", "play some music", "play music", "put on spotify",
        "next song", "louder", "mute", "volume up", "pause the music",
        "order a pizza", "order me an uber", "call me a cab",
        "book a flight", "whats the news", "news headlines",
        "whats bitcoin at", "stock price of apple", "buy bitcoin",
        "set a timer", "set an alarm", "remind me later",
        "what time is it", "what day is it", "translate this to french",
        "write me an essay", "write code for me", "do my homework",
        "solve this equation", "summarise this article",
        "how old are you", "sing a song", "sing me a song", "rap for me",
        "asdf", "qwerty", "foo bar", "lorem ipsum", "blah blah",
        "random words here", "the quick brown fox", "i like turtles",
        "banana", "potato", "test", "testing", "testing one two",
        "scroll down", "scroll up", "zoom in", "zoom out", "undo", "redo",
        "copy", "paste", "print", "download", "fullscreen", "screenshot",
        "save", "new tab", "refresh the page", "delete my cookies",
        "log me in", "sign up", "create an account", "password reset",
        "wheres the login", "add to cart", "checkout",
    ],
}

# v1 sim banks merge in verbatim (minus classes the site shell owns).
SIM_SKIP = {"none", "help", "status"}
SIM_RENAME = {"reset": "sim.reset", "controls": "sim.controls"}

# The site shell owns generic help/status wording; sim-flavoured status
# phrases from v1 become sim.status → handed off to /catchment.
SIM_STATUS_BANK = [
    "whats the rain at", "what mode am i in", "what world is this",
    "current sim settings", "what are the sim values", "sim status",
    "whats running in the sim", "simulation status",
]

# ---------------------------------------------------------- augmentation
# Per-group composition policy. Eggs stay narrow (precision beats volume);
# chat stays short; questions get question-y prefixes, not "make it".

QA_PREFIXES = [
    "", "hey ", "so ", "umm ", "ok so ", "btw ", "mate ", "quick question ",
    "just wondering ", "curious ", "one thing ", "real quick ", "sorry but ",
    "wait ", "also ", "and ",
]
QA_SUFFIXES = ["", "?", " mate", " please", " thanks", " exactly", " again"]

CHAT_SUFFIXES = ["", "!", " mate", " there", " again", " everyone", " hey"]

# (prefixes, suffixes, typo_rate, cap)
DEFAULT_POLICY = (PREFIXES, SUFFIXES, 0.30, 500)
POLICIES: dict[str, tuple[list[str], list[str], float, int]] = {
    "nav": (PREFIXES, SUFFIXES, 0.30, 500),
    "harvey": (QA_PREFIXES, QA_SUFFIXES, 0.30, 450),
    "site": (PREFIXES, SUFFIXES, 0.30, 450),
    "hire": (QA_PREFIXES, QA_SUFFIXES, 0.30, 500),
    "faq": (QA_PREFIXES, QA_SUFFIXES, 0.25, 500),
    "chat": ([""], CHAT_SUFFIXES, 0.15, 250),
    "joke": (QA_PREFIXES, QA_SUFFIXES, 0.25, 350),
    "egg": ([""], ["", "?", " please", " mate"], 0.10, 150),
    "none": (QA_PREFIXES, QA_SUFFIXES, 0.30, 700),
}


def merged_banks() -> dict[str, list[str]]:
    banks: dict[str, list[str]] = {}
    # Site banks first: on duplicate phrasings the site class wins.
    for name, bank in SITE_BANKS.items():
        banks[name] = list(bank)
    banks["site.help"] = banks["site.help"] + list(V1_BANKS["help"])
    for name, bank in V1_BANKS.items():
        if name in SIM_SKIP or name in SIM_RENAME:
            continue
        banks[name] = list(bank)
    for old, new in SIM_RENAME.items():
        banks[new] = list(V1_BANKS[old])
    banks["sim.status"] = list(SIM_STATUS_BANK)

    # Cross-class exact-string dedupe, first listing wins. Anything v1's none
    # bank shared with a new intent ("tell me a joke", "dark mode"…) is gone
    # already because v2 writes its own none bank; this guards the rest.
    seen: dict[str, str] = {}
    dropped = 0
    for name, bank in banks.items():
        kept = []
        for phrase in bank:
            owner = seen.get(phrase)
            if owner is None:
                seen[phrase] = name
                kept.append(phrase)
            elif owner != name:
                dropped += 1
        banks[name] = kept
    if dropped:
        print(f"dedupe: dropped {dropped} cross-class duplicate phrasings")
    return banks


def group_of(intent: str) -> str:
    head = intent.split(".")[0]
    if head in {"rain", "storm", "erosion", "wind", "relief", "sun", "mode",
                "scene", "neural", "map", "sim"}:
        return "sim"
    if head in {"nav", "harvey", "site", "hire", "faq", "chat", "joke", "egg", "none"}:
        return head
    return "sim"  # any other v1 leftover is sim-side


def build_dataset(banks: dict[str, list[str]], rng: random.Random,
                  ) -> tuple[list[str], list[int], list[str]]:
    intents = sorted(banks.keys())
    idx = {name: i for i, name in enumerate(intents)}
    texts: list[str] = []
    labels: list[int] = []
    for intent, bank in banks.items():
        prefixes, suffixes, typo_rate, cap = POLICIES.get(group_of(intent), DEFAULT_POLICY)
        seen: set[str] = set()
        samples: list[str] = []
        for base in bank:
            if base not in seen:
                seen.add(base)
                samples.append(base)
        attempts = 0
        while len(samples) < cap and attempts < cap * 30:
            attempts += 1
            s = rng.choice(prefixes) + rng.choice(bank) + rng.choice(suffixes)
            if rng.random() < typo_rate:
                s = typo(s, rng)
            if s not in seen:
                seen.add(s)
                samples.append(s)
        texts.extend(samples)
        labels.extend([idx[intent]] * len(samples))
    # Pure letter soup lands in `none`.
    for _ in range(150):
        n = rng.randrange(3, 12)
        soup = "".join(rng.choice("abcdefghijklmnopqrstuvwxyz    ") for _ in range(n)).strip()
        if soup:
            texts.append(soup)
            labels.append(idx["none"])
    return texts, labels, intents


# ------------------------------------------------------------------ training

def to_dense(texts: list[str], buckets: int) -> np.ndarray:
    X = np.zeros((len(texts), buckets), dtype=np.float32)
    for i, t in enumerate(texts):
        for k, v in featurize(t, buckets).items():
            X[i, k] += v
    return X


def train(X: np.ndarray, y: np.ndarray, C: int, hidden: int,
          rng: np.random.Generator):
    N, buckets = X.shape
    W1 = (rng.standard_normal((buckets, hidden)) * np.sqrt(2.0 / buckets)).astype(np.float64)
    b1 = np.zeros(hidden)
    W2 = (rng.standard_normal((hidden, C)) * np.sqrt(2.0 / hidden)).astype(np.float64)
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
            bi = order[s: s + BATCH]
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
                mhat = m_ / (1 - 0.9 ** t)
                vhat = v_ / (1 - 0.999 ** t)
                p_ -= lr * mhat / (np.sqrt(vhat) + 1e-8)
    return W1, b1, W2, b2


def logits_of(X, W1, b1, W2, b2) -> np.ndarray:
    h = np.maximum(X.astype(np.float64) @ W1 + b1, 0)
    return h @ W2 + b2


def quantize(W: np.ndarray, bits: int) -> tuple[np.ndarray, float]:
    lim = 2 ** (bits - 1) - 1
    s = float(np.abs(W).max()) / lim or 1.0
    return np.clip(np.round(W / s), -lim, lim).astype(np.int32), s


# ------------------------------------------------------------------ eval

# "A user would type this" — held entirely out of training verbatim-space by
# construction is not guaranteed (some are bank bases); the point is a fast
# behavioural regression check, printed on every run.
MANUAL_SCRIPT: list[tuple[str, str]] = [
    ("open the playground", "nav.playground"),
    ("take me home", "nav.home"),
    ("show me your work", "nav.work"),
    ("open catchment", "nav.catchment"),
    ("whats catchment", "faq.catchment"),
    ("summon something weird", "nav.genesis"),
    ("read the pretraining report", "nav.pretraining"),
    ("resume", "harvey.resume"),
    ("can i grab your cv", "harvey.resume"),
    ("whats your email address", "harvey.email"),
    ("github", "harvey.github"),
    ("are you on linkedin", "harvey.linkedin"),
    ("who are you", "faq.who"),
    ("who built this site", "faq.who"),
    ("what do you actually do", "faq.what"),
    ("where are you based", "faq.location"),
    ("what stack do you use", "faq.stack"),
    ("tell me about arbormeta", "faq.arbormeta"),
    ("are you an ai", "faq.model"),
    ("hire harvey", "hire.contact"),
    ("are you available for contract work", "hire.availability"),
    ("whats your day rate", "hire.availability"),
    ("dark mode", "site.theme_dark"),
    ("lights on", "site.theme_light"),
    ("switch the theme", "site.theme_toggle"),
    ("what can i type here", "site.help"),
    ("clear the screen", "site.clear"),
    ("gday", "chat.greeting"),
    ("hows it going", "chat.howareyou"),
    ("thanks mate", "chat.thanks"),
    ("this is sick", "chat.compliment"),
    ("tell me a joke", "joke.tell"),
    ("got any dad jokes", "joke.dad"),
    ("do a barrel roll", "egg.barrel_roll"),
    ("follow the white rabbit", "egg.matrix"),
    ("what is the meaning of life", "egg.meaning_of_life"),
    ("are you alive", "egg.alive"),
    ("make me a coffee", "egg.coffee"),
    ("hows the surf", "egg.byron"),
    ("any easter eggs", "egg.olympus"),
    ("is there a game here", "egg.transect"),
    ("make it storm", "storm.up"),
    ("chuck a meteor at it", "mode.meteor"),
    ("flood the valleys", "scene.flood"),
    ("let the neural net drive", "neural.on"),
    ("reset the terrain", "sim.reset"),
    ("whats the weather in sydney tomorrow", "none"),
    ("play some music", "none"),
    ("order me a pizza", "none"),
    ("write me an essay about rome", "none"),
]

# Pairs where a mixup is embarrassing or destructive — report val confusion.
DANGEROUS_PAIRS = [
    ("joke.tell", "site.help"),
    ("hire.contact", "harvey.email"),
    ("hire.contact", "nav.contact"),
    ("faq.catchment", "nav.catchment"),
    ("faq.genesis", "nav.genesis"),
    ("chat.greeting", "none"),
    ("egg.alive", "faq.model"),
    ("storm.up", "none"),
    ("site.theme_dark", "sun.move"),
]


def main() -> None:
    global EPOCHS
    ap = argparse.ArgumentParser()
    ap.add_argument("--buckets", type=int, default=1024)
    ap.add_argument("--hidden", type=int, default=128)
    ap.add_argument("--epochs", type=int, default=EPOCHS)
    ap.add_argument("--stretch", action="store_true", help="2048 buckets x 192 hidden")
    ap.add_argument("--out", type=str, default=str(OUT_PATH))
    args = ap.parse_args()
    if args.stretch:
        args.buckets, args.hidden = 2048, 192
    EPOCHS = args.epochs
    buckets, hidden = args.buckets, args.hidden

    rng_py = random.Random(SEED)
    rng_np = np.random.default_rng(SEED)

    banks = merged_banks()
    texts, labels, intents = build_dataset(banks, rng_py)
    y = np.array(labels)
    X = to_dense(texts, buckets)
    C = len(intents)
    print(f"dataset: {len(texts)} phrases · {C} intents · {buckets} buckets · hidden {hidden}")

    order = rng_np.permutation(len(y))
    n_val = max(1, len(y) // 10)
    val_i, tr_i = order[:n_val], order[n_val:]

    W1, b1, W2, b2 = train(X[tr_i], y[tr_i], C, hidden, rng_np)
    lg_tr = logits_of(X[tr_i], W1, b1, W2, b2)
    lg_va = logits_of(X[val_i], W1, b1, W2, b2)
    acc_tr = float((lg_tr.argmax(1) == y[tr_i]).mean())
    acc_va = float((lg_va.argmax(1) == y[val_i]).mean())
    print(f"float:  train {acc_tr:.4f} · val {acc_va:.4f}")

    dW1 = dW2 = None
    wbits = 8
    for bits in (8, 16):
        q1, s1 = quantize(W1, bits)
        q2, s2 = quantize(W2, bits)
        dW1, dW2 = q1 * s1, q2 * s2
        lg_q = logits_of(X[val_i], dW1, b1, dW2, b2)
        acc_q = float((lg_q.argmax(1) == y[val_i]).mean())
        print(f"int{bits}:   val {acc_q:.4f}")
        wbits = bits
        if acc_q >= acc_va - 0.005:
            break

    # ---- group accuracy + confusion (quantised, val split)
    pred_va = logits_of(X[val_i], dW1, b1, dW2, b2).argmax(1)
    by_group: dict[str, list[bool]] = {}
    conf = Counter()
    for yi, pi in zip(y[val_i], pred_va):
        by_group.setdefault(group_of(intents[yi]), []).append(yi == pi)
        if yi != pi:
            conf[(intents[yi], intents[pi])] += 1
    print("val by group: " + " · ".join(
        f"{g} {np.mean(v):.3f} (n={len(v)})" for g, v in sorted(by_group.items())))
    print("top val confusions:")
    for (a, b_), n in conf.most_common(10):
        print(f"  {n:3d}  {a} → {b_}")
    print("dangerous pairs (val, either direction):")
    for a, b_ in DANGEROUS_PAIRS:
        n = conf.get((a, b_), 0) + conf.get((b_, a), 0)
        print(f"  {'ok ' if n == 0 else 'WARN'} {a} ↔ {b_}: {n}")

    # ---- quantised predictor for probes/manual script
    def predict(text: str) -> tuple[str, float]:
        x = np.zeros(buckets)
        for k, v in featurize(text, buckets).items():
            x[k] += v
        h = np.maximum(x @ dW1 + b1, 0)
        lg = h @ dW2 + b2
        lg -= lg.max()
        e = np.exp(lg)
        p = e / e.sum()
        c = int(p.argmax())
        return intents[c], float(p[c])

    print("\nmanual script:")
    fails = 0
    for text, want in MANUAL_SCRIPT:
        got, conf_ = predict(text)
        ok = got == want
        fails += 0 if ok else 1
        print(f"  {'ok ' if ok else 'FAIL'} \"{text}\" → {got} @ {conf_:.2f}"
              + ("" if ok else f"  (wanted {want})"))
    print(f"manual script: {len(MANUAL_SCRIPT) - fails}/{len(MANUAL_SCRIPT)}")

    parity_texts = [
        "open the about page",
        "show me your resume",
        "tell me a joke",
        "who are you",
        "hire harvey",
        "are you available next month",
        "dark mode please",
        "what is catchment",
        "do a barrel roll",
        "wheres the coffee",
        "make it storm",
        "chuck a meteor at it",
        "flood the valleys",
        "gday mate",
        "what stack do you use",
        "play some music",
    ]
    parity = []
    for txt in parity_texts:
        intent, conf_ = predict(txt)
        parity.append({"text": txt, "intent": intent, "conf": round(conf_, 6)})
        print(f'probe: "{txt}" -> {intent} @ {conf_:.3f}')

    dtype = "<i1" if wbits == 8 else "<i2"
    out = {
        "kind": "site-intent-v2",
        "version": 2,
        "buckets": buckets,
        "hidden": hidden,
        "intents": intents,
        "wbits": wbits,
        "w1b64": base64.b64encode(q1.astype(dtype).tobytes()).decode("ascii"),
        "w2b64": base64.b64encode(q2.astype(dtype).tobytes()).decode("ascii"),
        "b1": [round(float(v), 6) for v in b1],
        "b2": [round(float(v), 6) for v in b2],
        "s1": s1,
        "s2": s2,
        "threshold": THRESHOLD,
        "eggThreshold": 0.70,
        "parity": parity,
    }
    out_path = Path(args.out)
    out_path.write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
    kb = out_path.stat().st_size / 1024
    print(f"wrote {out_path.name}: {kb:.0f} KB")


if __name__ == "__main__":
    main()
