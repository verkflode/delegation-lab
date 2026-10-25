// The end of a v5 game: the player's final documents, linted as the Guardian would on startup, the core's
// Delegation Scorecard over all four days, and every decision as it went out on the ACS wire.
import { compilePolicy, lintBinding, lintMatrix, lintSeeds, scorecard, type DecisionRecord, type LintResult, type ProbeResult, type Scorecard, type SeedOutcome, type SpawnOutcome } from "@verkflode/vaom-guardian-core";
import { toResult } from "@verkflode/vaom-guardian-acs";
import type { RoundResult } from "../types";
import { buildBinding, buildMatrix, type Doc, type Round1Policy } from "./round1";
import { startingGate, toGate, type GateChoice } from "./round2";
import { reviewTweak, seedsDoc, startingReview, type ReviewChoice } from "./round3";
import { nightTweak, startingNight, type NightChoice } from "./round4";
import type { V5Scenario } from "./scenario";

export interface Choices { v5r1?: Round1Policy; v5r2?: GateChoice; v5r3?: ReviewChoice; v5r4?: NightChoice }

export const EXPORT_VERSION = "1.3.0";
const GUARDIAN_CONFIG_FORMAT = "vaom-guardian.config/0.1";

/** The VAOM Guardian commit vendored in vendor/vaom-guardian; tests/v5.test.mts checks it matches VENDORED.md. */
export const GUARDIAN_COMMIT = "08ad17fb4d64e3c08fca0fa3ce2c6236775a9dfc";
/** Exported files name the schema they follow at that commit, so an editor can check them as they change. */
export const SCHEMA_BASE = `https://raw.githubusercontent.com/verkflode/vaom-guardian/${GUARDIAN_COMMIT}/schema/`;
const withSchema = (d: Doc, schema: string): Doc => { const rest = { ...d }; delete rest.$schema; return { $schema: SCHEMA_BASE + schema, ...rest }; };

/** The matrix as it stood after the night: every round's choices applied. */
export function finalMatrix(sc: V5Scenario, c: Choices): Doc {
  const policy = c.v5r1 ?? sc.round1.startingPolicy();
  const m = buildMatrix(sc, policy, toGate(sc, c.v5r2 ?? startingGate(sc)));
  reviewTweak(c.v5r3 ?? startingReview())(m);
  nightTweak(sc, c.v5r4 ?? startingNight(sc))(m);
  m.version = EXPORT_VERSION;
  m.description = "Built in the Delegation Lab (lab.vaom.ai): the four rounds' choices, as one matrix. A Delegation Authority Matrix in the Verkflöde Agent Operating Model (VAOM) 5.0, https://vaom.ai.";
  return m;
}

export interface ExportFile { name: string; doc: Doc; lint?: LintResult; what: string }

