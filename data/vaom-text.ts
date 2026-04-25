import type {
  DetectedAntiPattern,
  MultiAgentFailureMode,
  ProcessedInvoice,
  ProfileArchetype,
  R1Policy,
  R2Policy,
  R3PreEvents,
  RoundNumber,
  RoundResult,
  ScenarioDomain,
  ScoreBreakdown,
} from "../lib/types";
import { totalNumeric } from "../lib/scoring";
import { ANTI_PATTERN_DEFS, MULTI_AGENT_FAILURE_DEFS } from "../lib/anti-patterns";

/**
 * VAOM voice — fallback text bank. Used when /api/claude is unavailable or
 * to fill the briefing screen instantly while the dynamic Claude response
 * streams in. Voice rules: calm, precise, slightly dry. References specifics.
 * Never speaks in generalities when it has them.
 */

/**
 * Translate the internal flag tokens (e.g. "modified_terms_net15_with_2pct_discount")
 * into a sentence VAOM can speak naturally. The tokens are deliberately
 * descriptive in code so they're easy to grep, but they leak into the
 * narration if we're not careful.
 */
function humanizeFlag(flag: string): string {
  const map: Record<string, string> = {
    // Invoice processing
    modified_terms_net15_with_2pct_discount:
      "modified payment terms — a shift from net-30 to net-15 with an early-payment discount",
    unverified_vendor: "an unverified vendor with no prior history",
    above_5k_threshold: "an amount above the five-thousand-euro threshold",
    matches_invoice_INV_2003: "a near-duplicate of another item in the same batch",
    possible_resend: "a possible duplicate re-send",
    paired_with_INV_3011: "a companion item that together exceeds the threshold",
    paired_with_INV_3012: "a companion item that together exceeds the threshold",
    // Customer complaints
    regulatory_reporting_obligation: "a regulatory reporting obligation hidden in the complaint language",
    ombudsman_threat: "a customer threatening to escalate to the financial ombudsman",
    vulnerable_customer: "a vulnerable customer indicator requiring special handling",
    systemic_issue_pattern: "a pattern suggesting a systemic issue across multiple complaints",
    compensation_above_authority: "a compensation request above the delegated authority threshold",
    // AML triage
    cross_border_element: "a cross-border element requiring multi-jurisdiction coordination",
    known_typology_match: "a match against a known money laundering typology",
    structuring_pattern: "a structuring pattern — multiple transactions below the reporting threshold",
    sar_filing_deadline: "an approaching SAR filing deadline with regulatory consequences",
    shell_company_indicator: "shell company indicators in the transaction chain",
    // HR investigation
    involves_c_suite_executive: "involvement of a C-suite executive — escalation required",
    pattern_not_isolated: "evidence suggesting a pattern of behaviour, not an isolated incident",
    conflict_of_interest: "a conflict of interest — the accused is the investigator's manager",
    non_delegable_outcome: "a non-delegable outcome decision affecting careers",
    media_sensitivity: "media sensitivity requiring communications team coordination",
    multi_department_scope: "a multi-department scope requiring cross-team coordination",
  };
  const normalized = flag.replace(/-/g, "_");
  if (map[normalized]) return map[normalized];
  // Fallback: turn snake_case into readable text.
  return flag.replace(/_/g, " ");
}

// ────────────────────────────────────────────────────────────────────────────
// Briefings — pre-round narration
// ────────────────────────────────────────────────────────────────────────────

const SCENARIO_R1_FLAVOR: Record<string, { items: string; verb: string }> = {
  invoice_processing: { items: "vendor invoices", verb: "auto-approves" },
  customer_complaints: { items: "customer complaints", verb: "auto-classifies" },
  aml_triage: { items: "transaction monitoring alerts", verb: "auto-dismisses" },
  hr_investigation: { items: "reported HR cases", verb: "auto-classifies" },
};

