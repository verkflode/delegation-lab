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
export type ScenarioDomain = "invoice_processing" | "incident_remediation" | "aml_triage" | "delegated_purchasing";

// ────────────────────────────────────────────────────────────────────────────
// What a round shows per item: the batch item or event, where the Guardian put it, and the verdict.
// ────────────────────────────────────────────────────────────────────────────

export type RoutingBand = "auto_approve" | "human_review" | "escalation" | "blocked";

export type RoundItem = {
  id: string;
  /** What the agent did, in the workflow's words. */
  label: string;
  /** Why it matters, shown after the run. */
  teaching: string;
  band: RoutingBand;
  /** Was this the right call? */
  outcome: "good" | "wasteful" | "risky" | "missed";
  /** One line on why this verdict. */
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
  items: RoundItem[];
  score: ScoreBreakdown;
  incidents: string[];
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
