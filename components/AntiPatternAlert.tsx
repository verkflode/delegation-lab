"use client";

import { AlertTriangle } from "lucide-react";
import { ANTI_PATTERN_DEFS, MULTI_AGENT_FAILURE_DEFS } from "../lib/anti-patterns";
import type { DetectedAntiPattern, MultiAgentFailureMode } from "../lib/types";

export function AntiPatternBadge({ ap }: { ap: DetectedAntiPattern }) {
  const def = ANTI_PATTERN_DEFS[ap.id];
  return (
    <div className="surface px-3 py-2.5 border border-amber/30 bg-amber/5 animate-fade-up">
      <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.16em] text-amber font-bold">
        <AlertTriangle size={11} />
        {def.label}
      </div>
      <div className="text-[11px] text-muted leading-snug mt-1">{ap.detail}</div>
    </div>
  );
}

export function MultiAgentFailureBadge({ mode }: { mode: MultiAgentFailureMode }) {
  const def = MULTI_AGENT_FAILURE_DEFS[mode];
  return (
    <div className="surface px-3 py-2.5 border border-red/30 bg-red/5 animate-fade-up">
      <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.16em] text-red-bright font-bold">
        <AlertTriangle size={11} />
        {def.label}
      </div>
      <div className="text-[11px] text-muted leading-snug mt-1">{def.description}</div>
    </div>
  );
}

export function AntiPatternList({
  patterns,
  failures,
}: {
  patterns: DetectedAntiPattern[];
  failures?: MultiAgentFailureMode[];
}) {
  if (patterns.length === 0 && (!failures || failures.length === 0)) return null;
  return (
    <div className="space-y-2">
      {patterns.length > 0 && (
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber font-bold">
          Calibration anti-patterns detected
        </div>
      )}
      {patterns.map((ap) => (
        <AntiPatternBadge key={ap.id} ap={ap} />
      ))}
      {failures && failures.length > 0 && (
        <>
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-red-bright font-bold mt-3">
            Multi-agent failure modes
          </div>
          {failures.map((mode) => (
            <MultiAgentFailureBadge key={mode} mode={mode} />
          ))}
        </>
      )}
    </div>
  );
}
