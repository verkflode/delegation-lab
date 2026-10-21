// The end of a v5 game: the player's final documents, linted as the Guardian would on startup, the core's
// Delegation Scorecard over all four days, and every decision as it went out on the ACS wire.
import { compilePolicy, lintBinding, lintMatrix, lintSeeds, scorecard, type DecisionRecord, type LintResult, type ProbeResult, type Scorecard, type SeedOutcome, type SpawnOutcome } from "@verkflode/vaom-guardian-core";
import { toResult } from "@verkflode/vaom-guardian-acs";
import standard from "../../data/v5/invoice-standard.scoring.json";
import duplicate from "../../data/v5/invoice-duplicate.scoring.json";
import type { RoundResult } from "../types";
import { buildBinding, buildMatrix, startingPolicy, type Doc, type Round1Policy } from "./round1";
import { startingGate, toGate, type GateChoice } from "./round2";
import { reviewTweak, seedsDoc, startingReview, type ReviewChoice } from "./round3";
import { nightTweak, NIGHT_END, startingNight, type NightChoice } from "./round4";

export interface Choices { v5r1?: Round1Policy; v5r2?: GateChoice; v5r3?: ReviewChoice; v5r4?: NightChoice }

export const EXPORT_VERSION = "1.3.0";
const GUARDIAN_CONFIG_FORMAT = "vaom-guardian.config/0.1";

/** The matrix as it stood after the night: every round's choices applied. */
export function finalMatrix(c: Choices): Doc {
  const policy = c.v5r1 ?? startingPolicy();
  const m = buildMatrix(policy, toGate(c.v5r2 ?? startingGate()));
  reviewTweak(c.v5r3 ?? startingReview())(m);
  nightTweak(c.v5r4 ?? startingNight())(m);
  m.version = EXPORT_VERSION;
  m.description = "Built in the Delegation Lab (lab.vaom.ai): the four rounds' choices, as one matrix. A Delegation Authority Matrix in the Verkflöde Agent Operating Model (VAOM) 5.0, https://vaom.ai.";
  return m;
}

export interface ExportFile { name: string; doc: Doc; lint?: LintResult; what: string }

/** The files a Guardian needs to enforce the player's design, each checked as createGuardian checks it. */
export function exportFiles(c: Choices): { files: ExportFile[]; ok: boolean; problems: string[] } {
  const policy = c.v5r1 ?? startingPolicy();
  const matrix = finalMatrix(c);
  const binding = buildBinding(policy, matrix);
  binding.id = "lab.ap.invoice.claude-code";
  binding.title = "Your matrix on Claude Code, via a placeholder ERP MCP server";
  const seeds = seedsDoc(c.v5r3 ?? startingReview());
  const hasSeeds = (seeds.seeds as Doc[]).length > 0;

  const problems: string[] = [];
  const mLint = lintMatrix(matrix);
  const bLint = lintBinding(binding, matrix);
  if (!mLint.ok) problems.push(...mLint.findings.filter((f) => f.severity === "error").map((f) => `matrix ${f.path}: ${f.message}`));
  if (!bLint.ok) problems.push(...bLint.findings.filter((f) => f.severity === "error").map((f) => `binding ${f.path}: ${f.message}`));
  const compiled = mLint.ok ? compilePolicy(matrix, binding, [standard, duplicate]) : null;
  if (compiled && !compiled.ok) problems.push(...compiled.findings.map((f) => `policy ${f.path}: ${f.message}`));
  const sLint = hasSeeds && compiled?.ok ? lintSeeds(seeds, compiled.policy) : undefined;
  if (sLint && !sLint.ok) problems.push(...sLint.findings.map((f) => `seeds ${f.path}: ${f.message}`));

  const decisionRows = (matrix.rows as Doc[]).filter((r) => r.authority.kind === "delegable" || (r.authority.kind === "non-delegable" && r.authority.agentMayPrepare === true)).map((r) => r.id as string);
  const config = {
    format: GUARDIAN_CONFIG_FORMAT,
    matrix: "matrix.json",
    binding: "binding.json",
    scoring: ["invoice-standard.scoring.json", "invoice-duplicate.scoring.json"],
    ...(hasSeeds ? { seeds: "seeds.json" } : {}),
    dataDir: "./guardian-data",
    port: 7311,
    activation: { "ap-agent": { rows: decisionRows } },
  };
  const strip = (d: Doc) => { const rest = { ...d }; delete rest.$schema; return rest; };
  const files: ExportFile[] = [
    { name: "matrix.json", doc: matrix, lint: mLint, what: "Your delegation matrix, vaom.matrix/0.2" },
    { name: "binding.json", doc: binding, lint: bLint, what: "How tool calls map to the matrix's capabilities, vaom.binding/0.1" },
    { name: "invoice-standard.scoring.json", doc: strip(standard), what: "The controller's scoring policy for approvals" },
    { name: "invoice-duplicate.scoring.json", doc: strip(duplicate), what: "The scoring policy for duplicate flags" },
    ...(hasSeeds ? [{ name: "seeds.json", doc: seeds, ...(sLint ? { lint: sLint } : {}), what: "Your planted review cases, with their disclosure" }] : []),
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
export function finalScorecard(c: Choices, results: RoundResult[]): Scorecard {
  const ev = evidence(results);
  return scorecard(finalMatrix(c), ev.records, {
    from: "2026-10-14T00:00:00Z", to: NIGHT_END, minSample: GAME_MIN_SAMPLE, seedMinSample: 1,
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
