import type {
  DecisionType,
  DecompositionProfile,
  DelegationPattern,
} from "./types";

/**
 * The six VAOM v3.0 delegation patterns, in order of increasing agent autonomy.
 * Spec: §4.3 of the whitepaper.
 */
export const PATTERNS: Record<
  DelegationPattern,
  {
    name: string;
    short: string;
    autonomy: number; // 1..6
    humanRole: string;
    agentRole: string;
    useWhen: string;
    accent: "cyan" | "amber" | "mint" | "sky" | "lav" | "vkgreen";
  }
> = {
  prepare_present: {
    name: "Prepare & Present",
    short: "Agent assembles context. Human decides and acts.",
    autonomy: 1,
    humanRole: "Decision-maker",
    agentRole: "Context assembler",
    useWhen:
      "High-consequence, judgment-dependent, or non-delegable decisions where preparation is automatable.",
    accent: "lav",
  },
  draft_approve: {
    name: "Draft & Approve",
    short: "Agent drafts. Human reviews, modifies, approves before execution.",
    autonomy: 2,
    humanRole: "Approver with modification rights",
    agentRole: "Drafter",
    useWhen:
      "Decisions that need human judgment but where the agent can produce a reasonable first pass.",
    accent: "sky",
  },
  triage_route: {
    name: "Triage & Route",
    short: "Agent classifies and routes to the right handler. Doesn't resolve.",
    autonomy: 3,
    humanRole: "Exception handler for misroutes",
    agentRole: "Classifier and router",
    useWhen:
      "High volume, well-defined classification rules, manageable misroute cost.",
    accent: "mint",
  },
  execute_audit: {
    name: "Execute & Audit",
    short: "Agent decides and executes. Humans audit a sample after.",
    autonomy: 4,
    humanRole: "Auditor (post-execution)",
    agentRole: "Decision-maker and executor within authority",
    useWhen:
      "Bounded, reversible consequences. High historical confidence. Authority permits autonomous action.",
    accent: "vkgreen",
  },
  monitor_intervene: {
    name: "Monitor & Intervene",
    short: "Agent runs continuously. Humans get alerted and can override.",
    autonomy: 5,
    humanRole: "Interventionist",
    agentRole: "Continuous monitor with bounded response authority",
    useWhen:
      "Continuous detection workloads where intervention paths are well-defined.",
    accent: "amber",
  },
  coordinate_escalate: {
    name: "Coordinate & Escalate",
    short:
      "Multiple agents collaborate, with explicit handoffs and escalation on cross-boundary state.",
    autonomy: 6,
    humanRole: "Escalation authority for coordination failures",
    agentRole: "Specialist within scope, with handoff protocols",
    useWhen:
      "Multi-domain workflows with mature governance over individual agent authorities.",
    accent: "cyan",
  },
};

/**
 * The six decision types the simulator throws at the player. Round 2 lets
 * the player assign one pattern + threshold to each. The decomposition
 * profile drives the radar chart and the "did the player pick the right
 * pattern?" scoring.
 */
export const DECISION_TYPES: Record<
  DecisionType,
  {
    label: string;
    blurb: string;
    decomposition: DecompositionProfile;
    /** The pattern VAOM would recommend for this decomposition profile. */
    recommendedPattern: DelegationPattern;
    /** Patterns that are "acceptable" — close enough not to be marked as risky. */
    acceptablePatterns: DelegationPattern[];
  }
> = {
  standard: {
    label: "Standard invoice (≤ €5k)",
    blurb: "Routine vendor invoice, clear PO match, amount within historical norms.",
    decomposition: {
      reversibility: "reversible_friction",
      consequenceScope: "internal_financial",
      regulatoryExposure: "general_context",
      confidenceMeasurability: "quantifiable",
      accountabilityClarity: "clear_owner",
    },
    recommendedPattern: "execute_audit",
    acceptablePatterns: ["execute_audit", "draft_approve"],
  },
  high_value: {
    label: "High-value invoice (> €5k)",
    blurb: "Larger amount, often crosses an authority threshold or vendor cap.",
    decomposition: {
      reversibility: "partially_reversible",
      consequenceScope: "internal_financial",
      regulatoryExposure: "general_context",
      confidenceMeasurability: "quantifiable",
      accountabilityClarity: "clear_owner",
    },
    recommendedPattern: "draft_approve",
    acceptablePatterns: ["draft_approve", "prepare_present"],
  },
  duplicate: {
    label: "Duplicate detection anomaly",
    blurb: "Looks like an existing invoice. Could be a re-send, could be fraud.",
    decomposition: {
      reversibility: "partially_reversible",
      consequenceScope: "internal_financial",
      regulatoryExposure: "general_context",
      confidenceMeasurability: "partially_quantifiable",
      accountabilityClarity: "shared_defined",
    },
    recommendedPattern: "triage_route",
    acceptablePatterns: ["triage_route", "draft_approve"],
  },
  modified_terms: {
    label: "Modified payment terms",
    blurb:
      "Vendor has shifted contract terms (e.g., net-30 → net-15 with discount). Contractual modification.",
    decomposition: {
      reversibility: "partially_reversible",
      consequenceScope: "external_relational",
      regulatoryExposure: "general_context",
      confidenceMeasurability: "judgment_dependent",
      accountabilityClarity: "shared_defined",
    },
    recommendedPattern: "prepare_present",
    acceptablePatterns: ["prepare_present", "draft_approve"],
  },
  new_vendor: {
    label: "New / unverified vendor",
    blurb: "Vendor not yet in the approved list. KYC and onboarding incomplete.",
    decomposition: {
      reversibility: "reversible_friction",
      consequenceScope: "external_relational",
      regulatoryExposure: "regulated",
      confidenceMeasurability: "partially_quantifiable",
      accountabilityClarity: "shared_defined",
    },
    recommendedPattern: "draft_approve",
    acceptablePatterns: ["draft_approve", "triage_route", "prepare_present"],
  },
  split_invoice: {
    label: "Split invoice (cross-document)",
    blurb:
      "Two invoices from the same vendor that together cross the €5k threshold even though individually they don't.",
    decomposition: {
      reversibility: "partially_reversible",
      consequenceScope: "internal_financial",
      regulatoryExposure: "regulated",
      confidenceMeasurability: "partially_quantifiable",
      accountabilityClarity: "ambiguous",
    },
    recommendedPattern: "coordinate_escalate",
    acceptablePatterns: ["coordinate_escalate", "prepare_present", "draft_approve"],
  },
};
