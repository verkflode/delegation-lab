import type {
  DimensionWeights,
  GameState,
  RoundResult,
  VerificationDepth,
} from "./types";

/**
 * The Delegation Scorecard (VAOM v4.0 §11) — ten metrics with healthy
 * ranges, computed from the full campaign. Each breach maps to a named
 * diagnosis. This is deliberately the same artifact an ops team would run
 * in production: the player leaves having used it.
 */

export type ScorecardMetric = {
  n: number;
  group: "calibration" | "operational" | "enforcement";
  label: string;
  value: string;
  healthy: string;
  pass: boolean;
  diagnosis: string; // shown when breached
};

function pct(n: number, d: number): number {
  return d === 0 ? 0 : Math.round((n / d) * 100);
}

export function computeScorecard(state: {
  results: RoundResult[];
  r2?: { weights?: DimensionWeights; verificationDepth?: VerificationDepth };
  r4?: GameState["r4"];
}): ScorecardMetric[] {
  const all = state.results.flatMap((r) => r.processed);
  const total = all.length || 1;
  const auto = all.filter((p) => p.band === "auto_approve").length;
  const review = all.filter((p) => p.band === "human_review").length;

  // 1 — Band distribution
  const autoRate = pct(auto, total);
  const reviewRate = pct(review, total);
  const bandHealthy = autoRate >= 30 && autoRate <= 70 && reviewRate <= 55;

  // 2 — Band B approval rate (proxy: share of reviewed items that were routine)
  const reviewed = all.filter((p) => p.band === "human_review");
  const rubberStamp = reviewed.filter(
    (p) => p.invoice.hiddenFlags.length === 0 && p.invoice.composite >= 0.85
  ).length;
  const approvalRate = reviewed.length === 0 ? 0 : pct(rubberStamp, reviewed.length);
  const approvalHealthy = approvalRate < 90 && reviewed.length > 0;

  // 3 — Exception-path share (items with no configured pattern that fell through)
  const exceptions = all.filter(
    (p) => p.patternUsed === null && p.band === "auto_approve" && p.reason.includes("No pattern")
  ).length;
  const exceptionShare = pct(exceptions, total);

  // 4 — Dimension correlation (proxy: max single weight)
  const weights = state.r2?.weights;
  const maxWeight = weights
    ? Math.max(...Object.values(weights))
    : 0.3;
  const correlationHealthy = maxWeight <= 0.6;

  // 5 — Verifier disagreement
  const depth = state.r2?.verificationDepth ?? "off";
  const verifierValue =
    depth === "off"
      ? "not run"
      : depth === "shallow"
        ? "~0%"
        : depth === "preconditions"
          ? "measurable"
          : "high";
  const verifierHealthy = depth === "preconditions" || depth === "dry_run";

  // 6 — Band-distribution drift (R2 → R3 auto-rate swing)
  const r2res = state.results.find((r) => r.round === 2);
  const r3res = state.results.find((r) => r.round === 3);
  let drift = 0;
  if (r2res && r3res) {
    const rate = (r: RoundResult) =>
      r.processed.filter((p) => p.band === "auto_approve").length /
      (r.processed.length || 1);
    drift = Math.round(Math.abs(rate(r3res) - rate(r2res)) * 100);
  }
  const driftHealthy = drift <= 20;

  // 7 — Escalation SLA (proxy: hazardous items that reached a non-auto band).
  // Burst-cluster flags mark legitimate volume, not hazards.
  const hazards = all.filter(
    (p) =>
      p.invoice.hiddenFlags.filter((f) => f !== "burst_cluster").length > 0
  );
  const escalatedOk = hazards.filter((p) => p.band !== "auto_approve").length;
  const slaRate = pct(escalatedOk, hazards.length || 1);
  const slaHealthy = slaRate >= 70;

  // 8 — Band A audit error rate
  const autoItems = all.filter((p) => p.band === "auto_approve");
  const autoErrors = autoItems.filter((p) => p.outcome === "risky").length;
  const auditErrorRate = pct(autoErrors, autoItems.length || 1);
  const auditHealthy = auditErrorRate <= 10;

  // 9 — Scope-denial posture (R4)
  const r4res = state.results.find((r) => r.round === 4);
  const denials =
    r4res?.nightEvents?.filter(
      (e) => e.kind === "scope_denial" || e.kind === "injection_blocked"
    ).length ?? 0;
  const breaches =
    r4res?.nightEvents?.filter((e) => e.kind === "injection_executed").length ?? 0;
  const scopeHealthy = r4res ? breaches === 0 : false;

  // 10 — Chain integrity
  const laundering =
    r4res?.nightEvents?.filter((e) => e.kind === "laundering").length ?? 0;
  const chainHealthy = r4res ? laundering === 0 : false;

  return [
    {
      n: 1,
      group: "calibration",
      label: "Band distribution",
      value: `${autoRate}% auto · ${reviewRate}% review`,
      healthy: "30–70% auto",
      pass: bandHealthy,
      diagnosis: autoRate > 70 ? "Authority creep" : "Review Queue Flood",
    },
    {
      n: 2,
      group: "calibration",
      label: "Band B approval rate",
      value: reviewed.length === 0 ? "no reviews" : `~${approvalRate}%`,
      healthy: "< 90%",
      pass: approvalHealthy,
      diagnosis: "The agent adds delay, not judgment",
    },
    {
      n: 3,
      group: "calibration",
      label: "Exception-path share",
      value: `${exceptionShare}%`,
      healthy: "< 15%",
      pass: exceptionShare < 15,
      diagnosis: "Exception Graveyard",
    },
    {
      n: 4,
      group: "calibration",
      label: "Dimension correlation",
      value: `max weight ${Math.round(maxWeight * 100)}%`,
      healthy: "≤ 60%",
      pass: correlationHealthy,
      diagnosis: "Dimension Collapse",
    },
    {
      n: 5,
      group: "calibration",
      label: "Verifier disagreement",
      value: verifierValue,
      healthy: "above zero",
      pass: verifierHealthy,
      diagnosis: depth === "off" ? "Verification not deployed" : "Verification theater",
    },
    {
      n: 6,
      group: "operational",
      label: "Band-distribution drift",
      value: `${drift} pts (R2→R3)`,
      healthy: "≤ 20 pts",
      pass: driftHealthy,
      diagnosis: "Stale Threshold",
    },
    {
      n: 7,
      group: "operational",
      label: "Escalation coverage",
      value: `${slaRate}% of hazards`,
      healthy: "≥ 70%",
      pass: slaHealthy,
      diagnosis: "Broken escalation paths",
    },
    {
      n: 8,
      group: "operational",
      label: "Band A audit error rate",
      value: `${auditErrorRate}%`,
      healthy: "≤ 10%",
      pass: auditHealthy,
      diagnosis: "Confidence Mirage",
    },
    {
      n: 9,
      group: "enforcement",
      label: "Boundary integrity",
      value: r4res
        ? `${denials} denials · ${breaches} breach${breaches === 1 ? "" : "es"}`
        : "not tested",
      healthy: "0 breaches",
      pass: scopeHealthy,
      diagnosis: breaches > 0 ? "Boundary existed in policy only" : "Round 4 not played",
    },
    {
      n: 10,
      group: "enforcement",
      label: "Chain integrity",
      value: r4res
        ? laundering === 0
          ? "attenuation held"
          : `${laundering} laundering event${laundering === 1 ? "" : "s"}`
        : "not tested",
      healthy: "0 violations",
      pass: chainHealthy,
      diagnosis: laundering > 0 ? "Delegation laundering" : "Round 4 not played",
    },
  ];
}