/** The files a Guardian needs to enforce the player's design, each checked as createGuardian checks it. */
export function exportFiles(sc: V5Scenario, c: Choices): { files: ExportFile[]; ok: boolean; problems: string[] } {
  const policy = c.v5r1 ?? sc.round1.startingPolicy();
  const matrix = finalMatrix(sc, c);
  const binding = buildBinding(sc, policy, matrix);
  binding.id = sc.exportFiles.bindingId;
  binding.title = sc.exportFiles.bindingTitle;
  const seeds = seedsDoc(sc, c.v5r3 ?? startingReview());
  const hasSeeds = (seeds.seeds as Doc[]).length > 0;

  const problems: string[] = [];
  const mLint = lintMatrix(matrix);
  const bLint = lintBinding(binding, matrix);
  if (!mLint.ok) problems.push(...mLint.findings.filter((f) => f.severity === "error").map((f) => `matrix ${f.path}: ${f.message}`));
  if (!bLint.ok) problems.push(...bLint.findings.filter((f) => f.severity === "error").map((f) => `binding ${f.path}: ${f.message}`));
  const compiled = mLint.ok ? compilePolicy(matrix, binding, sc.docs.scoring) : null;
  if (compiled && !compiled.ok) problems.push(...compiled.findings.map((f) => `policy ${f.path}: ${f.message}`));
  const sLint = hasSeeds && compiled?.ok ? lintSeeds(seeds, compiled.policy) : undefined;
  if (sLint && !sLint.ok) problems.push(...sLint.findings.map((f) => `seeds ${f.path}: ${f.message}`));

  const decisionRows = (matrix.rows as Doc[]).filter((r) => r.authority.kind === "delegable" || (r.authority.kind === "non-delegable" && r.authority.agentMayPrepare === true)).map((r) => r.id as string);
  const config = {
    format: GUARDIAN_CONFIG_FORMAT,
    matrix: "matrix.json",
    binding: "binding.json",
    scoring: sc.exportFiles.scoringNames,
    ...(hasSeeds ? { seeds: "seeds.json" } : {}),
    dataDir: "./guardian-data",
    port: 7311,
    activation: { [sc.agent]: { rows: decisionRows } },
  };
  const files: ExportFile[] = [
    { name: "matrix.json", doc: withSchema(matrix, "vaom-matrix-0.2.schema.json"), lint: mLint, what: "Your delegation matrix, in the draft format vaom.matrix/0.2" },
    { name: "binding.json", doc: withSchema(binding, "vaom-binding.schema.json"), lint: bLint, what: "How tool calls map to the matrix's capabilities, vaom.binding/0.1" },
    ...sc.docs.scoring.map((s, i) => ({ name: sc.exportFiles.scoringNames[i], doc: withSchema(s, "vaom-scoring-0.1.schema.json"), what: sc.exportFiles.scoringWhat[i] })),
    ...(hasSeeds ? [{ name: "seeds.json", doc: withSchema(seeds, "vaom-seeds-0.1.schema.json"), ...(sLint ? { lint: sLint } : {}), what: "Your planted review cases, with their disclosure" }] : []),
    { name: "guardian.config.json", doc: config, what: "A VAOM Guardian config that loads all of the above" },
  ];
  return { files, ok: problems.length === 0, problems };
}

/** All four days' evidence. */
export function evidence(results: RoundResult[]): { records: DecisionRecord[]; seeds: SeedOutcome[]; spawns: SpawnOutcome[]; probes: ProbeResult[] } {
  const e = results.map((r) => r.v5Evidence).filter((x): x is NonNullable<RoundResult["v5Evidence"]> => !!x);
  return {
    records: e.flatMap((x) => x.records),
    seeds: e.flatMap((x) => x.seeds ?? []),
    spawns: e.flatMap((x) => x.spawns ?? []),
    probes: e.flatMap((x) => x.probes ?? []),
  };
}

/** The core's Delegation Scorecard over the game's four days. A game is tiny, so the minimum samples are
 *  lowered (the Guardian's defaults are 20 placements and 10 seeds), and the screen says so. */
export const GAME_MIN_SAMPLE = 3;
export function finalScorecard(sc: V5Scenario, c: Choices, results: RoundResult[]): Scorecard {
  const ev = evidence(results);
  return scorecard(finalMatrix(sc, c), ev.records, {
    from: `${sc.round1.date}T00:00:00Z`, to: sc.round4.night.end, minSample: GAME_MIN_SAMPLE, seedMinSample: 1,
    seeds: ev.seeds, spawns: ev.spawns, probes: ev.probes,
  });
}

/** What the Guardian answered on the ACS wire for a record. */
export function wireOf(r: DecisionRecord): { decision?: string; reason_codes?: string[]; ask_details?: { approver?: { id?: string } } } {
  const d = r.decision;
  return toResult(
    { outcome: d.outcome, band: d.band, ...(d.approver_role ? { approverRole: d.approver_role } : {}), placements: d.placements, reasons: d.reasons, policy: r.policy },
    { requestId: r.id, acsVersion: "0.1.0", approvalTimeoutSeconds: 300, deferTimeoutMs: 1000, evaluatorVersion: "delegation-lab" },
  ) as ReturnType<typeof wireOf>;
}
