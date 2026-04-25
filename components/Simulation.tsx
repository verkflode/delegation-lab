"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Activity } from "lucide-react";
import { useGame } from "../lib/game-state";
import { fetchScenario } from "../lib/api";
import { fallbackBatchForScenario } from "../data/fallback-scenarios";
import { SCENARIOS } from "../data/scenarios";
import { recomputeComposites, routeRound1, routeRound2, routeRound3, scoreRound } from "../lib/scoring";
import { detectAntiPatterns, detectMultiAgentFailures } from "../lib/anti-patterns";
import type { Invoice, ProcessedInvoice, RoundResult } from "../lib/types";
import { InvoiceCard } from "./InvoiceCard";
import { Dashboard } from "./Dashboard";

/**
 * Simulation orchestrator. Loads invoices for the current round, processes
 * them through the player's policy, then animates them into the pipeline
 * one at a time. When all invoices have arrived, records the round result
 * and surfaces a "View debrief" button.
 */
export function Simulation() {
  const { state, recordResult, advance } = useGame();
  const scenario = SCENARIOS[state.scenario];
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [processed, setProcessed] = useState<ProcessedInvoice[]>([]);
  const [streamed, setStreamed] = useState<ProcessedInvoice[]>([]);
  const [done, setDone] = useState(false);
  const recordedRef = useRef(false);

  // 1. Use fallback batch. Claude is too slow to swap mid-animation,
  // so we don't try. The fallback batches are scenario-specific and
  // well-crafted — they ARE the game content. Claude enrichment happens
  // in the briefings and debriefs where text can stream, not here where
  // cards are already animating.
  useEffect(() => {
    setInvoices(fallbackBatchForScenario(state.scenario, state.round));
  }, [state.round, state.scenario]);

  // 2. Run routing once invoices are settled
  useEffect(() => {
    if (!invoices) return;
    // Recompute composites with custom weights if the player adjusted them
    const weights = state.r2?.weights;
    const adjustedInvoices =
      weights && (state.round === 2 || state.round === 3)
        ? recomputeComposites(invoices, weights)
        : invoices;

    let processedNow: ProcessedInvoice[];
    if (state.round === 1 && state.r1) {
      processedNow = routeRound1(adjustedInvoices, state.r1);
    } else if (state.round === 2 && state.r2) {
      processedNow = routeRound2(adjustedInvoices, state.r2);
    } else if (state.round === 3 && state.r2 && state.r3) {
      processedNow = routeRound3(adjustedInvoices, state.r2, state.r3);
    } else {
      processedNow = [];
    }
    setProcessed(processedNow);
    setStreamed([]);
    setDone(false);
    recordedRef.current = false;
  }, [invoices, state.round, state.r1, state.r2, state.r3]);

  // 3. Animate invoices in one at a time
  useEffect(() => {
    if (processed.length === 0) return;
    let i = 0;
    setStreamed([]);
    const interval = window.setInterval(() => {
      i++;
      setStreamed(processed.slice(0, i));
      if (i >= processed.length) {
        window.clearInterval(interval);
        setDone(true);
      }
    }, 650);
    return () => window.clearInterval(interval);
  }, [processed]);

  // 4. Record the result the moment streaming finishes (only once)
  useEffect(() => {
    if (!done || recordedRef.current) return;
    recordedRef.current = true;
    const score = scoreRound(processed, state.round, state.r3);
    const incidents = processed
      .filter((p) => p.outcome === "risky" || p.outcome === "missed")
      .map((p) => p.invoice.id);

    // Detect anti-patterns
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
      priorAutoRate
    );
    const multiAgentFailures =
      state.round === 3
        ? detectMultiAgentFailures(processed, state.r3)
        : undefined;

    const result: RoundResult = {
      round: state.round,
      processed,
      score,
      incidents,
      antiPatterns,
      multiAgentFailures,
    };
    recordResult(result);
  }, [done, processed, state.round, state.r3, state.r2?.weights, state.results, recordResult]);

  return (
    <div className="min-h-screen px-6 py-12 animate-fade-in">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-baseline justify-between mb-6">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-cyan font-bold">
              Round {state.round} · Simulation
            </div>
            <h1 className="font-mono text-[24px] md:text-[30px] font-bold text-mint mt-1">
              {scenario.itemNounPlural.charAt(0).toUpperCase() + scenario.itemNounPlural.slice(1)} flowing
            </h1>
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-2">
            <Activity size={12} className={done ? "text-mint" : "text-cyan animate-pulse-soft"} />
            {done ? "Run complete" : "Live"}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6 items-start">
          {/* Pipeline column */}
          <div className="surface-strong px-5 py-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan font-bold">
                {scenario.itemNoun.charAt(0).toUpperCase() + scenario.itemNoun.slice(1)} pipeline
              </div>
              <div className="flex-1 h-px bg-white/8" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[60vh] overflow-y-auto scroll-slim pr-1">
              {streamed.length === 0 && (
                <div className="col-span-full text-center py-12 font-mono text-[11px] text-muted-2">
                  Waiting for first {scenario.itemNoun}…
                </div>
              )}
              {streamed.map((p) => (
                <InvoiceCard key={p.invoice.id} p={p} compact />
              ))}
            </div>
          </div>

          {/* Dashboard + advance button */}
          <div className="space-y-4 sticky top-6">
            <Dashboard processed={streamed} total={processed.length} />
            {done && (
              <button
                onClick={() => advance("debrief")}
                className="w-full group inline-flex items-center justify-center gap-3 rounded-full bg-gradient-to-r from-amber to-amber/80 text-bg-1 font-bold font-mono uppercase tracking-[0.18em] text-[11px] px-6 py-4 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(232,185,49,0.35)] transition-all focus-ring animate-fade-up"
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
