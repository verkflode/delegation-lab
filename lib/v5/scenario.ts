// What a scenario gives the v5 rounds. The rounds (lib/v5/round*.ts) are the VAOM mechanics and the
// Guardian core; a scenario is the workflow they run on: its published example matrix and binding, the
// decisions the player inventories, the agent's tool calls, the history, and the words. Scenarios live in
// lib/v5/scenarios/, one file each, listed in the registry there.
import type { Call, DecisionRecord } from "@verkflode/vaom-guardian-core";
import type { ScenarioDomain } from "../types";

// ── Vocabulary (vaom.matrix/0.2) ───────────────────────────────────────────

export type Band = "A" | "B" | "C";
export type Level = "high" | "medium" | "low";
export type Pattern = "prepare-and-present" | "draft-and-approve" | "triage-and-route" | "execute-and-audit" | "monitor-and-intervene" | "coordinate-and-escalate";
export type Profile = {
  reversibility: "fully-reversible" | "reversible-with-friction" | "partially-reversible" | "irreversible";
  consequenceScope: "internal-operational" | "internal-financial" | "external-relational" | "external-regulatory";
  regulatoryExposure: "none" | "general-context" | "regulated-decision" | "prohibited-from-full-automation";
  confidenceMeasurability: "quantifiable" | "partially-quantifiable" | "judgment-dependent";
  /** Shared ownership needs a gap check and a stop rule; the Lab offers single ownership only. */
  accountabilityClarity: "clear-single-owner" | "ambiguous" | "none";
};

export type Doc = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

// ── Round 1: the decisions and the player's choices ────────────────────────

export interface RowChoice {
  included: boolean;
  profile: Profile;
  pattern: Pattern;
  kind: "delegable" | "non-delegable";
  routing: Record<Level, Band>;
  owner: string;
}
/** The player's matrix choices, by row id. */
export type Round1Policy = Record<string, RowChoice>;

export interface DecisionMeta {
  id: string;
  title: string;
  /** What the agent does, in the workflow's words. */
  blurb: string;
  /** How the player finds it: obvious, or hidden inside another step. */
  hidden?: string;
  tool: string;
  /** Weekly volume by confidence level; feeds the review-load check. */
  volume: Partial<Record<Level, number>>;
  reviewMinutes: number;
  escalationMinutes: number;
}

/** The gated row's confidence thresholds, calibration, value ceiling and cumulative cap. Round 1 uses the
 *  scenario's controller gate; round 2 hands them to the player. */
export interface Gate {
  thresholds: { high: number; medium: number };
  /** The calibration record, or null when no threshold passed the test (then Band A can't lint). */
  calibration: Doc | null;
  /** The value ceiling, or null where the scenario's gated row has none (its example says why). */
  ceiling: { amount: number; onExceed: "B" | "C" } | null;
  /** The cumulative cap's total or count (V5Scenario.round2.limits says which), or null for none. */
  cap: number | null;
  /** Weekly decisions on the gated row by confidence level, and how many of them exceed the ceiling. */
  volume: Partial<Record<Level, number>>;
  overCeilingPerWeek: number;
  /** The matrix version this gate produces, and which round built it. */
  version: string;
  round: 1 | 2;
}

// ── The batches ────────────────────────────────────────────────────────────

export type Truth = "clean" | "hazard";
export interface BatchItem {
  id: string;
  label: string;
  call: Call;
  truth: Truth;
  /** What a reviewer sees, and the right call, for asks that reach the player's queue (round 3). */
  review?: { facts: string[]; correct: "approve" | "reject"; why: string };
  /** Did the gated row's independent check pass? */
  verified: boolean;
  /** Why it matters, shown after the run. */
  teaching: string;
  /** The item's kind, for the debrief and final screens. */
  type: string;
  vendor: string;
  amount: number;
}

export type Lane = "A" | "B" | "C" | "held";
export type Verdict = "good" | "wasteful" | "risky" | "missed";

// ── The scenario ───────────────────────────────────────────────────────────

export interface V5Scenario {
  id: ScenarioDomain;
  /** The published example the player's documents are cut from, and the scoring policies it cites. */
  docs: { matrix: Doc; binding: Doc; scoring: Doc[] };
  /** The player's matrix: its id, title and approving role. */
  matrix: { id: string; title: string; approvedBy: string };
  /** Role ids and their names, and each role's deputy. */
  roles: Record<string, string>;
  deputies: Record<string, string>;
  /** Who reviews and escalates on a row the example keeps non-delegable, when the player delegates it. */
  fallbackAuthority: { reviewer: string; escalation: { role: string; sla: string } };
  /** The agent's identity in every record. */
  agent: string;

