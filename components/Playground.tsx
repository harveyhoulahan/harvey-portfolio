"use client";

import { useState } from "react";
import SpatialDemo from "@/components/SpatialDemo";
import EmbeddingAtlas from "@/components/EmbeddingAtlas";

const TABS = [
  { id: "search", label: "Semantic search", hint: "language → terrain" },
  { id: "atlas", label: "Embedding atlas", hint: "few-shot mapping" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function Playground() {
  const [tab, setTab] = useState<TabId>("search");

  return (
    <div>
      {/* tab bar */}
      <div className="border-b border-hairline">
        <div className="mx-auto flex max-w-work flex-wrap items-end gap-1 px-6">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                aria-pressed={active}
                className={`group relative -mb-px border-b-2 px-4 py-3 text-left transition-colors ${
                  active ? "border-sage" : "border-transparent hover:border-hairline"
                }`}
              >
                <span className={`block font-mono text-xs uppercase tracking-[0.12em] ${active ? "text-sage" : "text-ink/60 group-hover:text-ink"}`}>
                  {t.label}
                </span>
                <span className="mt-0.5 block font-mono text-[10px] tracking-[0.08em] text-ink/35">
                  {t.hint}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* one map instance at a time */}
      {tab === "search" ? <SpatialDemo /> : <EmbeddingAtlas />}
    </div>
  );
}
