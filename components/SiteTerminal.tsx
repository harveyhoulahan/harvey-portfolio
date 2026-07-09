"use client";

/*
 * Site shell — the portfolio's command line.
 *
 * Press `/` anywhere (except inside Catchment, which runs its own) and a small
 * dark terminal slides up: `open genesis`, `resume`, `theme dark`, `email`.
 * Plain english works too — it rides the same 83 KB intent model that drives
 * the Catchment terminal, and anything that reads as a *simulation* command
 * ("make it storm", "chuck a meteor") is handed off: the shell navigates to
 * /catchment and the sim terminal runs it on arrival. One model, whole site.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createLazyClassifier } from "@/lib/catchment/intent";
import { setTheme } from "@/lib/theme";
import { profile } from "@/data/metadata";

export const CATCHMENT_HANDOFF_KEY = "catchment:handoff";
export const SITE_TERMINAL_VISIBILITY_EVENT = "site-terminal:visibility";

type Line = { kind: "in" | "ok" | "err" | "dim" | "block"; text: string; cmd?: string };

const PAGES: { id: string; path: string; blurb: string; aliases: string[] }[] = [
  { id: "home", path: "/", blurb: "the front door", aliases: ["index", "root"] },
  { id: "work", path: "/projects", blurb: "case studies — ArborMeta, Step One, FibreTrace", aliases: ["projects", "cases"] },
  { id: "playground", path: "/playground", blurb: "live GPU demos", aliases: ["demos", "lab"] },
  { id: "catchment", path: "/catchment", blurb: "neural earth engine — flagship i", aliases: [] },
  { id: "genesis", path: "/genesis", blurb: "artificial-life lab — flagship ii", aliases: [] },
  { id: "pretraining", path: "/pretraining", blurb: "LLM pretraining under fixed compute, the report", aliases: ["report", "paper", "research"] },
  { id: "canopy", path: "/canopy", blurb: "canopy cover from orbit, the day job deep-dive", aliases: ["arbormeta", "forest", "lidar"] },
  { id: "pagerank", path: "/pagerank", blurb: "web navigation as a stochastic process", aliases: ["surf", "markov", "monash", "fit3139"] },
  { id: "about", path: "/about", blurb: "who's building this", aliases: ["bio"] },
  { id: "experience", path: "/experience", blurb: "the timeline", aliases: ["timeline"] },
  { id: "skills", path: "/skills", blurb: "the toolbox", aliases: ["stack"] },
  { id: "contact", path: "/contact", blurb: "start a conversation", aliases: ["hire", "talk"] },
];

/** Intent groups that belong to the simulation — hand these off to /catchment. */
const SIM_GROUPS = new Set(["rain", "storm", "erosion", "wind", "relief", "sun", "mode", "scene", "neural", "map"]);

const BOOT: Line[] = [
  { kind: "block", text: "[ok] shell    hjh/os — site command line" },
  { kind: "dim", text: "tip: `ls` · `open genesis` · `resume`", cmd: "ls" },
];

/** Short discoverable commands — rotate while the prompt is empty. */
const PLACEHOLDERS = [
  "open pagerank",
  "open canopy",
  "open pretraining",
  "open genesis",
  "open catchment",
  "resume",
  "whoami",
  "ls",
];

const HELP: Line[] = [
  { kind: "block", text: "go       open <page> · ls · pwd · back" },
  { kind: "block", text: "harvey   resume · email · github · linkedin · whoami" },
  { kind: "block", text: "site     theme dark|light · clear · help" },
  { kind: "dim", text: "…and anything the catchment understands runs there:", cmd: undefined },
  { kind: "dim", text: "  ↳ chuck a meteor at it", cmd: "chuck a meteor at it" },
];

const SUGGESTIONS = [
  "open catchment", "open genesis", "open pagerank", "open canopy", "open pretraining",
  "open work", "ls", "resume", "email", "github", "linkedin", "theme dark", "whoami", "help",
  "make it storm",
];

