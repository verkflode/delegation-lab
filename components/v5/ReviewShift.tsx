"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, X } from "lucide-react";
import { useGame, useScenario } from "../../lib/game-state";
import { startingGate, toGate } from "../../lib/v5/round2";
import { judgeShift, lintReview, secondsPerAsk, SPEED, startShift, startingReview, type Ask, type Click, type ShiftResult } from "../../lib/v5/round3";
import { round3Debrief, round3Result } from "../../lib/v5/round3-result";

/**
 * Round 3 (v5): the player works the day's Band B queue as the scenario's reviewer. Each click is a
 * resolution on a real decision record (or a planted case's outcome); the core's scorecard reads them.
 */
export function ReviewShift() {
  const { state, recordResult, advance } = useGame();
  const sc = useScenario();
  const policy = state.v5r1 ?? sc.round1.startingPolicy();
  const gate = useMemo(() => toGate(sc, state.v5r2 ?? startingGate(sc)), [sc, state.v5r2]);
  const choice = state.v5r3 ?? startingReview(sc);
  // A role's name inside a sentence: lower-case first letter, acronyms kept ("the SRE lead on call").
  const inSentence = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
  const reviewer = inSentence(sc.roles[sc.round3.reviewer]);
  const escalatedTo = inSentence(sc.roles[sc.fallbackAuthority.escalation.role]);
  const day = sc.ui.days[2];
  const setup = useMemo(() => {
    try {
      const { hours, funded } = lintReview(sc, policy, gate, choice);
      return { shift: startShift(sc, policy, gate, choice), seconds: secondsPerAsk(hours, funded), hours };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [sc, policy, gate, choice]);

  const [phase, setPhase] = useState<"brief" | "queue" | "done">("brief");
  const [index, setIndex] = useState(0);
  const [clicks, setClicks] = useState<Record<string, Click>>({});
  const [verdict, setVerdict] = useState<ShiftResult | null>(null);
  const shownAt = useRef(0);

  const shift = setup.shift;
  const asks = shift?.asks ?? [];
  const current = asks[index];

  const onShow = useCallback((t: number) => { shownAt.current = t; }, []);
  const finish = useCallback((all: Record<string, Click>) => {
    if (!shift) return;
    const v = judgeShift(sc, shift, all);
    const result = round3Result(sc, shift, all, v, choice, setup.hours!);
    result.v5Debrief = round3Debrief(result, v, choice);
    setVerdict(v);
    recordResult(result);
    setPhase("done");
  }, [sc, shift, choice, setup.hours, recordResult]);

  const decide = useCallback((decision: Click["decision"]) => {
    if (!current) return;
    const realMs = decision === "expired" ? setup.seconds! * 1000 : Math.round(performance.now() - shownAt.current);
    const all = { ...clicks, [current.key]: { decision, realMs } };
    setClicks(all);
    setIndex((i) => i + 1);
    if (index + 1 >= asks.length) finish(all);
  }, [current, setup.seconds, clicks, index, asks.length, finish]);

  if (setup.error || !shift) {
    return (
      <div className="min-h-screen px-6 py-16">
        <div className="max-w-2xl mx-auto vaom-panel px-5 py-4">
          <p className="text-[14px] text-ink">The Guardian couldn&apos;t run this plan, so nothing ran: {setup.error}</p>
          <button onClick={() => advance("config")} className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-cyan">Back to the plan</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 sm:px-6 py-12 animate-fade-in">
      <div className="max-w-3xl mx-auto">
        <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-cyan font-bold mb-2">Round 3 · The shift</div>
        <h1 className="font-serif text-[24px] md:text-[30px] font-normal text-mint">{day}. You are the {reviewer}.</h1>
        <p className="text-[13px] text-muted mt-2">
          {day}&apos;s batch ran under your matrix: {shift.elsewhere.A} executed in Band A, {shift.elsewhere.C} went to the
          {" "}{escalatedTo}, {shift.elsewhere.held} {shift.elsewhere.held === 1 ? "was" : "were"} held. {asks.length} {asks.length === 1 ? "ask is" : "asks are"} waiting for you.
        </p>

        {phase === "brief" && (
          <div className="mt-6 space-y-4">
            {shift.seeds && (
              <div className="vaom-panel px-5 py-4 pl-6">
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber font-bold mb-1">Before your shift · disclosure</div>
                <p className="text-[14px] text-ink leading-relaxed">{shift.seeds.doc.disclosure.statement}</p>
                <p className="font-mono text-[10px] text-muted-2 mt-2">vaom.seeds/0.1 · lintSeeds: {shift.seeds.lint.ok ? "ok" : "fails"}</p>
              </div>
            )}
            <div className="surface px-5 py-4 text-[13px] text-muted">
              You get about <b className="text-ink">{setup.seconds} seconds</b> per ask; the game clock runs {SPEED} times faster
              than yours. An ask you don&apos;t decide expires, and an expired ask is denied.
            </div>
            <button
              onClick={() => { setPhase("queue"); shownAt.current = performance.now(); }}
              disabled={asks.length === 0}
              className="cta group inline-flex items-center gap-3 rounded-full font-bold font-mono uppercase tracking-[0.18em] text-[11px] px-6 py-3 focus-ring disabled:opacity-40"
            >
              Open the queue
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </button>
            {asks.length === 0 && <p className="text-[13px] text-muted">Your design sent nothing to the {reviewer} today. Go to the debrief.</p>}
          </div>
        )}

        {phase === "queue" && current && (
          <AskCard key={current.key} ask={current} n={index + 1} of={asks.length} approver={sc.round3.reviewer} seconds={setup.seconds!} onShow={onShow} onDecide={decide} />
        )}

        {phase === "done" && verdict && (
          <ShiftSummary verdict={verdict} asks={asks} clicks={clicks} onNext={() => advance("debrief")} />
        )}
        {phase === "brief" && asks.length === 0 && (
          <button onClick={() => finish({})} className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-cyan">Finish the shift</button>
        )}
      </div>
    </div>
  );
}

function AskCard({ ask, n, of, approver, seconds, onShow, onDecide }: { ask: Ask; n: number; of: number; approver: string; seconds: number; onShow: (t: number) => void; onDecide: (d: Click["decision"]) => void }) {
  const [left, setLeft] = useState(seconds * 1000);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t0 = performance.now();
    onShow(t0);
    const id = window.setInterval(() => {
      const e = performance.now() - t0;
      setElapsed(e);
      setLeft(Math.max(0, seconds * 1000 - e));
      if (e >= seconds * 1000) { window.clearInterval(id); onDecide("expired"); }
    }, 100);
    return () => window.clearInterval(id);
  }, [seconds, onShow, onDecide]);

  const game = Math.floor((elapsed * SPEED) / 1000);
  return (
    <div className="surface-strong mt-6 px-5 py-5 animate-fade-up">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-2">Ask {n} of {of} · approver: {approver}</span>
        <span className="font-mono text-[12px] text-ink tabular-nums">{Math.floor(game / 60)}:{String(game % 60).padStart(2, "0")} reviewing</span>
      </div>
      <div className="h-1.5 rounded-full bg-ink/8 mt-2 overflow-hidden">
        <div className="h-full bg-band-b transition-[width] duration-100" style={{ width: `${(left / (seconds * 1000)) * 100}%` }} />
      </div>
      <h2 className="font-serif text-[22px] text-mint mt-4 leading-tight">{ask.label}</h2>
      <p className="font-mono text-[10px] text-muted-2 mt-1">
        Band B because: {ask.reasons.length ? ask.reasons.join(", ") : "your matrix routes this decision to review"}
      </p>
      <ul className="mt-4 space-y-1.5">
        {ask.facts.map((f) => (
          <li key={f} className="text-[14px] text-ink flex gap-2"><span className="text-muted-2">·</span>{f}</li>
        ))}
      </ul>
      <div className="mt-5 flex gap-3">
        <button onClick={() => onDecide("approve")} className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-band-a text-white font-mono text-[12px] uppercase tracking-[0.14em] py-3 focus-ring">
          <Check size={14} /> Approve
        </button>
        <button onClick={() => onDecide("reject")} className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-band-held text-white font-mono text-[12px] uppercase tracking-[0.14em] py-3 focus-ring">
          <X size={14} /> Reject
        </button>
      </div>
    </div>
  );
}

function ShiftSummary({ verdict, asks, clicks, onNext }: { verdict: ShiftResult; asks: Ask[]; clicks: Record<string, Click>; onNext: () => void }) {
  const metric = (label: string, ms: Record<string, { status: string; diagnosis?: string }>) => (
    <div className="space-y-1">
      {Object.entries(ms).map(([row, m]) => (
        <div key={row} className="font-mono text-[11px] text-ink break-words">
          <span className="text-muted-2">{label} · {row}:</span>{" "}
          <span className={m.status === "breach" ? "text-red font-bold" : m.status === "healthy" ? "text-band-a" : "text-muted"}>{m.status}</span>
          {m.diagnosis ? ` · ${m.diagnosis}` : ""}
        </div>
      ))}
    </div>
  );
  return (
    <div className="mt-6 space-y-4 animate-fade-up">
      <div className="surface-strong px-5 py-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-2 mb-2">The scorecard on your shift · scorecard()</div>
        {metric("review engagement", verdict.engagement)}
        <div className="mt-2">{metric("seeded detection", verdict.detection)}</div>
        <p className="text-[11px] text-muted-2 mt-2">A game shift is tiny: the Lab lowers the minimum samples to 4 decided reviews and 1 planted case. The Guardian&apos;s defaults are 20 and 10.</p>
      </div>
      <div className="surface px-5 py-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-2 mb-2">Your calls · {verdict.correct} of {asks.length} right</div>
        <ul className="space-y-2">
          {asks.map((a) => {
            const c = clicks[a.key]?.decision ?? "expired";
            const ok = c === a.correct;
            return (
              <li key={a.key} className="text-[13px]">
                <span className={ok ? "text-band-a" : "text-red font-bold"}>{ok ? "✓" : "✗"}</span>{" "}
                <span className="text-ink">{a.seed ? "Planted: " : ""}{a.label}</span>
                <span className="text-muted-2"> · you {c === "expired" ? "let it expire" : c === "approve" ? "approved" : "rejected"}</span>
                {!ok && <div className="text-[12px] text-muted ml-4">{a.why}</div>}
              </li>
            );
          })}
        </ul>
      </div>
      <button onClick={onNext} className="cta w-full group inline-flex items-center justify-center gap-3 rounded-full font-bold font-mono uppercase tracking-[0.18em] text-[11px] px-6 py-4 focus-ring">
        View VAOM debrief
        <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
      </button>
    </div>
  );
}
