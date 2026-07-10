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
  VerificationDepth,
} from "./types";
import { DEFAULT_WEIGHTS } from "./types";

/**
 * Composite confidence score from VAOM v4.0 §8. Weighted average across
 * five dimensions, with a hard floor: if any dimension falls below 0.40
 * the composite is capped at 0.70 (review band).
 *
 * v4.0: `verification` is nullable. When it is not run, the composite
 * renormalizes over the remaining four dimensions — disabled verification
 * narrows the composite rather than silently inflating it.
 */
export function compositeConfidence(
  c: ConfidenceDimensions,
  w: DimensionWeights = DEFAULT_WEIGHTS
): number {
  const anomalyAdjusted = 1 - c.anomalySignal;
  const hasVerification = c.verification !== null && c.verification !== undefined;

  const entries: { value: number; weight: number }[] = [
    { value: c.modelCertainty, weight: w.modelCertainty },
    { value: c.ruleMatch, weight: w.ruleMatch },
    { value: c.dataCompleteness, weight: w.dataCompleteness },
    { value: anomalyAdjusted, weight: w.anomalySignal },
  ];
  if (hasVerification) {
    entries.push({ value: c.verification as number, weight: w.verification });
  }

  const weightSum = entries.reduce((s, e) => s + e.weight, 0) || 1;
  const weighted = entries.reduce((s, e) => s + e.value * (e.weight / weightSum), 0);

  if (entries.some((e) => e.value < 0.4)) {
    return Math.min(weighted, 0.7);
  }
  return Math.max(0, Math.min(1, weighted));
}

/**
 * v4.0: derive the verification signal for an item from the configured
 * verification depth. This is where verification theater becomes visible:
 * a shallow verifier returns ~0.96 for everything, hazard or not.
 */
export function verificationSignal(
  invoice: Invoice,
  depth: VerificationDepth
): number | null {
  if (depth === "off") return null;
  const hazardous = invoice.hiddenFlags.length > 0;
  if (depth === "shallow") {
    // Checks trivial properties — approves everything. Theater.
    return 0.96;
  }
  if (depth === "preconditions") {
    // Catches rule-level problems (mismatched PO, unverified vendor).
    return hazardous && invoice.poMatch !== "yes" ? 0.3 : hazardous ? 0.62 : 0.95;
  }
  // dry_run — validates expected postconditions; catches most hazards.
  return hazardous ? 0.22 : 0.97;
}

/**
 * Recompute composite scores on all invoices using the player's custom
 * dimension weights and verification depth. Called once before routing.
 */
