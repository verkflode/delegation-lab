"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { useGame } from "../lib/game-state";
import { fetchBriefing } from "../lib/api";
import { briefingFallback } from "../data/vaom-text";
import { VAOMVoice } from "./VAOMVoice";
import type { ScenarioDomain } from "../lib/types";

/** Pre-generated Round 1 briefing audio per scenario. Instant playback. */
const CACHED_R1_AUDIO: Record<ScenarioDomain, string> = {
  invoice_processing: "/audio/briefing-r1-invoice.mp3",
  customer_complaints: "/audio/briefing-r1-complaints.mp3",
  aml_triage: "/audio/briefing-r1-aml.mp3",
  hr_investigation: "/audio/briefing-r1-hr.mp3",
};

const ROUND_TITLES: Record<1 | 2 | 3, { kicker: string; title: string; concept: string }> = {
  1: { kicker: "Round 1", title: "The Basics", concept: "Confidence Gate · Decision Inventory" },
  2: { kicker: "Round 2", title: "The Edge Cases", concept: "Delegation Patterns · Authority Decomposition" },
  3: { kicker: "Round 3", title: "The Audit", concept: "Foundation Model Drift · Readiness Assessment" },
};

export function Briefing() {
  const { state, advance } = useGame();
  // Optimistic load: show the fallback briefing immediately so the screen
  // never feels empty, then swap in the dynamic Claude version when it
  // arrives. The text-typing animation will start over only if the text
  // actually changes.
  const [text, setText] = useState(() => briefingFallback(state.round, state.scenario));

  useEffect(() => {
    let cancelled = false;
    setText(briefingFallback(state.round, state.scenario));
    fetchBriefing(state.round, state.scenario).then((dynamic) => {
      if (cancelled) return;
      if (dynamic && dynamic.length > 20) setText(dynamic);
    });
    return () => {
      cancelled = true;
    };
  }, [state.round, state.scenario]);

  const meta = ROUND_TITLES[state.round];
  const nextPhase = state.round === 3 ? "preEvents" : "config";

  return (
    <div className="min-h-screen flex items-center px-6 py-16 animate-fade-in">
      <div className="w-full max-w-4xl mx-auto">
        <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-cyan font-bold mb-2">
          {meta.kicker}
        </div>
        <h1 className="font-mono text-[36px] md:text-[44px] leading-[1.05] font-bold tracking-tight text-mint mb-2">
          {meta.title}
        </h1>
        <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-amber mb-8">
          {meta.concept}
        </div>

        <VAOMVoice
          text={text}
          moment="round_briefing"
          label={`VAOM · ${meta.kicker} briefing`}
          cachedAudioUrl={state.round === 1 ? CACHED_R1_AUDIO[state.scenario] : undefined}
        />

        <div className="mt-8 flex items-center justify-between">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-2">
            Press start when ready
          </div>
          <button
            onClick={() => advance(nextPhase)}
            className="group inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-cyan to-cyan/70 text-bg-1 font-bold font-mono uppercase tracking-[0.18em] text-[11px] px-6 py-3 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(98,182,203,0.35)] transition-all focus-ring"
          >
            {state.round === 3 ? "Address pre-events" : "Configure policy"}
            <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
}
