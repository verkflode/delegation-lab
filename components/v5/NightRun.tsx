"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Moon, Sun } from "lucide-react";
import { useGame, useScenario } from "../../lib/game-state";
import { startingGate, toGate } from "../../lib/v5/round2";
import { reviewTweak } from "../../lib/v5/round3";
import { lintNight, runNight, startingNight, type Night, type NightEvent } from "../../lib/v5/round4";
import { round4Debrief, round4Result } from "../../lib/v5/round4-result";

/**
 * Round 4 (v5): the night, in navy. Events arrive on a night clock; every call and spawn was decided by
 * the core. At six the morning report shows what the scorecard makes of it.
 */
const PACE_MS = 1900;

const TONE: Record<NightEvent["verdict"], string> = { good: "text-mint", wasteful: "text-amber", risky: "text-red-bright font-bold", neutral: "text-muted" };

export function NightRun() {
  const { state, recordResult, advance } = useGame();
  const sc = useScenario();
  const policy = state.v5r1 ?? sc.round1.startingPolicy();
  const gate = useMemo(() => toGate(sc, state.v5r2 ?? startingGate(sc)), [sc, state.v5r2]);
  const review = useMemo(() => (state.v5r3 ? reviewTweak(state.v5r3) : undefined), [state.v5r3]);
  const choice = state.v5r4 ?? startingNight(sc);
  const out = useMemo(() => {
    try {
      const warnings = lintNight(sc, policy, gate, review, choice).lint.findings.filter((f) => f.severity === "warning").length;
      return { night: runNight(sc, policy, gate, review, choice), warnings };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [sc, policy, gate, review, choice]);

  const [shown, setShown] = useState(0);
  const recorded = useRef(false);
  const night = out.night;
  const events = night?.events ?? [];
  const done = events.length > 0 && shown >= events.length;

  useEffect(() => {
    document.documentElement.classList.add("night");
    return () => document.documentElement.classList.remove("night");
  }, []);

  useEffect(() => {
    if (!events.length || shown >= events.length) return;
    const t = window.setTimeout(() => setShown((n) => n + 1), shown === 0 ? 900 : PACE_MS * (0.75 + Math.random() * 0.5));
    return () => window.clearTimeout(t);
  }, [shown, events.length]);

  useEffect(() => {
    if (!done || recorded.current || !night) return;
    recorded.current = true;
    const result = round4Result(sc, night, choice, out.warnings ?? 0);
    result.v5Debrief = round4Debrief(sc, night, choice);
    recordResult(result);
  }, [sc, done, night, choice, out.warnings, recordResult]);

  if (out.error || !night) {
    return (
      <div className="min-h-screen px-6 py-16">
        <div className="max-w-2xl mx-auto vaom-panel px-5 py-4">
          <p className="text-[14px] text-ink">The Guardian couldn&apos;t run this night, so nothing ran: {out.error}</p>
          <button onClick={() => advance("config")} className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-cyan">Back</button>
        </div>
      </div>
    );
  }

  const visible = events.slice(0, shown);
  const clock = done ? "06:00" : visible.at(-1)?.ts.slice(11, 16) ?? "02:00";

  return (
    <div className="min-h-screen px-4 sm:px-6 py-12 animate-fade-in">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-baseline justify-between gap-4 flex-wrap mb-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-cyan font-bold">Round 4 · Night shift</div>
            <h1 className="font-serif text-[24px] md:text-[30px] font-normal text-mint mt-1 flex items-center gap-3">
              {done ? <Sun size={22} className="text-amber" /> : <Moon size={22} className="text-lav" />}
              {done ? "Morning." : "You are asleep."}
            </h1>
          </div>
          <div className="font-mono text-[22px] font-bold text-lav tabular-nums tracking-[0.1em]">{clock}</div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6 items-start">
          <div className="space-y-4 min-w-0">
            <div className="surface px-5 py-4">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-2 mb-2">Earlier this week</div>
              <ul className="space-y-1.5">
                {night.pre.log.map((l) => (
                  <li key={l.ts + l.text} className="font-mono text-[11px] text-muted leading-relaxed">
                    <span className="text-lav">{l.ts.slice(5, 10)} {l.ts.slice(11, 16)}</span> {l.text}
                  </li>
                ))}
              </ul>
            </div>

            <div className="surface-strong px-5 py-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-lav font-bold">Night log · decided by the Guardian</div>
                <div className="flex-1 h-px bg-ink/10" />
                <div className="font-mono text-[10px] text-muted-2 tabular-nums">{visible.length} events</div>
              </div>
              <div className="space-y-2.5">
                {visible.length === 0 && <div className="font-mono text-[11px] text-muted-2 py-6 text-center">02:00. The batch starts.</div>}
                {visible.map((e, i) => (
                  <div key={`${e.id}-${i}`} className="flex gap-3 animate-fade-up">
                    <div className="font-mono text-[10px] text-lav tabular-nums shrink-0 mt-0.5">{e.ts.slice(11, 16)}</div>
                    <div className="min-w-0">
                      <div className={`font-mono text-[11px] leading-relaxed break-words ${e.kind === "breaker" ? "text-amber font-bold" : TONE[e.verdict]}`}>
                        {e.actor !== "agent" && e.actor !== "guardian" && <span className="text-muted-2">[{e.actor}] </span>}
                        {e.text}
                      </div>
                      {e.wire && (
                        <div className="font-mono text-[10px] text-muted-2 break-words">ACS → {e.wire.decision}{e.wire.reason_codes?.length ? ` · ${e.wire.reason_codes.join(", ")}` : ""}</div>
                      )}
                      {done && e.morning && <div className="font-mono text-[10px] text-muted">{e.morning}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4 lg:sticky lg:top-6 min-w-0">
            <Chain events={visible} />
            {done && <Morning night={night} onNext={() => advance("debrief")} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function Chain({ events }: { events: NightEvent[] }) {
  const sc = useScenario();
  const spawns = events.filter((e) => e.kind === "spawn");
  const suspended = events.find((e) => e.kind === "breaker" && e.text.includes("suspended"));
  return (
    <div className="surface-strong px-5 py-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-2 mb-3">The agent chain</div>
      <div className={`font-mono text-[12px] ${suspended ? "text-red-bright" : "text-mint"}`}>{sc.agent} {suspended ? "· suspended" : "· working"}</div>
      <ul className="mt-2 space-y-1.5 border-l border-ink/15 pl-3">
        {spawns.length === 0 && <li className="font-mono text-[11px] text-muted-2">no sub-agents yet</li>}
        {spawns.map((s) => {
          const ok = s.text.includes(": allowed");
          return (
            <li key={s.id} className={`font-mono text-[11px] ${ok ? (s.verdict === "risky" ? "text-red-bright" : "text-mint") : "text-muted"}`}>
              {ok ? "↳ " : "✕ "}{s.label.replace(/^Spawns an? /, "").replace(/^The /, "")}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Morning({ night, onNext }: { night: Night; onNext: () => void }) {
  const sc = useScenario();
  const metric = (label: string, m: { status: string; diagnosis?: string }) => (
    <div className="font-mono text-[11px] break-words">
      <span className="text-muted-2">{label}:</span>{" "}
      <span className={m.status === "breach" ? "text-red-bright font-bold" : m.status === "healthy" ? "text-mint" : "text-muted"}>{m.status}</span>
      {m.diagnosis ? <span className="text-muted"> · {m.diagnosis}</span> : null}
    </div>
  );
  return (
    <div className="space-y-4 animate-fade-up">
      <div className="surface-strong px-5 py-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-2 mb-2">Morning report · scorecard()</div>
        {metric("chain integrity", night.chainIntegrity)}
        {metric("boundary verification", night.boundaryVerification)}
        <div className="mt-3 space-y-1.5">
          {night.boundaries.map((b) => (
            <div key={b.boundary} className="font-mono text-[10px] text-muted break-words">
              <span className="text-ink">{b.boundary}</span> · claimed {b.claimed} · {b.status}, counts as {b.creditedAs}
            </div>
          ))}
        </div>
        {night.pre.toolPresent && (
          <p className="text-[12px] text-amber mt-3">{sc.ui.night.toolAllNight}</p>
        )}
        {night.paged.length > 0 && <p className="font-mono text-[10px] text-muted mt-2">Paged: {night.paged.join("; ")}</p>}
      </div>
      <button onClick={onNext} className="cta w-full group inline-flex items-center justify-center gap-3 rounded-full font-bold font-mono uppercase tracking-[0.18em] text-[11px] px-6 py-4 focus-ring">
        Read the morning debrief
        <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
      </button>
    </div>
  );
}
