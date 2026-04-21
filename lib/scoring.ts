import { DECISION_TYPES } from "./patterns";
import type {
  ConfidenceDimensions,
  DimensionWeights,
  Invoice,
  ProcessedInvoice,
  R1Policy,
  R2Policy,
  R3PreEvents,
  RoundResult,
  RoutingBand,
  ScoreBreakdown,
} from "./types";
import { DEFAULT_WEIGHTS } from "./types";

/**
 * Composite confidence score from VAOM v3.5 §8. Weighted average across
 * four dimensions, with a hard floor: if any dimension falls below 0.40
 * the composite is capped at 0.70 (review band).
 *
 * v3.5: weights are player-adjustable in Round 2. Default: .30/.30/.20/.20.
 */
export function compositeConfidence(
  c: ConfidenceDimensions,
  w: DimensionWeights = DEFAULT_WEIGHTS
): number {
  const anomalyAdjusted = 1 - c.anomalySignal;
  const weighted =
    c.modelCertainty * w.modelCertainty +
    c.ruleMatch * w.ruleMatch +
    c.dataCompleteness * w.dataCompleteness +
    anomalyAdjusted * w.anomalySignal;

  const dims = [c.modelCertainty, c.ruleMatch, c.dataCompleteness, anomalyAdjusted];
  if (dims.some((d) => d < 0.4)) {
    return Math.min(weighted, 0.7);
  }
  return Math.max(0, Math.min(1, weighted));
}

/**
 * Recompute composite scores on all invoices using the player's custom
 * dimension weights. Called once in Simulation before routing.
 */
export function recomputeComposites(
  invoices: Invoice[],
  weights: DimensionWeights
): Invoice[] {
  return invoices.map((inv) => ({
    ...inv,
    composite: compositeConfidence(inv.confidence, weights),
  }));
}

// ────────────────────────────────────────────────────────────────────────────
// Routing — Round 1: single global threshold
// ────────────────────────────────────────────────────────────────────────────

