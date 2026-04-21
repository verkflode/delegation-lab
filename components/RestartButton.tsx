"use client";

import { RotateCcw } from "lucide-react";
import { useGame } from "../lib/game-state";

/**
 * Floating restart button — visible on all screens except the title.
 * Resets the entire game state and returns to the title screen.
 */
export function RestartButton() {
  const { reset } = useGame();

  return (
    <button
      onClick={reset}
      className="fixed top-5 right-5 z-50 inline-flex items-center gap-2 rounded-full border border-white/10 bg-bg-1/80 backdrop-blur-sm px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-muted hover:text-ink hover:border-white/25 transition focus-ring"
      aria-label="Restart simulation"
    >
      <RotateCcw size={11} />
      Restart
    </button>
  );
}
