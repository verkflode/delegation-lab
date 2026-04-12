/**
 * Core game types — shared across config screens, simulation engine,
 * scoring, and the API routes. Read this first to understand the shape
 * of game state.
 *
 * v3.5: adds scenario domains, composite dimension weights, calibration
 * anti-patterns, and multi-agent failure modes.
 */

// ────────────────────────────────────────────────────────────────────────────
// Game flow
// ────────────────────────────────────────────────────────────────────────────

export type RoundNumber = 1 | 2 | 3;

export type GamePhase =
  | "title"
  | "briefing"
  | "config"
  | "preEvents" // Round 3 only
  | "simulation"
  | "debrief"
  | "final";

// ────────────────────────────────────────────────────────────────────────────
// Scenario domains (v3.5)
// ────────────────────────────────────────────────────────────────────────────

export type ScenarioDomain =
  | "invoice_processing"
  | "customer_complaints"
  | "aml_triage"
  | "hr_investigation";

// ────────────────────────────────────────────────────────────────────────────
// VAOM concepts
// ────────────────────────────────────────────────────────────────────────────

/** The six named delegation patterns from VAOM v3.0 §4.3, in order of agent autonomy. */
export type DelegationPattern =
  | "prepare_present"
  | "draft_approve"
  | "triage_route"
  | "execute_audit"
  | "monitor_intervene"
  | "coordinate_escalate";

/** Decision categories used in Round 2's pattern matrix. */
export type DecisionType =
  | "standard"
  | "high_value"
  | "duplicate"
  | "modified_terms"
  | "new_vendor"
  | "split_invoice";

// Five-dimension authority decomposition (VAOM §4.2)
export type ReversibilityLevel =
  | "fully_reversible"
  | "reversible_friction"
  | "partially_reversible"
  | "irreversible";

export type ConsequenceScope =
  | "internal_operational"
  | "internal_financial"
  | "external_relational"
  | "external_regulatory";

export type RegulatoryExposure =
  | "none"
  | "general_context"
  | "regulated"
  | "prohibited";

export type ConfidenceMeasurability =
  | "quantifiable"
  | "partially_quantifiable"
  | "judgment_dependent";

export type AccountabilityClarity =
  | "clear_owner"
  | "shared_defined"
  | "ambiguous"
  | "no_owner";

export type DecompositionProfile = {
  reversibility: ReversibilityLevel;
  consequenceScope: ConsequenceScope;
  regulatoryExposure: RegulatoryExposure;
  confidenceMeasurability: ConfidenceMeasurability;
  accountabilityClarity: AccountabilityClarity;
};

// ────────────────────────────────────────────────────────────────────────────
// Confidence & invoices
// ────────────────────────────────────────────────────────────────────────────

/** Composite confidence dimensions (VAOM §7/§8). */
export type ConfidenceDimensions = {
  modelCertainty: number; // 0..1
  ruleMatch: number; // 0..1
  dataCompleteness: number; // 0..1
  anomalySignal: number; // 0..1 — higher = MORE anomalous (worse)
};

/** Player-adjustable dimension weights (v3.5 §8). Must sum to 1.0. */
export type DimensionWeights = {
  modelCertainty: number;
  ruleMatch: number;
  dataCompleteness: number;
  anomalySignal: number;
};

export const DEFAULT_WEIGHTS: DimensionWeights = {
  modelCertainty: 0.3,
  ruleMatch: 0.3,
  dataCompleteness: 0.2,
  anomalySignal: 0.2,
};

// ────────────────────────────────────────────────────────────────────────────
// Calibration anti-patterns (v3.5 §8)
// ────────────────────────────────────────────────────────────────────────────

export type AntiPatternId =
  | "review_queue_flood"
  | "confidence_mirage"
  | "exception_graveyard"
  | "stale_threshold"
  | "dimension_collapse";

export type DetectedAntiPattern = {
  id: AntiPatternId;
  round: RoundNumber;
  detail: string;
};

// ────────────────────────────────────────────────────────────────────────────
// Multi-agent failure modes (v3.5 Pattern 6)
// ────────────────────────────────────────────────────────────────────────────

export type MultiAgentFailureMode =
  | "authority_conflict"
  | "cascading_confidence_erosion"
  | "coordination_state_loss";

export type Invoice = {
  id: string; // INV-1001
  vendor: string;
  amount: number; // EUR
  type: DecisionType;
  poMatch: "yes" | "no" | "partial";
  confidence: ConfidenceDimensions;
  /** Composite confidence after weighted average + hard floor cap */
  composite: number;
  /** Internal flags the player's policy is supposed to catch */
  hiddenFlags: string[];
  description: string;
  teachingPoint: string;
};

// ────────────────────────────────────────────────────────────────────────────
// Routing outcomes (per invoice, after the policy runs)
// ────────────────────────────────────────────────────────────────────────────

export type RoutingBand = "auto_approve" | "human_review" | "escalation" | "blocked";

export type ProcessedInvoice = {
  invoice: Invoice;
  band: RoutingBand;
  patternUsed: DelegationPattern | null;
  /** Was this the right call? Used for risk and efficiency scoring. */
  outcome: "good" | "wasteful" | "risky" | "missed";
  reason: string;
};

// ────────────────────────────────────────────────────────────────────────────
// Player policy (carries forward across rounds)
// ────────────────────────────────────────────────────────────────────────────

/** Round 1 policy: a single global confidence threshold. */
export type R1Policy = {
  threshold: number; // 50..99
};

/** Round 2 policy: pattern + threshold per decision type + optional weights. */
export type R2Policy = {
  perType: Partial<
    Record<
      DecisionType,
      {
        pattern: DelegationPattern;
        threshold: number; // 50..99
      }
    >
  >;
  weights?: DimensionWeights;
};

/** Round 3 pre-event responses — drives drift simulation, audit, escalation. */
export type R3PreEvents = {
  driftResponse: "regression_test" | "monitor" | "pause" | "ignore";
  evidenceLevel: "minimal" | "standard" | "full";
  escalationFix: "define_path" | "review_queue" | "suspend" | "ignore";
};

// ────────────────────────────────────────────────────────────────────────────
// Round results & cumulative scoring
// ────────────────────────────────────────────────────────────────────────────

export type ScoreBreakdown = {
  /** 0..25 each, summed for total /100 across the campaign */
  efficiency: number;
  riskControl: number;
  compliance: number;
  adaptability: number;
};

export type RoundResult = {
  round: RoundNumber;
  processed: ProcessedInvoice[];
  score: ScoreBreakdown;
  incidents: string[];
  antiPatterns: DetectedAntiPattern[];
  multiAgentFailures?: MultiAgentFailureMode[];
};

// ────────────────────────────────────────────────────────────────────────────
// Final profile (shareable)
// ────────────────────────────────────────────────────────────────────────────

export type ProfileArchetype =
  | "cautious_architect"
  | "speed_optimizer"
  | "compliance_hawk"
  | "balanced_operator"
  | "delegation_natural";

export type FinalProfile = {
  archetype: ProfileArchetype;
  name: string; // "The Cautious Architect"
  quote: string; // one-line LinkedIn-ready
  assessment: string; // 1-2 paragraphs
  totals: ScoreBreakdown;
};

// ────────────────────────────────────────────────────────────────────────────
// Aggregate game state
// ────────────────────────────────────────────────────────────────────────────

export type GameState = {
  phase: GamePhase;
  round: RoundNumber;
  scenario: ScenarioDomain;
  audioMuted: boolean;
  r1?: R1Policy;
  r2?: R2Policy;
  r3?: R3PreEvents;
  results: RoundResult[];
  profile?: FinalProfile;
};