const CSS = `
.st-root{position:fixed;bottom:0;left:0;margin:20px;z-index:60;width:min(400px,calc(100vw - 40px));font-family:var(--font-mono),"JetBrains Mono",ui-monospace,monospace;background:rgba(26,26,24,0.92);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border:1px solid rgba(216,211,200,0.22);border-left:2px solid #4A6741;box-shadow:0 12px 44px rgba(0,0,0,0.35);}
.st-head{display:flex;align-items:center;justify-content:space-between;padding:9px 12px 8px;border-bottom:1px solid rgba(216,211,200,0.14);}
.st-title{font-size:0.62rem;letter-spacing:0.16em;color:rgba(247,245,240,0.85);}
.st-close{width:20px;height:20px;display:flex;align-items:center;justify-content:center;border:1px solid rgba(216,211,200,0.25);background:transparent;color:rgba(247,245,240,0.6);font-size:0.8rem;line-height:1;cursor:pointer;transition:background .15s,color .15s;}
.st-close:hover{background:rgba(247,245,240,0.08);color:#F7F5F0;}
.st-scroll{max-height:230px;overflow-y:auto;overscroll-behavior:contain;padding:10px 12px 6px;}
.st-scroll::-webkit-scrollbar{width:5px;}
.st-scroll::-webkit-scrollbar-thumb{background:rgba(143,174,131,0.3);border-radius:3px;}
.st-line{display:block;width:100%;text-align:left;font-size:0.68rem;line-height:1.55;white-space:pre-wrap;word-break:break-word;background:none;border:none;padding:0;margin:0;font-family:inherit;}
.st-line.in{color:rgba(247,245,240,0.92);}
.st-line.in::before{content:"❯ ";color:#8FAE83;}
.st-line.ok{color:#A9C49B;}
.st-line.err{color:#C99578;}
.st-line.dim{color:rgba(247,245,240,0.38);}
.st-line.block{color:rgba(247,245,240,0.7);}
button.st-line{cursor:pointer;transition:color .12s;}
button.st-line:hover{color:#A9C49B;}
button.st-line:hover::after{content:"  ↵";color:rgba(143,174,131,0.7);}
.st-suggest{display:flex;flex-wrap:wrap;gap:6px;padding:8px 12px 0;border-top:1px solid rgba(216,211,200,0.14);}
.st-chip{font-family:inherit;font-size:0.6rem;letter-spacing:0.04em;color:rgba(247,245,240,0.55);background:rgba(247,245,240,0.05);border:1px solid rgba(216,211,200,0.2);padding:2px 8px;cursor:pointer;transition:color .12s,border-color .12s;}
.st-chip:hover{color:#A9C49B;border-color:rgba(143,174,131,0.5);}
.st-chip em{font-style:normal;color:#8FAE83;}
.st-inputrow{display:flex;align-items:center;gap:8px;padding:8px 12px 10px;}
.st-inputrow.has-border{border-top:1px solid rgba(216,211,200,0.14);}
.st-prompt{color:#8FAE83;font-size:0.72rem;flex:none;}
.st-input{flex:1;min-width:0;font-family:inherit;font-size:0.7rem;line-height:1.4;letter-spacing:0.02em;background:transparent;border:none;padding:0;color:#F7F5F0;caret-color:#8FAE83;outline:none;}
.st-input::placeholder{color:rgba(143,174,131,0.42);text-shadow:0 0 10px rgba(143,174,131,0.22);transition:opacity .55s ease,color .55s ease,text-shadow .55s ease;}
.st-input.st-ph-fade::placeholder{opacity:0;}
@keyframes st-ph-glow{
  0%,100%{color:rgba(143,174,131,0.36);text-shadow:0 0 6px rgba(143,174,131,0.12);}
  50%{color:rgba(169,196,155,0.58);text-shadow:0 0 14px rgba(143,174,131,0.38);}
}
@media (prefers-reduced-motion:no-preference){
  .st-input:placeholder-shown::placeholder{animation:st-ph-glow 3.6s ease-in-out infinite;}
}
.st-key{flex:none;font-size:0.54rem;letter-spacing:0.1em;color:rgba(247,245,240,0.3);border:1px solid rgba(247,245,240,0.16);padding:1px 5px;user-select:none;}
`;

