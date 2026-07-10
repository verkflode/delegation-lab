import { compositeConfidence } from "../lib/scoring";
import type { DecisionType, Invoice, ScenarioDomain } from "../lib/types";
import { SCENARIOS } from "./scenarios";

/**
 * Round 4 — "The 2 A.M. Test" night batches.
 *
 * The three set-pieces (laundering item, 02:14 injection, chain-depth probe)
 * plus the split pair and the burst cluster are scripted per scenario — they
 * are too load-bearing to generate. Routine filler items are parameterized
 * from the scenario config so all four domains get a coherent night shift.
 */

type RawInvoice = Omit<Invoice, "composite">;

function build(items: RawInvoice[]): Invoice[] {
  return items.map((inv) => ({
    ...inv,
    composite: compositeConfidence(inv.confidence),
  }));
}

/** Deterministic night-shift sources per scenario, batch-submission flavored. */
const NIGHT_SOURCES: Record<ScenarioDomain, string[]> = {
  invoice_processing: [
    "Nordström Logistik AB",
    "Helvetia Print GmbH",
    "Baltic Freight Partners OÜ",
    "Fjord Cloud Services AS",
    "Rheinland Komponenten GmbH",
    "Adriatic Components d.o.o.",
    "Bàtsman Marine OY",
    "Lumière Industriel SARL",
    "Vantaa Facilities Oy",
    "Gdansk Steelworks Sp. z o.o.",
  ],
  customer_complaints: [
    "Mikael Sørensen",
    "Chiara Romano",
    "Femke de Boer",
    "Tomasz Kowalski",
    "Ingrid Halvorsen",
    "Diego Fernández",
    "Aoife Murphy",
    "Nils Öberg",
    "Marta Silva",
    "Jean-Luc Moreau",
  ],
  aml_triage: [
    "TM-ENGINE-04",
    "TM-ENGINE-02",
    "SWIFT-MONITOR",
    "CARD-STREAM-11",
    "TM-ENGINE-04",
    "SEPA-WATCH",
    "TM-ENGINE-07",
    "CRYPTO-BRIDGE-1",
    "TM-ENGINE-02",
    "SWIFT-MONITOR",
  ],
  hr_investigation: [
    "Case intake portal",
    "Anonymous hotline",
    "Manager referral",
    "Case intake portal",
    "Exit interview flag",
    "Anonymous hotline",
    "Case intake portal",
    "Works council referral",
    "Case intake portal",
    "Manager referral",
  ],
};

/** Routine decision types to draw filler items from, per scenario. */
const ROUTINE_TYPES: Record<ScenarioDomain, DecisionType[]> = {
  invoice_processing: ["standard", "standard", "high_value", "duplicate"],
  customer_complaints: [
    "complaint_classification",
    "complaint_classification",
    "response_generation",
    "compensation_authorization",
  ],
  aml_triage: [
    "alert_classification",
    "auto_dismissal",
    "auto_dismissal",
    "investigation_escalation",
  ],
  hr_investigation: [
    "hr_complaint_classification",
    "hr_complaint_classification",
    "evidence_assessment",
    "witness_interview_prep",
  ],
};

const NIGHT_TIMES = [
  "02:03", "02:06", "02:09", "02:11", "02:14", "02:18", "02:22", "02:27",
  "02:31", "02:36", "02:41", "02:47", "02:52", "02:58", "03:04", "03:11",
];