export function briefingFallback(round: RoundNumber, scenario?: ScenarioDomain): string {
  const flavor = SCENARIO_R1_FLAVOR[scenario ?? "invoice_processing"];
  if (round === 1) {
    return [
      "Banks have managed structured decision authority for decades. Risk bands determine which loans are auto-approved, which need an underwriter, and which go to committee. They separate statistical risk scores from institutional authority. They log every decision. They recalibrate against outcomes. VAOM brings the same discipline to AI. Your job: design the delegation policy for this workflow. Let's see what you learn.",
      `Round one is the simplest case. A stream of ${flavor.items} will arrive. You will set a single confidence threshold. Above the threshold, the agent ${flavor.verb}. Below it, a human reviews.`,
      "Pay attention to what this configuration cannot express. Your workflow contains more decision points than the obvious ones. You will need that observation for what comes next.",
    ].join("\n\n");
  }
  if (round === 2) {
    return [
      "A threshold is not a delegation policy. Last round you made one cut across every decision. This round you will make six.",
      "There are six named delegation patterns in the Verkflöde Agent Operating Model. Each pattern represents a different relationship between agent action and human authority. You will assign one to each decision type, with its own confidence threshold.",
      "Before you choose, look at the authority decomposition for each decision. Reversibility, consequence scope, regulatory exposure, confidence measurability, accountability clarity. The profile should tell you which pattern fits.",
    ].join("\n\n");
  }
  return [
    "Three things have happened since you last sat at this console.",
    "Your AI provider has pushed a foundation model update. A regulator has requested decision evidence for fifty automated decisions from Q1. And an item was auto-processed last week down a path your escalation rules never defined.",
    "This round tests whether your delegation design is governance-ready, not just operationally functional. Address the three pre-events. Then run the simulation.",
  ].join("\n\n");
}

// ────────────────────────────────────────────────────────────────────────────
// Debriefs — post-round analysis (template-based fallback)
// ────────────────────────────────────────────────────────────────────────────

export type DebriefArgs = {
  round: RoundNumber;
  processed: ProcessedInvoice[];
  score: ScoreBreakdown;
  policy?: { r1?: R1Policy; r2?: R2Policy; r3?: R3PreEvents };
  antiPatterns?: DetectedAntiPattern[];
  multiAgentFailures?: MultiAgentFailureMode[];
  scenario?: ScenarioDomain;
};

const SCENARIO_NOUNS: Record<string, { singular: string; plural: string }> = {
  invoice_processing: { singular: "invoice", plural: "invoices" },
  customer_complaints: { singular: "complaint", plural: "complaints" },
  aml_triage: { singular: "alert", plural: "alerts" },
  hr_investigation: { singular: "case", plural: "cases" },
};

export function debriefFallback(args: DebriefArgs): string {
  const { round, processed, score } = args;
  const nouns = SCENARIO_NOUNS[args.scenario ?? "invoice_processing"];
  const risky = processed.filter((p) => p.outcome === "risky");
  const wasteful = processed.filter((p) => p.outcome === "wasteful");
  const good = processed.filter((p) => p.outcome === "good");
  const total = processed.length;
  const autoApproved = processed.filter((p) => p.band === "auto_approve").length;

  const paragraphs: string[] = [];

  // ── P1: what happened, with specifics ────────────────────────────────────
  if (round === 1 && args.policy?.r1) {
    const slipped = risky.find((p) => p.band === "auto_approve");
    paragraphs.push(
      `You set your threshold at ${args.policy.r1.threshold} percent. ${autoApproved} of ${total} ${nouns.plural} auto-processed. ${
        slipped
          ? `That number includes ${slipped.invoice.id} — and it should not have.`
          : "Nothing slipped through that should not have."
      }`
    );
  } else {
    paragraphs.push(
      `${total} ${nouns.plural} processed. ${autoApproved} auto-processed, ${good.length} routed appropriately, ${risky.length} flagged as risky in retrospect, ${wasteful.length} routed more conservatively than they needed to be.`
    );
  }

  // ── P2: what they missed or got right ────────────────────────────────────
  if (risky.length > 0) {
    const r = risky[0];
    const flagText = r.invoice.hiddenFlags.length > 0
      ? humanizeFlag(r.invoice.hiddenFlags[0])
      : "category risk that confidence alone could not surface";
    paragraphs.push(
      `${r.invoice.id} from ${r.invoice.vendor} carried ${flagText}. Confidence on that ${nouns.singular} was ${(r.invoice.composite * 100).toFixed(0)} percent — high enough to clear most thresholds, and your agent acted on it. Confidence was never the problem. Authority was.`
    );
  } else if (wasteful.length > 2) {
    paragraphs.push(
      `${wasteful.length} ${nouns.plural} were routed to human review when the underlying decomposition profile permitted autonomous action. Your humans did work the system was designed to spare them. Pattern selection is not overhead — it is the delegation design.`
    );
  } else {
    paragraphs.push(
      "The configuration held. Hazards were caught, routine items moved, and your humans were not flooded. This is what the Confidence Gate is for: separating statistical confidence from organizational authority before either gets confused with the other."
    );
  }

  // ── P3: name the principle ───────────────────────────────────────────────
  if (round === 1) {
    paragraphs.push(
      "This is the Delegation Gap. A single confidence threshold tells you whether the agent feels certain. It does not tell you whether the agent is permitted to act. The Decision Inventory for this workflow identifies twenty-three decision points. You configured for one."
    );
  } else if (round === 2) {
    paragraphs.push(
      "Confidence informs authority. It does not define it. The six delegation patterns exist precisely because different decisions require different relationships between agent action and human review. Execute & Audit is not a default. It is an answer to a specific decomposition profile."
    );
  } else {
    paragraphs.push(
      "Your delegation design must survive the system changing underneath it. Foundation model drift, regulator audits, and undefined escalation paths are not edge cases. They are the operating reality. The Readiness Assessment exists to make sure your delegation is governance-ready, not just operationally functional."
    );
  }

  // ── Anti-pattern naming (v3.5) ────────────────────────────────────────────
  if (args.antiPatterns && args.antiPatterns.length > 0) {
    const names = args.antiPatterns
      .map((ap) => ANTI_PATTERN_DEFS[ap.id].label)
      .join(", ");
    paragraphs.push(
      `I observed a calibration signal worth naming: ${names}. A bank would not auto-approve a loan just because the credit score was high. It would also check the loan-to-value ratio, the employment verification, and the regulatory exposure. Your delegation system should apply the same discipline.`
    );
  }

  // ── Multi-agent failure naming (v3.5, R3 only) ──────────────────────────
  if (args.multiAgentFailures && args.multiAgentFailures.length > 0) {
    const names = args.multiAgentFailures
      .map((m) => MULTI_AGENT_FAILURE_DEFS[m].label)
      .join(", ");
    paragraphs.push(
      `Your multi-agent coordination encountered: ${names}. These are the three failure modes unique to Pattern 6. Each agent scored its own decision correctly, but the aggregate outcome was wrong.`
    );
  }

  // ── P4: foreshadowing ────────────────────────────────────────────────────
  if (round === 1) {
    paragraphs.push(
      "Round two brings five distinct decision types, adjustable confidence weights, and the risk of calibration anti-patterns. The vocabulary is going to expand. Be ready."
    );
  } else if (round === 2) {
    paragraphs.push(
      "Round three is the audit. The system is about to change underneath you, and multi-agent coordination will compound the challenge. We will see whether your design can answer for itself."
    );
  } else {
    paragraphs.push(
      `Total score: ${totalNumeric(score)} of 100. Your delegation profile follows.`
    );
  }

  return paragraphs.join("\n\n");
}

