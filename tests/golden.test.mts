// The golden replay: three scripted games per scenario, every output the v5 engine gives the screens
// (lints and their explanations, each step and its decision record, round results and debriefs, the night,
// the scorecard, the exported files, the archetype, the briefings and prompts), compared with
// tests/golden/<scenario>.json. A change to the engine that changes nothing a player sees leaves these
// files untouched.
// Rewrite the snapshot (only after a change meant to alter the game): GOLDEN=update npm test
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { lintPolicy, runRound1, type Round1Policy } from "../lib/v5/round1.ts";
import { explain } from "../lib/v5/explain.ts";
import { v5Result, round1Debrief, round2Debrief } from "../lib/v5/round1-result.ts";
import { calibrate, ERROR_TARGETS, runRound2, startingGate, toGate, type GateChoice } from "../lib/v5/round2.ts";
import { judgeShift, lintReview, reviewTweak, startShift, startingReview, type Click, type ReviewChoice } from "../lib/v5/round3.ts";
import { round3Result, round3Debrief } from "../lib/v5/round3-result.ts";
import { lintNight, runNight, startingNight, type NightChoice } from "../lib/v5/round4.ts";
import { round4Result, round4Debrief } from "../lib/v5/round4-result.ts";
import { exportFiles, finalScorecard, wireOf } from "../lib/v5/final.ts";
import { chooseArchetypeV5 } from "../lib/v5/archetypes.ts";
import { vaomSystem } from "../lib/v5/prompts.ts";
import { INVOICE } from "../lib/v5/scenarios/invoice.ts";
import { INCIDENT } from "../lib/v5/scenarios/incident.ts";
import type { V5Scenario } from "../lib/v5/scenario.ts";

type Game = { name: string; r1: Round1Policy; r2: GateChoice; r3: ReviewChoice; r4: NightChoice; clicks: "careful" | "stamp" | "mixed" };

function invoiceGames(): Game[] {
const sc = INVOICE;
const startingPolicy = sc.round1.startingPolicy;
const good: Round1Policy = startingPolicy();
good["invoice.approve"].routing = { high: "A", medium: "B", low: "C" };
good["invoice.duplicate-anomaly"] = { ...good["invoice.duplicate-anomaly"], included: true, pattern: "triage-and-route", routing: { high: "B", medium: "C", low: "C" } };
good["contract.modify"] = { ...good["contract.modify"], included: true, kind: "non-delegable", pattern: "prepare-and-present", owner: "legal-counsel",
  profile: { reversibility: "irreversible", consequenceScope: "external-relational", regulatoryExposure: "general-context", confidenceMeasurability: "judgment-dependent", accountabilityClarity: "clear-single-owner" } };
const goodNight: NightChoice = { chain: { maxDepth: 1, maxFanOut: 2, subagents: { "vendor-check": true, "batch-approver": false }, childCeilingB: true }, boundary: { mechanism: "absent", every: "P1D", onManifest: true }, breakers: { outOfBounds: "suspend", chainDepth: "alert", notify: "ap-owner" } };

const games: Game[] = [
  { name: "naive", r1: startingPolicy(), r2: startingGate(sc), r3: startingReview(), r4: startingNight(sc), clicks: "stamp" },
  { name: "careful", r1: good, r2: { errorTarget: 0.02, medium: 0.5, ceiling: 7500, onExceed: "B", cap: 7000 },
    r3: { ...startingReview(), fundedHours: 70, seedRows: { "invoice.duplicate-anomaly": true }, seedRate: 0.1 }, r4: goodNight, clicks: "careful" },
  { name: "mixed", r1: good, r2: { errorTarget: 0.03, medium: 0.75, ceiling: 15000, onExceed: "C", cap: null },
    r3: { ...startingReview(), fundedHours: 50, seedRows: { "invoice.duplicate-anomaly": true }, seedRate: 0.2, reviewerMetrics: true, dpia: true },
    r4: { ...goodNight, boundary: { mechanism: "policy", every: "P7D", onManifest: false }, breakers: { ...goodNight.breakers, outOfBounds: "alert" } }, clicks: "mixed" },
];
return games;
}

function incidentGames(): Game[] {
  const sc = INCIDENT;
  const startingPolicy = sc.round1.startingPolicy;
  const good: Round1Policy = startingPolicy();
  good["remediation.restart"].routing = { high: "A", medium: "B", low: "C" };
  good["config.change"] = { ...good["config.change"], included: true, kind: "non-delegable", pattern: "prepare-and-present", owner: "platform-owner",
    profile: { reversibility: "reversible-with-friction", consequenceScope: "external-relational", regulatoryExposure: "none", confidenceMeasurability: "partially-quantifiable", accountabilityClarity: "clear-single-owner" } };
  good["production.restricted"] = { ...good["production.restricted"], included: true, kind: "non-delegable", pattern: "prepare-and-present", owner: "platform-owner",
    profile: { reversibility: "irreversible", consequenceScope: "external-relational", regulatoryExposure: "general-context", confidenceMeasurability: "judgment-dependent", accountabilityClarity: "clear-single-owner" } };
  const goodNight: NightChoice = { chain: { maxDepth: 1, maxFanOut: 2, subagents: { "log-analysis": true, "dependency-check": true, "fleet-restarter": false }, childCeilingB: true }, boundary: { mechanism: "absent", every: "P1D", onManifest: true }, breakers: { outOfBounds: "suspend", chainDepth: "alert", notify: "sre-lead" } };
  return [
    { name: "naive", r1: startingPolicy(), r2: startingGate(sc), r3: startingReview(), r4: startingNight(sc), clicks: "stamp" },
    { name: "careful", r1: good, r2: { errorTarget: 0.02, medium: 0.7, ceiling: null, onExceed: "B", cap: 3 },
      r3: { ...startingReview(), fundedHours: 10, seedRows: { "remediation.restart": true }, seedRate: 0.1 }, r4: goodNight, clicks: "careful" },
    { name: "mixed", r1: good, r2: { errorTarget: 0.03, medium: 0.7, ceiling: null, onExceed: "B", cap: null },
      r3: { ...startingReview(), fundedHours: 8, seedRows: { "remediation.restart": true }, seedRate: 0.2, reviewerMetrics: true, dpia: true },
      r4: { ...goodNight, boundary: { mechanism: "policy", every: "P7D", onManifest: false }, breakers: { ...goodNight.breakers, outOfBounds: "alert" } }, clicks: "mixed" },
  ];
}

