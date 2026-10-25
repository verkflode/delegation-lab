// The v5 rounds, end to end on the VAOM Guardian core: what each design lets through, what the linter
// refuses, what the scorecard says, and that the exported files load as a Guardian loads them.
// Run with the module hook: node --import ./tests/v5-hooks.mjs --test tests/
import { lintPolicy, runBatch, runRound1, startingPolicy, type Round1Policy } from "../lib/v5/round1.ts";
import { explain } from "../lib/v5/explain.ts";
import { v5Result } from "../lib/v5/round1-result.ts";
import { BATCH2, BATCH2_START, calibrate, startingGate, toGate, type GateChoice } from "../lib/v5/round2.ts";
import { judgeShift, lintReview, reviewTweak, startShift, startingReview, type Click, type ReviewChoice } from "../lib/v5/round3.ts";
import { round3Result } from "../lib/v5/round3-result.ts";
import { lintNight, runNight, startingNight, type NightChoice } from "../lib/v5/round4.ts";
import { round4Result } from "../lib/v5/round4-result.ts";
import { exportFiles, finalScorecard, GUARDIAN_COMMIT, SCHEMA_BASE, wireOf } from "../lib/v5/final.ts";
import { lintBinding, lintMatrix } from "@verkflode/vaom-guardian-core";
import { readFileSync } from "node:fs";
import { BRIEFING_PROMPTS_V5, VAOM_SYSTEM_V5 } from "../lib/v5/prompts.ts";
import { chooseArchetypeV5 } from "../lib/v5/archetypes.ts";

let fails = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) { fails++; console.log("FAIL", name, "got", JSON.stringify(got), "want", JSON.stringify(want)); }
};
const verdicts = (steps: { item: { id: string }; verdict: string }[]) => Object.fromEntries(steps.map((s) => [s.item.id, s.verdict]));

// A considered design, round by round.
const good: Round1Policy = startingPolicy();
good["invoice.approve"].routing = { high: "A", medium: "B", low: "C" };
good["invoice.duplicate-anomaly"] = { ...good["invoice.duplicate-anomaly"], included: true, pattern: "triage-and-route", routing: { high: "B", medium: "C", low: "C" } };
good["contract.modify"] = { ...good["contract.modify"], included: true, kind: "non-delegable", pattern: "prepare-and-present", owner: "legal-counsel",
  profile: { reversibility: "irreversible", consequenceScope: "external-relational", regulatoryExposure: "general-context", confidenceMeasurability: "judgment-dependent", accountabilityClarity: "clear-single-owner" } };
const goodGate: GateChoice = { errorTarget: 0.02, medium: 0.5, ceiling: 7500, onExceed: "B", cap: 7000 };
const goodReview: ReviewChoice = { ...startingReview(), fundedHours: 70, seedRows: { "invoice.duplicate-anomaly": true }, seedRate: 0.1 };
const goodNight: NightChoice = { chain: { maxDepth: 1, maxFanOut: 2, vendorCheck: true, batchApprover: false, childCeilingB: true }, bank: { mechanism: "absent", every: "P1D", onManifest: true }, breakers: { outOfBounds: "suspend", chainDepth: "alert", notify: "ap-owner" } };

// ── Round 1 ────────────────────────────────────────────────────────────────
{
  const start = startingPolicy();
  eq("r1 start lints", lintPolicy(start).lint.ok, true);
  const v = verdicts(runRound1(start).steps);
  eq("r1 naive: new vendor runs", v["INV-1105"], "risky");
  eq("r1 naive: unusual amount runs", v["INV-1109"], "risky");
  eq("r1 naive: duplicate flag can't be placed", v["FLAG-1111"], "missed");
  eq("r1 naive: over ceiling held", v["INV-1103"], "good");
  eq("r1 good: every call right", new Set(runRound1(good).steps.map((s) => s.verdict)), new Set(["good"]));

  const added = startingPolicy();
  added["invoice.duplicate-anomaly"].included = true;
  added["contract.modify"].included = true;
  const l = lintPolicy(added);
  eq("r1 hidden rows added naively don't lint", l.lint.ok, false);
  const texts = explain(l.lint, l.matrix, added).map((e) => `${e.row}: ${e.text.split(".")[0]}`);
  eq("r1 explained", texts.includes("contract.modify: Band A needs calibrated confidence"), true);

  const amb = structuredClone(good); amb["invoice.approve"].profile.accountabilityClarity = "ambiguous";
  const la = lintPolicy(amb);
  eq("r1 ambiguous owner can't be delegated", explain(la.lint, la.matrix, amb).some((e) => e.text.startsWith("Ambiguous or missing ownership")), true);
  const allB = structuredClone(good); allB["invoice.approve"].routing = { high: "B", medium: "B", low: "C" };
  eq("r1 review flood is unfunded", lintPolicy(allB).lint.findings.map((f) => f.rule), ["oversight.unfunded"]);
}

