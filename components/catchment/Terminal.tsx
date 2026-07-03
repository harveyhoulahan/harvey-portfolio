"use client";

/*
 * Catchment terminal — the one control surface.
 *
 * A small dark console over the pale scene: a staged kernel-style boot,
 * scrollback where output lines can carry commands (click a world to mount
 * it), a clickable suggestion strip under the prompt, ↑/↓ history, and `/`
 * summons it from anywhere. Commands resolve through
 * lib/catchment/terminal-core; natural language rides the lazy-loaded intent
 * model. Timed mode windows ("meteor for 30s") are owned here — the core
 * stays pure.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createLazyClassifier } from "@/lib/catchment/intent";
import {
  completions, createExecutor,
  type CatchmentBus, type ExecResult, type TermLine,
} from "@/lib/catchment/terminal-core";

const MAX_LINES = 240;
const BOOT_STEP_MS = 160;

const BOOT_LINES: TermLine[] = [
  { kind: "block", text: "[ok] kernel   catchment/os 4.1 (webgpu)" },
  { kind: "block", text: "[ok] engine   shallow water · erosion · wildfire — wgsl compute" },
  { kind: "block", text: "[..] intent   26k params · 83 kb — wakes on first plain english" },
  { kind: "dim", text: "tip: type `help` — or just say it: “make it storm”", cmd: "make it storm" },
];

const PLACEHOLDERS = [
  "make it storm",
  "chuck a meteor at it",
  "rain 80",
  "wind from the north",
  "worlds",
  "flood the valleys",
  "help",
];

const TERM_CSS = `
.ct-root{position:absolute;bottom:0;left:0;margin:20px;z-index:7;width:min(400px,calc(100vw - 40px));font-family:var(--font-mono),"JetBrains Mono",ui-monospace,monospace;background:rgba(26,26,24,0.88);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border:1px solid rgba(216,211,200,0.22);border-left:2px solid #4A6741;transition:opacity .6s ease;}
.ct-root.is-faded{opacity:0;pointer-events:none;}
.ct-head{display:flex;align-items:center;justify-content:space-between;padding:9px 12px 8px;border-bottom:1px solid rgba(216,211,200,0.14);}
.ct-title{font-size:0.62rem;letter-spacing:0.16em;color:rgba(247,245,240,0.85);}
.ct-live{display:inline-flex;align-items:center;gap:6px;font-size:0.56rem;letter-spacing:0.14em;text-transform:uppercase;color:#8FAE83;cursor:pointer;user-select:none;background:none;border:none;font-family:inherit;padding:0;}
.ct-live i{width:6px;height:6px;border-radius:50%;background:#8FAE83;display:inline-block;animation:ct-pulse 2s ease-in-out infinite;}
@keyframes ct-pulse{0%,100%{opacity:1}50%{opacity:0.25}}
.ct-collapse{width:20px;height:20px;display:flex;align-items:center;justify-content:center;border:1px solid rgba(216,211,200,0.25);background:transparent;color:rgba(247,245,240,0.6);font-size:0.85rem;line-height:1;cursor:pointer;transition:background .15s,color .15s;}
.ct-collapse:hover{background:rgba(247,245,240,0.08);color:#F7F5F0;}
.ct-scroll{max-height:236px;overflow-y:auto;overscroll-behavior:contain;padding:10px 12px 6px;}
.ct-scroll::-webkit-scrollbar{width:5px;}
.ct-scroll::-webkit-scrollbar-thumb{background:rgba(143,174,131,0.3);border-radius:3px;}
.ct-scroll::-webkit-scrollbar-track{background:transparent;}
.ct-line{display:block;width:100%;text-align:left;font-size:0.68rem;line-height:1.55;white-space:pre-wrap;word-break:break-word;background:none;border:none;padding:0;margin:0;font-family:inherit;}
.ct-line.in{color:rgba(247,245,240,0.92);}
.ct-line.in::before{content:"❯ ";color:#8FAE83;}
.ct-line.ok{color:#A9C49B;}
.ct-line.err{color:#C99578;}
.ct-line.dim{color:rgba(247,245,240,0.38);}
.ct-line.block{color:rgba(247,245,240,0.7);}
button.ct-line{cursor:pointer;transition:color .12s;}
button.ct-line:hover{color:#A9C49B;}
button.ct-line:hover::after{content:"  ↵";color:rgba(143,174,131,0.7);}
.ct-suggest{display:flex;flex-wrap:wrap;gap:6px;padding:8px 12px 0;border-top:1px solid rgba(216,211,200,0.14);}
.ct-chip{font-family:inherit;font-size:0.6rem;letter-spacing:0.04em;color:rgba(247,245,240,0.55);background:rgba(247,245,240,0.05);border:1px solid rgba(216,211,200,0.2);padding:2px 8px;cursor:pointer;transition:color .12s,border-color .12s;}
.ct-chip:hover{color:#A9C49B;border-color:rgba(143,174,131,0.5);}
.ct-chip em{font-style:normal;color:#8FAE83;}
.ct-inputrow{display:flex;align-items:center;gap:8px;padding:8px 12px 10px;}
.ct-inputrow.has-border{border-top:1px solid rgba(216,211,200,0.14);}
.ct-prompt{color:#8FAE83;font-size:0.72rem;flex:none;}
.ct-input{flex:1;min-width:0;font-family:inherit;font-size:0.7rem;line-height:1.4;letter-spacing:0.01em;background:transparent;border:none;padding:0;margin:0;color:#F7F5F0;caret-color:#8FAE83;outline:none;}
.ct-input::placeholder{color:rgba(247,245,240,0.26);}
.ct-key{flex:none;font-size:0.54rem;letter-spacing:0.1em;color:rgba(247,245,240,0.3);border:1px solid rgba(247,245,240,0.16);padding:1px 5px;user-select:none;}
@media (prefers-reduced-motion: reduce){.ct-live i{animation:none;}}
`;

export default function Terminal({ bus, faded }: { bus: CatchmentBus; faded: boolean }) {
  const [lines, setLines] = useState<TermLine[]>([]);
  const [input, setInput] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [focused, setFocused] = useState(false);
  const [placeholder, setPlaceholder] = useState(PLACEHOLDERS[0]);

  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const history = useRef<string[]>([]);
  const histIdx = useRef(-1);
  const draft = useRef("");
  const revertTimer = useRef<number | null>(null);
  const liveClicks = useRef(0);
  const booted = useRef(false);

  const run = useMemo(() => {
    const classify = createLazyClassifier("/catchment/intent.json");
    return createExecutor(bus, classify);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bus]);

  const append = useCallback((added: TermLine[]) => {
    setLines((prev) => [...prev, ...added].slice(-MAX_LINES));
  }, []);

  // Boot: kernel lines land one by one, like the machine is waking up.
  // Reduced motion (or a strict-mode re-run) prints them instantly.
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { append(BOOT_LINES); return; }
    const timers = BOOT_LINES.map((line, i) =>
      window.setTimeout(() => append([line]), (i + 1) * BOOT_STEP_MS),
    );
    return () => {
      // Strict-mode dev remount: clear pending timers and let the re-run boot again.
      timers.forEach((t) => window.clearTimeout(t));
      booted.current = false;
    };
  }, [append]);

  // A timed mode window ("meteor for 30s"): the revert is ours to keep — and
  // ours to cancel the moment any other command changes the mode again.
  const armRevert = useCallback((result: ExecResult) => {
    if (result.modeChanged !== undefined && revertTimer.current !== null) {
      window.clearTimeout(revertTimer.current);
      revertTimer.current = null;
    }
    if (result.revert) {
      const { ms, mode } = result.revert;
      revertTimer.current = window.setTimeout(() => {
        revertTimer.current = null;
        bus.setMode(mode);
        append([{ kind: "dim", text: `window closed — mode → ${mode}.` }]);
      }, ms);
    }
  }, [bus, append]);

  const submit = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text) return;
    history.current.push(text);
    histIdx.current = -1;
    draft.current = "";
    setInput("");
    append([{ kind: "in", text }]);
    try {
      const result = await run(text);
      if (result.clear) setLines([]);
      else if (result.lines.length) append(result.lines);
      armRevert(result);
    } catch {
      append([{ kind: "err", text: "internal error — that one's on me." }]);
    }
  }, [run, append, armRevert]);

  // Suggestion strip: completions extending the current input. Click to run
  // (or to fill, when the completion still wants an argument). Tab takes the first.
  const suggestions = useMemo(() => {
    const q = input.trimStart().toLowerCase();
    if (!q) return [];
    let snap = null;
    try { snap = bus.snapshot(); } catch { /* engine mid-reload */ }
    const out: string[] = [];
    for (const c of completions(snap)) {
      const lc = c.toLowerCase();
      if (lc.startsWith(q) && lc.trim() !== q && !out.some((o) => o.toLowerCase() === lc)) out.push(c);
      if (out.length >= 3) break;
    }
    return out;
  }, [input, bus]);

  const acceptSuggestion = useCallback((s: string) => {
    if (s.endsWith(" ")) {
      setInput(s);
      inputRef.current?.focus();
    } else {
      void submit(s);
      inputRef.current?.focus();
    }
  }, [submit]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      void submit(input);
    } else if (e.key === "Tab") {
      e.preventDefault();
      if (suggestions[0]) setInput(suggestions[0]);
    } else if (e.key === "ArrowUp") {
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
    } else if (e.key === "Escape") {
      inputRef.current?.blur();
    }
  };

  // `/` or backtick summons the terminal from anywhere on the page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" && e.key !== "`") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
      setCollapsed(false);
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Rotate the placeholder while the prompt sits empty — quiet discoverability.
  useEffect(() => {
    const id = window.setInterval(() => {
      setPlaceholder(PLACEHOLDERS[Math.floor(Math.random() * PLACEHOLDERS.length)]);
    }, 5000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines, collapsed]);

  useEffect(() => () => {
    if (revertTimer.current !== null) window.clearTimeout(revertTimer.current);
  }, []);

  // Never fade mid-thought: focus or a filled prompt pins the terminal open.
  const hidden = faded && !focused && input === "";

  return (
    <div className={`ct-root pointer-events-auto${hidden ? " is-faded" : ""}`} onPointerDown={(e) => e.stopPropagation()}>
      <style dangerouslySetInnerHTML={{ __html: TERM_CSS }} />
      <div className="ct-head">
        <span className="ct-title">catchment/os · /dev/terrain</span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            className="ct-live"
            title="live"
            onClick={() => { if (++liveClicks.current >= 5) bus.unlockSecret(); }}
          ><i />live</button>
          <button
            type="button"
            className="ct-collapse"
            aria-label={collapsed ? "Expand terminal" : "Collapse terminal"}
            onClick={() => setCollapsed((v) => !v)}
          >{collapsed ? "+" : "–"}</button>
        </div>
      </div>
      {!collapsed && (
        <div ref={scrollRef} className="ct-scroll" aria-live="polite">
          {lines.map((l, i) =>
            l.cmd ? (
              <button key={i} type="button" className={`ct-line ${l.kind}`} onClick={() => acceptSuggestion(l.cmd!)}>
                {l.text}
              </button>
            ) : (
              <div key={i} className={`ct-line ${l.kind}`}>{l.text}</div>
            ),
          )}
        </div>
      )}
      {!collapsed && suggestions.length > 0 && (
        <div className="ct-suggest">
          {suggestions.map((s) => (
            <button key={s} type="button" className="ct-chip" onClick={() => acceptSuggestion(s)}>
              <em>{s.slice(0, input.trimStart().length)}</em>{s.slice(input.trimStart().length)}
            </button>
          ))}
        </div>
      )}
      <div className={`ct-inputrow${collapsed || suggestions.length === 0 ? " has-border" : ""}`} onClick={() => inputRef.current?.focus()}>
        <span className="ct-prompt">❯</span>
        <input
          ref={inputRef}
          className="ct-input"
          value={input}
          placeholder={`try: ${placeholder}`}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          aria-label="Catchment command input"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => { setFocused(true); setCollapsed(false); }}
          onBlur={() => setFocused(false)}
        />
        {!focused && <span className="ct-key">/</span>}
      </div>
    </div>
  );
}
