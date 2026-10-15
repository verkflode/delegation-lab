"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Trophy } from "lucide-react";
import { isV5Round, useGame } from "../lib/game-state";
import { fetchDebrief } from "../lib/api";
import { debriefFallback } from "../data/vaom-text";
import { round1Debrief, round2Debrief } from "../lib/v5/round1-result";
import { calibrate } from "../lib/v5/round2";
import { VAOMVoice } from "./VAOMVoice";
import { AntiPatternList } from "./AntiPatternAlert";
import type { GameMoment } from "../lib/ssml";
import type { ScoreBreakdown } from "../lib/types";

/**
 * Round debrief: VAOM analyzes the just-completed run, then offers a button
 * to advance to the next round (or to the final assessment).
 */
export function Debrief() {
  const { state, advance, setRound } = useGame();
  const result = state.results[state.results.length - 1];
  // v5 round 1 has its own scripted debrief until the model prompts are rewritten for v5 (M5).
  const v5 = isV5Round(state.round, state.scenario);
  const v5Text = !result || !v5 ? null
    : result.v5Debrief ? result.v5Debrief
    : state.round === 2 && state.v5r2 ? round2Debrief(result, state.v5r2, calibrate(state.v5r2.errorTarget).threshold)
    : state.round === 1 && state.v5r1 ? round1Debrief(result, state.v5r1)
    : null;
  const [text, setText] = useState<string>(() =>
    v5Text ?? (result
      ? debriefFallback({
          round: state.round,
          processed: result.processed,
          score: result.score,
          policy: { r1: state.r1, r2: state.r2, r3: state.r3, r4: state.r4 },
          antiPatterns: result.antiPatterns,
          multiAgentFailures: result.multiAgentFailures,
          scenario: state.scenario,
          nightEvents: result.nightEvents,
          guardianReport: result.guardianReport,
        })
      : "")
  );

  const mountedAt = useRef(Date.now());

  useEffect(() => {
    if (!result) return;
    let cancelled = false;
    mountedAt.current = Date.now();
    if (v5Text) {
      // Scripted from the run: always right, and the model never improves on that here.
      setText(v5Text);
      return;
    }
    setText(
      debriefFallback({
        round: state.round,
        processed: result.processed,
        score: result.score,
        policy: { r1: state.r1, r2: state.r2, r3: state.r3, r4: state.r4 },
        antiPatterns: result.antiPatterns,
        multiAgentFailures: result.multiAgentFailures,
        scenario: state.scenario,
        nightEvents: result.nightEvents,
        guardianReport: result.guardianReport,
      })
    );
    // Round 4's night debrief is fully scripted — the set-pieces are
    // deterministic, so the fallback IS the canonical text.
    if (state.round !== 4) {
      fetchDebrief({
        round: state.round,
        processed: result.processed,
        score: result.score,
        policy: { r1: state.r1, r2: state.r2, r3: state.r3 },
        scenario: state.scenario,
      }).then((dynamic) => {
        if (cancelled) return;
        if (dynamic && dynamic.length > 50 && Date.now() - mountedAt.current < 1500) {
          setText(dynamic);
        }
      });
    }
    return () => {
      cancelled = true;
    };
  }, [result, v5Text, state.round, state.results.length, state.r1, state.r2, state.r3, state.r4, state.scenario]);

  if (!result) return null;

  const isMissed = result.processed.some(
    (p) => p.outcome === "risky" || p.outcome === "missed"
  );
  const moment: GameMoment = isMissed ? "debrief_missed" : "debrief_good";

  const handleAdvance = () => {
    if (state.round === 4) {
      advance("final");
      return;
    }
    setRound((state.round + 1) as 1 | 2 | 3 | 4);
    advance("briefing");
  };

  return (
    <div className="min-h-screen px-6 py-12 animate-fade-in">
      <div className="max-w-4xl mx-auto">
        <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-cyan font-bold mb-2">
          Round {state.round} · Debrief
        </div>
        <h1 className="font-serif text-[28px] md:text-[36px] font-normal text-mint mb-6 flex items-center gap-3">
          <Trophy size={26} className="text-amber" />
          The verdict
        </h1>

        <ScoreBar score={result.score} />

        {(result.antiPatterns.length > 0 ||
          (result.multiAgentFailures && result.multiAgentFailures.length > 0)) && (
          <div className="mt-4">
            <AntiPatternList
              patterns={result.antiPatterns}
              failures={result.multiAgentFailures}
            />
          </div>
        )}

        <div className="mt-6">
          <VAOMVoice text={text} moment={moment} label="VAOM · Debrief" />
        </div>

        <div className="mt-8 flex items-center justify-between">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-2">
            {state.round === 4 ? "The scorecard is next" : `Round ${state.round + 1} awaits`}
          </div>
          <button
            onClick={handleAdvance}
            className="cta group inline-flex items-center gap-3 rounded-full font-bold font-mono uppercase tracking-[0.18em] text-[11px] px-6 py-3 focus-ring"
          >
            {state.round === 4 ? "Reveal scorecard & profile" : `Begin Round ${state.round + 1}`}
            <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Stable dimension colors — the same hue means the same dimension everywhere
 * (debrief, per-round breakdown, final dashboard). Amber is deliberately
 * absent: it belongs to VAOM's voice and the review band.
 */
export const DIMENSION_TONES: Record<string, string> = {
  efficiency: "from-cyan to-cyan/40",
  riskControl: "from-green-bright to-green-bright/40",
  compliance: "from-sky to-sky/40",
  adaptability: "from-lav to-lav/40",
  enforcement: "from-mint to-mint/40",
};

export function ScoreBar({
  score,
  compact = false,
}: {
  score: ScoreBreakdown;
  compact?: boolean;
}) {
  const items: { key: string; label: string; value: number }[] = [
    { key: "efficiency", label: "Efficiency", value: score.efficiency },
    { key: "riskControl", label: "Risk control", value: score.riskControl },
    { key: "compliance", label: "Compliance", value: score.compliance },
    { key: "adaptability", label: "Adaptability", value: score.adaptability },
    { key: "enforcement", label: "Enforcement", value: score.enforcement ?? 0 },
  ];
  // In compact mode (used inside per-round breakdown columns) we always render
  // 2 columns regardless of viewport so the labels don't collide.
  const gridCls = compact
    ? "grid grid-cols-2 gap-2.5"
    : "grid grid-cols-2 md:grid-cols-5 gap-3";
  return (
    <div className="surface-strong px-5 py-4">
      {!compact && (
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan font-bold mb-3">
          Round score · /20 each
        </div>
      )}
      <div className={gridCls}>
        {items.map((it) => (
          <div key={it.key}>
            <div className="flex items-baseline justify-between mb-1 gap-2">
              <div className="font-mono text-[10px] text-muted-2 truncate">{it.label}</div>
              <div className="font-sans text-[13px] font-bold text-ink whitespace-nowrap tabular-nums">
                {it.value}
                <span className="text-muted-2 text-[10px]">/20</span>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-ink/5 overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${DIMENSION_TONES[it.key]}`}
                style={{ width: `${(it.value / 20) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
