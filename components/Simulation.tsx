"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Activity, CheckCircle2, Eye, AlertOctagon, Moon } from "lucide-react";
import { useGame } from "../lib/game-state";
import { fallbackBatchForScenario } from "../data/fallback-scenarios";
import { SCENARIOS } from "../data/scenarios";
import {
  recomputeComposites,
  routeRound1,
  routeRound2,
  routeRound3,
  scoreRound,
} from "../lib/scoring";
import { detectAntiPatterns } from "../lib/anti-patterns";
import { runNightShift, type NightShiftResult } from "../lib/swarm";
import type {
  Invoice,
  NightEvent,
  ProcessedInvoice,
  RoundResult,
} from "../lib/types";
import { InvoiceCard } from "./InvoiceCard";
import { Dashboard } from "./Dashboard";
import { SpawnTree } from "./SpawnTree";

/**
 * Simulation orchestrator. Routes the round's items through the player's
 * policy, then streams them into three routing lanes with organic pacing —
 * slow enough to watch, fast enough to hold. Missed hazards interrupt
 * (card flash + VAOM interjection) instead of scrolling silently past.
 *
 * Round 4 runs the night-shift engine: hands-off, night palette, the agent
 * chain visualization, and a timestamped night log instead of interjections.
 */

// Base ms between item arrivals, per round. Jittered ±35% so the stream
// feels like arrivals, not a metronome.
const PACE: Record<number, number> = { 1: 2800, 2: 2300, 3: 2100, 4: 2600 };

type Interjection = { id: string; text: string };

