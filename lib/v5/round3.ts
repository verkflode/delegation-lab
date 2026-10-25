// Round 3, "The Reviewer", on the VAOM Guardian core.
//
// The player funds the reviewer hours and decides where planted cases (seeded errors) go, then works the
// day's Band B queue as the scenario's reviewer. Every approve or reject becomes a resolution on a
// real decision record; every planted case becomes a seed outcome. The core's scorecard() then judges
// review engagement and seeded-error detection from the player's own clicks.
//
// Rules the core enforces here: seeding is never allowed on a row whose records feed regulatory reporting
// (in the invoice scenario, approval feeds VAT returns); planted cases never execute; reviewers are told planted cases
// exist (the seeds file's disclosure); per-reviewer metrics are employee monitoring and need a recorded
// approval such as a DPIA. The game clock runs faster than real time: four times, or the scenario's speed.
import { lintSeeds, preview, resolveRecord, scorecard, type DecisionRecord, type LintResult, type Metric, type SeedOutcome } from "@verkflode/vaom-guardian-core";
import { FACT_KEY, lintPolicy, reviewHours, runBatch, type Doc, type Gate, type MatrixTweak, type Round1Policy, type Round1Run } from "./round1";
import type { V5Scenario } from "./scenario";

export const SPEED = 4;
export const speedOf = (sc: V5Scenario) => sc.round3.speed ?? SPEED;

// ── The player's oversight choices ─────────────────────────────────────────

export interface ReviewChoice {
  fundedHours: number;
  /** Rows the player plants seeded cases in. */
  seedRows: Partial<Record<string, boolean>>;
  seedRate: number;
  targetDetection: number;
  /** Per-reviewer metrics, and whether a DPIA is on file for them. */
  reviewerMetrics: boolean;
  dpia: boolean;
}

export const SEED_RATES = [0.05, 0.1, 0.2];

export function startingReview(sc: V5Scenario): ReviewChoice {
  return { fundedHours: sc.round3.funded.start, seedRows: {}, seedRate: 0.1, targetDetection: 0.9, reviewerMetrics: false, dpia: false };
}

export function reviewTweak(c: ReviewChoice): MatrixTweak {
  return (m: Doc) => {
    m.oversight.fundedReviewerHoursPerWeek = c.fundedHours;
    m.oversight.reviewerLevelMetrics = c.reviewerMetrics
      ? { enabled: true, ...(c.dpia ? { approvalRef: "placeholder://lab/dpia-reviewer-metrics" } : {}) }
      : { enabled: false };
    for (const row of m.rows as Doc[]) {
      if (!row.oversight) continue;
      row.oversight.seeding = c.seedRows[row.id] ? { enabled: true, rate: c.seedRate, targetDetectionRate: c.targetDetection } : { enabled: false };
      // A seeded row declares what its records feed; for the duplicate row that's nothing.
      if (c.seedRows[row.id]) row.oversight.recordsFeed ??= [];
      row.oversight.minPlausibleReviewSeconds ??= 45;
    }
  };
}

export function lintReview(sc: V5Scenario, policy: Round1Policy, gate: Gate, c: ReviewChoice): { matrix: Doc; lint: LintResult; hours: number; funded: number } {
  const tweak = reviewTweak(c);
  const { matrix, lint } = lintPolicy(sc, policy, gate, tweak);
  const { hours, funded } = reviewHours(sc, policy, gate, tweak);
  return { matrix, lint, hours, funded };
}

/** Seconds of real time the player gets per ask: more headroom between funded hours and load, more time. */
export function secondsPerAsk(hours: number, funded: number): number {
  const headroom = hours > 0 ? funded / hours : 2;
  return Math.round(Math.max(6, Math.min(20, 8 * headroom)));
}

// ── Planted cases ──────────────────────────────────────────────────────────

export function seedsDoc(sc: V5Scenario, c: ReviewChoice): Doc {
  const rows = (Object.entries(c.seedRows) as [string, boolean][]).filter(([, on]) => on).map(([r]) => r);
  const s = sc.round3.seeds;
  return {
    format: "vaom.seeds/0.1",
    id: s.id,
    version: "1.0",
    title: "Planted review cases with known errors",
    approval: { role: s.approvedBy, date: s.date, ref: "placeholder://lab/oversight-plan" },
    disclosure: {
      statement: `About ${c.seedRate * 100}% of review cases on the rows below are planted cases with a known error. They arrive right after a real ask, never execute whatever you decide, and are used only to measure whether review catches errors, in aggregate, never per person.`,
      date: s.date,
      ref: s.handbookRef,
    },
    seeds: sc.round3.plants.filter((p) => rows.includes(p.row)).map((p) => ({ id: p.id, row: p.row, tool: p.tool, arguments: p.arguments, error: p.error })),
  };
}

// ── The queue ──────────────────────────────────────────────────────────────

export interface Ask {
  key: string;
  label: string;
  facts: string[];
  /** Why the Guardian asked: its reason codes. */
  reasons: string[];
  correct: "approve" | "reject";
  why: string;
  record: DecisionRecord;
  seed?: { id: string; row: string; error: string };
}

export interface Shift {
  run: Round1Run;
  asks: Ask[];
  /** What happened outside the player's queue. */
  elsewhere: { A: number; C: number; held: number };
  seeds: { doc: Doc; lint: LintResult } | null;
}

/** Run the day's batch and build the player's queue: the Band B asks addressed to the reviewer, each real
 *  ask followed (at the disclosed rate, at most one each) by a planted case on its row. */