export function recomputeComposites(
  invoices: Invoice[],
  weights: DimensionWeights,
  verificationDepth: VerificationDepth = "off"
): Invoice[] {
  return invoices.map((inv) => {
    const verification = verificationSignal(inv, verificationDepth);
    const confidence = { ...inv.confidence, verification };
    return {
      ...inv,
      confidence,
      composite: compositeConfidence(confidence, weights),
    };
  });
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

    // Escalation gap — triggers on any hazardous item that auto-approved
    // when the escalation path was never fixed
    if (
      pre.escalationFix === "ignore" &&
      p.invoice.hiddenFlags.length > 0 &&
      p.band === "auto_approve"
    ) {
      outcome = "risky";
      reason = "Escalation path was never defined — a hazardous item slipped through.";
    }

    return { ...p, outcome, reason };
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Per-round score breakdown (v4.0: out of 20 per dimension, five dimensions)
// ────────────────────────────────────────────────────────────────────────────

export function scoreRound(
  processed: ProcessedInvoice[],
  round: 1 | 2 | 3 | 4,
  pre?: R3PreEvents,
  /** v4.0: Round 4 passes a pre-computed enforcement score from the swarm engine. */
  enforcementOverride?: number,
  verificationDepth?: VerificationDepth
): ScoreBreakdown {
  const good = processed.filter((p) => p.outcome === "good").length;
  const risky = processed.filter((p) => p.outcome === "risky").length;
  const wasteful = processed.filter((p) => p.outcome === "wasteful").length;
  const missed = processed.filter((p) => p.outcome === "missed").length;

  // Burst-cluster flags mark legitimate volume spikes (guardian calibration
  // tests), not hazards — they must not count against risk control.
  const realFlags = (p: ProcessedInvoice) =>
    p.invoice.hiddenFlags.filter((f) => f !== "burst_cluster");

  // Efficiency: high when routine items auto-approved correctly, low when over-routed.
  // "Routine" = no hidden flags and good outcome (scenario-agnostic).
  const efficient = processed.filter(
    (p) =>
      realFlags(p).length === 0 &&
      p.band === "auto_approve" &&
      p.outcome === "good"
  ).length;
  const routineCount = processed.filter((p) => realFlags(p).length === 0).length || 1;
  let efficiency = Math.round((efficient / routineCount) * 20 - wasteful * 1.2);
  // Verification has a cost: dry-running everything is thorough but slow.
  if (verificationDepth === "dry_run") efficiency -= 2;

  // Risk Control: high when hazards were caught.
  const hazards = processed.filter((p) => realFlags(p).length > 0);
  const hazardCount = hazards.length || 1;
  const caught = hazards.filter((p) => p.band !== "auto_approve").length;
  const riskControl = Math.round((caught / hazardCount) * 20 - risky * 2.5);

  // Compliance: starts at partial marks for R1/R2 (we don't model evidence gates
  // until R3). R3 deducts for missed evidence and rewards full audit posture.
  let compliance = round === 1 ? 14 : 17;
  if (round === 3 && pre) {
    compliance =
      pre.evidenceLevel === "full"
        ? 20
        : pre.evidenceLevel === "standard"
          ? 14
          : 6;
    compliance -= missed * 2;
  }
  if (round === 4) {
    // Night shift compliance: every event is logged; deduct for incidents.
    compliance = 18 - risky * 3 - missed * 2;
  }

  // Adaptability: only meaningful in R3+ (drift + escalation response).
  let adaptability = 10;
  if (round === 2) {
    // Reward differentiation: more distinct patterns used = more adaptive.
    const patternsUsed = new Set(
      processed.map((p) => p.patternUsed).filter(Boolean)
    ).size;
    adaptability = 6 + Math.min(12, patternsUsed * 2.5);
  }
  if (round === 3 && pre) {
    let a = 0;
    if (pre.driftResponse === "regression_test") a += 10;
    else if (pre.driftResponse === "pause") a += 6;
    else if (pre.driftResponse === "monitor") a += 3;
    if (pre.escalationFix === "define_path") a += 8;
    else if (pre.escalationFix === "review_queue") a += 5;
    else if (pre.escalationFix === "suspend") a += 4;
    adaptability = Math.min(20, a + Math.round(good * 0.5) - risky);
  }
  if (round === 4) {
    // Adaptability at night = how well the chain handled the unexpected.
    adaptability = Math.min(20, 8 + good - risky * 2);
  }

  // Enforcement (v4.0): only fully measurable in Round 4 (the swarm engine
  // computes it from attenuation, boundary depths, and guardian calibration).
  // Earlier rounds get a modest baseline — enforcement hasn't been tested yet.
  let enforcement = round === 1 ? 10 : round === 2 ? 11 : 12;
  if (enforcementOverride !== undefined) {
    enforcement = enforcementOverride;
  }

  // Clamp
  const clamp = (n: number) => Math.max(0, Math.min(20, Math.round(n)));
  return {
    efficiency: clamp(efficiency),
    riskControl: clamp(riskControl),
    compliance: clamp(compliance),
    adaptability: clamp(adaptability),
    enforcement: clamp(enforcement),
  };
}

/** Average scores across rounds — each dimension /20, total /100. */
export function totalScore(rounds: RoundResult[]): ScoreBreakdown {
  if (rounds.length === 0) {
    return { efficiency: 0, riskControl: 0, compliance: 0, adaptability: 0, enforcement: 0 };
  }
  const sum = rounds.reduce<ScoreBreakdown>(
    (acc, r) => ({
      efficiency: acc.efficiency + r.score.efficiency,
      riskControl: acc.riskControl + r.score.riskControl,
      compliance: acc.compliance + r.score.compliance,
      adaptability: acc.adaptability + r.score.adaptability,
      enforcement: acc.enforcement + (r.score.enforcement ?? 10),
    }),
    { efficiency: 0, riskControl: 0, compliance: 0, adaptability: 0, enforcement: 0 }
  );
  return {
    efficiency: Math.round(sum.efficiency / rounds.length),
    riskControl: Math.round(sum.riskControl / rounds.length),
    compliance: Math.round(sum.compliance / rounds.length),
    adaptability: Math.round(sum.adaptability / rounds.length),
    enforcement: Math.round(sum.enforcement / rounds.length),
  };
}

export function totalNumeric(score: ScoreBreakdown): number {
  return (
    score.efficiency +
    score.riskControl +
    score.compliance +
    score.adaptability +
    (score.enforcement ?? 0)
  );
}