export function Simulation() {
  const { state, recordResult, advance } = useGame();
  const scenario = SCENARIOS[state.scenario];
  const isNight = state.round === 4;

  const [processed, setProcessed] = useState<ProcessedInvoice[]>([]);
  const [night, setNight] = useState<NightShiftResult | null>(null);
  const [streamedCount, setStreamedCount] = useState(0);
  const [done, setDone] = useState(false);
  const [interjections, setInterjections] = useState<Interjection[]>([]);
  const recordedRef = useRef(false);

  // Night palette for Round 4 — swap the CSS variables, restore on unmount.
  useEffect(() => {
    if (!isNight) return;
    document.documentElement.classList.add("night");
    return () => document.documentElement.classList.remove("night");
  }, [isNight]);

  // 1+2. Load the fallback batch and route it through the player's policy.
  // The fallback batches ARE the game content — set-pieces are scripted.
  useEffect(() => {
    const invoices: Invoice[] = fallbackBatchForScenario(state.scenario, state.round);
    const weights = state.r2?.weights;
    const depth = state.r2?.verificationDepth ?? "off";
    const adjusted =
      weights && state.round >= 2
        ? recomputeComposites(invoices, weights, depth)
        : invoices;

    if (state.round === 1 && state.r1) {
      setProcessed(routeRound1(adjusted, state.r1));
    } else if (state.round === 2 && state.r2) {
      setProcessed(routeRound2(adjusted, state.r2));
    } else if (state.round === 3 && state.r2 && state.r3) {
      setProcessed(routeRound3(adjusted, state.r2, state.r3));
    } else if (state.round === 4 && state.r2 && state.r4) {
      const result = runNightShift(
        adjusted,
        state.r2,
        state.r4,
        scenario.r4.constrainedType
      );
      setNight(result);
      setProcessed(result.processed);
    } else {
      setProcessed([]);
    }
    setStreamedCount(0);
    setInterjections([]);
    setDone(false);
    recordedRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.round, state.scenario]);

  // 3. Stream items in with jittered pacing.
  useEffect(() => {
    if (processed.length === 0) return;
    let cancelled = false;
    let i = 0;
    const base = PACE[state.round] ?? 2500;

    const next = () => {
      if (cancelled) return;
      i++;
      setStreamedCount(i);
      if (i >= processed.length) {
        // Small beat before declaring the run complete.
        window.setTimeout(() => !cancelled && setDone(true), 900);
        return;
      }
      const jitter = base * (0.65 + Math.random() * 0.7);
      window.setTimeout(next, jitter);
    };
    const t = window.setTimeout(next, 700);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [processed, state.round]);

  const streamed = useMemo(
    () => processed.slice(0, streamedCount),
    [processed, streamedCount]
  );

  // 3b. Interjections: a hazard clearing the gate interrupts (Rounds 1–3;
  // Round 4's night log carries the drama instead).
  useEffect(() => {
    if (isNight || streamedCount === 0) return;
    const latest = processed[streamedCount - 1];
    if (!latest) return;
    if (latest.outcome === "risky" && latest.band === "auto_approve") {
      setInterjections((prev) =>
        [
          {
            id: latest.invoice.id,
            text: `${latest.invoice.id} cleared your gate. It should not have.`,
          },
          ...prev,
        ].slice(0, 2)
      );
    }
  }, [streamedCount, processed, isNight]);

  // Night log entries revealed as their items stream in.
  const visibleEvents = useMemo<NightEvent[]>(() => {
    if (!night) return [];
    const ids = new Set(streamed.map((p) => p.invoice.id));
    return night.events.filter(
      (e) => (e.itemId ? ids.has(e.itemId) : done)
    );
  }, [night, streamed, done]);

  const latestEvent = visibleEvents[visibleEvents.length - 1];
  const latestStreamed = streamed[streamed.length - 1];

  // 4. Record the result once streaming finishes.
  useEffect(() => {
    if (!done || recordedRef.current || processed.length === 0) return;
    recordedRef.current = true;

    const depth = state.r2?.verificationDepth;
    const score = scoreRound(
      processed,
      state.round,
      state.r3,
      night?.enforcementScore,
      depth
    );
    const incidents = processed
      .filter((p) => p.outcome === "risky" || p.outcome === "missed")
      .map((p) => p.invoice.id);

    const priorAutoRate =
      state.results.length > 0
        ? state.results[state.results.length - 1].processed.filter(
            (p) => p.band === "auto_approve"
          ).length / state.results[state.results.length - 1].processed.length
        : undefined;
    const antiPatterns = detectAntiPatterns(
      processed,
      state.round,
      state.r2?.weights,
      priorAutoRate,
      depth
    );

    const result: RoundResult = {
      round: state.round,
      processed,
      score,
      incidents,
      antiPatterns,
      multiAgentFailures: night?.multiAgentFailures,
      nightEvents: night?.events,
      guardianReport: night?.guardianReport,
    };
    recordResult(result);
  }, [done, processed, night, state.round, state.r2, state.r3, state.results, recordResult]);

  const nounPlural =
    scenario.itemNounPlural.charAt(0).toUpperCase() + scenario.itemNounPlural.slice(1);

  return (
    <div className="min-h-screen px-6 py-12 animate-fade-in">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-cyan font-bold">
              Round {state.round} · {isNight ? "Night shift" : "Simulation"}
            </div>
            <h1 className="font-mono text-[24px] md:text-[30px] font-bold text-mint mt-1 flex items-center gap-3">
              {isNight && <Moon size={22} className="text-lav" />}
              {isNight ? "You are asleep." : `${nounPlural} flowing`}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            {isNight && (
              <NightClock
                time={latestStreamed?.invoice.arrivalTime ?? "02:00"}
                done={done}
              />
            )}
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-2">
              <Activity
                size={12}
                className={done ? "text-mint" : "text-cyan animate-pulse-soft"}
              />
              {done ? "Run complete" : "Live"}
            </div>
          </div>
        </div>

        {/* VAOM interjections — hazards interrupt, they don't scroll past */}
        {interjections.length > 0 && (
          <div className="space-y-2 mb-4">
            {interjections.map((ij) => (
              <div
                key={ij.id}
                className="vaom-panel px-4 py-2.5 pl-5 flex items-center gap-3 animate-fade-up"
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber font-bold">
                  VAOM
                </span>
                <span className="font-mono text-[12px] text-ink">{ij.text}</span>
              </div>
            ))}
          </div>
        )}

        {/* Round 4: the agent chain */}
        {isNight && state.r4 && (
          <div className="mb-4">
            <SpawnTree
              agents={scenario.r4.subAgents}
              attenuation={state.r4.attenuation}
              lastRoute={latestStreamed?.chainRoute}
              lastEvent={latestEvent}
              guardianEnabled={state.r4.guardian.enabled}
              guardianOwned={state.r4.guardian.accountableHuman.trim().length > 0}
            />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6 items-start">
          {/* Routing lanes */}
          <Lanes streamed={streamed} itemNoun={scenario.itemNoun} />

          {/* Right column */}
          <div className="space-y-4 sticky top-6">
            {isNight ? (
              <NightLog events={visibleEvents} />
            ) : (
              <Dashboard processed={streamed} total={processed.length} />
            )}
            {done && (
              <button
                onClick={() => advance("debrief")}
                className="cta w-full group inline-flex items-center justify-center gap-3 rounded-full font-bold font-mono uppercase tracking-[0.18em] text-[11px] px-6 py-4 focus-ring animate-fade-up"
              >
                {isNight ? "Read the morning report" : "View VAOM debrief"}
                <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Lanes — the routing decision made visible as a distribution
// ────────────────────────────────────────────────────────────────────────────

const LANES = [
  {
    key: "auto" as const,
    label: "Auto-executed",
    icon: <CheckCircle2 size={12} />,
    tone: "text-green-bright",
    match: (p: ProcessedInvoice) => p.band === "auto_approve",
  },
  {
    key: "review" as const,
    label: "Human review",
    icon: <Eye size={12} />,
    tone: "text-amber",
    match: (p: ProcessedInvoice) => p.band === "human_review",
  },
  {
    key: "escalated" as const,
    label: "Escalated · Blocked",
    icon: <AlertOctagon size={12} />,
    tone: "text-red-bright",
    match: (p: ProcessedInvoice) =>
      p.band === "escalation" || p.band === "blocked",
  },
];

function Lanes({
  streamed,
  itemNoun,
}: {
  streamed: ProcessedInvoice[];
  itemNoun: string;
}) {
  return (
    <div className="surface-strong px-4 py-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {LANES.map((lane) => {
          const items = streamed.filter(lane.match);
          return (
            <div key={lane.key} className="min-w-0">
              <div
                className={`flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] font-bold ${lane.tone} mb-2 px-1`}
              >
                {lane.icon}
                <span className="truncate">{lane.label}</span>
                <span className="ml-auto text-muted-2 tabular-nums">
                  {items.length}
                </span>
              </div>
              <div className="space-y-2 max-h-[52vh] overflow-y-auto scroll-slim pr-0.5 min-h-[80px]">
                {items.length === 0 && (
                  <div className="tile px-3 py-4 text-center font-mono text-[10px] text-muted-2">
                    No {itemNoun}s yet
                  </div>
                )}
                {items.map((p) => {
                  const missedHazard =
                    p.outcome === "risky" && p.band === "auto_approve";
                  return (
                    <div
                      key={p.invoice.id}
                      className={missedHazard ? "animate-hazard-flash rounded-2xl" : undefined}
                    >
                      <InvoiceCard p={p} compact />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Night additions
// ────────────────────────────────────────────────────────────────────────────

function NightClock({ time, done }: { time: string; done: boolean }) {
  return (
    <div className="font-mono text-[18px] font-bold text-lav tabular-nums tracking-[0.1em]">
      {done ? "06:00" : time}
    </div>
  );
}

const EVENT_TONES: Record<NightEvent["severity"], string> = {
  info: "text-muted",
  good: "text-mint",
  warn: "text-amber",
  critical: "text-red-bright",
};

function NightLog({ events }: { events: NightEvent[] }) {
  return (
    <div className="surface-strong px-5 py-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-lav font-bold">
          Night log
        </div>
        <div className="flex-1 h-px bg-white/8" />
        <div className="font-mono text-[10px] text-muted-2 tabular-nums">
          {events.length} events
        </div>
      </div>
      <div className="space-y-2.5 max-h-[48vh] overflow-y-auto scroll-slim pr-1">
        {events.length === 0 && (
          <div className="font-mono text-[11px] text-muted-2 py-6 text-center">
            The agents are working. Nothing to report yet.
          </div>
        )}
        {[...events].reverse().map((e, i) => (
          // Events only append, so the original-array index is a stable key.
          <div key={`evt-${events.length - 1 - i}`} className="flex gap-2.5 animate-fade-up">
            <div className="font-mono text-[10px] text-lav tabular-nums flex-shrink-0 mt-0.5">
              {e.time}
            </div>
            <div className={`font-mono text-[11px] leading-relaxed ${EVENT_TONES[e.severity]}`}>
              {e.text}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
