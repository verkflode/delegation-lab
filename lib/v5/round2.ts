// Round 2, "The Gate", on the VAOM Guardian core (invoices).
//
// The player sets the approve row's limits. The threshold for Band A isn't set directly: the matrix
// schema says the threshold is an output of the calibration record, not an input. So the player picks an
// error target, the Lab runs a learn-then-test on a calibration sample (fixed-sequence testing, one-sided
// Clopper-Pearson bound at 95%), and the threshold the test supports goes into the matrix with its
// calibration record. If no threshold passes, there is no record, and the linter keeps Band A shut.
// The player also sets the medium threshold, the value ceiling and the per-vendor daily cap, then
// Wednesday's batch runs through decide() as in round 1.
import { CONTROLLER_GATE, item, type BatchItem, type Gate, type Level } from "./round1";

// ── Calibration ────────────────────────────────────────────────────────────

/** 240 past approvals, scored by invoice-standard 3.2 and checked by hand: how many were wrong. */
export const SAMPLE: { score: number; n: number; errors: number }[] = [
  { score: 1.0, n: 160, errors: 0 },
  { score: 0.875, n: 50, errors: 0 },
  { score: 0.75, n: 20, errors: 2 },
  { score: 0.5, n: 10, errors: 4 },
];
export const SAMPLE_SIZE = SAMPLE.reduce((a, b) => a + b.n, 0);
export const CONFIDENCE = 0.95;
export const ERROR_TARGETS = [0.01, 0.02, 0.03, 0.05, 0.1];

function binomCdf(k: number, n: number, p: number): number {
  if (p <= 0) return 1;
  if (p >= 1) return k >= n ? 1 : 0;
  let term = Math.pow(1 - p, n), sum = term;
  for (let i = 1; i <= k; i++) { term *= ((n - i + 1) / i) * (p / (1 - p)); sum += term; }
  return Math.min(1, sum);
}

/** One-sided Clopper-Pearson upper bound on the error rate, from `errors` in `n`. */
export function upperBound(errors: number, n: number, confidence = CONFIDENCE): number {
  let lo = errors / n, hi = 1;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (binomCdf(errors, n, mid) > 1 - confidence) lo = mid; else hi = mid;
  }
  return hi;
}

export interface CalibrationStep { threshold: number; n: number; errors: number; bound: number; pass: boolean }
export interface Calibration { target: number; steps: CalibrationStep[]; threshold: number | null }

/** Learn-then-test with fixed-sequence testing: from the strictest threshold down, stop at the first that
 *  fails. The lowest threshold that passed is calibrated. */
export function calibrate(target: number): Calibration {
  const steps: CalibrationStep[] = [];
  let threshold: number | null = null, n = 0, errors = 0;
  for (const b of SAMPLE) {
    n += b.n; errors += b.errors;
    const bound = upperBound(errors, n);
    const pass = bound <= target;
    steps.push({ threshold: b.score, n, errors, bound, pass });
    if (!pass) break;
    threshold = b.score;
  }
  return { target, steps, threshold };
}

// ── Volume: what the gate costs a week ─────────────────────────────────────

const WEEKLY = 1520;
/** Share of approvals above an amount (EUR). */
const OVER: [number, number][] = [[1000, 0.45], [2000, 0.25], [3000, 0.15], [5000, 0.06], [7500, 0.035], [10000, 0.02], [15000, 0.008], [20000, 0.004]];

export function shareOver(amount: number): number {
  if (amount <= OVER[0][0]) return OVER[0][1];
  for (let i = 1; i < OVER.length; i++) {
    const [a0, s0] = OVER[i - 1], [a1, s1] = OVER[i];
    if (amount <= a1) return Math.exp(Math.log(s0) + ((Math.log(amount) - Math.log(a0)) / (Math.log(a1) - Math.log(a0))) * (Math.log(s1) - Math.log(s0)));
  }
  return OVER[OVER.length - 1][1];
}

function volumeByLevel(high: number, medium: number): Partial<Record<Level, number>> {
  const out: Partial<Record<Level, number>> = {};
  for (const b of SAMPLE) {
    const level: Level = b.score >= high ? "high" : b.score >= medium ? "medium" : "low";
    out[level] = Math.round((out[level] ?? 0) + (WEEKLY * b.n) / SAMPLE_SIZE);
  }
  return out;
}

// ── The player's gate ──────────────────────────────────────────────────────

export interface GateChoice {
  errorTarget: number;
  medium: number;
  ceiling: number;
  onExceed: "B" | "C";
  /** Per-vendor daily cap; null for none. */
  cap: number | null;
}

