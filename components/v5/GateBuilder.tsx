"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Check, X } from "lucide-react";
import { useGame, useScenario } from "../../lib/game-state";
import { lintPolicy, reviewHours, type Level, type Round1Policy } from "../../lib/v5/round1";
import { CONFIDENCE, ERROR_TARGETS, MEDIUM_OPTIONS, sampleSize, shareOver, startingGate, toGate, type GateChoice } from "../../lib/v5/round2";
import { explain } from "../../lib/v5/explain";
import { BandPicker, LintPanel, LoadBar, Segmented } from "./MatrixBuilder";

/**
 * Round 2 (v5), "The Gate": the player sets the gated decision's limits. The Band A threshold comes out of a
 * learn-then-test calibration at the player's error target; the linter decides whether the result runs.
 */
export function GateBuilder() {
  const { state, setV5R1, setV5R2, advance } = useGame();
  const sc = useScenario();
  const G = sc.ui.gate;
  const noun = sc.round2.noun;
  const gated = sc.round1.gatedRow;
  const [policy, setPolicy] = useState<Round1Policy>(() => state.v5r1 ?? sc.round1.startingPolicy());
  const [choice, setChoice] = useState<GateChoice>(() => state.v5r2 ?? startingGate(sc));
  const gate = useMemo(() => toGate(sc, choice), [sc, choice]);
  const ceiling = sc.round2.limits.ceiling ? choice.ceiling : null;
  const { matrix, lint } = useMemo(() => lintPolicy(sc, policy, gate), [sc, policy, gate]);
  const explained = useMemo(() => explain(sc, lint, matrix, policy), [sc, lint, matrix, policy]);
  const load = useMemo(() => reviewHours(sc, policy, gate), [sc, policy, gate]);
  const approve = policy[gated];
  const set = (patch: Partial<GateChoice>) => setChoice((c) => ({ ...c, ...patch }));

  const run = () => {
    setV5R1(policy);
    setV5R2(choice);
    advance("simulation");
  };

  const cal = gate.calibrationRun;
  const pct = (x: number) => `${+(x * 100).toFixed(2)}%`;

  return (
    <div className="min-h-screen px-4 sm:px-6 py-12 animate-fade-in">
      <div className="max-w-6xl mx-auto">
        <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-cyan font-bold mb-2">Round 2 · The Gate</div>
        <h1 className="font-serif text-[28px] md:text-[36px] leading-[1.1] font-normal text-mint mb-3">{G.title}</h1>
        <p className="text-[14px] text-muted leading-relaxed max-w-2xl">{G.intro}</p>

        <div className="grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-6 mt-8 items-start">
          <div className="space-y-4 min-w-0">
            {approve.kind !== "delegable" && (
              <div className="vaom-panel px-4 py-3 pl-5 text-[13px] text-ink">
                {G.keptWithHuman}
              </div>
            )}

            <Card kicker="Calibration" title={`How many wrong ${noun} can you tolerate?`}>
              <p className="text-[13px] text-muted mb-3">
                Choose an error target for Band A. A learn-then-test on {sampleSize(sc)} past {noun}, checked by hand,
                finds the lowest threshold whose error rate stays under it with {CONFIDENCE * 100}% confidence.
              </p>
              <Segmented
                options={ERROR_TARGETS.map((t) => ({ value: String(t), label: `${t * 100}%` }))}
                value={String(choice.errorTarget)}
                onChange={(v) => set({ errorTarget: Number(v) })}
              />
              <div className="mt-4 overflow-x-auto">
                <table className="w-full font-mono text-[11px] text-ink tabular-nums">
                  <thead>
                    <tr className="text-muted-2 text-left">
                      <th className="font-normal py-1 pr-3">score ≥</th><th className="font-normal pr-3">{noun}</th><th className="font-normal pr-3">wrong</th><th className="font-normal pr-3">upper bound</th><th className="font-normal" />
                    </tr>
                  </thead>
                  <tbody>
                    {cal.steps.map((s) => (
                      <tr key={s.threshold} className="border-t border-ink/8">
                        <td className="py-1 pr-3">{s.threshold}</td><td className="pr-3">{s.n}</td><td className="pr-3">{s.errors}</td><td className="pr-3">{pct(s.bound)}</td>
                        <td>{s.pass ? <span className="text-band-a inline-flex items-center gap-1"><Check size={11} /> under {pct(choice.errorTarget)}</span> : <span className="text-red inline-flex items-center gap-1"><X size={11} /> over: stop</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className={`text-[13px] mt-3 ${cal.threshold === null ? "text-red" : "text-ink"}`}>
                {cal.threshold === null
                  ? "No threshold passes. There is no calibration record, so Band A is closed for this decision."
                  : <>High confidence starts at <b>{cal.threshold}</b>. The matrix records it with its calibration: target, confidence, sample size and method.</>}
              </p>
            </Card>

            <Card kicker="Routing" title="Where each confidence level lands">
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[11px] text-muted w-[150px] shrink-0">medium starts at</span>
                  <Segmented
                    options={MEDIUM_OPTIONS.filter((m) => m <= gate.thresholds.high).map((m) => ({ value: String(m), label: String(m) }))}
                    value={String(gate.thresholds.medium)}
                    onChange={(v) => set({ medium: Number(v) })}
                  />
                </div>
                {approve.kind === "delegable" && (["high", "medium", "low"] as Level[]).map((lvl) => (
                  <div key={lvl} className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[11px] text-muted w-[150px] shrink-0">
                      {lvl} · {gate.volume[lvl] ?? 0} a week
                    </span>
                    <BandPicker
                      value={approve.routing[lvl]}
                      onChange={(b) => setPolicy((p) => ({ ...p, [gated]: { ...p[gated], routing: { ...p[gated].routing, [lvl]: b } } }))}
                    />
                  </div>
                ))}
              </div>
            </Card>

            {ceiling !== null && <Card kicker="Value ceiling" title={`At most ${G.money(ceiling)} ${G.per}`}>
              <input
                type="range" min={G.ceilingRange[0]} max={G.ceilingRange[1]} step={G.ceilingRange[2]} value={ceiling}
                onChange={(e) => set({ ceiling: Number(e.target.value) })}
                aria-label={`Value ceiling ${G.unitAria}`}
                className="w-full accent-cyan cursor-pointer"
              />
              <div className="flex items-center justify-between gap-3 flex-wrap mt-2">
                <span className="font-mono text-[11px] text-muted">about {Math.round(sc.round2.weekly * shareOver(sc, ceiling))} {G.overNote}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[12px] text-muted">above it:</span>
                  <Segmented options={[{ value: "B", label: "Band B at best" }, { value: "C", label: "Band C" }]} value={choice.onExceed} onChange={(v) => set({ onExceed: v as "B" | "C" })} />
                </div>
              </div>
            </Card>}

            <Card kicker="Cumulative cap" title={choice.cap === null ? G.capNone : `At most ${G.capValue(choice.cap)} ${G.capPer}`}>
              <Segmented
                options={[{ value: "off", label: "No cap" }, { value: "on", label: G.capOn }]}
                value={choice.cap === null ? "off" : "on"}
                onChange={(v) => set({ cap: v === "off" ? null : ceiling ?? G.capStart })}
              />
              {choice.cap !== null && (
                <input
                  type="range" min={G.capRange[0]} max={G.capRange[1]} step={G.capRange[2]} value={choice.cap}
                  onChange={(e) => set({ cap: Number(e.target.value) })}
                  aria-label={`${G.capOn} ${G.unitAria}`}
                  className="w-full accent-cyan cursor-pointer mt-3"
                />
              )}
              <p className="text-[12px] text-muted-2 mt-2">Pending {noun} count towards it. A breach lowers the band to B; it never blocks and never loosens.</p>
            </Card>
          </div>

          <div className="space-y-4 lg:sticky lg:top-6 min-w-0">
            <LintPanel ok={lint.ok} explained={explained} />
            <LoadBar hours={load.hours} funded={load.funded} />
            <button
              onClick={run}
              disabled={!lint.ok}
              className="cta w-full group inline-flex items-center justify-center gap-3 rounded-full font-bold font-mono uppercase tracking-[0.18em] text-[11px] px-6 py-4 focus-ring disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {lint.ok ? `Run ${sc.ui.days[1]}'s batch` : "Fix the matrix to run it"}
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