// ── Round 2 ────────────────────────────────────────────────────────────────
{
  eq("r2 calibration", [0.01, 0.02, 0.03, 0.05].map((t) => calibrate(t).threshold), [null, 0.875, 0.75, 0.5]);
  const naive = verdicts(runBatch(good, toGate(startingGate()), BATCH2, BATCH2_START).steps);
  eq("r2 start: the slipped decimal runs", naive["INV-2004"], "risky");
  eq("r2 start: the split runs", naive["BATCH-2005"], "risky");
  eq("r2 start: the PO check holds", naive["INV-2006"], "good");
  eq("r2 good gate: every call right", new Set(runBatch(good, toGate(goodGate), BATCH2, BATCH2_START).steps.map((s) => s.verdict)), new Set(["good"]));
  const strict = lintPolicy(good, toGate({ ...goodGate, errorTarget: 0.01 }));
  eq("r2 no calibration, no Band A", explain(strict.lint, strict.matrix, good).some((e) => e.text.startsWith("Band A needs calibrated confidence, and your calibration test")), true);
}

// ── Round 3 ────────────────────────────────────────────────────────────────
const gate = toGate(goodGate);
{
  eq("r3 seeding approvals is refused", lintReview(good, gate, { ...goodReview, seedRows: { "invoice.approve": true } }).lint.ok, false);
  eq("r3 per-reviewer metrics need a DPIA", lintReview(good, gate, { ...goodReview, reviewerMetrics: true }).lint.ok, false);
  eq("r3 with a DPIA they lint", lintReview(good, gate, { ...goodReview, reviewerMetrics: true, dpia: true }).lint.ok, true);
  const shift = startShift(good, gate, goodReview);
  eq("r3 seeds lint", shift.seeds?.lint.ok, true);
  eq("r3 planted cases in the queue", shift.asks.filter((a) => a.seed).length, 2);
  const careful: Record<string, Click> = {}, stamp: Record<string, Click> = {};
  for (const a of shift.asks) { careful[a.key] = { decision: a.correct, realMs: 16_000 }; stamp[a.key] = { decision: "approve", realMs: 4_000 }; }
  const c = judgeShift(shift, careful), s = judgeShift(shift, stamp);
  eq("r3 careful: engaged", Object.values(c.engagement).map((m) => m.status), ["healthy", "healthy"]);
  eq("r3 stamping: diagnosed", Object.values(s.engagement).map((m) => m.diagnosis), ["habituation: rubber-stamping", "habituation: rubber-stamping"]);
  eq("r3 stamping: seeds missed", s.missedSeeds, 2);
}