export default function SiteTerminal() {
  const router = useRouter();
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [lines, setLines] = useState<Line[]>(BOOT);
  const [input, setInput] = useState("");
  const [placeholder, setPlaceholder] = useState(PLACEHOLDERS[0]);
  const [phFade, setPhFade] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const history = useRef<string[]>([]);
  const histIdx = useRef(-1);
  const draft = useRef("");
  const phIdx = useRef(0);
  const prevPath = useRef(pathname);

  const classify = useMemo(() => createLazyClassifier("/catchment/intent.json"), []);

  // Catchment runs its own terminal on `/` — the shell stands down there.
  const suppressed = pathname === "/catchment";

  const append = useCallback((added: Line[]) => {
    setLines((prev) => [...prev, ...added].slice(-160));
  }, []);

  const goto = useCallback((page: (typeof PAGES)[number]): Line[] => {
    if (page.path === pathname) return [{ kind: "dim", text: `already here: ${page.path}` }];
    setVisible(false);
    router.push(page.path);
    return [{ kind: "ok", text: `→ ${page.path} — ${page.blurb}` }];
  }, [router, pathname]);

  const pageLines = useCallback((): Line[] => [
    { kind: "dim", text: "$ ls /site" },
    ...PAGES.map((p): Line => ({
      kind: "block",
      text: `${p.path === pathname ? "▸" : " "} ${p.id.padEnd(12)} ${p.blurb}`,
      cmd: p.path === pathname ? undefined : `open ${p.id}`,
    })),
    { kind: "dim", text: "click a page — or `open <name>`." },
  ], [pathname]);

  const handoff = useCallback((cmd: string): Line[] => {
    try { sessionStorage.setItem(CATCHMENT_HANDOFF_KEY, cmd); } catch { /* private mode */ }
    setVisible(false);
    router.push("/catchment");
    return [
      { kind: "ok", text: "that's a job for the earth engine — heading to /catchment." },
      { kind: "dim", text: "your command runs when the terrain is up." },
    ];
  }, [router]);

  const run = useCallback(async (raw: string): Promise<Line[]> => {
    const tokens = raw.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!tokens.length) return [];
    const [head, ...args] = tokens;

    const findPage = (q: string | undefined) =>
      q ? PAGES.find((p) => p.id === q || p.aliases.includes(q) || p.path === q || p.path === `/${q}`) : undefined;

    switch (head) {
      case "help": case "h": case "?": return HELP;
      case "clear": case "cls": setLines([]); return [];
      case "ls": case "pages": case "sitemap": return pageLines();
      case "pwd": return [{ kind: "block", text: pathname }];
      case "back": setVisible(false); router.back(); return [{ kind: "ok", text: "← back" }];
      case "open": case "goto": case "cd": case "go": {
        const page = findPage(args[0]);
        if (!page) return [{ kind: "err", text: `no page '${args[0] ?? ""}'.` }, ...pageLines()];
        return goto(page);
      }
      case "resume": case "cv":
        window.open(profile.resume, "_blank", "noopener");
        return [{ kind: "ok", text: "resume opened — pdf, one tab over." }];
      case "email": case "mail":
        window.location.href = profile.bookCall;
        return [{ kind: "ok", text: `drafting mail to ${profile.email}…` }];
      case "github": case "gh":
        window.open(profile.social.github, "_blank", "noopener");
        return [{ kind: "ok", text: "github opened — the source of all of this is public." }];
      case "linkedin":
        window.open(profile.social.linkedin, "_blank", "noopener");
        return [{ kind: "ok", text: "linkedin opened." }];
      case "theme": {
        const want = args[0] === "dark" || args[0] === "light"
          ? args[0]
          : document.documentElement.classList.contains("dark") ? "light" : "dark";
        setTheme(want as "dark" | "light");
        return [{ kind: "ok", text: `theme → ${want}` }];
      }
      case "whoami":
        return [
          { kind: "block", text: "guest — welcome. the site is yours; the GPU demos run on your machine." },
          { kind: "dim", text: `the owner: ${profile.name} — ${profile.title.toLowerCase()}`, cmd: "open about" },
        ];
      case "hire": case "contract": case "contact":
        return goto(PAGES.find((p) => p.id === "contact")!);
    }

    // Bare page names: `catchment`, `genesis`, `work`…
    const bare = findPage(head);
    if (bare && args.length === 0) return goto(bare);

    // Site-flavoured phrases the model shouldn't have to guess at.
    const t = " " + raw.toLowerCase() + " ";
    if (/\b(resume|cv)\b/.test(t)) { window.open(profile.resume, "_blank", "noopener"); return [{ kind: "ok", text: "resume opened." }]; }
    if (/\b(email|get in touch|reach out|hire|contract|work with)\b/.test(t)) return goto(PAGES.find((p) => p.id === "contact")!);
    if (/\b(github|source|code)\b/.test(t)) { window.open(profile.social.github, "_blank", "noopener"); return [{ kind: "ok", text: "github opened." }]; }
    if (/\b(dark|light)\s*(mode|theme)\b/.test(t)) { const m = t.includes("dark") ? "dark" : "light"; setTheme(m); return [{ kind: "ok", text: `theme → ${m}` }]; }
    if (/\b(demo|demos|play|simulation|simulations)\b/.test(t)) return goto(PAGES.find((p) => p.id === "playground")!);

    // Natural language → the shared intent model. Sim intents hand off.
    const pred = await classify(raw);
    if (pred && pred.intent !== "none") {
      const group = pred.intent.split(".")[0];
      if (SIM_GROUPS.has(group)) return handoff(raw);
      if (pred.intent === "help") return HELP;
      if (pred.intent === "status") return [{ kind: "block", text: pathname }, ...pageLines()];
    }
    return [{ kind: "err", text: "no parse. `help` lists the shell — or try “make it storm”." }];
  }, [classify, goto, handoff, pageLines, pathname, router]);

  // Close when navigation lands — layout keeps the shell mounted across routes.
  useEffect(() => {
    if (prevPath.current !== pathname) {
      setVisible(false);
      prevPath.current = pathname;
    }
  }, [pathname]);

  // Let other UI (footer runner, etc.) stand down while the shell is open.
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent(SITE_TERMINAL_VISIBILITY_EVENT, {
        detail: { open: visible && !suppressed },
      }),
    );
  }, [visible, suppressed]);

  const submit = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text) return;
    history.current.push(text);
    histIdx.current = -1;
    setInput("");
    append([{ kind: "in", text }]);
    try {
      const out = await run(text);
      if (out.length) append(out);
    } catch {
      append([{ kind: "err", text: "internal error — that one's on me." }]);
    }
  }, [append, run]);

  const suggestions = useMemo(() => {
    const q = input.trimStart().toLowerCase();
    if (!q) return [];
    return SUGGESTIONS.filter((s) => s.startsWith(q) && s !== q).slice(0, 3);
  }, [input]);

  // `/` opens the shell anywhere; Esc closes; the navbar chip fires an event.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (suppressed) return;
      if (e.key === "Escape" && visible) { setVisible(false); return; }
      if (e.key !== "/" && e.key !== "`") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
      setVisible(true);
      window.setTimeout(() => inputRef.current?.focus(), 20);
    };
    const onOpen = () => {
      setVisible(true);
      window.setTimeout(() => inputRef.current?.focus(), 20);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("site-terminal:open", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("site-terminal:open", onOpen);
    };
  }, [suppressed, visible]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines, visible]);

  // Soft-rotate empty-prompt hints every 12s — only while idle.
  useEffect(() => {
    if (!visible || input.length > 0) return;
    const id = window.setInterval(() => {
      setPhFade(true);
      window.setTimeout(() => {
        phIdx.current = (phIdx.current + 1) % PLACEHOLDERS.length;
        setPlaceholder(PLACEHOLDERS[phIdx.current]);
        setPhFade(false);
      }, 280);
    }, 12000);
    return () => window.clearInterval(id);
  }, [visible, input]);

  if (suppressed || !visible) return null;

  return (
    <div className="st-root" role="dialog" aria-label="Site command line">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="st-head">
        <span className="st-title">hjh/os · shell</span>
        <button type="button" className="st-close" aria-label="Close terminal" onClick={() => setVisible(false)}>✕</button>
      </div>
      <div ref={scrollRef} className="st-scroll" aria-live="polite">
        {lines.map((l, i) =>
          l.cmd ? (
            <button key={i} type="button" className={`st-line ${l.kind}`} onClick={() => void submit(l.cmd!)}>{l.text}</button>
          ) : (
            <div key={i} className={`st-line ${l.kind}`}>{l.text}</div>
          ),
        )}
      </div>
      {suggestions.length > 0 && (
        <div className="st-suggest">
          {suggestions.map((s) => (
            <button key={s} type="button" className="st-chip" onClick={() => void submit(s)}>
              <em>{s.slice(0, input.trimStart().length)}</em>{s.slice(input.trimStart().length)}
            </button>
          ))}
        </div>
      )}
      <div className={`st-inputrow${suggestions.length === 0 ? " has-border" : ""}`} onClick={() => inputRef.current?.focus()}>
        <span className="st-prompt">❯</span>
        <input
          ref={inputRef}
          className={`st-input${phFade ? " st-ph-fade" : ""}`}
          value={input}
          placeholder={placeholder}
          spellCheck={false}
          autoComplete="off"
          aria-label="Site command input"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit(input);
            else if (e.key === "Tab") { e.preventDefault(); if (suggestions[0]) setInput(suggestions[0]); }
            else if (e.key === "ArrowUp") {
              e.preventDefault();
              const h = history.current;
              if (!h.length) return;
              if (histIdx.current === -1) { draft.current = input; histIdx.current = h.length - 1; }
              else histIdx.current = Math.max(0, histIdx.current - 1);
              setInput(h[histIdx.current]);
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              const h = history.current;
              if (histIdx.current === -1) return;
              histIdx.current += 1;
              if (histIdx.current >= h.length) { histIdx.current = -1; setInput(draft.current); }
              else setInput(h[histIdx.current]);
            }
          }}
        />
        <span className="st-key">esc</span>
      </div>
    </div>
  );
}
