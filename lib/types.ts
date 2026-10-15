/**
 * Core game types — shared across config screens, simulation engine,
 * scoring, and the API routes. Read this first to understand the shape
 * of game state.
 *
 * v3.5: adds scenario domains, composite dimension weights, calibration
 * anti-patterns, and multi-agent failure modes.
 *
 * v4.0: adds Round 4 ("The 2 A.M. Test"), the fifth confidence dimension
 * (independent verification), boundary depths, sub-agent attenuation,
 * the guardian function, night events, and the Enforcement score dimension.
 */

// ────────────────────────────────────────────────────────────────────────────
// Game flow
// ────────────────────────────────────────────────────────────────────────────

export type RoundNumber = 1 | 2 | 3 | 4;

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

/** Decision categories used in Round 2's pattern matrix. Per-scenario. */
export type DecisionType =
  // Invoice processing
  | "standard"
  | "high_value"
  | "duplicate"
  | "modified_terms"
  | "new_vendor"
  | "split_invoice"
  // Customer complaints
  | "complaint_classification"
  | "response_generation"
  | "regulatory_reporting"
  | "compensation_authorization"
  | "escalation_to_ombudsman"
  // AML triage
  | "alert_classification"
  | "auto_dismissal"
  | "investigation_escalation"
  | "sar_preparation"
  | "cross_border_coordination"
  // HR investigation
  | "hr_complaint_classification"
  | "evidence_assessment"
  | "witness_interview_prep"
  | "outcome_recommendation"
  | "disciplinary_action";

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
// Confidence & items
// ────────────────────────────────────────────────────────────────────────────

/**
 * Composite confidence dimensions (VAOM v4.0 §8 — five dimensions).
 * `verification` is nullable by design: when verification is disabled the
 * composite renormalizes over four dimensions rather than silently counting
 * a missing signal as 1.0.
 */
export type ConfidenceDimensions = {
  modelCertainty: number; // 0..1
  ruleMatch: number; // 0..1
  dataCompleteness: number; // 0..1
  anomalySignal: number; // 0..1 — higher = MORE anomalous (worse)
  verification?: number | null; // 0..1, null/undefined = not run
};

/** Player-adjustable dimension weights (v4.0 §8). Must sum to 1.0. */
export type DimensionWeights = {
  modelCertainty: number;
  ruleMatch: number;
  dataCompleteness: number;
  anomalySignal: number;
  verification: number;
};

export const DEFAULT_WEIGHTS: DimensionWeights = {
  modelCertainty: 0.25,
  ruleMatch: 0.25,
  dataCompleteness: 0.15,
  anomalySignal: 0.15,
  verification: 0.2,
};

/**
 * v4.0: how deep does independent verification go? Depth is a policy choice
 * with a cost. `shallow` is verification theater — a verifier that cannot
 * fail. `dry_run` catches the most but costs latency on every verified item.
 */
export type VerificationDepth = "off" | "shallow" | "preconditions" | "dry_run";

// ────────────────────────────────────────────────────────────────────────────
// Calibration anti-patterns (v3.5 §8, v4.0 adds verification theater)
// ────────────────────────────────────────────────────────────────────────────

export type AntiPatternId =
  | "review_queue_flood"
  | "confidence_mirage"
  | "exception_graveyard"
  | "stale_threshold"
  | "dimension_collapse"
  | "verification_theater";

export type DetectedAntiPattern = {
  id: AntiPatternId;
  round: RoundNumber;
  detail: string;
};

// ────────────────────────────────────────────────────────────────────────────
// Multi-agent failure modes (v3.5 Pattern 6; v4.0 adds delegation laundering)
// ────────────────────────────────────────────────────────────────────────────

export type MultiAgentFailureMode =
  | "authority_conflict"
  | "cascading_confidence_erosion"
  | "coordination_state_loss"
  | "delegation_laundering";

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
  // ── v4.0 Round 4 fields (optional — only night-shift items carry them) ──
  /** Embedded instruction text on the 02:14 injection item. */
  injectionPayload?: string;
  /** Decision type the injection payload steers the agent toward. */
  injectionTarget?: DecisionType;
  /** Chain depth this item legitimately requires (chain-depth probe). */
  requiredDepth?: number;
  /** Simulated night clock arrival, e.g. "02:14". */
  arrivalTime?: string;
};

// ────────────────────────────────────────────────────────────────────────────
// Routing outcomes (per item, after the policy runs)
// ────────────────────────────────────────────────────────────────────────────

export type RoutingBand = "auto_approve" | "human_review" | "escalation" | "blocked";

export type ProcessedInvoice = {
  invoice: Invoice;
  band: RoutingBand;
  patternUsed: DelegationPattern | null;
  /** Was this the right call? Used for risk and efficiency scoring. */
  outcome: "good" | "wasteful" | "risky" | "missed";
  reason: string;
  /** v4.0: which agents in the chain touched this item (Round 4). */
  chainRoute?: string[];
};

// ────────────────────────────────────────────────────────────────────────────
// Player policy (carries forward across rounds)
// ────────────────────────────────────────────────────────────────────────────

/** Round 1 policy: a single global confidence threshold. */
export type R1Policy = {
  threshold: number; // 50..99
};

/** Round 2 policy: pattern + threshold per decision type + weights + verification. */
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
  /** v4.0: independent verification depth. */
  verificationDepth?: VerificationDepth;
};