// ────────────────────────────────────────────────────────────────────────────
// Final assessment — derived from cumulative scores
// ────────────────────────────────────────────────────────────────────────────

export function chooseArchetype(rounds: RoundResult[]): ProfileArchetype {
  if (rounds.length === 0) return "balanced_operator";
  const avg = (key: keyof ScoreBreakdown) =>
    rounds.reduce((s, r) => s + r.score[key], 0) / rounds.length;
  const eff = avg("efficiency");
  const risk = avg("riskControl");
  const comp = avg("compliance");
  const adapt = avg("adaptability");
  const total = eff + risk + comp + adapt;

  if (total >= 88 && risk >= 22 && comp >= 22) return "delegation_natural";
  if (risk >= 20 && comp >= 20 && eff < 16) return "compliance_hawk";
  if (eff >= 22 && risk < 16) return "speed_optimizer";
  if (eff < 14 && risk >= 18) return "cautious_architect";
  return "balanced_operator";
}

export const ARCHETYPE_DETAILS: Record<
  ProfileArchetype,
  { name: string; quote: string; assessment: string }
> = {
  cautious_architect: {
    name: "The Cautious Architect",
    quote:
      "You over-indexed on safety and under-indexed on flow. Every item got its day in court.",
    assessment:
      "You routed conservatively across the board. Hazards rarely slipped, but humans absorbed work the system was designed to spare them. To go live, calibrate thresholds against your actual historical false-positive rate and trust the patterns where the decomposition profile says you should.\n\nYour next move is differentiation. Execute & Audit exists for a reason — use it where reversibility, consequence scope, and accountability all support it. Save Prepare & Present for the decisions that genuinely demand human judgment.",
  },
  speed_optimizer: {
    name: "The Speed Optimizer",
    quote:
      "Fast, fluid, and missing the controls that make speed defensible. Auditors will have questions.",
    assessment:
      "You moved volume. Routine items cleared in seconds and your humans were not flooded. The problem is the hazards: high-consequence decisions, unverified sources, and multi-item patterns all benefited from the same low threshold. To go live, raise the floor for non-routine categories and pull non-delegable decisions out of the auto-approve band entirely.\n\nTreat efficiency as a constraint, not the goal. The Delegation Gap closes when speed is bounded by explicit authority — not when speed is the optimization function.",
  },
  compliance_hawk: {
    name: "The Compliance Hawk",
    quote:
      "Audit-ready and pattern-precise. Slow in the throughput numbers, but the regulator would shake your hand.",
    assessment:
      "Your evidence posture and pattern selection are strong. The drift response was sound, the escalation gap was closed, and the audit request would have been answerable. The trade-off is throughput: routine items that could have auto-processed sat in review queues longer than they needed to.\n\nTo move toward Balanced Operator, identify the categories where Execute & Audit is genuinely safe and let them flow. Your governance instincts are good — give yourself permission to delegate where the decomposition supports it.",
  },
  balanced_operator: {
    name: "The Balanced Operator",
    quote:
      "Differentiated patterns, reasonable thresholds, and a delegation design that adapts. A few edge cases got through, but the fundamentals are sound.",
    assessment:
      "You separated decision types, picked appropriate patterns for most of them, and responded constructively when the system changed. This is what controlled delegation looks like in practice — not perfect, but defensible end-to-end.\n\nThe gap between you and Delegation Natural is tightness on the edge cases: the paired-item scenario, the non-delegable auto-approve, the pattern mismatches. Tighten those and you have a production-ready delegation policy.",
  },
  delegation_natural: {
    name: "The Delegation Natural",
    quote:
      "Pattern selection nailed, the hidden hazard caught, drift handled, audit answerable. Rare.",
    assessment:
      "You read the decomposition profiles, you assigned patterns that matched them, you ran regression tests before trusting the new model, and you produced evidence the auditor could actually use. There is nothing structurally to fix.\n\nIf you took this policy to production tomorrow, the work that remains is calibration against real volumes — not redesign. That is the difference between someone who has read the framework and someone who has internalized it.",
  },
};

