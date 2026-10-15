// Round 3, "The Reviewer", on the VAOM Guardian core (invoices).
//
// The player funds the reviewer hours and decides where planted cases (seeded errors) go, then works
// Thursday's Band B queue as the accounts payable clerk. Every approve or reject becomes a resolution on a
// real decision record; every planted case becomes a seed outcome. The core's scorecard() then judges
// review engagement and seeded-error detection from the player's own clicks.
//
// Rules the core enforces here: seeding is never allowed on a row whose records feed regulatory reporting
// (invoice approval feeds VAT returns); planted cases never execute; reviewers are told planted cases
// exist (the seeds file's disclosure); per-reviewer metrics are employee monitoring and need a recorded
// approval such as a DPIA. The game clock runs four times faster than real time.
import { lintSeeds, preview, resolveRecord, scorecard, type DecisionRecord, type LintResult, type Metric, type SeedOutcome } from "@verkflode/vaom-guardian-core";
import { FACT_KEY, item, lintPolicy, reviewHours, runBatch, type BatchItem, type Doc, type Gate, type MatrixTweak, type Round1Policy, type Round1Run, type RowId } from "./round1";

export const SPEED = 4;
export const REVIEWER = "ap-clerk";

// ── The player's oversight choices ─────────────────────────────────────────

export interface ReviewChoice {
  fundedHours: number;
  /** Rows the player plants seeded cases in. */
  seedRows: Partial<Record<RowId, boolean>>;
  seedRate: number;
  targetDetection: number;
  /** Per-reviewer metrics, and whether a DPIA is on file for them. */
  reviewerMetrics: boolean;
  dpia: boolean;
}

export const SEED_RATES = [0.05, 0.1, 0.2];

export function startingReview(): ReviewChoice {
  return { fundedHours: 60, seedRows: {}, seedRate: 0.1, targetDetection: 0.9, reviewerMetrics: false, dpia: false };
}

export function reviewTweak(c: ReviewChoice): MatrixTweak {
  return (m: Doc) => {
    m.oversight.fundedReviewerHoursPerWeek = c.fundedHours;
    m.oversight.reviewerLevelMetrics = c.reviewerMetrics
      ? { enabled: true, ...(c.dpia ? { approvalRef: "placeholder://lab/dpia-reviewer-metrics" } : {}) }
      : { enabled: false };
    for (const row of m.rows as Doc[]) {
      if (!row.oversight) continue;
      row.oversight.seeding = c.seedRows[row.id as RowId] ? { enabled: true, rate: c.seedRate, targetDetectionRate: c.targetDetection } : { enabled: false };
      // A seeded row declares what its records feed; for the duplicate row that's nothing.
      if (c.seedRows[row.id as RowId]) row.oversight.recordsFeed ??= [];
      row.oversight.minPlausibleReviewSeconds ??= 45;
    }
  };
}

export function lintReview(policy: Round1Policy, gate: Gate, c: ReviewChoice): { matrix: Doc; lint: LintResult; hours: number; funded: number } {
  const tweak = reviewTweak(c);
  const { matrix, lint } = lintPolicy(policy, gate, tweak);
  const { hours, funded } = reviewHours(policy, gate, tweak);
  return { matrix, lint, hours, funded };
}

/** Seconds of real time the player gets per ask: more headroom between funded hours and load, more time. */
export function secondsPerAsk(hours: number, funded: number): number {
  const headroom = hours > 0 ? funded / hours : 2;
  return Math.round(Math.max(6, Math.min(20, 8 * headroom)));
}

// ── Thursday's batch ───────────────────────────────────────────────────────

const rv = (correct: "approve" | "reject", why: string, ...facts: string[]) => ({ facts, correct, why });
const withReview = (b: BatchItem, review: BatchItem["review"]): BatchItem => ({ ...b, review });
const flag = (id: string, of: string, vendor: string, amount: number, review: BatchItem["review"]): BatchItem => ({
  id: `FLAG-${id}`, label: `Flags INV-${id} as a duplicate of ${of}`, vendor, amount, truth: review!.correct === "approve" ? "hazard" : "clean", verified: true, type: "duplicate",
  call: { tool: "mcp__erp__flag_invoice", arguments: { invoice_id: `INV-${id}`, reason: "duplicate", duplicate_of: of } },
  teaching: review!.why, review,
});

