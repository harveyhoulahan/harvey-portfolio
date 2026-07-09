"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

const HighlightCtx = createContext<{
  activeId: string | null;
  setActiveId: (id: string | null) => void;
} | null>(null);

export function PretrainingHighlightProvider({ children }: { children: ReactNode }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  return (
    <HighlightCtx.Provider value={{ activeId, setActiveId }}>
      {children}
    </HighlightCtx.Provider>
  );
}

export function usePretrainingHighlight() {
  const ctx = useContext(HighlightCtx);
  if (!ctx) throw new Error("usePretrainingHighlight must sit inside PretrainingHighlightProvider");
  return ctx;
}
