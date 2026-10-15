// A v5 round's run in the shape the rest of the game reads (debrief, final score, profile), and VAOM's
// briefings and debriefs for rounds 1 and 2. The score is interim: M4 replaces it with the core's scorecard().
import type { GateChoice } from "./round2";
import type { Invoice, ProcessedInvoice, RoundResult, RoutingBand, ScoreBreakdown } from "../types";
import { CONTROLLER_GATE, DECISIONS, lintPolicy, type Gate, type Lane, type Round1Policy, type Round1Run, type Round1Step } from "./round1";

const BAND: Record<Lane, RoutingBand> = { A: "auto_approve", B: "human_review", C: "escalation", held: "blocked" };

function toProcessed(s: Round1Step): ProcessedInvoice {
  const score = s.record.decision.placements?.[0]?.score?.value ?? 0;
  const invoice: Invoice = {
    id: s.item.id,
    vendor: s.item.vendor,
    amount: s.item.amount,
    type: s.item.type,
    poMatch: s.item.verified ? "yes" : "no",
    confidence: { modelCertainty: score, ruleMatch: score, dataCompleteness: score, anomalySignal: 0 },
    composite: score,
    hiddenFlags: s.item.truth === "hazard" ? [s.item.type] : [],
    description: s.item.label,
    teachingPoint: s.item.teaching,
  };
  return { invoice, band: BAND[s.lane], patternUsed: null, outcome: s.verdict, reason: s.why };
}

const clamp = (n: number) => Math.max(0, Math.min(20, Math.round(n)));

export function v5Score(run: Round1Run, policy: Round1Policy, gate: Gate = CONTROLLER_GATE): ScoreBreakdown {
  const routine = run.steps.filter((s) => s.item.truth === "clean");
  const hazards = run.steps.filter((s) => s.item.truth === "hazard");
  const risky = hazards.filter((s) => s.verdict === "risky").length;
  const missing = DECISIONS.filter((d) => !policy[d.id].included).length;
  // The run only exists for a matrix that lints, so only warnings are left to count.
  const warnings = lintPolicy(policy, gate).lint.findings.filter((f) => f.severity === "warning").length;
  return {
    efficiency: clamp((20 * routine.filter((s) => s.verdict === "good").length) / (routine.length || 1)),
    riskControl: clamp((20 * hazards.filter((s) => s.verdict === "good").length) / (hazards.length || 1) - 4 * risky),
    compliance: clamp(20 - 5 * missing - 3 * warnings),
    adaptability: 10,
    enforcement: 10,
  };
}

export function v5Result(run: Round1Run, policy: Round1Policy, round: 1 | 2, gate: Gate = CONTROLLER_GATE): RoundResult {
  return {
    round,
    processed: run.steps.map(toProcessed),
    score: v5Score(run, policy, gate),
    incidents: run.steps.filter((s) => s.verdict === "risky" || s.verdict === "missed").map((s) => s.item.id),
    antiPatterns: [],
    v5Evidence: { records: run.steps.map((s) => s.record) },
  };
}

export const ROUND1_BRIEFING = [
  "Banks have managed structured decision authority for decades. Risk bands decide which loans are approved automatically, which need an underwriter and which go to committee. The score says how risky the loan is. The bands say who may decide it. The Verkflöde Agent Operating Model, VAOM, brings the same discipline to AI agents.",
  "Your agent runs accounts payable. Before it touches a single invoice, you write its delegation matrix: every decision it makes, what each one could cost, which band each confidence level lands in, and who answers for it. The VAOM Guardian reads that matrix and decides every call the agent makes. Nothing else does.",
  "Look carefully at the workflow. It contains more decisions than the obvious one. What your matrix doesn't name, the Guardian can't place.",
].join("\n\n");