/** Round 3 pre-event responses — drives drift simulation, audit, escalation. */
export type R3PreEvents = {
  driftResponse: "regression_test" | "monitor" | "pause" | "ignore";
  evidenceLevel: "minimal" | "standard" | "full";
  escalationFix: "define_path" | "review_queue" | "suspend" | "ignore";
};

// ────────────────────────────────────────────────────────────────────────────
// Round 4 policy (v4.0 — "The 2 A.M. Test")
// ────────────────────────────────────────────────────────────────────────────

/**
 * Enforcement depth for a decision-type boundary (VAOM v4.0 §9).
 * policy: a rule that says no (weakest — can be reasoned around).
 * scope: the credential denies it (holds unless a broader agent touches it).
 * unmounted: the tool does not exist (cannot be violated by any agent).
 */
export type BoundaryDepth = "policy" | "scope" | "unmounted";

/** inherit: sub-agents get everything the parent has (the lazy default). */
export type AttenuationMode = "inherit" | "derive";

export type GuardianSensitivity = "loose" | "calibrated" | "paranoid";

export type GuardianConfig = {
  enabled: boolean;
  sensitivity: GuardianSensitivity;
  tripwires: {
    scopeDenial: boolean;
    bandDrift: boolean;
    chainDepth: boolean;
    nonDelegableTouch: boolean;
  };
  /** Empty string = the unwatched watcher (Readiness Condition 5 failure). */
  accountableHuman: string;
};

export type R4Policy = {
  attenuation: AttenuationMode;
  spawnPolicy: "allow" | "escalate";
  maxChainDepth: number; // 1..4
  chainConfidence: "per_agent" | "chain_level";
  boundaryDepths: Partial<Record<DecisionType, BoundaryDepth>>;
  guardian: GuardianConfig;
};

// ── Night events — the Round 4 log ──────────────────────────────────────────

export type NightEventKind =
  | "arrival"
  | "laundering"
  | "injection_blocked"
  | "injection_executed"
  | "scope_denial"
  | "circuit_breaker"
  | "chain_depth"
  | "split_pair"
  | "info";

export type NightEvent = {
  time: string; // "02:14"
  kind: NightEventKind;
  itemId?: string;
  text: string;
  severity: "info" | "good" | "warn" | "critical";
};

export type GuardianReport = {
  falseSuspensions: number;
  interventions: number;
  /** Guardian enabled with no accountable human named. */
  unwatchedWatcher: boolean;
  /** A boundary held but no telemetry tripwire noticed the attack. */
  silentHold: boolean;
};

// ────────────────────────────────────────────────────────────────────────────
// Round results & cumulative scoring
// ────────────────────────────────────────────────────────────────────────────

export type ScoreBreakdown = {
  /** v4.0: 0..20 each across five dimensions, summed for total /100. */
  efficiency: number;
  riskControl: number;
  compliance: number;
  adaptability: number;
  enforcement: number;
};

export const SCORE_MAX_PER_DIMENSION = 20;

export type RoundResult = {
  round: RoundNumber;
  processed: ProcessedInvoice[];
  score: ScoreBreakdown;
  incidents: string[];
  antiPatterns: DetectedAntiPattern[];
  multiAgentFailures?: MultiAgentFailureMode[];
  /** v4.0 Round 4 artifacts */
  nightEvents?: NightEvent[];
  guardianReport?: GuardianReport;
  /** v5: VAOM's debrief, written when the round ends from what the core judged. */
  v5Debrief?: string;
  /** v5: what the archetype choice needs to know about the night. */
  v5Flags?: { paperTiger: boolean; nothingThrough: boolean; breakerOwned: boolean; toolAbsent: boolean };
  /** v5: the round's evidence, as the Guardian would store it, for the final scorecard. */
  v5Evidence?: {
    records: import("@verkflode/vaom-guardian-core").DecisionRecord[];
    seeds?: import("@verkflode/vaom-guardian-core").SeedOutcome[];
    spawns?: import("@verkflode/vaom-guardian-core").SpawnOutcome[];
    probes?: import("@verkflode/vaom-guardian-core").ProbeResult[];
  };
};

// ────────────────────────────────────────────────────────────────────────────
// Final profile (shareable)
// ────────────────────────────────────────────────────────────────────────────

export type ProfileArchetype =
  | "cautious_architect"
  | "speed_optimizer"
  | "compliance_hawk"
  | "balanced_operator"
  | "delegation_natural"
  | "paper_tiger"
  | "vault_builder";

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
  /** v5 round 1: the player's matrix choices (see lib/v5/round1.ts). */
  v5r1?: import("./v5/round1").Round1Policy;
  /** v5 round 2: the player's gate choices (see lib/v5/round2.ts). */
  v5r2?: import("./v5/round2").GateChoice;
  /** v5 round 3: the player's oversight choices (see lib/v5/round3.ts). */
  v5r3?: import("./v5/round3").ReviewChoice;
  /** v5 round 4: the player's night settings (see lib/v5/round4.ts). */
  v5r4?: import("./v5/round4").NightChoice;
  r2?: R2Policy;
  r3?: R3PreEvents;
  r4?: R4Policy;
  results: RoundResult[];
  profile?: FinalProfile;
};