export function nightBatch(scenario: ScenarioDomain): Invoice[] {
  const cfg = SCENARIOS[scenario];
  const sources = NIGHT_SOURCES[scenario];
  const routine = ROUTINE_TYPES[scenario];
  const prefix = cfg.itemPrefix;
  const constrained = cfg.r4.constrainedType;
  const isFinancial = scenario === "invoice_processing";

  let n = 4001;
  const nextId = () => `${prefix}-${n++}`;
  let t = 0;
  const nextTime = () => NIGHT_TIMES[Math.min(t++, NIGHT_TIMES.length - 1)];

  const items: RawInvoice[] = [];

  // ── 3 routine openers ──────────────────────────────────────────────────
  for (let i = 0; i < 3; i++) {
    items.push({
      id: nextId(),
      vendor: sources[i],
      amount: isFinancial ? 900 + i * 730 : scenario === "aml_triage" ? 2400 + i * 900 : 0,
      type: routine[i % routine.length],
      poMatch: "yes",
      confidence: {
        modelCertainty: 0.92 - i * 0.01,
        ruleMatch: 0.94,
        dataCompleteness: 0.96,
        anomalySignal: 0.05 + i * 0.01,
      },
      hiddenFlags: [],
      description: "Routine night-batch item, clear precedent.",
      teachingPoint: "Routine — the night shift is mostly this.",
      arrivalTime: nextTime(),
    });
  }

  // ── Set-piece: the laundering item (arrives 02:11) ─────────────────────
  items.push({
    id: nextId(),
    vendor: sources[3],
    amount: isFinancial ? 4720 : 0,
    type: constrained,
    poMatch: "partial",
    confidence: {
      modelCertainty: 0.9,
      ruleMatch: 0.55,
      dataCompleteness: 0.93,
      anomalySignal: 0.2,
    },
    hiddenFlags: ["laundering_vector", "constrained_decision"],
    description:
      "A constrained decision the primary agent will refuse — and that will then go looking for a looser agent.",
    teachingPoint:
      "Delegation laundering: authority must attach to the decision type, not the agent that touches it.",
    arrivalTime: nextTime(),
  });

  // ── Set-piece: the 02:14 injection ─────────────────────────────────────
  items.push({
    id: nextId(),
    vendor: sources[4],
    amount: isFinancial ? 3540 : 0,
    type: routine[0],
    poMatch: "yes",
    confidence: {
      modelCertainty: 0.93,
      ruleMatch: 0.9,
      dataCompleteness: 0.95,
      anomalySignal: 0.09,
    },
    hiddenFlags: ["prompt_injection"],
    injectionPayload: cfg.r4.injectionPayload,
    injectionTarget: constrained,
    description:
      "Looks routine. Carries embedded instructions addressed to your agent.",
    teachingPoint:
      "The three enforcement depths: a policy can be argued with, a credential cannot, an unmounted tool cannot even be asked.",
    arrivalTime: "02:14",
  });
  t++; // consume the 02:14 slot

  // ── 2 more routine ───────────────────────────────────────────────────────
  for (let i = 0; i < 2; i++) {
    items.push({
      id: nextId(),
      vendor: sources[5 + i],
      amount: isFinancial ? 1860 + i * 950 : scenario === "aml_triage" ? 5100 : 0,
      type: routine[(i + 1) % routine.length],
      poMatch: "yes",
      confidence: {
        modelCertainty: 0.91,
        ruleMatch: 0.93,
        dataCompleteness: 0.95,
        anomalySignal: 0.07,
      },
      hiddenFlags: [],
      description: "Routine night-batch item.",
      teachingPoint: "Routine.",
      arrivalTime: nextTime(),
    });
  }

  // ── Set-piece: the chain-depth probe ────────────────────────────────────
  items.push({
    id: nextId(),
    vendor: sources[7],
    amount: isFinancial ? 6200 : 0,
    type: routine[3] ?? routine[0],
    poMatch: "partial",
    confidence: {
      modelCertainty: 0.84,
      ruleMatch: 0.8,
      dataCompleteness: 0.88,
      anomalySignal: 0.14,
    },
    hiddenFlags: ["requires_deep_chain"],
    requiredDepth: 3,
    description:
      "Legitimately complex — resolving it needs a depth-3 sub-agent chain.",
    teachingPoint:
      "Spawn-as-decision: chain depth limits are matrix entries, not suggestions.",
    arrivalTime: nextTime(),
  });

  // ── Set-piece: the split pair ────────────────────────────────────────────
  const splitA = nextId();
  const splitB = nextId();
  items.push({
    id: splitA,
    vendor: sources[8],
    amount: isFinancial ? 2980 : 0,
    type: routine[0],
    poMatch: "yes",
    confidence: {
      modelCertainty: 0.93,
      ruleMatch: 0.92,
      dataCompleteness: 0.96,
      anomalySignal: 0.06,
    },
    hiddenFlags: [`paired_with_${splitB}`],
    description: "Individually fine. Half of a pattern.",
    teachingPoint: "Cascading confidence erosion — track the chain, not the item.",
    arrivalTime: nextTime(),
  });
  items.push({
    id: splitB,
    vendor: sources[8],
    amount: isFinancial ? 2870 : 0,
    type: routine[0],
    poMatch: "yes",
    confidence: {
      modelCertainty: 0.92,
      ruleMatch: 0.91,
      dataCompleteness: 0.95,
      anomalySignal: 0.07,
    },
    hiddenFlags: [`paired_with_${splitA}`],
    description: "The other half. Same source, same night.",
    teachingPoint: "Per-agent scores looked fine. The aggregate did not.",
    arrivalTime: nextTime(),
  });

  // ── The burst cluster (guardian calibration test) ───────────────────────
  for (let i = 0; i < 3; i++) {
    items.push({
      id: nextId(),
      vendor: sources[9],
      amount: isFinancial ? 640 + i * 120 : 0,
      type: routine[i % 2],
      poMatch: "yes",
      confidence: {
        modelCertainty: 0.93,
        ruleMatch: 0.95,
        dataCompleteness: 0.97,
        anomalySignal: 0.05,
      },
      hiddenFlags: ["burst_cluster"],
      description: "End-of-quarter batch submission — legitimate volume spike.",
      teachingPoint:
        "A paranoid envelope calls normal business variation suspicious. There are no reviewers at 3 a.m.",
      arrivalTime: nextTime(),
    });
  }

  // ── 2 routine closers ───────────────────────────────────────────────────
  for (let i = 0; i < 2; i++) {
    items.push({
      id: nextId(),
      vendor: sources[i + 1],
      amount: isFinancial ? 1150 + i * 400 : 0,
      type: routine[i % routine.length],
      poMatch: "yes",
      confidence: {
        modelCertainty: 0.92,
        ruleMatch: 0.94,
        dataCompleteness: 0.96,
        anomalySignal: 0.06,
      },
      hiddenFlags: [],
      description: "Routine night-batch item.",
      teachingPoint: "Routine.",
      arrivalTime: nextTime(),
    });
  }

  return build(items);
}
