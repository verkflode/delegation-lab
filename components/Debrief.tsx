"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Trophy } from "lucide-react";
import { useGame } from "../lib/game-state";
import { fetchDebrief } from "../lib/api";
import { debriefFallback } from "../data/vaom-text";
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
  const [text, setText] = useState<string>(() =>
    result
      ? debriefFallback({
          round: state.round,
          processed: result.processed,
          score: result.score,
          policy: { r1: state.r1, r2: state.r2, r3: state.r3 },
          antiPatterns: result.antiPatterns,
          multiAgentFailures: result.multiAgentFailures,
        })
      : ""
  );

  useEffect(() => {
    if (!result) return;
    let cancelled = false;
    setText(
      debriefFallback({
        round: state.round,
        processed: result.processed,
        score: result.score,
        policy: { r1: state.r1, r2: state.r2, r3: state.r3 },
        antiPatterns: result.antiPatterns,
        multiAgentFailures: result.multiAgentFailures,
      })
    );
    fetchDebrief({
      round: state.round,
      processed: result.processed,
      score: result.score,
      policy: { r1: state.r1, r2: state.r2, r3: state.r3 },
    }).then((dynamic) => {
      if (cancelled) return;
      if (dynamic && dynamic.length > 50) setText(dynamic);
    });
    return () => {
      cancelled = true;
    };
  }, [result, state.round, state.r1, state.r2, state.r3]);

  if (!result) return null;

  const isMissed = result.processed.some(
    (p) => p.outcome === "risky" || p.outcome === "missed"
  );
  const moment: GameMoment = isMissed ? "debrief_missed" : "debrief_good";

  const handleAdvance = () => {
    if (state.round === 3) {
      advance("final");
      return;
    }
    setRound((state.round + 1) as 1 | 2 | 3);
    advance("briefing");
  };

  return (
    <div className="min-h-screen px-6 py-12 animate-fade-in">
      <div className="max-w-4xl mx-auto">
        <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-cyan font-bold mb-2">
          Round {state.round} · Debrief
        </div>
        <h1 className="font-mono text-[28px] md:text-[36px] font-bold text-mint mb-6 flex items-center gap-3">
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
            {state.round === 3 ? "Final assessment is next" : `Round ${state.round + 1} awaits`}
          </div>
          <button
            onClick={handleAdvance}
            className="group inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-cyan to-cyan/70 text-bg-1 font-bold font-mono uppercase tracking-[0.18em] text-[11px] px-6 py-3 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(98,182,203,0.35)] transition-all focus-ring"
          >
            {state.round === 3 ? "Reveal profile" : `Begin Round ${state.round + 1}`}
            <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function ScoreBar({
  score,
  compact = false,
}: {
  score: ScoreBreakdown;
  compact?: boolean;
}) {
  const items: { label: string; value: number; tone: string }[] = [
    { label: "Efficiency", value: score.efficiency, tone: "from-cyan to-cyan/40" },
    { label: "Risk control", value: score.riskControl, tone: "from-mint to-mint/40" },
    { label: "Compliance", value: score.compliance, tone: "from-amber to-amber/40" },
    { label: "Adaptability", value: score.adaptability, tone: "from-lav to-lav/40" },
  ];
  // In compact mode (used inside per-round breakdown columns) we always render
  // 2 columns regardless of viewport so the labels don't collide.
  const gridCls = compact
    ? "grid grid-cols-2 gap-2.5"
    : "grid grid-cols-2 md:grid-cols-4 gap-3";
  return (
    <div className="surface-strong px-5 py-4">
      {!compact && (
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan font-bold mb-3">
          Round score · /25 each
        </div>
      )}
      <div className={gridCls}>
        {items.map((it) => (
          <div key={it.label}>
            <div className="flex items-baseline justify-between mb-1 gap-2">
              <div className="font-mono text-[9px] text-muted-2 truncate">{it.label}</div>
              <div className="font-sans text-[13px] font-bold text-ink whitespace-nowrap tabular-nums">
                {it.value}
                <span className="text-muted-2 text-[10px]">/25</span>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${it.tone}`}
                style={{ width: `${(it.value / 25) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
