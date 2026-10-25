/**
 * Game types shared by the screens and the v5 engine (lib/v5). The rounds' own choice types live with
 * their rounds; this file holds the game flow, the per-round result the screens show, and the state.
 */

// ────────────────────────────────────────────────────────────────────────────
// Game flow
// ────────────────────────────────────────────────────────────────────────────

export type RoundNumber = 1 | 2 | 3 | 4;

export type GamePhase = "title" | "briefing" | "config" | "simulation" | "debrief" | "final";

/** The playable scenarios. */
export type ScenarioDomain = "invoice_processing";

// ────────────────────────────────────────────────────────────────────────────
// What a round shows per item. The shape predates v5 and is still how the debrief and final screens
// read a run; the v5 rounds fill it from their decision records.
// ────────────────────────────────────────────────────────────────────────────

/** The item's kind, for the debrief and final screens. */
export type DecisionType = "standard" | "high_value" | "duplicate" | "modified_terms" | "new_vendor" | "split_invoice";

export type ConfidenceDimensions = {
  modelCertainty: number; // 0..1
  ruleMatch: number; // 0..1
  dataCompleteness: number; // 0..1
  anomalySignal: number; // 0..1, higher is more anomalous
  verification?: number | null; // 0..1, null or absent when not run
};

export type Invoice = {
  id: string; // INV-1001
  vendor: string;
  amount: number; // EUR
  type: DecisionType;
  poMatch: "yes" | "no" | "partial";
  confidence: ConfidenceDimensions;
  composite: number;
  /** What the item hides that the player's design is meant to catch. */
  hiddenFlags: string[];
  description: string;
  teachingPoint: string;
};

export type RoutingBand = "auto_approve" | "human_review" | "escalation" | "blocked";

export type ProcessedInvoice = {
  invoice: Invoice;
  band: RoutingBand;
  patternUsed: null;
  /** Was this the right call? */
  outcome: "good" | "wasteful" | "risky" | "missed";
  reason: string;
};

// ────────────────────────────────────────────────────────────────────────────
// Round results & cumulative scoring
// ────────────────────────────────────────────────────────────────────────────

export type ScoreBreakdown = {
  /** 0..20 each across five dimensions, summed for a total out of 100. */
  efficiency: number;
  riskControl: number;
  compliance: number;
  adaptability: number;
  enforcement: number;
};

export type RoundResult = {
  round: RoundNumber;
  processed: ProcessedInvoice[];
  score: ScoreBreakdown;
  incidents: string[];
  /** Always empty in v5; kept so a result's shape is unchanged. */
  antiPatterns: never[];
  /** VAOM's debrief, written when the round ends from what the core judged (rounds 3 and 4). */
  v5Debrief?: string;
  /** What the archetype choice needs to know about the night. */
  v5Flags?: { paperTiger: boolean; nothingThrough: boolean; breakerOwned: boolean; toolAbsent: boolean };
  /** The round's evidence, as the Guardian would store it, for the final scorecard. */
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

// ────────────────────────────────────────────────────────────────────────────
// Aggregate game state
// ────────────────────────────────────────────────────────────────────────────

export type GameState = {
  phase: GamePhase;
  round: RoundNumber;
  scenario: ScenarioDomain;
  /** Round 1: the player's matrix choices (see lib/v5/round1.ts). */
  v5r1?: import("./v5/round1").Round1Policy;
  /** Round 2: the player's gate choices (see lib/v5/round2.ts). */
  v5r2?: import("./v5/round2").GateChoice;
  /** Round 3: the player's oversight choices (see lib/v5/round3.ts). */
  v5r3?: import("./v5/round3").ReviewChoice;
  /** Round 4: the player's night settings (see lib/v5/round4.ts). */
  v5r4?: import("./v5/round4").NightChoice;
  results: RoundResult[];
};
