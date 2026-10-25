"use client";

import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { useGame, useScenario } from "../../lib/game-state";
import { startingGate, toGate } from "../../lib/v5/round2";
import { lintReview, secondsPerAsk, SEED_RATES, startingReview, type ReviewChoice } from "../../lib/v5/round3";
import { explain } from "../../lib/v5/explain";
import { LintPanel, LoadBar, Segmented } from "./MatrixBuilder";

/**
 * Round 3 (v5), "The Reviewer", setup: fund the review, decide where planted cases go, and whether to
 * measure reviewers one by one. The linter decides whether the oversight plan runs.
 */
export function ReviewSetup() {
  const { state, setV5R3, advance } = useGame();
  const sc = useScenario();
  const policy = state.v5r1 ?? sc.round1.startingPolicy();
  const gate = useMemo(() => toGate(sc, state.v5r2 ?? startingGate(sc)), [sc, state.v5r2]);
  const [choice, setChoice] = useState<ReviewChoice>(() => state.v5r3 ?? startingReview(sc));
  const { matrix, lint, hours, funded } = useMemo(() => lintReview(sc, policy, gate, choice), [sc, policy, gate, choice]);
  const explained = useMemo(() => explain(sc, lint, matrix, policy), [sc, lint, matrix, policy]);
  const set = (patch: Partial<ReviewChoice>) => setChoice((c) => ({ ...c, ...patch }));
  const seedable = sc.round1.decisions.filter((d) => policy[d.id].included && policy[d.id].kind === "delegable");
  const anySeeds = Object.values(choice.seedRows).some(Boolean);

  const start = () => {
    setV5R3(choice);
    advance("simulation");
  };

  return (
    <div className="min-h-screen px-4 sm:px-6 py-12 animate-fade-in">
      <div className="max-w-6xl mx-auto">
        <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-cyan font-bold mb-2">Round 3 · The Reviewer</div>
        <h1 className="font-serif text-[28px] md:text-[36px] leading-[1.1] font-normal text-mint mb-3">Fund the review, then do it.</h1>
        <p className="text-[14px] text-muted leading-relaxed max-w-2xl">
          Your matrix and limits stand. Decide how many reviewer hours to fund and how you will know whether review
          works. Then you take {sc.ui.days[2]}&apos;s queue yourself.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-6 mt-8 items-start">
          <div className="space-y-4 min-w-0">
            <Card kicker="Funding" title={`${choice.fundedHours} reviewer hours a week`}>
              <input
                type="range" min={sc.round3.funded.range[0]} max={sc.round3.funded.range[1]} step={sc.round3.funded.range[2]} value={choice.fundedHours}
                onChange={(e) => set({ fundedHours: Number(e.target.value) })}
                aria-label="Funded reviewer hours per week"
                className="w-full accent-cyan cursor-pointer"
              />
              <p className="text-[12px] text-muted mt-2">
                Your design needs {hours.toFixed(1)} hours a week. At 80% utilisation, {choice.fundedHours} funded hours give
                you about <b className="text-ink">{secondsPerAsk(hours, funded)} seconds per ask</b> in today&apos;s shift. Hours
                nobody needs are paid for anyway.
              </p>
            </Card>

            <Card kicker="Seeded errors" title="Plant known-bad cases in the queue?">
              <p className="text-[13px] text-muted mb-3">
                A planted case looks like a real ask but carries a known error. It never executes, whatever the reviewer
                decides. Reviewers are told planted cases exist, never which ones. Choose the rows to plant in.
              </p>
              <div className="space-y-2">
                {seedable.map((d) => (
                  <label key={d.id} className="flex items-center gap-3 text-[13px] text-ink cursor-pointer">
                    <input
                      type="checkbox" className="accent-cyan w-4 h-4"
                      checked={!!choice.seedRows[d.id]}
                      onChange={(e) => set({ seedRows: { ...choice.seedRows, [d.id]: e.target.checked } })}
                    />
                    {d.title}
                  </label>
                ))}
                {seedable.length === 0 && <p className="text-[12px] text-muted-2">No delegable row has a review queue to plant in.</p>}
              </div>
              {anySeeds && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-[12px] text-muted w-[130px]">Share planted</span>
                    <Segmented options={SEED_RATES.map((r) => ({ value: String(r), label: `${r * 100}%` }))} value={String(choice.seedRate)} onChange={(v) => set({ seedRate: Number(v) })} />
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-[12px] text-muted w-[130px]">Detection target</span>
                    <Segmented options={[0.8, 0.9, 0.95].map((r) => ({ value: String(r), label: `${r * 100}%` }))} value={String(choice.targetDetection)} onChange={(v) => set({ targetDetection: Number(v) })} />
                  </div>
                </div>
              )}
            </Card>

            <Card kicker="Measurement" title="Measure reviewers one by one?">
              <p className="text-[13px] text-muted mb-3">
                The scorecard reads review per row and per reviewer role. Measuring named people is employee monitoring.
              </p>
              <label className="flex items-center gap-3 text-[13px] text-ink cursor-pointer">
                <input type="checkbox" className="accent-cyan w-4 h-4" checked={choice.reviewerMetrics} onChange={(e) => set({ reviewerMetrics: e.target.checked })} />
                Turn on per-reviewer metrics
              </label>
              {choice.reviewerMetrics && (
                <label className="flex items-center gap-3 text-[13px] text-ink cursor-pointer mt-2 ml-7">
                  <input type="checkbox" className="accent-cyan w-4 h-4" checked={choice.dpia} onChange={(e) => set({ dpia: e.target.checked })} />
                  A data protection impact assessment is on file
                </label>
              )}
            </Card>
          </div>

          <div className="space-y-4 lg:sticky lg:top-6 min-w-0">
            <LintPanel ok={lint.ok} explained={explained} />
            <LoadBar hours={hours} funded={funded} />
            <button
              onClick={start}
              disabled={!lint.ok}
              className="cta w-full group inline-flex items-center justify-center gap-3 rounded-full font-bold font-mono uppercase tracking-[0.18em] text-[11px] px-6 py-4 focus-ring disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {lint.ok ? `Start ${sc.ui.days[2]}'s shift` : "Fix the plan to start"}
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({ kicker, title, children }: { kicker: string; title: string; children: React.ReactNode }) {
  return (
    <div className="surface-strong px-5 py-5">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan font-bold mb-1">{kicker}</div>
      <div className="font-serif text-[21px] text-mint leading-tight mb-3">{title}</div>
      {children}
    </div>
  );
}