export function routeRound1(
  invoices: Invoice[],
  policy: R1Policy
): ProcessedInvoice[] {
  const threshold = policy.threshold / 100;
  return invoices.map((invoice): ProcessedInvoice => {
    let band: RoutingBand;
    if (invoice.composite >= threshold) {
      band = "auto_approve";
    } else if (invoice.composite >= threshold - 0.15) {
      band = "human_review";
    } else {
      band = "escalation";
    }

    // Did we get away with it? Scenario-agnostic: items with hidden
    // flags are hazardous; items with high confidence and no flags are routine.
    const isHazardous = invoice.hiddenFlags.length > 0;
    const isRoutine = !isHazardous && invoice.composite >= 0.85;

    let outcome: ProcessedInvoice["outcome"];
    let reason: string;
    if (band === "auto_approve" && isHazardous) {
      outcome = "risky";
      reason = `Auto-approved despite ${invoice.hiddenFlags.join(", ") || "category risk"}.`;
    } else if (band === "auto_approve" && isRoutine) {
      outcome = "good";
      reason = "Routine item cleared the threshold.";
    } else if (band === "human_review" && isRoutine) {
      outcome = "wasteful";
      reason = "Routine item routed to human review unnecessarily.";
    } else if (band !== "auto_approve" && isHazardous) {
      outcome = "good";
      reason = "Hazard caught and queued for human attention.";
    } else if (band === "escalation" && !isHazardous) {
      outcome = "wasteful";
      reason = "Escalated despite low actual risk.";
    } else {
      outcome = "good";
      reason = "Routed appropriately.";
    }

    return {
      invoice,
      band,
      patternUsed: null,
      outcome,
      reason,
    };
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Routing — Round 2: pattern + threshold per decision type
// ────────────────────────────────────────────────────────────────────────────

export function routeRound2(
  invoices: Invoice[],
  policy: R2Policy
): ProcessedInvoice[] {
  return invoices.map((invoice): ProcessedInvoice => {
    const config = policy.perType[invoice.type];

    // Gap: no pattern configured for this type — falls through to auto-approve.
    if (!config) {
      const isHazardous = invoice.hiddenFlags.length > 0;
      return {
        invoice,
        band: "auto_approve",
        patternUsed: null,
        outcome: isHazardous ? "risky" : "good",
        reason:
          "No pattern configured for this decision type — fell through to auto-approve.",
      };
    }

    const threshold = config.threshold / 100;
    const meta = DECISION_TYPES[invoice.type];
    const recommended = meta?.acceptablePatterns.includes(config.pattern) ?? true;

    let band: RoutingBand;
    switch (config.pattern) {
      case "execute_audit":
        band = invoice.composite >= threshold ? "auto_approve" : "human_review";
        break;
      case "draft_approve":
        band = "human_review";
        break;
      case "triage_route":
        // Routes based on classification — high confidence stays with the agent's
        // proposed lane, low confidence goes to a human exception handler.
        band = invoice.composite >= threshold ? "human_review" : "escalation";
        break;
      case "prepare_present":
        band = "human_review";
        break;
      case "monitor_intervene":
        band = invoice.composite >= threshold ? "auto_approve" : "human_review";
        break;
      case "coordinate_escalate":
        band = "escalation";
        break;
    }

    const isHazardous = invoice.hiddenFlags.length > 0;
    let outcome: ProcessedInvoice["outcome"];
    let reason: string;

    const typeLabel = meta?.label ?? invoice.type;
    if (band === "auto_approve" && isHazardous && !recommended) {
      outcome = "risky";
      reason = `${typeLabel}: pattern mismatch let a hazardous item auto-approve.`;
    } else if (band === "auto_approve" && isHazardous && recommended) {
      outcome = "risky";
      reason = `${typeLabel}: threshold too low for this category.`;
    } else if (
      (band === "human_review" || band === "escalation") &&
      !isHazardous &&
      invoice.composite >= 0.85
    ) {
      outcome = "wasteful";
      reason = "Routine item routed conservatively when it could have auto-approved.";
    } else if (recommended) {
      outcome = "good";
      reason = `${typeLabel}: pattern matched the decomposition profile.`;
    } else {
      outcome = "wasteful";
      reason = `${typeLabel}: pattern is overcautious for this profile.`;
    }

    return {
      invoice,
      band,
      patternUsed: config.pattern,
      outcome,
      reason,
    };
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Routing — Round 3: same as R2 but with drift + audit gates
// ────────────────────────────────────────────────────────────────────────────

export function routeRound3(
  invoices: Invoice[],
  policy: R2Policy,
  pre: R3PreEvents
): ProcessedInvoice[] {
  // Drift shift: confidence scores systematically lower unless the player
  // ran regression tests (which lets them recalibrate ahead of time).
  const driftShift = pre.driftResponse === "regression_test" ? 0 : -0.07;

  const shifted = invoices.map((inv) => {
    const adjusted = Math.max(0, Math.min(1, inv.composite + driftShift));
    return { ...inv, composite: adjusted };
  });

  const processed = routeRound2(shifted, policy);

  // Apply pre-event consequences as outcome modifiers.
  return processed.map((p) => {
    let { outcome, reason } = p;

    // Audit / evidence gate
    if (
      pre.evidenceLevel === "minimal" &&
      p.band === "auto_approve" &&
      p.invoice.amount > 4000
    ) {
      outcome = "missed";
      reason = "Auto-approved with minimal evidence — auditor cannot reconstruct rationale.";
    }

    // Escalation gap
    if (
      pre.escalationFix === "ignore" &&
      p.invoice.type === "modified_terms" &&
      p.band === "auto_approve"
    ) {
      outcome = "risky";
      reason = "Escalation path was never defined — modified-terms invoice slipped.";
    }

    return { ...p, outcome, reason };
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Per-round score breakdown (out of 25 per dimension)
// ────────────────────────────────────────────────────────────────────────────

export function scoreRound(
  processed: ProcessedInvoice[],
  round: 1 | 2 | 3,
  pre?: R3PreEvents
): ScoreBreakdown {
  const total = processed.length || 1;
  const good = processed.filter((p) => p.outcome === "good").length;
  const risky = processed.filter((p) => p.outcome === "risky").length;
  const wasteful = processed.filter((p) => p.outcome === "wasteful").length;
  const missed = processed.filter((p) => p.outcome === "missed").length;

  // Efficiency: high when standard invoices auto-approved, low when over-routed.
  const efficient = processed.filter(
    (p) =>
      p.invoice.type === "standard" &&
      p.band === "auto_approve" &&
      p.outcome === "good"
  ).length;
  const standardCount = processed.filter((p) => p.invoice.type === "standard").length || 1;
  const efficiency = Math.round((efficient / standardCount) * 25 - wasteful * 1.5);

  // Risk Control: high when hazards were caught.
  const hazards = processed.filter(
    (p) => p.invoice.hiddenFlags.length > 0
  );
  const hazardCount = hazards.length || 1;
  const caught = hazards.filter((p) => p.band !== "auto_approve").length;
  const riskControl = Math.round((caught / hazardCount) * 25 - risky * 3);

  // Compliance: starts at full marks for R1/R2 (we don't model evidence gates
  // until R3). R3 deducts for missed evidence and rewards full audit posture.
  let compliance = round === 1 ? 18 : 22;
  if (round === 3 && pre) {
    compliance =
      pre.evidenceLevel === "full"
        ? 25
        : pre.evidenceLevel === "standard"
          ? 18
          : 8;
    compliance -= missed * 2;
  }

  // Adaptability: only meaningful in R3 (drift + escalation response).
  // R1 & R2 get a partial credit baseline that escalates as the player
  // demonstrates differentiated thinking.
  let adaptability = 12;
  if (round === 2) {
    // Reward differentiation: more distinct patterns used = more adaptive.
    const patternsUsed = new Set(
      processed.map((p) => p.patternUsed).filter(Boolean)
    ).size;
    adaptability = 8 + Math.min(15, patternsUsed * 3);
  }
  if (round === 3 && pre) {
    let a = 0;
    if (pre.driftResponse === "regression_test") a += 12;
    else if (pre.driftResponse === "pause") a += 8;
    else if (pre.driftResponse === "monitor") a += 4;
    if (pre.escalationFix === "define_path") a += 10;
    else if (pre.escalationFix === "review_queue") a += 6;
    else if (pre.escalationFix === "suspend") a += 5;
    adaptability = Math.min(25, a + good - risky);
  }

  // Clamp
  const clamp = (n: number) => Math.max(0, Math.min(25, n));
  return {
    efficiency: clamp(efficiency),
    riskControl: clamp(riskControl),
    compliance: clamp(compliance),
    adaptability: clamp(adaptability),
  };
}

/** Sum scores across rounds — caps each dimension at 25 (max single round). */
export function totalScore(rounds: RoundResult[]): ScoreBreakdown {
  if (rounds.length === 0) {
    return { efficiency: 0, riskControl: 0, compliance: 0, adaptability: 0 };
  }
  // Average across rounds (so a 3-round campaign maxes at 25 per dimension, 100 total)
  const sum = rounds.reduce<ScoreBreakdown>(
    (acc, r) => ({
      efficiency: acc.efficiency + r.score.efficiency,
      riskControl: acc.riskControl + r.score.riskControl,
      compliance: acc.compliance + r.score.compliance,
      adaptability: acc.adaptability + r.score.adaptability,
    }),
    { efficiency: 0, riskControl: 0, compliance: 0, adaptability: 0 }
  );
  return {
    efficiency: Math.round(sum.efficiency / rounds.length),
    riskControl: Math.round(sum.riskControl / rounds.length),
    compliance: Math.round(sum.compliance / rounds.length),
    adaptability: Math.round(sum.adaptability / rounds.length),
  };
}

export function totalNumeric(score: ScoreBreakdown): number {
  return score.efficiency + score.riskControl + score.compliance + score.adaptability;
}