export const BATCH3: BatchItem[] = [
  item("INV-3001", "€1,180 from a regular vendor, PO matched", "V-ACME", 1180, "clean", "standard", "Routine."),
  withReview(item("INV-3002", "€8,200 crane hire", "V-CRANE", 8200, "clean", "high_value", "Over the ceiling, and fine."),
    rv("approve", "Open PO for the exact amount, signed delivery, normal size for the vendor.", "PO-6610: €8,200, open", "Vendor's median: €6,600 over 5 invoices", "Delivery note signed 13 October")),
  withReview(item("INV-3003", "€9,400 steel delivery", "V-STEEL", 9400, "hazard", "high_value", "Billed twice for September."),
    rv("reject", "September was already invoiced and paid as INV-2003. This is a second bill for the same period.", "PO-6702: €9,400, open", "Service period: September 2026", "INV-2003, paid 15 October, also billed September")),
  withReview(item("INV-3004", "€2,600 urgent consulting, new vendor", "V-NORTHWIND", 2600, "hazard", "new_vendor", "Invoice fraud pattern."),
    rv("reject", "A new vendor whose bank account was added yesterday by email, on a PO raised by the same requester: the classic invoice-fraud pattern.", "First invoice from this vendor", "Bank account added yesterday after an emailed request", "PO-6750 raised yesterday by the requester who asked for the vendor")),
  withReview(item("INV-3005", "€3,100 facilities work, new vendor", "V-LOCAL", 3100, "clean", "new_vendor", "New, and properly onboarded."),
    rv("approve", "New, but onboarded with checks done and a PO approved by the budget owner.", "First invoice from this vendor", "Onboarded 2 October, checks complete", "PO-6688: €3,100, approved by facilities")),
  withReview(item("INV-3006", "€1,300 from a regular vendor; the PO check failed", "V-ACME", 1300, "hazard", "standard", "Digits transposed.", { verified: false }),
    rv("reject", "The PO is for €1,030. The invoice asks for €270 more.", "PO-4471: €1,030", "Invoice: €1,300", "Same vendor, same goods")),
  withReview(item("INV-3007", "€760 office supplies; the PO check failed", "V-OFFICE", 760, "clean", "standard", "No goods receipt yet.", { verified: false }),
    rv("approve", "The check failed only because the goods receipt isn't posted yet; delivery is confirmed.", "PO-6801: €760", "Goods receipt not posted in the ERP yet", "Office manager confirmed delivery by email")),
  item("INV-3008", "€980 cleaning services, PO matched", "V-CLEAN", 980, "clean", "standard", "Routine."),
  flag("3011", "INV-3001", "V-ACME", 1180, rv("approve", "Same vendor, amount, PO and date: a true duplicate.", "Both V-ACME, €1,180", "Same PO-4471", "Same invoice date, 16 October")),
  flag("3012", "INV-3002", "V-CRANE", 8200, rv("reject", "Same amount, but a different PO and delivery: a second hire, not a duplicate.", "Both V-CRANE, €8,200", "INV-3012 cites PO-6611, not PO-6610", "Different delivery note")),
  flag("3013", "INV-2007", "V-CLEAN", 880, rv("approve", "Same PO and the same service date: a true duplicate.", "Both V-CLEAN, €880", "Same PO", "Same service date, 14 October")),
  flag("3014", "INV-3008", "V-CLEAN", 980, rv("reject", "A monthly contract bills the same amount every month. Different month, not a duplicate.", "Both V-CLEAN, €980", "Monthly cleaning contract, fixed fee", "Service month: November, not October")),
];
export const BATCH3_START = "2026-10-16T09:00:00Z";

// ── Planted cases ──────────────────────────────────────────────────────────

interface Plant { id: string; row: RowId; tool: string; arguments: Record<string, unknown>; error: string; label: string; facts: string[] }

const PLANTS: Plant[] = [
  { id: "credit-note", row: "invoice.duplicate-anomaly", tool: "mcp__erp__flag_invoice", arguments: { invoice_id: "INV-3021", reason: "duplicate", duplicate_of: "INV-3005" },
    label: "Flags INV-3021 as a duplicate of INV-3005", facts: ["Both V-LOCAL, €3,100", "INV-3021 is a credit note: minus €3,100", "Issued after a cancelled order"],
    error: "INV-3021 is a credit note, not a second bill. Holding it holds money owed to us." },
  { id: "tenfold", row: "invoice.duplicate-anomaly", tool: "mcp__erp__flag_invoice", arguments: { invoice_id: "INV-3022", reason: "duplicate", duplicate_of: "INV-3002" },
    label: "Flags INV-3022 as a duplicate of INV-3002", facts: ["Both V-CRANE", "INV-3022: €820; INV-3002: €8,200", "Different PO: PO-6640"],
    error: "The amounts differ tenfold and the POs differ: not a duplicate." },
  { id: "other-vendor", row: "invoice.duplicate-anomaly", tool: "mcp__erp__flag_invoice", arguments: { invoice_id: "INV-3023", reason: "duplicate", duplicate_of: "INV-3006" },
    label: "Flags INV-3023 as a duplicate of INV-3006", facts: ["INV-3023: V-OFFICE, €1,300", "INV-3006: V-ACME, €1,300", "Different POs"],
    error: "Different vendors. An equal amount is not a duplicate." },
];

