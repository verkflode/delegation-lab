// Round 2, "The Gate", on the VAOM Guardian core.
//
// The player sets the gated row's limits. The threshold for Band A isn't set directly: the matrix
// schema says the threshold is an output of the calibration record, not an input. So the player picks an
// error target, the Lab runs a learn-then-test on a calibration sample (fixed-sequence testing, one-sided
// Clopper-Pearson bound at 95%), and the threshold the test supports goes into the matrix with its
// calibration record. If no threshold passes, there is no record, and the linter keeps Band A shut.
// The player also sets the medium threshold, the value ceiling and the cumulative cap, then the day's
// batch runs through decide() as in round 1. The sample, the volumes and the batch come from the scenario.
import { runBatch, type Round1Policy, type Round1Run } from "./round1";
import type { Gate, Level, V5Scenario } from "./scenario";

// ── Calibration ────────────────────────────────────────────────────────────

export const sampleSize = (sc: V5Scenario) => sc.round2.sample.reduce((a, b) => a + b.n, 0);
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
export function calibrate(sc: V5Scenario, target: number): Calibration {
  const steps: CalibrationStep[] = [];
  let threshold: number | null = null, n = 0, errors = 0;
  for (const b of sc.round2.sample) {
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

/** The share of the gated row's decisions above a value, from the scenario's curve. */
export function shareOver(sc: V5Scenario, amount: number): number {
  const OVER = sc.round2.over;
  if (amount <= OVER[0][0]) return OVER[0][1];
  for (let i = 1; i < OVER.length; i++) {
    const [a0, s0] = OVER[i - 1], [a1, s1] = OVER[i];
    if (amount <= a1) return Math.exp(Math.log(s0) + ((Math.log(amount) - Math.log(a0)) / (Math.log(a1) - Math.log(a0))) * (Math.log(s1) - Math.log(s0)));
  }
  return OVER[OVER.length - 1][1];
}

function volumeByLevel(sc: V5Scenario, high: number, medium: number): Partial<Record<Level, number>> {
  const out: Partial<Record<Level, number>> = {};
  const size = sampleSize(sc);
  for (const b of sc.round2.sample) {
    const level: Level = b.score >= high ? "high" : b.score >= medium ? "medium" : "low";
    out[level] = Math.round((out[level] ?? 0) + (sc.round2.weekly * b.n) / size);
  }
  return out;
}

// ── The player's gate ──────────────────────────────────────────────────────

export interface GateChoice {
  errorTarget: number;
  medium: number;
  ceiling: number;
  onExceed: "B" | "C";
  /** The cumulative cap's total; null for none. */
  cap: number | null;
}

export const MEDIUM_OPTIONS = [0.5, 0.6, 0.7, 0.75, 0.8, 0.875];

export function startingGate(sc: V5Scenario): GateChoice {
  return { ...sc.round2.startingGate };
}

/** The gate the player's choices produce. With no calibrated threshold, high sits at 1.0 and there is no
 *  calibration record, so a row routing anything to Band A fails lint. */
export function toGate(sc: V5Scenario, c: GateChoice): Gate & { calibrationRun: Calibration } {
  const cal = calibrate(sc, c.errorTarget);
  const high = cal.threshold ?? 1;
  const medium = Math.min(c.medium, high);
  return {
    thresholds: { high, medium },
    calibration: cal.threshold === null ? null : {
      errorTarget: c.errorTarget, confidenceLevel: CONFIDENCE, sampleSize: sampleSize(sc), sampleDate: sc.round2.sampleDate,
      sampleRef: "placeholder://lab/calibration-sample", method: "learn-then-test",
    },
    ceiling: { amount: c.ceiling, onExceed: c.onExceed },
    cap: c.cap,
    volume: volumeByLevel(sc, high, medium),
    overCeilingPerWeek: Math.round(sc.round2.weekly * shareOver(sc, c.ceiling)),
    version: "1.1.0",
    round: 2,
    calibrationRun: cal,
  };
}

/** The day's batch under the player's gate. */
export function runRound2(sc: V5Scenario, policy: Round1Policy, gate: Gate): Round1Run {
  return runBatch(sc, policy, gate, sc.round2.batch, sc.round2.start);
}
