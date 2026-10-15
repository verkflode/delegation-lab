// The shareable profile for a v5 game: the same seven archetypes as before, chosen from what the v5 rounds
// showed and described in VAOM 5.0's terms. The Lab score drives the card; the core's scorecard sits beside it.
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

export const ARCHETYPES_V5: Record<ProfileArchetype, { name: string; quote: string; assessment: string }> = {
  cautious_architect: {
    name: "The Cautious Architect",
    quote: "Nothing bad ran. Neither did much else.",
    assessment:
      "Your matrix kept the hazards away from Band A, and your reviewers saw everything that mattered. They also saw a great deal that didn't: routine invoices waited for people the agent was meant to spare, and review hours went to work no one needed checked.\n\nBefore an agent runs on this design, let calibration do its job. Set the error target you can defend, take the threshold the sample supports, and let Band A carry what it earns. The ceiling, the cap and the PO check are there so the score doesn't have to be perfect.",
  },
  speed_optimizer: {
    name: "The Speed Optimizer",
    quote: "Fast, and fast at the things that should have waited.",
    assessment:
      "Routine invoices flowed and reviewers weren't flooded. But the same openness let hazards through: a new vendor, an unusual amount, a split that every single invoice hid. Confidence was carrying authority it was never meant to carry.\n\nBefore going live, put limits under the score: a calibrated threshold, a value ceiling, a cumulative cap per vendor, an independent check for Band A. Speed is defensible when it is bounded. Here it was the goal.",
  },
  compliance_hawk: {
    name: "The Compliance Hawk",
    quote: "Every control in place, and a queue to prove it.",
    assessment:
      "Your matrix lints clean, your boundaries hold and your oversight plan would satisfy an auditor. The cost is throughput: invoices that calibration would have let run went to people instead, and people are the scarcest thing in the design.\n\nThe next step is trust where the evidence supports it. Readiness Condition 6 asks for oversight that is funded and effective; spending it on decisions the sample already vouches for makes it neither.",
  },
  balanced_operator: {
    name: "The Balanced Operator",
    quote: "A defensible design with a few edges still showing.",
    assessment:
      "You named the decisions, routed them sensibly, set limits that caught most of what they were for, and kept the review load inside what was funded. Something still got through somewhere, and the debriefs named it.\n\nClose those edges and this is a design an agent could run on: check the hidden decisions, put a cap where a ceiling can be split, and make sure every boundary you rely on has been tried by a probe, not just claimed.",
  },
  delegation_natural: {
    name: "The Delegation Natural",
    quote: "The right decisions named, the right limits set, and the review worth its hours.",
    assessment:
      "You found the decisions hiding in the workflow, profiled them honestly, calibrated instead of guessing, and reviewed like someone who expected to find errors. Hazards were held, routine work ran, and the oversight you funded did real work.\n\nWhat remains for production is evidence over time: real volumes, recalibration under change control, and a scorecard read every quarter. The design itself needs no rework.",
  },
  paper_tiger: {
    name: "The Paper Tiger",
    quote: "Your boundary was absent on paper and present in the manifest.",
    assessment:
      "Your matrix and limits were good. Then the night showed that a boundary you claimed as absent was only held by the Guardian's refusal: the tool had been in the agent's manifest since Tuesday, and nothing tried to cross the boundary between that day and the night. A Guardian refusal is policy. It held, and it was not what you had claimed.\n\nControls are proven, not presumed. Probe every boundary on a schedule and whenever the agent's tools change, and count a boundary at the strength it was last shown to have. Then replay the night.",
  },
  vault_builder: {
    name: "The Vault Builder",
    quote: "The bank doesn't tell the teller the vault limit. You checked the vault.",
    assessment:
      "Your boundary had been tried and found holding, so at 02:14 there was nothing to call. Sub-agents could only ever hold a narrower slice of authority, and when the agent reached past its limits a breaker fired and woke a named person. Nothing got through, and you can show why.\n\nWhat remains is the ordinary work of keeping it so: probes on schedule, re-attestation, a scorecard read every quarter. The design is done. The proof has to keep being renewed.",
  },
};
