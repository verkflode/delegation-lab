"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, ArrowRight } from "lucide-react";
import { useGame } from "../../lib/game-state";
import { CONTROLLER_GATE, runBatch, BATCH, type Lane, type Round1Step, type Verdict } from "../../lib/v5/round1";
import { BATCH2, BATCH2_START, toGate } from "../../lib/v5/round2";
import { v5Result } from "../../lib/v5/round1-result";

/**
 * Rounds 1 and 2 (v5): the batch, decided call by call by the VAOM Guardian core against the player's matrix.
 * Each card shows the band, the core's reasons and the answer on the ACS wire.
 */

const PACE_MS = 1700;

const LANES: { key: Lane; label: string; dot: string; text: string }[] = [
  { key: "A", label: "Band A · agent acts", dot: "bg-band-a", text: "text-band-a" },
  { key: "B", label: "Band B · review", dot: "bg-band-b", text: "text-band-b" },
  { key: "C", label: "Band C · escalate", dot: "bg-band-c", text: "text-band-c" },
  { key: "held", label: "Held · refused or deferred", dot: "bg-band-held", text: "text-band-held" },
];

const VERDICT: Record<Verdict, { label: string; cls: string }> = {
  good: { label: "right call", cls: "text-band-a" },
  wasteful: { label: "human time spent", cls: "text-band-b" },
  risky: { label: "should not have run", cls: "text-red font-bold" },
  missed: { label: "not in the matrix", cls: "text-band-none" },
};

const ROUNDS = {
  1: { title: "Tuesday morning, accounts payable", batch: BATCH, start: "2026-10-14T09:00:00Z" },
  2: { title: "Wednesday morning, accounts payable", batch: BATCH2, start: BATCH2_START },
} as const;

