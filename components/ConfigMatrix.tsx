"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useGame } from "../lib/game-state";
import { DECISION_TYPES, PATTERNS } from "../lib/patterns";
import type { DecisionType, DelegationPattern, DimensionWeights, R2Policy } from "../lib/types";
import { DEFAULT_WEIGHTS } from "../lib/types";
import { DecompositionRadar } from "./DecompositionRadar";

/**
 * Round 2 configuration: assign one of six delegation patterns + a per-type
 * confidence threshold to each decision type. The DecompositionRadar shows
 * the authority profile so the player can see which pattern fits — without
 * being told the answer outright.
 */

const ASSIGNABLE_TYPES: DecisionType[] = [
  "standard",
  "high_value",
  "duplicate",
  "modified_terms",
  "new_vendor",
];

const ASSIGNABLE_PATTERNS: DelegationPattern[] = [
  "execute_audit",
  "draft_approve",
  "triage_route",
  "prepare_present",
];

export function ConfigMatrix() {
  const { setR2, advance } = useGame();
  const [selected, setSelected] = useState<DecisionType>("standard");
  const [weights, setWeights] = useState<DimensionWeights>({ ...DEFAULT_WEIGHTS });
  const [policy, setPolicy] = useState<R2Policy>(() => ({
    perType: {
      standard: { pattern: "execute_audit", threshold: 88 },
      high_value: { pattern: "draft_approve", threshold: 92 },
      duplicate: { pattern: "triage_route", threshold: 75 },
      modified_terms: { pattern: "prepare_present", threshold: 90 },
      new_vendor: { pattern: "draft_approve", threshold: 85 },
    },
  }));

  const setPattern = (type: DecisionType, pattern: DelegationPattern) => {
    setPolicy((p) => ({
      ...p,
      perType: {
        ...p.perType,
        [type]: { pattern, threshold: p.perType[type]?.threshold ?? 85 },
      },
    }));
  };

  const setThreshold = (type: DecisionType, threshold: number) => {
    setPolicy((p) => ({
      ...p,
      perType: {
        ...p.perType,
        [type]: {
          pattern: p.perType[type]?.pattern ?? "execute_audit",
          threshold,
        },
      },
    }));
  };

  const adjustWeight = (dim: keyof DimensionWeights, value: number) => {
    setWeights((prev) => {
      const delta = value - prev[dim];
      const others = (Object.keys(prev) as (keyof DimensionWeights)[]).filter(
        (k) => k !== dim
      );
      const othersSum = others.reduce((s, k) => s + prev[k], 0);
      const next = { ...prev, [dim]: value };
      for (const k of others) {
        next[k] = othersSum > 0
          ? Math.max(0.05, prev[k] - delta * (prev[k] / othersSum))
          : 0.05;
      }
      // Normalize to exactly 1.0
      const total = Object.values(next).reduce((s, v) => s + v, 0);
      for (const k of Object.keys(next) as (keyof DimensionWeights)[]) {
        next[k] = Math.round((next[k] / total) * 100) / 100;
      }
      return next;
    });
  };

  const dimensionCollapseWarning = Object.values(weights).some((w) => w > 0.6);

  const handleStart = () => {
    setR2({ ...policy, weights });
    advance("simulation");
  };

  const meta = DECISION_TYPES[selected];
  const current = policy.perType[selected];
  const allConfigured = ASSIGNABLE_TYPES.every((t) => policy.perType[t]);

  return (
    <div className="min-h-screen px-6 py-12 animate-fade-in">
      <div className="max-w-6xl mx-auto">
        <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-cyan font-bold mb-2">
          Round 2 · Configuration
        </div>
        <h1 className="font-mono text-[28px] md:text-[36px] font-bold text-mint mb-3">
          Assign delegation patterns.
        </h1>
        <p className="text-[14px] text-muted leading-relaxed max-w-3xl">
          Five decision types. Six delegation patterns. Each profile on the radar tells you which pattern fits — Reversibility, Consequence Scope, Regulatory Exposure, Confidence Measurability, Accountability Clarity.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-6 mt-8">
          {/* Decision type list */}
          <div className="space-y-2">
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-2 px-1 mb-1">
              Decision types
            </div>
            {ASSIGNABLE_TYPES.map((t) => {
              const cfg = policy.perType[t];
              const isActive = selected === t;
              return (
                <button
                  key={t}
                  onClick={() => setSelected(t)}
                  className={`w-full text-left surface px-4 py-3 transition border ${
                    isActive
                      ? "border-cyan/60 bg-cyan/8"
                      : "border-white/8 hover:border-white/20"
                  } focus-ring`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-mono text-[12px] font-bold text-ink">
                      {DECISION_TYPES[t].label}
                    </div>
                    {cfg && <CheckCircle2 size={14} className="text-mint" />}
                  </div>
                  {cfg && (
                    <div className="font-mono text-[10px] text-muted-2 mt-1">
                      {PATTERNS[cfg.pattern].name} · {cfg.threshold}%
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Decomposition + pattern picker */}
          <div className="surface-strong px-6 py-5">
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-cyan font-bold">
                  Decomposition profile
                </div>
                <div className="font-mono text-[18px] font-bold text-mint mt-1">
                  {meta.label}
                </div>
                <p className="text-[12.5px] text-muted leading-snug max-w-xs mt-2">
                  {meta.blurb}
                </p>
              </div>
              <DecompositionRadar profile={meta.decomposition} size={200} />
            </div>

            {/* Pattern picker */}
            <div className="mt-6">
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-cyan font-bold mb-3">
                Choose a delegation pattern
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {ASSIGNABLE_PATTERNS.map((p) => {
                  const def = PATTERNS[p];
                  const active = current?.pattern === p;
                  return (
                    <button
                      key={p}
                      onClick={() => setPattern(selected, p)}
                      className={`text-left rounded-xl px-4 py-3 border transition focus-ring ${
                        active
                          ? "border-amber/60 bg-amber/8"
                          : "border-white/10 bg-white/3 hover:border-white/25"
                      }`}
                    >
                      <div className="font-mono text-[11.5px] font-bold text-ink">
                        {def.name}
                      </div>
                      <div className="text-[11px] text-muted leading-snug mt-1">
                        {def.short}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Threshold for this type */}
            <div className="mt-6">
              <div className="flex items-baseline justify-between mb-2">
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-cyan font-bold">
                  Confidence threshold for this type
                </div>
                <div className="font-sans text-[20px] font-bold text-amber tabular-nums">
                  {current?.threshold ?? 85}%
                </div>
              </div>
              <input
                type="range"
                min={50}
                max={99}
                step={1}
                value={current?.threshold ?? 85}
                onChange={(e) => setThreshold(selected, parseInt(e.target.value, 10))}
                className="w-full accent-amber cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Composite dimension weights (v3.5) */}
        <div className="surface-strong px-6 py-5 mt-6">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-cyan font-bold mb-1">
            Composite confidence weights
          </div>
          <p className="text-[12px] text-muted leading-snug max-w-2xl mb-4">
            How much does each dimension contribute to the composite score? Adjust to match this scenario's risk profile. Weights must sum to 100%.
          </p>
          {dimensionCollapseWarning && (
            <div className="rounded-lg border border-amber/40 bg-amber/8 px-3 py-2 mb-4 font-mono text-[10px] text-amber">
              Dimension Collapse risk — one dimension dominates the composite score.
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(
              [
                { key: "modelCertainty", label: "Model certainty" },
                { key: "ruleMatch", label: "Rule match" },
                { key: "dataCompleteness", label: "Data completeness" },
                { key: "anomalySignal", label: "Anomaly signals" },
              ] as const
            ).map((dim) => (
              <div key={dim.key}>
                <div className="flex items-baseline justify-between mb-1">
                  <div className="font-mono text-[9px] text-muted-2 uppercase tracking-[0.12em]">
                    {dim.label}
                  </div>
                  <div className="font-sans text-[14px] font-bold text-ink tabular-nums">
                    {Math.round(weights[dim.key] * 100)}%
                  </div>
                </div>
                <input
                  type="range"
                  min={5}
                  max={80}
                  step={1}
                  value={Math.round(weights[dim.key] * 100)}
                  onChange={(e) =>
                    adjustWeight(dim.key, parseInt(e.target.value, 10) / 100)
                  }
                  className="w-full accent-cyan cursor-pointer"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 flex items-center justify-end gap-4">
          {!allConfigured && (
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber">
              Configure all five decision types
            </div>
          )}
          <button
            onClick={handleStart}
            disabled={!allConfigured}
            className="group inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-amber to-amber/80 text-bg-1 font-bold font-mono uppercase tracking-[0.18em] text-[11px] px-6 py-3 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(232,185,49,0.35)] transition-all focus-ring disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none"
          >
            Run simulation
            <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
}
