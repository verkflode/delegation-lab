// The shareable profile for a v5 game: seven archetypes, chosen from what the v5 rounds showed. Each
// scenario describes them in its own terms, in VAOM 5.0's (V5Scenario.archetypes). The Lab score drives
// the card; the core's scorecard sits beside it.
import type { ProfileArchetype, RoundResult, ScoreBreakdown } from "../types";

export function chooseArchetypeV5(rounds: RoundResult[]): ProfileArchetype {
  if (rounds.length === 0) return "balanced_operator";
  const avg = (key: keyof ScoreBreakdown) => rounds.reduce((s, r) => s + (r.score[key] ?? 0), 0) / rounds.length;
  const eff = avg("efficiency"), risk = avg("riskControl"), comp = avg("compliance");
  const total = eff + risk + comp + avg("adaptability") + avg("enforcement");
  const night = rounds.find((r) => r.round === 4);
  const flags = night?.v5Flags;
  if (flags) {
    // A sound design whose boundary was only ever written down.
    const gate = rounds.find((r) => r.round === 2);
    const designWasGood = (gate?.score.riskControl ?? 0) >= 14;
    if (flags.paperTiger && designWasGood) return "paper_tiger";
    // Nothing through, the boundary shown to hold, and a breaker that wakes someone.
    if (flags.nothingThrough && flags.toolAbsent && flags.breakerOwned && (night?.score.riskControl ?? 0) >= 16 && total >= 62) return "vault_builder";
  }
  if (total >= 82 && risk >= 17 && comp >= 16) return "delegation_natural";
  if (risk >= 16 && comp >= 16 && eff < 12) return "compliance_hawk";
  if (eff >= 17 && risk < 12) return "speed_optimizer";
  if (eff < 11 && risk >= 14) return "cautious_architect";
  return "balanced_operator";
}