// ────────────────────────────────────────────────────────────────────────────
// Round 3 in-event narration
// ────────────────────────────────────────────────────────────────────────────

export const PRE_EVENTS = {
  drift: {
    title: "Foundation model update",
    body: "Your AI provider has pushed a model update overnight. Confidence score distributions may have shifted. Your existing thresholds were calibrated against the previous model.",
    options: [
      {
        id: "regression_test",
        label: "Run regression tests first",
        detail:
          "Replay historical decisions through the new model. Recalibrate thresholds before any auto-approvals resume.",
      },
      {
        id: "pause",
        label: "Pause auto-approvals until validated",
        detail:
          "Conservative. Everything goes to human review until you have confidence the new model behaves.",
      },
      {
        id: "monitor",
        label: "Accept and monitor",
        detail:
          "Let the new model run in production. Watch for divergence in real time.",
      },
      {
        id: "ignore",
        label: "Ignore the announcement",
        detail: "Carry on with the current configuration. Hope the change is small.",
      },
    ],
  },
  audit: {
    title: "Regulator audit request",
    body: "A regulator has requested decision evidence for fifty automated decisions from Q1. They want the inputs, the confidence scores, the policy version, and the named accountable human for each one.",
    options: [
      {
        id: "full",
        label: "Full evidence (slowest, most defensible)",
        detail:
          "Log every dimension, every input, every policy version. Audit trails are bulletproof.",
      },
      {
        id: "standard",
        label: "Standard evidence",
        detail:
          "Log decisions, inputs, and outcomes. Some reconstruction needed for edge cases.",
      },
      {
        id: "minimal",
        label: "Minimal evidence (fastest)",
        detail:
          "Log only the decision and timestamp. Reconstruction will be hard if questioned.",
      },
    ],
  },
  escalation: {
    title: "Undefined escalation path",
    body: "An item was auto-processed last week that should have been escalated. The escalation path for that category was never defined.",
    options: [
      {
        id: "define_path",
        label: "Define the escalation path now",
        detail:
          "Identify the receiving role, document the path, and test it before the simulation runs.",
      },
      {
        id: "review_queue",
        label: "Add the category to the review queue",
        detail:
          "Stop short of formal escalation, but route those decisions through human review.",
      },
      {
        id: "suspend",
        label: "Suspend auto-approval for that category",
        detail:
          "Block the agent from acting on the category entirely until the path is defined.",
      },
      {
        id: "ignore",
        label: "Defer the fix",
        detail: "Acknowledge and move on. Hope it doesn't recur.",
      },
    ],
  },
} as const;
