import type {
  AntiPatternId,
  DetectedAntiPattern,
  DimensionWeights,
  MultiAgentFailureMode,
  ProcessedInvoice,
  R3PreEvents,
  RoundNumber,
} from "./types";

export const ANTI_PATTERN_DEFS: Record<
  AntiPatternId,
  { label: string; description: string }
> = {
  review_queue_flood: {
    label: "The Review Queue Flood",
    description:
      "Thresholds too conservative — the majority of items route to human review and rubber-stamping begins.",
  },
  confidence_mirage: {
    label: "The Confidence Mirage",
    description:
      "Composite scores cluster high and look healthy, but post-execution audits reveal errors. Over-reliance on model certainty.",
  },
  exception_graveyard: {
    label: "The Exception Graveyard",
    description:
      "Too many hardcoded exceptions accumulate, bypassing the Confidence Gate entirely.",
  },
  stale_threshold: {
    label: "The Stale Threshold",
    description:
      "Model drift shifted the confidence distribution but thresholds were never recalibrated.",
  },
  dimension_collapse: {
    label: "The Dimension Collapse",
    description:
      "The composite score effectively equals a single dimension — the other three are along for the ride.",
  },
};

export const MULTI_AGENT_FAILURE_DEFS: Record<
  MultiAgentFailureMode,
  { label: string; description: string }
> = {
  authority_conflict: {
    label: "Authority conflict",
    description: "Two agents claim jurisdiction over the same decision, or neither does.",
  },
  cascading_confidence_erosion: {
    label: "Cascading confidence erosion",
    description: "Small errors compound across agent chains — each agent scored correctly, but the aggregate outcome was wrong.",
  },
  coordination_state_loss: {
    label: "Coordination state loss",
    description: "Handoffs lost context — downstream agents acted on incomplete information.",
  },
};

/**
 * Run anti-pattern detection on a set of processed invoices.
 * Called in real-time as invoices stream in (for the Dashboard)
 * and again on the full set after completion.
 */
export function detectAntiPatterns(
  processed: ProcessedInvoice[],
  round: RoundNumber,
  weights?: DimensionWeights,
  priorAutoRate?: number
): DetectedAntiPattern[] {
  if (processed.length < 3) return [];
  const detected: DetectedAntiPattern[] = [];

  // Review Queue Flood: >60% route to Band B
  const reviewCount = processed.filter(
    (p) => p.band === "human_review" || p.band === "escalation"
  ).length;
  if (reviewCount / processed.length > 0.6) {
    detected.push({
      id: "review_queue_flood",
      round,
      detail: `${Math.round((reviewCount / processed.length) * 100)}% of items routed to human review or escalation.`,
    });
  }

  // Confidence Mirage: >85% of composites cluster between 0.92 and 0.98
  const highCluster = processed.filter(
    (p) => p.invoice.composite >= 0.92 && p.invoice.composite <= 0.98
  ).length;
  if (highCluster / processed.length > 0.85) {
    detected.push({
      id: "confidence_mirage",
      round,
      detail: `${Math.round((highCluster / processed.length) * 100)}% of composite scores fell between 0.92 and 0.98 — a dangerously narrow band.`,
    });
  }

  // Dimension Collapse: if any single weight > 0.60
  if (weights) {
    const dims: (keyof DimensionWeights)[] = [
      "modelCertainty",
      "ruleMatch",
      "dataCompleteness",
      "anomalySignal",
    ];
    for (const dim of dims) {
      if (weights[dim] > 0.6) {
        const name = dim
          .replace(/([A-Z])/g, " $1")
          .toLowerCase()
          .trim();
        detected.push({
          id: "dimension_collapse",
          round,
          detail: `${name} weight is ${(weights[dim] * 100).toFixed(0)}% — composite score tracks this single dimension too closely.`,
        });
        break;
      }
    }
  }

  // Stale Threshold: Round 3 drift caused >20% swing in auto-approval rate
  if (round === 3 && priorAutoRate !== undefined) {
    const currentAutoRate =
      processed.filter((p) => p.band === "auto_approve").length / processed.length;
    const delta = Math.abs(currentAutoRate - priorAutoRate);
    if (delta > 0.2) {
      detected.push({
        id: "stale_threshold",
        round,
        detail: `Auto-approval rate shifted by ${Math.round(delta * 100)} percentage points after the model update — thresholds were not recalibrated.`,
      });
    }
  }

  return detected;
}

/**
 * Detect multi-agent failure modes in Round 3 based on the split-invoice
 * scenario and escalation gap handling.
 */
export function detectMultiAgentFailures(
  processed: ProcessedInvoice[],
  pre?: R3PreEvents
): MultiAgentFailureMode[] {
  const failures: MultiAgentFailureMode[] = [];

  // Find split invoices
  const splits = processed.filter((p) => p.invoice.type === "split_invoice");

  if (splits.length >= 2) {
    const bothAutoApproved = splits.every((p) => p.band === "auto_approve");
    const differentBands = new Set(splits.map((p) => p.band)).size > 1;

    if (bothAutoApproved) {
      // Neither agent caught the combined threshold violation
      failures.push("coordination_state_loss");
    }
    if (differentBands) {
      // Agents disagreed on the same vendor's invoices
      failures.push("authority_conflict");
    }
  }

  // Cascading confidence erosion: drift caused auto-approved items to
  // have lower composite scores than usual, compounding across the chain
  const driftedDown = processed.filter(
    (p) =>
      p.band === "human_review" &&
      p.invoice.composite > 0.75 &&
      p.invoice.composite < 0.88
  );
  if (driftedDown.length >= 3) {
    failures.push("cascading_confidence_erosion");
  }

  // Escalation gap not fixed → authority conflict on modified terms
  if (pre?.escalationFix === "ignore") {
    const modTermsAutoApproved = processed.some(
      (p) => p.invoice.type === "modified_terms" && p.band === "auto_approve"
    );
    if (modTermsAutoApproved && !failures.includes("authority_conflict")) {
      failures.push("authority_conflict");
    }
  }

  return failures;
}