export const MEDIUM_OPTIONS = [0.5, 0.6, 0.7, 0.75, 0.8, 0.875];

export function startingGate(): GateChoice {
  return { errorTarget: 0.05, medium: 0.7, ceiling: 15000, onExceed: "B", cap: null };
}

/** The gate the player's choices produce. With no calibrated threshold, high sits at 1.0 and there is no
 *  calibration record, so a row routing anything to Band A fails lint. */
export function toGate(c: GateChoice): Gate & { calibrationRun: Calibration } {
  const cal = calibrate(c.errorTarget);
  const high = cal.threshold ?? 1;
  const medium = Math.min(c.medium, high);
  return {
    thresholds: { high, medium },
    calibration: cal.threshold === null ? null : {
      errorTarget: c.errorTarget, confidenceLevel: CONFIDENCE, sampleSize: SAMPLE_SIZE, sampleDate: "2026-10-01",
      sampleRef: "placeholder://lab/calibration-sample", method: "learn-then-test",
    },
    ceiling: { amount: c.ceiling, onExceed: c.onExceed },
    cap: c.cap,
    volume: volumeByLevel(high, medium),
    overCeilingPerWeek: Math.round(WEEKLY * shareOver(c.ceiling)),
    version: "1.1.0",
    round: 2,
    calibrationRun: cal,
  };
}

export { CONTROLLER_GATE };

// ── Wednesday's batch ──────────────────────────────────────────────────────

export const BATCH2: BatchItem[] = [
  item("INV-2001", "€1,350 from a regular vendor, PO matched", "V-ACME", 1350, "clean", "standard", "Routine."),
  item("INV-2002", "€4,900 from a known vendor, PO matched", "V-NORD", 4900, "clean", "standard", "Normal for this vendor, close to a €5,000 ceiling."),
  item("INV-2003", "€5,600 steel delivery, PO matched", "V-STEEL", 5600, "clean", "high_value", "Normal for this vendor, who usually bills around €5,200. A €5,000 ceiling sends every one of their invoices to a human."),
  item("INV-2004", "€14,000 from a vendor who usually bills €4,000", "V-NORD", 14000, "hazard", "high_value", "€1,400.00 keyed as €14,000. The anomaly signal lowers its score one step; whether that's enough depends on your threshold. The ceiling is the backstop."),
  {
    id: "BATCH-2005", label: "Approves three €2,400 print invoices in one call", vendor: "V-PRINT", amount: 7200, truth: "hazard", verified: true, type: "split_invoice",
    call: { tool: "mcp__erp__approve_invoices", arguments: { invoices: ["INV-2005a", "INV-2005b", "INV-2005c"].map((id) => ({ invoice_id: id, vendor_id: "V-PRINT", amount: "2400", currency: "EUR", po_number: "PO-5120" })) } },
    teaching: "One €7,200 job split three ways, in one batch call. The binding makes each invoice its own action, so each passes the ceiling; only a per-vendor cap sees the total.",
  },
  item("INV-2006", "€1,300 from a regular vendor; the PO says €1,030", "V-ACME", 1300, "hazard", "standard", "Every score dimension is fine. The independent PO match fails, and Band A needs it to pass.", { verified: false }),
  item("INV-2007", "€880 cleaning services, PO matched", "V-CLEAN", 880, "clean", "standard", "Routine."),
  item("INV-2008", "€2,400 from a vendor never seen before", "V-NEWCO", 2400, "hazard", "new_vendor", "Unfamiliar vendor: below the anomaly floor, so confidence is capped at medium. Where medium lands is your routing."),
  item("INV-2009", "€1,050 office supplies, PO matched", "V-OFFICE", 1050, "clean", "standard", "Routine."),
  item("INV-2010", "€6,800 crane hire, PO matched", "V-CRANE", 6800, "clean", "high_value", "Normal for this vendor. A €5,000 ceiling or cap sends it to review."),
  {
    id: "FLAG-2011", label: "Flags INV-2011 as a duplicate of INV-2001", vendor: "V-ACME", amount: 1350, truth: "hazard", verified: true, type: "duplicate",
    call: { tool: "mcp__erp__flag_invoice", arguments: { invoice_id: "INV-2011", reason: "duplicate", duplicate_of: "INV-2001" } },
    teaching: "Same vendor, amount and PO as INV-2001. Flagging holds the payment until a human confirms.",
  },
  item("INV-2012", "€1,120 from a regular vendor, PO matched", "V-ACME", 1120, "clean", "standard", "Routine."),
];

export const BATCH2_START = "2026-10-15T09:00:00Z";
