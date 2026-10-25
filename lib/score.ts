import type { RoundResult, ScoreBreakdown } from "./types";

/** Average scores across rounds — each dimension /20, total /100. */
export function totalScore(rounds: RoundResult[]): ScoreBreakdown {
  if (rounds.length === 0) {
    return { efficiency: 0, riskControl: 0, compliance: 0, adaptability: 0, enforcement: 0 };
  }
  const sum = rounds.reduce<ScoreBreakdown>(
    (acc, r) => ({
      efficiency: acc.efficiency + r.score.efficiency,
      riskControl: acc.riskControl + r.score.riskControl,
      compliance: acc.compliance + r.score.compliance,
      adaptability: acc.adaptability + r.score.adaptability,
      enforcement: acc.enforcement + (r.score.enforcement ?? 10),
    }),
    { efficiency: 0, riskControl: 0, compliance: 0, adaptability: 0, enforcement: 0 }
  );
  return {
    efficiency: Math.round(sum.efficiency / rounds.length),
    riskControl: Math.round(sum.riskControl / rounds.length),
    compliance: Math.round(sum.compliance / rounds.length),
    adaptability: Math.round(sum.adaptability / rounds.length),
    enforcement: Math.round(sum.enforcement / rounds.length),
  };
}

export function totalNumeric(score: ScoreBreakdown): number {
  return (
    score.efficiency +
    score.riskControl +
    score.compliance +
    score.adaptability +
    (score.enforcement ?? 0)
  );
}