// ── Round 4 ────────────────────────────────────────────────────────────────
const review = reviewTweak(goodReview);
{
  const naiveRouting = structuredClone(good); naiveRouting["invoice.approve"].routing = { high: "A", medium: "A", low: "B" };
  const naive = runNight(naiveRouting, gate, review, startingNight());
  eq("r4 naive: tool still there", naive.pre.toolPresent, true);
  eq("r4 naive: bank call can't be placed", naive.events.find((e) => e.id === "BANK-4014")?.record?.decision.outcome, "unplaceable");
  eq("r4 naive: what got through", naive.events.filter((e) => e.verdict === "risky").map((e) => e.id), ["INV-4014", "SPAWN-2", "INV-4015", "SPAWN-4"]);
  const n = runNight(good, gate, review, goodNight);
  eq("r4 good: probe caught the tool", [n.pre.toolPresent, n.pre.detected?.ts], [false, "2026-10-13T11:15:00.000Z"]);
  eq("r4 good: suspended at the injection", n.suspendedAt, "2026-10-17T02:14:00Z");
  eq("r4 good: nothing risky", n.events.filter((e) => e.verdict === "risky").length, 0);
  const policyClaim = runNight(good, gate, review, { ...goodNight, bank: { mechanism: "policy", every: "P7D", onManifest: false }, breakers: { ...goodNight.breakers, outOfBounds: "alert" } });
  eq("r4 policy claim: refused as non-delegable", policyClaim.events.find((e) => e.id === "BANK-4014")?.record?.decision.outcome, "refuse");
  eq("r4 policy claim warns", lintNight(good, gate, review, { ...goodNight, bank: { ...goodNight.bank, mechanism: "policy" } }).lint.findings.map((f) => f.rule), ["structural.weak"]);
}

// ── The end: scorecard and export ──────────────────────────────────────────
{
  const choices = { v5r1: good, v5r2: goodGate, v5r3: goodReview, v5r4: goodNight };
  const ex = exportFiles(choices);
  eq("export lints and compiles", [ex.ok, ex.problems], [true, []]);
  eq("export files", ex.files.map((f) => f.name), ["matrix.json", "binding.json", "invoice-standard.scoring.json", "invoice-duplicate.scoring.json", "seeds.json", "guardian.config.json"]);
  const naiveEx = exportFiles({});
  eq("a naive game exports too", naiveEx.ok, true);
  // Each exported file but the config names its schema at the vendored Guardian commit, and still lints with it.
  const vendored = readFileSync(new URL("../vendor/vaom-guardian/VENDORED.md", import.meta.url), "utf8").match(/Commit: `([0-9a-f]{40})`/)?.[1];
  eq("the schema pin is the vendored commit", GUARDIAN_COMMIT, vendored);
  eq("every file but the config names its schema", ex.files.filter((f) => f.name !== "guardian.config.json").every((f) => String(f.doc.$schema).startsWith(SCHEMA_BASE)), true);
  eq("the config names none (no schema exists for it)", ex.files.find((f) => f.name === "guardian.config.json")?.doc.$schema, undefined);
  const mFile = ex.files.find((f) => f.name === "matrix.json")!.doc, bFile = ex.files.find((f) => f.name === "binding.json")!.doc;
  eq("the exported matrix lints with its $schema", lintMatrix(mFile).ok, true);
  eq("the exported binding lints with its $schema", lintBinding(bFile, mFile).ok, true);

  const shift = startShift(good, gate, goodReview);
  const clicks: Record<string, Click> = Object.fromEntries(shift.asks.map((a) => [a.key, { decision: a.correct, realMs: 16_000 } as Click]));
  const results = [
    v5Result(runRound1(good), good, 1),
    v5Result(runBatch(good, gate, BATCH2, BATCH2_START), good, 2, gate),
    round3Result(shift, clicks, judgeShift(shift, clicks), goodReview, 33),
    round4Result(runNight(good, gate, review, goodNight), goodNight, 0),
  ];
  const card = finalScorecard(choices, results);
  eq("scorecard reads every record", card.records, results.reduce((n, r) => n + (r.v5Evidence?.records.length ?? 0), 0));
  eq("scorecard: review engaged", card.rows.find((r) => r.row === "invoice.approve")?.metrics.reviewEngagement.status, "healthy");
  eq("scorecard: boundaries verified", card.workflow.boundaryVerification.status, "healthy");
  eq("wire: a review asks", wireOf(results[0].v5Evidence!.records.find((r) => r.decision.outcome === "review")!).decision, "ask");

  // The model writes briefings only, from prompts that never ask it to call a Guardian refusal structural.
  eq("four briefings", Object.keys(BRIEFING_PROMPTS_V5), ["1", "2", "3", "4"]);
  eq("the system prompt holds the line on strength", VAOM_SYSTEM_V5.includes("Never call a Guardian refusal structural"), true);
  eq("a careful game builds the vault", chooseArchetypeV5(results), "vault_builder");
}

if (fails) { console.log(`${fails} failed`); process.exit(1); }
console.log("v5: all passed");