function play(sc: V5Scenario, g: Game) {
  const out: Record<string, unknown> = {};
  const l1 = lintPolicy(sc, g.r1);
  out.r1 = { lint: l1.lint, explained: explain(sc, l1.lint, l1.matrix, g.r1), matrix: l1.matrix };
  const run1 = runRound1(sc, g.r1);
  const res1 = v5Result(sc, run1, g.r1, 1);
  out.r1run = { run: run1, result: res1, debrief: round1Debrief(sc, res1, g.r1) };

  const gate = toGate(sc, g.r2);
  const l2 = lintPolicy(sc, g.r1, gate);
  const run2 = runRound2(sc, g.r1, gate);
  const res2 = v5Result(sc, run2, g.r1, 2, gate);
  out.r2 = { gate, lint: l2.lint, explained: explain(sc, l2.lint, l2.matrix, g.r1), run: run2, result: res2, debrief: round2Debrief(sc, res2, g.r2, gate.calibrationRun.threshold) };

  const l3 = lintReview(sc, g.r1, gate, g.r3);
  const shift = startShift(sc, g.r1, gate, g.r3);
  const clicks: Record<string, Click> = Object.fromEntries(shift.asks.map((a, i) => [a.key,
    g.clicks === "careful" ? { decision: a.correct, realMs: 16_000 }
      : g.clicks === "stamp" ? { decision: "approve", realMs: 4_000 }
        : i % 3 === 2 ? { decision: "expired", realMs: 0 } : { decision: a.correct, realMs: 9_000 + i * 700 }] as [string, Click]));
  const verdict = judgeShift(sc, shift, clicks);
  const res3 = round3Result(sc, shift, clicks, verdict, g.r3, l3.hours);
  out.r3 = { lint: l3, shift, verdict, result: res3, debrief: round3Debrief(res3, verdict, g.r3) };

  const review = reviewTweak(g.r3);
  const l4 = lintNight(sc, g.r1, gate, review, g.r4);
  const night = runNight(sc, g.r1, gate, review, g.r4);
  const res4 = round4Result(sc, night, g.r4, l4.lint.findings.filter((f) => f.severity === "warning").length);
  out.r4 = { lint: l4, night, result: res4, debrief: round4Debrief(sc, night, g.r4) };

  const choices = { v5r1: g.r1, v5r2: g.r2, v5r3: g.r3, v5r4: g.r4 };
  const results = [res1, res2, res3, res4];
  out.final = {
    exports: exportFiles(sc, choices),
    scorecard: finalScorecard(sc, choices, results),
    wire: results.flatMap((r) => r.v5Evidence?.records ?? []).map(wireOf),
    archetype: chooseArchetypeV5(results),
  };
  return out;
}

const snapshot = (sc: V5Scenario, games: Game[]) => ({
  games: Object.fromEntries(games.map((g) => [g.name, play(sc, g)])),
  calibration: ERROR_TARGETS.map((t) => calibrate(sc, t)),
  text: { briefings: [1, 2, 3, 4].map((r) => sc.briefings[r as 1 | 2 | 3 | 4]), archetypes: sc.archetypes, system: vaomSystem(sc), prompts: sc.prompts.briefings },
});

// Stable JSON: byte arrays as hex, undefined dropped, as JSON would.
let failed = false;
for (const [sc, games] of [[INVOICE, invoiceGames()], [INCIDENT, incidentGames()]] as const) {
  const json = JSON.stringify(snapshot(sc, games), (_k, v) => (v instanceof Uint8Array ? Buffer.from(v).toString("hex") : v), 1) + "\n";
  const name = sc.id.split("_")[0];
  const file = new URL(`./golden/${name}.json`, import.meta.url);
  if (process.env.GOLDEN === "update") {
    mkdirSync(new URL("./golden/", import.meta.url), { recursive: true });
    writeFileSync(file, json);
    console.log(`golden: ${name}.json rewritten`);
    continue;
  }
  const want = readFileSync(file, "utf8");
  if (want !== json) {
    const a = want.split("\n"), b = json.split("\n");
    const i = a.findIndex((line, n) => line !== b[n]);
    console.log(`FAIL golden ${name}: first difference at line ${i + 1}\n  want: ${a[i]}\n  got:  ${b[i]}`);
    failed = true;
  } else console.log(`golden: ${name} scenario unchanged`);
}
if (failed) process.exit(1);
