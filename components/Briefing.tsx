"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { useGame, useScenario } from "../lib/game-state";
import { briefingKey, ready } from "../lib/v5/narration";
import { VAOMVoice } from "./VAOMVoice";

const TITLES = {
  1: { kicker: "Round 1", title: "The Matrix", concept: "Decision inventory · Authority decomposition · The matrix", cta: "Build the matrix" },
  2: { kicker: "Round 2", title: "The Gate", concept: "Calibrated thresholds · Value ceilings · Cumulative caps", cta: "Set the limits" },
  3: { kicker: "Round 3", title: "The Reviewer", concept: "Funded oversight · Seeded errors · Review engagement", cta: "Plan the review" },
  4: { kicker: "Round 4", title: "The 2 A.M. Test", concept: "Sub-agent chains · Boundary verification · Circuit breakers", cta: "Configure the night" },
};

export function Briefing() {
  const { state, advance } = useGame();
  const sc = useScenario();
  // Waits (briefly, and usually not at all: it was prefetched) for the model's text before typing anything,
  // so the typing never restarts when a different text lands.
  const [text, setText] = useState("");

  useEffect(() => {
    let cancelled = false;
    // The model's version if it's already here (prefetched) or arrives within 1.5 s, else the scripted text.
    ready<string>(briefingKey(state.scenario, state.round), 1500).then((t) => { if (!cancelled) setText(t || sc.briefings[state.round]); });
    return () => { cancelled = true; };
  }, [state.scenario, state.round, sc]);

  const meta = state.round === 2 && sc.ui.gateConcept ? { ...TITLES[2], concept: sc.ui.gateConcept } : TITLES[state.round];

  return (
    <div className="min-h-screen flex items-center px-6 py-16 animate-fade-in">
      <div className="w-full max-w-4xl mx-auto">
        <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-cyan font-bold mb-2">
          {meta.kicker}
        </div>
        <h1 className="font-serif text-[36px] md:text-[44px] leading-[1.05] font-normal tracking-tight text-mint mb-2">
          {meta.title}
        </h1>
        <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-amber mb-8">
          {meta.concept}
        </div>

        <VAOMVoice text={text} moment="round_briefing" label={`VAOM · ${meta.kicker} briefing`} />

        <div className="mt-8 flex items-center justify-between">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-2">
            Press start when ready
          </div>
          <button
            onClick={() => advance("config")}
            className="group inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-cyan to-cyan/70 text-bg-1 font-bold font-mono uppercase tracking-[0.18em] text-[11px] px-6 py-3 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(45,106,79,0.30)] transition-all focus-ring"
          >
            {meta.cta}
            <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
}