export function BatchRun() {
  const { state, recordResult, advance } = useGame();
  const policy = state.v5r1;
  const round = state.round === 2 ? 2 : 1;
  const gate = useMemo(() => (round === 2 && state.v5r2 ? toGate(state.v5r2) : CONTROLLER_GATE), [round, state.v5r2]);
  const run = useMemo(() => {
    if (!policy) return { error: "No matrix to run." };
    try { return { run: runBatch(policy, gate, ROUNDS[round].batch, ROUNDS[round].start) }; } catch (e) { return { error: (e as Error).message }; }
  }, [policy, gate, round]);
  const steps = run.run?.steps ?? [];

  const [shown, setShown] = useState(0);
  const done = steps.length > 0 && shown >= steps.length;
  const recorded = useRef(false);

  useEffect(() => {
    if (!steps.length || shown >= steps.length) return;
    const t = window.setTimeout(() => setShown((n) => n + 1), shown === 0 ? 600 : PACE_MS * (0.7 + Math.random() * 0.6));
    return () => window.clearTimeout(t);
  }, [shown, steps.length]);

  useEffect(() => {
    if (!done || recorded.current || !run.run || !policy) return;
    recorded.current = true;
    recordResult(v5Result(run.run, policy, round, gate));
  }, [done, run, policy, round, gate, recordResult]);

  const visible = steps.slice(0, shown);
  const latest = visible[visible.length - 1];
  const slipped = visible.filter((s) => s.verdict === "risky").slice(-2).reverse();

  if (run.error) {
    return (
      <div className="min-h-screen px-6 py-16">
        <div className="max-w-2xl mx-auto vaom-panel px-5 py-4">
          <p className="text-[14px] text-ink">The Guardian couldn&apos;t run this matrix, so nothing ran: {run.error}</p>
          <button onClick={() => advance("config")} className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-cyan">Back to the matrix</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 sm:px-6 py-12 animate-fade-in">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-baseline justify-between mb-4 gap-4 flex-wrap">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-cyan font-bold">Round {round} · The batch</div>
            <h1 className="font-serif text-[24px] md:text-[30px] font-normal text-mint mt-1">{ROUNDS[round].title}</h1>
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-2">
            <Activity size={12} className={done ? "text-mint" : "text-cyan animate-pulse-soft"} />
            {done ? "Batch complete" : `${shown} of ${steps.length}`}
          </div>
        </div>

        {slipped.length > 0 && (
          <div className="space-y-2 mb-4">
            {slipped.map((s) => (
              <div key={s.item.id} className="vaom-panel px-4 py-2.5 pl-5 flex items-center gap-3 animate-fade-up">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber font-bold">VAOM</span>
                <span className="text-[13px] text-ink">{s.item.id} ran {s.lane === "A" ? "in Band A" : ""}. {s.why}</span>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1.7fr_1fr] gap-6 items-start">
          <div className="surface-strong px-3 sm:px-4 py-4 min-w-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              {LANES.map((lane) => {
                const items = visible.filter((s) => s.lane === lane.key);
                return (
                  <div key={lane.key} className="min-w-0">
                    <div className={`flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] font-bold mb-2 px-1 ${lane.text}`}>
                      <span className={`w-2 h-2 rounded-full ${lane.dot}`} />
                      <span className="truncate">{lane.label}</span>
                      <span className="ml-auto text-muted-2 tabular-nums">{items.length}</span>
                    </div>
                    <div className="space-y-2 min-h-[64px]">
                      {items.map((s) => <CallCard key={s.item.id} step={s} reveal={done} />)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-4 lg:sticky lg:top-6 min-w-0">
            <Tally steps={visible} />
            {latest && <Wire step={latest} />}
            {done && (
              <button
                onClick={() => advance("debrief")}
                className="cta w-full group inline-flex items-center justify-center gap-3 rounded-full font-bold font-mono uppercase tracking-[0.18em] text-[11px] px-6 py-4 focus-ring animate-fade-up"
              >
                View VAOM debrief
                <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CallCard({ step, reveal }: { step: Round1Step; reveal: boolean }) {
  const v = VERDICT[step.verdict];
  const flash = step.verdict === "risky";
  const reason = step.record.decision.reasons.filter((r) => !r.code.startsWith("confidence.")).map((r) => r.code)[0]
    ?? step.record.decision.reasons.map((r) => r.code).at(-1);
  return (
    <div className={`tile px-3 py-2.5 animate-fade-up ${flash ? "animate-hazard-flash" : ""}`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[11px] font-bold text-ink">{step.item.id}</span>
        {reason && <span className="font-mono text-[9px] text-muted-2 truncate">{reason}</span>}
      </div>
      <p className="text-[12px] text-muted leading-snug mt-0.5">{step.item.label}</p>
      {(reveal || step.verdict === "risky") && <p className={`font-mono text-[10px] mt-1 ${v.cls}`}>{v.label}</p>}
    </div>
  );
}

function Tally({ steps }: { steps: Round1Step[] }) {
  const minutes = steps.reduce((m, s) => m + (s.lane === "B" ? 6 : s.lane === "C" ? 20 : 0), 0);
  const count = (v: Verdict) => steps.filter((s) => s.verdict === v).length;
  return (
    <div className="surface-strong px-5 py-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-2 mb-3">This batch</div>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Right calls" value={count("good")} cls="text-band-a" />
        <Stat label="Should not have run" value={count("risky")} cls="text-red" />
        <Stat label="Human time on routine" value={count("wasteful")} cls="text-band-b" />
        <Stat label="Not in the matrix" value={count("missed")} cls="text-band-none" />
      </div>
      <div className="font-mono text-[11px] text-muted mt-3 tabular-nums">Reviewer time asked for: {minutes} min</div>
    </div>
  );
}

function Stat({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div>
      <div className={`font-sans text-[26px] font-bold leading-none tabular-nums ${cls}`}>{value}</div>
      <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-2 mt-1">{label}</div>
    </div>
  );
}

function Wire({ step }: { step: Round1Step }) {
  const d = step.record.decision;
  const w = step.wire;
  return (
    <div className="surface px-5 py-4 min-w-0">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-2 mb-2">On the wire · OWASP ACS</div>
      <div className="font-mono text-[11px] text-ink break-words">{step.item.call.tool}</div>
      <div className="font-mono text-[12px] text-ink mt-2 break-words">
        <span className="font-bold">{w.decision ?? "?"}</span>
        {w.ask_details?.approver?.id ? ` → approver: ${w.ask_details.approver.id}` : ""}
        {d.band ? ` · band ${d.band}` : ""}
      </div>
      {w.reason_codes?.length ? <div className="font-mono text-[10px] text-muted mt-1 break-words">{w.reason_codes.join(", ")}</div> : null}
      <div className="font-mono text-[10px] text-muted-2 mt-1 break-words">{step.record.policy.matrix.id}@{step.record.policy.matrix.version}</div>
    </div>
  );
}
