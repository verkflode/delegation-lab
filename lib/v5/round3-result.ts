// Round 3 in the shape the rest of the game reads, and VAOM's briefing and debrief for it. The score is
// interim (M4 replaces it with the scorecard); the verdicts quoted in the debrief are the core's.
import type { RoundItem, RoundResult, ScoreBreakdown } from "../types";
import type { Click, ReviewChoice, Shift, ShiftResult } from "./round3";
import type { V5Scenario } from "./scenario";

const clamp = (n: number) => Math.max(0, Math.min(20, Math.round(n)));

export function round3Result(sc: V5Scenario, shift: Shift, clicks: Record<string, Click>, verdict: ShiftResult, choice: ReviewChoice, neededHours: number): RoundResult {
  const items: RoundItem[] = shift.asks.map((a) => {
    const c = clicks[a.key]?.decision ?? "expired";
    const outcome: RoundItem["outcome"] = c === "expired" ? "missed" : c === a.correct ? "good" : c === "approve" ? "risky" : "wasteful";
    return { id: a.seed ? `SEED · ${a.seed.id}` : a.record.id.replace(/^lab-/, ""), label: a.label, teaching: a.why, band: "human_review", outcome, reason: a.why };
  });
  const bad = shift.asks.filter((a) => a.correct === "reject"), good = shift.asks.filter((a) => a.correct === "approve");
  const decided = (a: (typeof shift.asks)[number]) => clicks[a.key]?.decision;
  const breaches = Object.values(verdict.engagement).filter((m) => m.status === "breach").length + Object.values(verdict.detection).filter((m) => m.status === "breach").length;
  // Hours funded well past what the load needs are paid for and unused.
  const surplus = Math.max(0, choice.fundedHours * 0.8 - neededHours * 1.5);
  const score: ScoreBreakdown = {
    efficiency: clamp((20 * good.filter((a) => decided(a) === "approve").length) / (good.length || 1) - surplus / 5),
    riskControl: clamp((20 * bad.filter((a) => decided(a) === "reject").length) / (bad.length || 1) - 3 * verdict.executedBad.length),
    compliance: clamp(20 - 6 * breaches),
    adaptability: 10,
    enforcement: 10,
  };
  return { round: 3, items, score, incidents: verdict.executedBad.map((a) => a.record.id), v5Evidence: { records: verdict.records, seeds: verdict.seeds } };
}

export function round3Debrief(result: RoundResult, verdict: ShiftResult, choice: ReviewChoice): string {
  const out: string[] = [];
  const total = result.items.length;
  const expired = verdict.wrong.filter((w) => w.click.decision === "expired").length;
  out.push(expired === 0
    ? `You decided ${total} asks and got ${verdict.correct} right. ${verdict.medianGameSeconds !== null ? `Your median review took ${Math.round(verdict.medianGameSeconds)} seconds of game time.` : "You let every ask expire."}`
    : expired === total
      ? `You let all ${total} asks expire. An expired ask is denied: nobody chose that outcome.`
      : `Of ${total} asks, ${expired} expired before you decided; an expired ask is denied, and nobody chose that. You decided ${total - expired} and got ${verdict.correct} right. Your median review took ${Math.round(verdict.medianGameSeconds ?? 0)} seconds of game time.`);

  const diag = Object.entries(verdict.engagement).filter(([, m]) => m.diagnosis);
  if (diag.length) out.push(`The scorecard's verdict on review engagement: ${diag.map(([row, m]) => `${row}, ${m.diagnosis}`).join("; ")}. It reads only the records, aggregated per row, never per person. It doesn't need to know who you are to see it.`);
  else if (Object.values(verdict.engagement).some((m) => m.status === "insufficient-sample")) out.push(`The scorecard couldn't judge review engagement: too few reviews were decided for a verdict, even at the game's lowered minimum.${expired ? " Expired asks aren't reviews." : ""}`);
  else out.push("The scorecard found review engaged: approvals weren't automatic, and reviews took plausible time. On a sample this small that's a hint, not proof; the Guardian's defaults need twenty decided reviews before they give a verdict.");

  if (verdict.executedBad.length) {
    const a = verdict.executedBad[0];
    out.push(`${a.label} executed on your approval. ${a.why} An approval is an authority record: from here on, that one is yours.`);
  }

  const seeded = Object.values(choice.seedRows).some(Boolean);
  if (seeded) {
    out.push(verdict.missedSeeds
      ? `You approved ${verdict.missedSeeds} planted ${verdict.missedSeeds === 1 ? "case" : "cases"}. Nothing happened, because planted cases never execute. That is the point of them: they measure whether review catches errors before a real one teaches you.`
      : `You caught ${verdict.detectedSeeds} of ${verdict.detectedSeeds} planted ${verdict.detectedSeeds === 1 ? "case" : "cases"}. You were told they existed; disclosure is the rule, and it doesn't make them easier to spot.`);
  } else {
    out.push("You planted no cases, so review engagement is the only evidence that review works. Approval share and time per review can show rubber-stamping. Only a known error shows whether anyone would catch one.");
  }
  if (choice.reviewerMetrics) out.push("You also turned on per-reviewer metrics. That is employee monitoring; the matrix let it run only with a recorded approval behind it.");
  out.push("The night shift is next, and tonight you won't be awake to review anything.");
  return out.join("\n\n");
}
