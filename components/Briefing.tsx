"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { isV5Round, useGame } from "../lib/game-state";
import { fetchBriefing } from "../lib/api";
import { briefingFallback } from "../data/vaom-text";
import { ROUND1_BRIEFING, ROUND2_BRIEFING } from "../lib/v5/round1-result";
import { ROUND3_BRIEFING } from "../lib/v5/round3-result";
import { ROUND4_BRIEFING } from "../lib/v5/round4-result";
import { briefingKey, ready } from "../lib/v5/narration";
import { VAOMVoice } from "./VAOMVoice";
import type { ScenarioDomain } from "../lib/types";

/** Pre-generated Round 1 briefing audio per scenario. Instant playback. */
const CACHED_R1_AUDIO: Record<ScenarioDomain, string> = {
  invoice_processing: "/audio/briefing-r1-invoice.mp3",
  customer_complaints: "/audio/briefing-r1-complaints.mp3",
  aml_triage: "/audio/briefing-r1-aml.mp3",
  hr_investigation: "/audio/briefing-r1-hr.mp3",
};

const ROUND_TITLES: Record<1 | 2 | 3 | 4, { kicker: string; title: string; concept: string }> = {
  1: { kicker: "Round 1", title: "The Basics", concept: "Confidence Gate · Decision Inventory" },
  2: { kicker: "Round 2", title: "The Edge Cases", concept: "Delegation Patterns · Independent Verification" },
  3: { kicker: "Round 3", title: "The Audit", concept: "Foundation Model Drift · Readiness Assessment" },
  4: { kicker: "Round 4", title: "The 2 A.M. Test", concept: "Identity & Credentialing · Attenuation · Guardians" },
};

const V5_TITLES = {
  1: { kicker: "Round 1", title: "The Matrix", concept: "Decision inventory · Authority decomposition · The matrix" },
  2: { kicker: "Round 2", title: "The Gate", concept: "Calibrated thresholds · Value ceilings · Cumulative caps" },
  3: { kicker: "Round 3", title: "The Reviewer", concept: "Funded oversight · Seeded errors · Review engagement" },
  4: { kicker: "Round 4", title: "The 2 A.M. Test", concept: "Sub-agent chains · Boundary verification · Circuit breakers" },
};

export function Briefing() {
  const { state, advance } = useGame();
  // Optimistic load: show the fallback briefing immediately so the screen
  // never feels empty, then swap in the dynamic Claude version when it
  // arrives. The text-typing animation will start over only if the text
  // actually changes.
  // v5 rounds use their own scripted text until the model prompts are rewritten for v5 (M5).
  const v5 = isV5Round(state.round, state.scenario);
  const v5Text = state.round === 4 ? ROUND4_BRIEFING : state.round === 3 ? ROUND3_BRIEFING : state.round === 2 ? ROUND2_BRIEFING : ROUND1_BRIEFING;
  // v5 waits (briefly, and usually not at all: it was prefetched) for the model's text before typing anything,
  // so the typing never restarts when a different text lands.
  const [text, setText] = useState(() => (v5 ? "" : briefingFallback(state.round, state.scenario)));
  const mountedAt = useRef(0); // set when the effect runs

  useEffect(() => {
    let cancelled = false;
    mountedAt.current = Date.now();
    if (v5) {
      // The model's version if it's already here (prefetched) or arrives within 1.5 s, else the scripted text.
      ready<string>(briefingKey(state.round), 1500).then((t) => { if (!cancelled) setText(t || v5Text); });
      return () => { cancelled = true; };
    }
    setText(briefingFallback(state.round, state.scenario));
    fetchBriefing(state.round, state.scenario).then((dynamic) => {
      if (cancelled) return;
      // Only swap if Claude responded fast enough that the player hasn't
      // started reading yet (~1.5s). Otherwise let the fallback finish.
      if (dynamic && dynamic.length > 20 && Date.now() - mountedAt.current < 1500) {
        setText(dynamic);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [state.round, state.scenario, v5, v5Text]);

  const meta = v5 ? V5_TITLES[state.round] : ROUND_TITLES[state.round];
  const nextPhase = state.round === 3 && !v5 ? "preEvents" : "config";

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

        <VAOMVoice
          text={text}
          moment="round_briefing"
          label={`VAOM · ${meta.kicker} briefing`}
          cachedAudioUrl={state.round === 1 && !v5 ? CACHED_R1_AUDIO[state.scenario] : undefined}
        />

        <div className="mt-8 flex items-center justify-between">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-2">
            Press start when ready
          </div>
          <button
            onClick={() => advance(nextPhase)}
            className="group inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-cyan to-cyan/70 text-bg-1 font-bold font-mono uppercase tracking-[0.18em] text-[11px] px-6 py-3 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(45,106,79,0.30)] transition-all focus-ring"
          >
            {v5
              ? state.round === 4 ? "Configure the night" : state.round === 3 ? "Plan the review" : state.round === 2 ? "Set the limits" : "Build the matrix"
              : state.round === 3
                ? "Address pre-events"
                : state.round === 4
                  ? "Configure the night"
                  : "Configure policy"}
            <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
}
