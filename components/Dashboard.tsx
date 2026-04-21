"use client";

import type { ProcessedInvoice } from "../lib/types";

/**
 * Real-time metrics panel that updates as the simulation streams invoices.
 * Shows: throughput, auto-approve rate, hazards caught, human burden.
 */
export function Dashboard({
  processed,
  total,
}: {
  processed: ProcessedInvoice[];
  total: number;
}) {
  const done = processed.length;
  const auto = processed.filter((p) => p.band === "auto_approve").length;
  const review = processed.filter((p) => p.band === "human_review").length;
  const escalated = processed.filter((p) => p.band === "escalation").length;
  const hazardsCaught = processed.filter(
    (p) => p.invoice.hiddenFlags.length > 0 && p.band !== "auto_approve"
  ).length;
  const totalHazards = processed.filter(
    (p) => p.invoice.hiddenFlags.length > 0
  ).length;

  const pct = (n: number, d: number) =>
    d === 0 ? 0 : Math.round((n / d) * 100);

  return (
    <div className="surface-strong px-5 py-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan font-bold">
          Live dashboard
        </div>
        <div className="flex-1 h-px bg-white/8" />
        <div className="font-mono text-[10px] text-muted-2">
          {done}/{total} processed
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Metric label="Auto-approved" value={`${auto}`} sub={`${pct(auto, done)}%`} tone="green" />
        <Metric label="Routed for review" value={`${review}`} sub={`${pct(review, done)}%`} tone="amber" />
        <Metric label="Escalated" value={`${escalated}`} sub={`${pct(escalated, done)}%`} tone="red" />
        <Metric
          label="Hazards caught"
          value={`${hazardsCaught}/${totalHazards}`}
          sub={totalHazards === 0 ? "—" : `${pct(hazardsCaught, totalHazards)}%`}
          tone={hazardsCaught === totalHazards ? "mint" : "amber"}
        />
      </div>

      {/* Progress bar */}
      <div className="mt-5">
        <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-2 mb-1.5">
          Pipeline
        </div>
        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan via-mint to-amber transition-all duration-500"
            style={{ width: `${(done / Math.max(1, total)) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: "green" | "amber" | "red" | "mint" | "cyan";
}) {
  const tones: Record<string, string> = {
    green: "text-green-bright",
    amber: "text-amber",
    red: "text-red-bright",
    mint: "text-mint",
    cyan: "text-cyan",
  };
  return (
    <div className="surface px-3 py-2.5">
      <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-2">
        {label}
      </div>
      <div className="flex items-baseline gap-2 mt-1">
        <div className={`font-sans text-[20px] font-bold tabular-nums ${tones[tone]}`}>
          {value}
        </div>
        <div className="font-sans text-[10px] text-muted-2 tabular-nums">{sub}</div>
      </div>
    </div>
  );
}