export function startShift(sc: V5Scenario, policy: Round1Policy, gate: Gate, c: ReviewChoice): Shift {
  const REVIEWER = sc.round3.reviewer;
  const run = runBatch(sc, policy, gate, sc.round3.batch, sc.round3.start, reviewTweak(c));
  const asks: Ask[] = [];
  const doc = seedsDoc(sc, c);
  const seedLint = doc.seeds.length ? lintSeeds(doc, run.policy) : null;
  const plants = seedLint?.ok ? [...(doc.seeds as Doc[])] : [];
  // A week's worth of planted cases compressed into one shift: the rate decides how many.
  const budget = Math.min(plants.length, Math.max(1, Math.round(c.seedRate * 20)));
  let planted = 0;

  for (const s of run.steps) {
    if (s.lane !== "B" || s.record.decision.approver_role !== REVIEWER || !s.item.review) continue;
    asks.push({ key: s.record.id, label: s.item.label, facts: s.item.review.facts, reasons: codes(s.record), correct: s.item.review.correct, why: s.item.review.why, record: s.record });
    const row = s.record.decision.placements[0]?.row;
    const pi = plants.findIndex((p) => p.row === row);
    if (planted < budget && pi >= 0) {
      const p = plants.splice(pi, 1)[0];
      const meta = sc.round3.plants.find((x) => x.id === p.id)!;
      const at = Date.parse(s.record.request.ts) + 120_000;
      run.contexts.open({ id: `ctx-seed-${p.id}`, session: "lab", agent: { id: sc.agent }, rows: [p.row] }, at);
      const rec = preview(run.policy, { tool: p.tool, arguments: p.arguments }, run.ledger, {
        id: `seed-${p.id}`, ts: new Date(at).toISOString(), agent: { id: sc.agent }, session: { id: "lab" }, contexts: run.contexts, factKey: FACT_KEY,
        verifications: { [sc.round1.verifiedCapability]: true },
      });
      // A planted case is shown only if it would reach this reviewer exactly as a real ask would.
      if (rec.decision.outcome === "review" && rec.decision.approver_role === REVIEWER) {
        asks.push({ key: rec.id, label: meta.label, facts: meta.facts, reasons: codes(rec), correct: "reject", why: meta.error, record: rec, seed: { id: p.id, row: p.row, error: meta.error } });
        planted++;
      }
    }
  }
  const lane = (l: string) => run.steps.filter((s) => s.lane === l).length;
  return { run, asks, elsewhere: { A: lane("A"), C: lane("C"), held: lane("held") }, seeds: seedLint ? { doc, lint: seedLint } : null };
}

function codes(r: DecisionRecord): string[] {
  return [...new Set(r.decision.reasons.map((x) => x.code).filter((c) => !c.startsWith("confidence.high")))];
}

// ── The verdict ────────────────────────────────────────────────────────────

export type Click = { decision: "approve" | "reject" | "expired"; realMs: number };

export interface ShiftResult {
  correct: number;
  wrong: { ask: Ask; click: Click }[];
  missedSeeds: number;
  detectedSeeds: number;
  executedBad: Ask[];
  engagement: Record<string, Metric>;
  detection: Record<string, Metric>;
  medianGameSeconds: number | null;
  /** The day's records, the player's resolved, and the seed outcomes: the round's evidence. */
  records: DecisionRecord[];
  seeds: SeedOutcome[];
}

export function judgeShift(sc: V5Scenario, shift: Shift, clicks: Record<string, Click>): ShiftResult {
  const date = sc.round3.start.slice(0, 10);
  const speed = speedOf(sc);
  const records: DecisionRecord[] = [];
  const seeds: SeedOutcome[] = [];
  const wrong: ShiftResult["wrong"] = [];
  const executedBad: Ask[] = [];
  let correct = 0;
  const latencies: number[] = [];

  for (const a of shift.asks) {
    const c = clicks[a.key] ?? { decision: "expired", realMs: 0 };
    const at = new Date(Date.parse(a.record.request.ts) + c.realMs * speed).toISOString();
    const approval = { approver_role: sc.round3.reviewer, record: `placeholder://lab/approvals/${a.key}`, latency_ms: c.realMs * speed };
    if (c.decision !== "expired") latencies.push(c.realMs * speed);
    if (c.decision === a.correct) correct++;
    else wrong.push({ ask: a, click: c });
    if (a.seed) {
      seeds.push({ row: a.seed.row, ts: at, result: c.decision === "reject" ? "detected" : c.decision === "approve" ? "missed" : "expired" });
      continue;
    }
    if (c.decision === "approve" && a.correct === "reject") executedBad.push(a);
    records.push(resolveRecord(a.record, c.decision === "expired" ? { ts: at, result: "expired" }
      : c.decision === "approve" ? { ts: at, result: "executed", approval } : { ts: at, result: "rejected", approval }));
  }

  // The scorecard reads the whole day: the batch's other records, resolved as they went.
  const others = shift.run.steps.map((s) => s.record).filter((r) => !shift.asks.some((a) => a.key === r.id));
  const day = [...others, ...records];
  const card = scorecard(shift.run.matrix, day, {
    from: `${date}T00:00:00Z`, to: new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().replace(".000Z", "Z"),
    // A game shift is tiny; real verdicts need far more (the defaults are 20 and 10).
    minSample: 4, seeds, seedMinSample: 1,
  });
  const engagement: Record<string, Metric> = {}, detection: Record<string, Metric> = {};
  for (const r of card.rows) {
    engagement[r.row] = r.metrics.reviewEngagement;
    detection[r.row] = r.metrics.seededDetection;
  }
  latencies.sort((a, b) => a - b);
  return {
    correct, wrong, executedBad,
    missedSeeds: seeds.filter((s) => s.result === "missed").length,
    detectedSeeds: seeds.filter((s) => s.result === "detected").length,
    engagement, detection, records: day, seeds,
    medianGameSeconds: latencies.length ? latencies[latencies.length >> 1] / 1000 : null,
  };
}
