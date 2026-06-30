"use client";

import { useEffect, useRef, useState } from "react";

export interface IdleUIState {
  /** True once the user has interacted (pointer/key/touch) at least once. Never resets. */
  everInteracted: boolean;
  /** True after `timeout` ms with no interaction. Stays false when reduced motion is set. */
  idle: boolean;
}

/**
 * Tracks coarse interaction state for letting a full-screen demo's UI breathe.
 *
 * Two distinct signals, deliberately decoupled:
 * - `everInteracted` flips true only on a *deliberate* act — a click/tap or
 *   keypress. The intro title keys off this, so it retires when the user actually
 *   does something, not merely when the cursor drifts across the canvas.
 * - `idle` reflects plain *movement*: any pointer move/wheel/click keeps it false
 *   and re-arms a timer; after `timeout` ms of stillness it flips true, letting the
 *   controls fade to "just the animation." Moving again revives them.
 *
 * Respects prefers-reduced-motion: `idle` never flips true, so the UI stays put.
 */
export function useIdleUI({ timeout = 3500 }: { timeout?: number } = {}): IdleUIState {
  const [everInteracted, setEverInteracted] = useState(false);
  const [idle, setIdle] = useState(false);
  const timer = useRef<number | null>(null);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

    const arm = () => {
      if (timer.current != null) window.clearTimeout(timer.current);
      if (reduced.current) return;
      timer.current = window.setTimeout(() => setIdle(true), timeout);
    };

    // movement only keeps the controls awake — it must not retire the title
    const onActivity = () => { setIdle(false); arm(); };
    // a deliberate act retires the title and also counts as activity
    const onEngage = () => { setEverInteracted(true); setIdle(false); arm(); };

    const activity: (keyof WindowEventMap)[] = ["pointermove", "wheel", "touchmove"];
    const engage: (keyof WindowEventMap)[] = ["pointerdown", "keydown"];
    for (const e of activity) window.addEventListener(e, onActivity, { passive: true });
    for (const e of engage) window.addEventListener(e, onEngage, { passive: true });

    return () => {
      for (const e of activity) window.removeEventListener(e, onActivity);
      for (const e of engage) window.removeEventListener(e, onEngage);
      if (timer.current != null) window.clearTimeout(timer.current);
    };
  }, [timeout]);

  return { everInteracted, idle };
}