  round1: {
    /** The matrix's approval date. */
    date: string;
    start: string;
    decisions: DecisionMeta[];
    startingPolicy: () => Round1Policy;
    /** The row the gate (value ceiling, cumulative cap, calibration) applies to. */
    gatedRow: string;
    controllerGate: Gate;
    /** The capability whose independent check BatchItem.verified reports. */
    verifiedCapability: string;
    /** Tools the binding gains from the player's choices (a delegable row whose tool the example leaves out). */
    extraTools: (policy: Round1Policy) => Doc[];
    /** Past decisions, human-approved under the published example, that the ledger starts from. */
    history: { effective: string; rows: string[]; calls: { id: string; ts: string; call: Call }[] };
    batch: BatchItem[];
    /** A verdict the generic judge can't give (a read, a disguised decision), or null to let it judge. */
    judgeSpecial: (item: BatchItem, record: DecisionRecord, lane: Lane, policy: Round1Policy) => { verdict: Verdict; why: string } | null;
    /** How the debrief names wasted human time on routine work. */
    routine: { review: string; escalation: string; noun: string };
  };

  round2: {
    start: string;
    /** The labelled sample the calibration test runs on: per score, how many and how many were wrong. */
    sample: { score: number; n: number; errors: number }[];
    sampleDate: string;
    /** Decisions a week on the gated row, and the share of them above each value (log-interpolated). */
    weekly: number;
    over: [number, number][];
    startingGate: { errorTarget: number; medium: number; ceiling: number | null; onExceed: "B" | "C"; cap: number | null };
    /** Which limits the gated row takes: a value ceiling or none, and a cap on a summed value (the example's
     *  own cap, re-totalled) or on a count of actions (this template, with the player's count). */
    limits: { ceiling: boolean; cap: { kind: "total" } | { kind: "count"; template: Doc } };
    /** What the gated row's decisions are called in the calibration's words ("approvals", "restarts"). */
    noun: string;
    batch: BatchItem[];
    /** Debrief lines: the tail after a wasteful example, all held and all ran, and what caught what. */
    debrief: { wasteTail: string; allGood: string; whatCaughtWhat: string };
  };

  round3: {
    start: string;
    /** The role whose Band B asks the player works. */
    reviewer: string;
    batch: BatchItem[];
    /** Planted cases with a known error, by row. */
    plants: Plant[];
    seeds: { id: string; approvedBy: string; date: string; handbookRef: string };
    /** Reviewer hours a week: where the player starts, and the slider's range and step. */
    funded: { start: number; range: [number, number, number] };
  };

  round4: {
    night: { date: string; start: string; end: string };
    /** When the forbidden tool slipped into the manifest, and when probing began. */
    toolAdded: string;
    probeEpoch: string;
    /** The boundary under test tonight, and the non-delegable row it guards. */
    boundary: { id: string; tool: string; capability: string; mappedToolId: string; description: string; probe: string; target: string; row: Doc; owner: string };
    /** The example's other boundaries, probed weekly and holding. */
    otherProbes: { prefix: string; boundary: string; observed: "absent" | "scope-denied"; tool: string }[];
    probeSet: { id: string; host: string };
    /** The sub-agent types the player may allow, with what each would hold. */
    subagents: Record<string, { capabilities: string[]; maxLifetime: string }>;
    script: NightStep[];
    /** Who a breaker pages, in a sentence. */
    pageNames: Record<string, string>;
    log: { toolAdded: string; reported: string; removed: string };
    debrief: (ctx: { claimed: string; status: string; lastProbe: string; detected: string | null }) => { claimedButPresent: string; policyHeld: string; absent: string };
  };

  briefings: Record<1 | 2 | 3 | 4, string>;
  archetypes: Record<import("../types").ProfileArchetype, { name: string; quote: string; assessment: string }>;
  prompts: { seedingExcludes: string; briefings: Record<1 | 2 | 3 | 4, string> };
  exportFiles: { bindingId: string; bindingTitle: string; scoringNames: string[]; scoringWhat: string[] };

  /** The screens' words for this workflow. */
  ui: {
    /** The title screen's entry, and the line the pitch ends on ("an AI agent for …"). */
    title: { label: string; sub: string };
    team: string;
    /** The three working days before the night. */
    days: [string, string, string];
    /** Round 2's concept line on its briefing, where the scenario's limits differ from the default. */
    gateConcept?: string;
    /** Who set round 1's fixed limits ("the controller"). */
    limitsSetBy: string;
    /** The prefix the scenario's tools share, dropped where a screen names a tool. */
    toolPrefix: string;
    matrixIntro: string;
    loadNote: string;
    /** Round 1's fixed limits, as the controller set them. */
    controllerLimits: string[];
    gate: {
      title: string;
      intro: string;
      keptWithHuman: string;
      money: (n: number) => string;
      per: string;
      overNote: string;
      capPer: string;
      capNone: string;
      capOn: string;
      unitAria: string;
      ceilingRange: [number, number, number];
      capRange: [number, number, number];
      /** The cap's value in words, and where a newly switched-on cap starts. */
      capValue: (n: number) => string;
      capStart: number;
    };
    night: {
      subagentLabels: Record<string, string>;
      noAuthority: string;
      childCeiling: string;
      boundaryTitle: string;
      boundaryIntro: string;
      toolAllNight: string;
    };
  };
}

export interface Plant { id: string; row: string; type: BatchItem["type"]; tool: string; arguments: Record<string, unknown>; error: string; label: string; facts: string[] }

export type NightStep =
  | { at: string; kind: "call"; id: string; label: string; actor: string; call: Call; hazard: boolean; injected?: boolean }
  | { at: string; kind: "spawn"; id: string; label: string; type: string; from: string; hazard: boolean };
