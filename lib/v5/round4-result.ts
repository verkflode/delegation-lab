// Round 4 in the shape the rest of the game reads, and VAOM's briefing and morning debrief. The score is
// interim (M4 replaces it with the scorecard); the verdicts quoted are the core's.
import type { Invoice, ProcessedInvoice, RoundResult, RoutingBand, ScoreBreakdown } from "../types";
import { resolveRecord } from "@verkflode/vaom-guardian-core";
import { NIGHT_END, type Night, type NightChoice } from "./round4";

const clamp = (n: number) => Math.max(0, Math.min(20, Math.round(n)));

export function round4Result(night: Night, c: NightChoice, warnings: number): RoundResult {
  const events = night.events.filter((e) => e.kind !== "breaker" && e.kind !== "info");
  const processed: ProcessedInvoice[] = events.map((e) => {
    const o = e.record?.decision.outcome;
    const band: RoutingBand = o === "allow" ? "auto_approve" : o === "review" ? "human_review" : o === "escalate" ? "escalation" : "blocked";
    const invoice: Invoice = {
      id: e.id, vendor: "", amount: 0, type: "standard", poMatch: "yes",
      confidence: { modelCertainty: 0, ruleMatch: 0, dataCompleteness: 0, anomalySignal: 0 }, composite: 0,
      hiddenFlags: e.hazard ? ["night_hazard"] : [], description: e.actor === "agent" ? `The main agent: ${e.label}` : e.label, teachingPoint: e.text,
    };
    return { invoice, band: e.kind === "spawn" ? (e.text.includes(": allowed") ? "auto_approve" : "blocked") : band, patternUsed: null, outcome: e.verdict === "neutral" ? "good" : e.verdict, reason: e.text };
  });
  const hazards = events.filter((e) => e.hazard), routine = events.filter((e) => !e.hazard);
  const risky = hazards.filter((e) => e.verdict === "risky").length;
  const paperTiger = night.pre.toolPresent && c.bank.mechanism !== "policy";
  const enforcement =
    (night.pre.toolPresent ? (c.bank.mechanism === "policy" ? 5 : 0) : 8) +
    (night.spawns.some((s) => s.decision === "allow" && events.some((e) => e.kind === "spawn" && e.verdict === "risky")) ? 0 : 6) +
    (c.breakers.outOfBounds !== "off" && c.breakers.notify ? 6 : c.breakers.outOfBounds !== "off" ? 3 : 0);
  const score: ScoreBreakdown = {
    efficiency: clamp((20 * routine.filter((e) => e.verdict === "good").length) / (routine.length || 1)),
    riskControl: clamp((20 * hazards.filter((e) => e.verdict === "good").length) / (hazards.length || 1) - 4 * risky),
    compliance: clamp(20 - 3 * warnings - (c.breakers.notify ? 0 : 5) - (paperTiger ? 5 : 0)),
    adaptability: 10,
    enforcement: clamp(enforcement),
  };
  // Asks left overnight expired at six; executed calls ran.
  const records = night.events.flatMap((e) => {
    const r = e.record;
    if (!r) return [];
    const o = r.decision.outcome;
    if (o === "review" || o === "escalate") return [resolveRecord(r, { ts: NIGHT_END, result: "expired" })];
    if (o === "allow") return [resolveRecord(r, { ts: r.request.ts, result: "executed" })];
    return [resolveRecord(r, { ts: r.request.ts, result: "not-executed" })];
  });
  return {
    round: 4, processed, score, incidents: events.filter((e) => e.verdict === "risky").map((e) => e.id), antiPatterns: [],
    v5Evidence: { records, spawns: night.spawns, probes: night.pre.probes },
    v5Flags: {
      paperTiger,
      nothingThrough: risky === 0,
      breakerOwned: c.breakers.outOfBounds !== "off" && !!c.breakers.notify,
      toolAbsent: !night.pre.toolPresent,
    },
  };
}

export const ROUND4_BRIEFING = [
  "It is two in the morning. Your agent is awake. You are not.",
  "Before you sleep, decide three things. How far authority may travel: which sub-agents your agent may spawn, how deep, and whether a child may ever do more than ask. Which boundaries are real: a boundary you claim is only as strong as the last probe that checked it. And what happens when something reaches past its limits: a breaker that suspends, or one that only alerts, and who it wakes.",
  "Everything tonight is decided by the VAOM Guardian against your matrix. A Guardian's refusal is policy: it holds because the Guardian holds. A capability that isn't there at all is stronger. Find out which of yours is which.",
].join("\n\n");

export function round4Debrief(night: Night, c: NightChoice): string {
  const out: string[] = [];
  const risky = night.events.filter((e) => e.verdict === "risky");
  const bank = night.boundaries.find((b) => b.boundary === "no-bank-write");
  out.push(
    night.pre.toolPresent && c.bank.mechanism !== "policy"
      ? `Your bank-details boundary was claimed ${c.bank.mechanism} and counted as ${bank?.status ?? "unknown"}, off a probe from ${bank?.last?.ts.slice(0, 10) ?? "never"}. The tool had been in the agent's manifest since Tuesday. At 02:14 it held only because the Guardian didn't know the tool and refused to guess. That is policy strength, wearing the label of absence.`
      : night.pre.toolPresent
        ? "You claimed the bank-details boundary at policy strength, and policy is what held at 02:14: the Guardian refused a non-delegable capability. An honest claim. A probe will never tell you it's stronger than it is."
        : `A probe saw the bank-details tool ${night.pre.detected ? `on ${night.pre.detected.ts.slice(0, 10)}` : "before the night"}, the owner removed it, and at 02:14 there was nothing to call. That is what absent means, and it only means it because something checked.`,
  );
  out.push(
    night.suspendedAt
      ? `A breaker suspended the agent at ${night.suspendedAt.slice(11, 16)}${night.paged.length ? ` and woke ${night.paged[0].slice(6).toLowerCase()}` : ", and told nobody"}. Everything after that waited for the morning: safe, and a backlog.`
      : night.paged.length
        ? "Your breakers only alerted. Someone was paged, and the agent kept working with whatever had just tried to misuse it."
        : "No breaker stopped the agent. After the injected instruction, it kept working all night.",
  );
  if (risky.length) out.push(`What got through: ${risky.map((e) => e.label.replace(/\.$/, "")).join("; ")}.`);
  else out.push("Nothing got through.");
  const verdicts = `chain integrity ${night.chainIntegrity.status}${night.chainIntegrity.diagnosis ? `, ${night.chainIntegrity.diagnosis}` : ""}; boundary verification ${night.boundaryVerification.status}${night.boundaryVerification.diagnosis ? `, ${night.boundaryVerification.diagnosis}` : ""}`;
  const blind = (night.pre.toolPresent && c.bank.mechanism !== "policy") || risky.some((e) => e.kind === "spawn");
  out.push(blind && night.chainIntegrity.status !== "breach" && night.boundaryVerification.status !== "breach"
    ? `The scorecard on the night: ${verdicts}. It judges the evidence it is given: a probe that was within its schedule, spawns your matrix allowed. A healthy scorecard over a weak design is the design's verdict, not the scorecard's.`
    : `The scorecard on the night: ${verdicts}.`);
  out.push("Policy that cannot be checked is a wish. Your matrix, your limits, your review and your boundaries were all read by the same core tonight. The scorecard is next.");
  return out.join("\n\n");
}