export function seedsDoc(c: ReviewChoice): Doc {
  const rows = (Object.entries(c.seedRows) as [RowId, boolean][]).filter(([, on]) => on).map(([r]) => r);
  return {
    format: "vaom.seeds/0.1",
    id: "lab.ap.invoice.seeds",
    version: "1.0",
    title: "Planted review cases with known errors",
    approval: { role: "ap-owner", date: "2026-10-16", ref: "placeholder://lab/oversight-plan" },
    disclosure: {
      statement: `About ${c.seedRate * 100}% of review cases on the rows below are planted cases with a known error. They arrive right after a real ask, never execute whatever you decide, and are used only to measure whether review catches errors, in aggregate, never per person.`,
      date: "2026-10-16",
      ref: "placeholder://lab/ap-handbook-oversight",
    },
    seeds: PLANTS.filter((p) => rows.includes(p.row)).map((p) => ({ id: p.id, row: p.row, tool: p.tool, arguments: p.arguments, error: p.error })),
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
  seed?: { id: string; row: RowId; error: string };
}

export interface Shift {
  run: Round1Run;
  asks: Ask[];
  /** What happened outside the player's queue. */
  elsewhere: { A: number; C: number; held: number };
  seeds: { doc: Doc; lint: LintResult } | null;
}

/** Run Thursday's batch and build the player's queue: the Band B asks addressed to the clerk, each real
 *  ask followed (at the disclosed rate, at most one each) by a planted case on its row. */
export function startShift(policy: Round1Policy, gate: Gate, c: ReviewChoice): Shift {
  const run = runBatch(policy, gate, BATCH3, BATCH3_START, reviewTweak(c));
  const asks: Ask[] = [];
  const doc = seedsDoc(c);
  const seedLint = doc.seeds.length ? lintSeeds(doc, run.policy) : null;
  const plants = seedLint?.ok ? [...(doc.seeds as Doc[])] : [];
  // A week's worth of planted cases compressed into one shift: the rate decides how many.
  const budget = Math.min(plants.length, Math.max(1, Math.round(c.seedRate * 20)));
  let planted = 0;

  for (const s of run.steps) {
    if (s.lane !== "B" || s.record.decision.approver_role !== REVIEWER || !s.item.review) continue;
    asks.push({ key: s.record.id, label: s.item.label, facts: s.item.review.facts, reasons: codes(s.record), correct: s.item.review.correct, why: s.item.review.why, record: s.record });
    const row = s.record.decision.placements[0]?.row as RowId | undefined;
    const pi = plants.findIndex((p) => p.row === row);
    if (planted < budget && pi >= 0) {
      const p = plants.splice(pi, 1)[0];
      const meta = PLANTS.find((x) => x.id === p.id)!;
      const at = Date.parse(s.record.request.ts) + 120_000;
      run.contexts.open({ id: `ctx-seed-${p.id}`, session: "lab", agent: { id: "ap-agent" }, rows: [p.row] }, at);
      const rec = preview(run.policy, { tool: p.tool, arguments: p.arguments }, run.ledger, {
        id: `seed-${p.id}`, ts: new Date(at).toISOString(), agent: { id: "ap-agent" }, session: { id: "lab" }, contexts: run.contexts, factKey: FACT_KEY,
        verifications: { "erp:invoice.approve": true },
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
}

export function judgeShift(shift: Shift, clicks: Record<string, Click>): ShiftResult {
  const records: DecisionRecord[] = [];
  const seeds: SeedOutcome[] = [];
  const wrong: ShiftResult["wrong"] = [];
  const executedBad: Ask[] = [];
  let correct = 0;
  const latencies: number[] = [];

  for (const a of shift.asks) {
    const c = clicks[a.key] ?? { decision: "expired", realMs: 0 };
    const at = new Date(Date.parse(a.record.request.ts) + c.realMs * SPEED).toISOString();
    const approval = { approver_role: REVIEWER, record: `placeholder://lab/approvals/${a.key}`, latency_ms: c.realMs * SPEED };
    if (c.decision !== "expired") latencies.push(c.realMs * SPEED);
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
  const card = scorecard(shift.run.matrix, [...others, ...records], {
    from: "2026-10-16T00:00:00Z", to: "2026-10-17T00:00:00Z",
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
    engagement, detection,
    medianGameSeconds: latencies.length ? latencies[latencies.length >> 1] / 1000 : null,
  };
}