/** VAOM's debrief for round 1, from what the run did. */
export function round1Debrief(result: RoundResult, policy: Round1Policy): string {
  const p = result.processed;
  const n = (band: RoutingBand) => p.filter((x) => x.band === band).length;
  const inMatrix = DECISIONS.filter((d) => policy[d.id].included);
  const missing = DECISIONS.filter((d) => !policy[d.id].included);
  const risky = p.filter((x) => x.outcome === "risky");
  const missed = p.filter((x) => x.outcome === "missed");
  const wasteful = p.filter((x) => x.outcome === "wasteful");
  const out: string[] = [];

  out.push(
    `Your matrix named ${inMatrix.length} of the ${DECISIONS.length} decisions in this workflow. Of ${p.length} calls, ${n("auto_approve")} ran in Band A, ${n("human_review")} went to a reviewer, ${n("escalation")} were escalated and ${n("blocked")} were held. ` +
      (risky.length ? `${risky[0].invoice.id} is among the ones that ran, and it should not have.` : "Nothing ran that should not have."),
  );

  if (risky.length) {
    const r = risky[0];
    out.push(`${r.invoice.id}: ${r.invoice.description}. ${r.reason} ${r.invoice.teachingPoint}`);
  } else if (missed.length) {
    const m = missed[0];
    out.push(`${m.invoice.id}: ${m.invoice.description}. ${m.reason} The Guardian fails closed: what the matrix doesn't name, it can't place, so it defers and the timeout denies. Safe, and nobody owns the gap.`);
  } else if (wasteful.length > 2) {
    out.push(`${wasteful.length} routine calls went to a human or were refused. The matrix kept everything safe by keeping the agent from working. Every one of those is reviewer time somebody has to fund.`);
  } else {
    out.push("Hazards were held, routine work ran, and the review load fits the funded hours. That is what a matrix is for.");
  }

  if (missing.length) {
    out.push(`Not in your matrix: ${missing.map((d) => d.title.toLowerCase()).join(" and ")}. A decision inventory finds the decisions hidden inside the obvious one before an agent finds them for you.`);
  }

  out.push(
    "A threshold says how sure the agent is. The matrix says what it may do, who answers for it, and what watching it costs. Every answer in this round came from the VAOM Guardian's core reading your matrix: the same code and the same file format an organisation would run.",
  );
  out.push("Round two hands you the dials this round kept fixed. The vocabulary is going to expand.");
  return out.join("\n\n");
}

export const ROUND2_BRIEFING = [
  "Last round the controller set the limits on invoice approval for you. This round they are yours: the error target, the thresholds, the value ceiling and the per-vendor cap.",
  "One of them you don't set directly. In VAOM the threshold for Band A is the output of a calibration, not a number someone liked. You choose how many wrong approvals you can tolerate; a test on 240 past approvals, checked by hand, tells you which threshold that supports, and with what confidence. Ask for more certainty than your sample can show, and there is no threshold at all.",
  "Every limit you tighten sends more invoices to people, and their hours are funded, not infinite. Every limit you loosen is a bet on the score. Wednesday's batch has been waiting for you.",
].join("\n\n");

/** VAOM's debrief for round 2. */
export function round2Debrief(result: RoundResult, gate: GateChoice, threshold: number | null): string {
  const p = result.processed;
  const risky = p.filter((x) => x.outcome === "risky");
  const wasteful = p.filter((x) => x.outcome === "wasteful");
  const out: string[] = [];
  const pct = (x: number) => `${+(x * 100).toFixed(1)} percent`;
  out.push(
    threshold === null
      ? `You asked for an error rate of ${pct(gate.errorTarget)}. The sample couldn't show it, so nothing was calibrated and nothing ran in Band A.`
      : `You asked for at most ${pct(gate.errorTarget)} wrong approvals in Band A, at 95 percent confidence. The sample supported a threshold of ${threshold}. ${p.filter((x) => x.band === "auto_approve").length} of ${p.length} calls ran in Band A.`,
  );
  if (risky.length) {
    const r = risky[0];
    out.push(`${r.invoice.id}: ${r.invoice.description}. ${r.reason} ${r.invoice.teachingPoint}`);
  } else if (wasteful.length) {
    const w = wasteful[0];
    out.push(`${w.invoice.id}: ${w.invoice.description}. ${w.reason} ${w.invoice.teachingPoint} Safe, and somebody's six minutes, every time.`);
  } else {
    out.push("Every hazard was held and every routine invoice ran. The score did some of that; the ceiling, the cap and the PO check did the rest. None of them alone would have.");
  }
  out.push(
    "Notice what caught what. The score lowered the unfamiliar vendor. The PO match, an independent check, stopped the invoice whose numbers all looked fine. The ceiling stopped the slipped decimal the score let through. The cap saw the split that every single invoice hid. Confidence informs authority. The limits define it.",
  );
  out.push("Every one of those Band B asks landed on a person. Next round, that person is you.");
  return out.join("\n\n");
}
