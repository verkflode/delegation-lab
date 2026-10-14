"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import type { ScorecardMetric } from "../lib/scorecard";

/**
 * The Delegation Scorecard (VAOM v4.0 §11) — ten metrics, healthy ranges,
 * pass/breach markers. The same artifact an ops team would run in
 * production; the player leaves the game having used it.
 */

const GROUPS: { id: ScorecardMetric["group"]; label: string }[] = [
  { id: "calibration", label: "Calibration health" },
  { id: "operational", label: "Operational health" },
  { id: "enforcement", label: "Enforcement health" },
];

export function Scorecard({ metrics }: { metrics: ScorecardMetric[] }) {
  const passed = metrics.filter((m) => m.pass).length;
  return (
    <div className="surface-strong px-6 py-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan font-bold">
          The Delegation Scorecard
        </div>
        <div className="flex-1 h-px bg-ink/8" />
        <div className="font-mono text-[11px] tabular-nums">
          <span className={passed >= 7 ? "text-mint" : passed >= 4 ? "text-amber" : "text-red-bright"}>
            {passed}
          </span>
          <span className="text-muted-2">/10 healthy</span>
        </div>
      </div>

      <div className="space-y-5">
        {GROUPS.map((g) => (
          <div key={g.id}>
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-2 mb-2 px-1">
              {g.label}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {metrics
                .filter((m) => m.group === g.id)
                .map((m) => (
                  <div
                    key={m.n}
                    className={`tile px-3.5 py-2.5 flex items-start gap-3 ${
                      m.pass ? "" : "border-red/30"
                    }`}
                  >
                    {m.pass ? (
                      <CheckCircle2 size={14} className="text-mint flex-shrink-0 mt-0.5" />
                    ) : (
                      <XCircle size={14} className="text-red-bright flex-shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="font-mono text-[11px] font-bold text-ink truncate">
                          {m.n}. {m.label}
                        </div>
                        <div className="font-mono text-[9px] text-muted-2 whitespace-nowrap">
                          healthy: {m.healthy}
                        </div>
                      </div>
                      <div className="flex items-baseline justify-between gap-2 mt-0.5">
                        <div className="font-mono text-[11px] text-muted tabular-nums">
                          {m.value}
                        </div>
                        {!m.pass && (
                          <div className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-red-bright">
                            {m.diagnosis}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
