import { compositeConfidence } from "../lib/scoring";
import type { Invoice, RoundNumber } from "../lib/types";
import { VENDORS } from "./vendors";

/**
 * Pre-built invoice batches per round. Used when the Claude API is unavailable
 * or while the player is waiting for the dynamic batch to come back. The
 * teaching arc still works without ANY API call.
 *
 * Designs follow the spec table in §"Invoice Generation":
 *   60-70% routine, 30-40% configuration-test invoices.
 */

type RawInvoice = Omit<Invoice, "composite">;

function build(invoices: RawInvoice[]): Invoice[] {
  return invoices.map((inv) => ({
    ...inv,
    composite: compositeConfidence(inv.confidence),
  }));
}

let nextId = 1001;
function id(): string {
  return `INV-${nextId++}`;
}

// Reset id sequence per round so the IDs feel scoped to that scenario
function resetIds(start: number) {
  nextId = start;
}

// ────────────────────────────────────────────────────────────────────────────
// ROUND 1 — 8 invoices, mostly clean, 2 hidden hazards
// ────────────────────────────────────────────────────────────────────────────

export function round1Batch(): Invoice[] {
  resetIds(1001);
  return build([
    {
      id: id(),
      vendor: VENDORS[0],
      amount: 1240,
      type: "standard",
      poMatch: "yes",
      confidence: { modelCertainty: 0.94, ruleMatch: 0.96, dataCompleteness: 0.98, anomalySignal: 0.05 },
      hiddenFlags: [],
      description: "Routine logistics invoice, exact PO match.",
      teachingPoint: "Standard auto-approval candidate.",
    },
    {
      id: id(),
      vendor: VENDORS[1],
      amount: 870,
      type: "standard",
      poMatch: "yes",
      confidence: { modelCertainty: 0.91, ruleMatch: 0.93, dataCompleteness: 0.97, anomalySignal: 0.07 },
      hiddenFlags: [],
      description: "Recurring print services charge, on contract.",
      teachingPoint: "Standard.",
    },
    {
      id: id(),
      vendor: VENDORS[2],
      amount: 3120,
      type: "standard",
      poMatch: "yes",
      confidence: { modelCertainty: 0.92, ruleMatch: 0.94, dataCompleteness: 0.95, anomalySignal: 0.08 },
      hiddenFlags: [],
      description: "Catering for Q2 town hall.",
      teachingPoint: "Standard.",
    },
    {
      id: id(),
      vendor: VENDORS[3],
      amount: 4280,
      type: "standard",
      poMatch: "partial",
      confidence: { modelCertainty: 0.78, ruleMatch: 0.71, dataCompleteness: 0.88, anomalySignal: 0.18 },
      hiddenFlags: [],
      description: "Slightly off PO line item count, otherwise clean.",
      teachingPoint: "Borderline — should land in review band for most thresholds.",
    },
    {
      id: id(),
      vendor: VENDORS[4],
      amount: 2950,
      type: "standard",
      poMatch: "yes",
      confidence: { modelCertainty: 0.95, ruleMatch: 0.97, dataCompleteness: 0.99, anomalySignal: 0.04 },
      hiddenFlags: [],
      description: "Cloud infrastructure monthly bill.",
      teachingPoint: "Standard.",
    },
    {
      id: id(),
      vendor: VENDORS[5],
      amount: 1860,
      type: "standard",
      poMatch: "yes",
      confidence: { modelCertainty: 0.93, ruleMatch: 0.95, dataCompleteness: 0.96, anomalySignal: 0.06 },
      hiddenFlags: [],
      description: "Component supplier, recurring.",
      teachingPoint: "Standard.",
    },
    // ── Hazard 1: modified payment terms ────────────────────────────────────
    {
      id: id(),
      vendor: VENDORS[6],
      amount: 4720,
      type: "modified_terms",
      poMatch: "yes",
      confidence: { modelCertainty: 0.92, ruleMatch: 0.93, dataCompleteness: 0.95, anomalySignal: 0.12 },
      hiddenFlags: ["modified_terms_net15_with_2pct_discount"],
      description:
        "Familiar vendor, normal amount, but contract terms shifted from net-30 to net-15 with a 2% early-payment discount.",
      teachingPoint:
        "The Friday afternoon scenario: confidence is high, but the contractual modification falls outside the agent's delegated authority.",
    },
    // ── Hazard 2: new vendor ────────────────────────────────────────────────
    {
      id: id(),
      vendor: "Adriatic Components d.o.o.",
      amount: 3540,
      type: "new_vendor",
      poMatch: "no",
      confidence: { modelCertainty: 0.86, ruleMatch: 0.55, dataCompleteness: 0.78, anomalySignal: 0.22 },
      hiddenFlags: ["unverified_vendor"],
      description: "New supplier, no prior history, partial KYC documentation.",
      teachingPoint:
        "Vendor verification is a delegation question, not a confidence question.",
    },
  ]);
}

// ────────────────────────────────────────────────────────────────────────────
// ROUND 2 — 12 invoices, full edge-case mix
// ────────────────────────────────────────────────────────────────────────────

export function round2Batch(): Invoice[] {
  resetIds(2001);
  return build([
    {
      id: id(),
      vendor: VENDORS[7],
      amount: 1180,
      type: "standard",
      poMatch: "yes",
      confidence: { modelCertainty: 0.94, ruleMatch: 0.96, dataCompleteness: 0.97, anomalySignal: 0.06 },
      hiddenFlags: [],
      description: "Office supplies, on contract.",
      teachingPoint: "Standard.",
    },
    {
      id: id(),
      vendor: VENDORS[8],
      amount: 2240,
      type: "standard",
      poMatch: "yes",
      confidence: { modelCertainty: 0.92, ruleMatch: 0.93, dataCompleteness: 0.96, anomalySignal: 0.08 },
      hiddenFlags: [],
      description: "Workshop materials.",
      teachingPoint: "Standard.",
    },
    {
      id: id(),
      vendor: VENDORS[9],
      amount: 3680,
      type: "standard",
      poMatch: "yes",
      confidence: { modelCertainty: 0.91, ruleMatch: 0.94, dataCompleteness: 0.95, anomalySignal: 0.09 },
      hiddenFlags: [],
      description: "Architecture consulting.",
      teachingPoint: "Standard.",
    },
    {
      id: id(),
      vendor: VENDORS[10],
      amount: 4490,
      type: "standard",
      poMatch: "partial",
      confidence: { modelCertainty: 0.85, ruleMatch: 0.72, dataCompleteness: 0.88, anomalySignal: 0.16 },
      hiddenFlags: [],
      description: "Data services bill, partial PO match.",
      teachingPoint: "Borderline standard.",
    },
    // ── high value
    {
      id: id(),
      vendor: VENDORS[11],
      amount: 18750,
      type: "high_value",
      poMatch: "yes",
      confidence: { modelCertainty: 0.93, ruleMatch: 0.95, dataCompleteness: 0.97, anomalySignal: 0.05 },
      hiddenFlags: ["above_5k_threshold"],
      description: "Annual IT consulting contract instalment.",
      teachingPoint: "High-value invoices need human approval regardless of confidence.",
    },
    {
      id: id(),
      vendor: VENDORS[12],
      amount: 28400,
      type: "high_value",
      poMatch: "yes",
      confidence: { modelCertainty: 0.90, ruleMatch: 0.93, dataCompleteness: 0.96, anomalySignal: 0.07 },
      hiddenFlags: ["above_5k_threshold"],
      description: "Stationery framework agreement quarterly draw.",
      teachingPoint: "High-value.",
    },
    // ── duplicate
    {
      id: id(),
      vendor: VENDORS[13],
      amount: 2120,
      type: "duplicate",
      poMatch: "yes",
      confidence: { modelCertainty: 0.78, ruleMatch: 0.62, dataCompleteness: 0.95, anomalySignal: 0.42 },
      hiddenFlags: ["matches_invoice_INV-2003"],
      description: "Looks identical to a recent invoice from the same vendor.",
      teachingPoint:
        "Duplicate detection: should be Triage & Route, not auto-resolved.",
    },
    // ── modified terms (Friday afternoon scenario)
    {
      id: id(),
      vendor: VENDORS[14],
      amount: 4640,
      type: "modified_terms",
      poMatch: "yes",
      confidence: { modelCertainty: 0.91, ruleMatch: 0.92, dataCompleteness: 0.95, anomalySignal: 0.10 },
      hiddenFlags: ["modified_terms_net15_with_2pct_discount"],
      description:
        "Trusted vendor shifts from net-30 to net-15 with an early-payment discount. Confidence high, contractual change real.",
      teachingPoint: "Confidence informs authority — it does not define it.",
    },
    // ── new vendor
    {
      id: id(),
      vendor: "Hellenic Office Supplies S.A.",
      amount: 1520,
      type: "new_vendor",
      poMatch: "no",
      confidence: { modelCertainty: 0.83, ruleMatch: 0.48, dataCompleteness: 0.74, anomalySignal: 0.20 },
      hiddenFlags: ["unverified_vendor"],
      description: "First invoice from a vendor not yet onboarded.",
      teachingPoint: "Vendor verification — not a confidence question.",
    },
    // ── another standard
    {
      id: id(),
      vendor: VENDORS[15],
      amount: 1990,
      type: "standard",
      poMatch: "yes",
      confidence: { modelCertainty: 0.94, ruleMatch: 0.96, dataCompleteness: 0.97, anomalySignal: 0.05 },
      hiddenFlags: [],
      description: "Steel components, recurring.",
      teachingPoint: "Standard.",
    },
    {
      id: id(),
      vendor: VENDORS[16],
      amount: 3180,
      type: "standard",
      poMatch: "yes",
      confidence: { modelCertainty: 0.93, ruleMatch: 0.95, dataCompleteness: 0.96, anomalySignal: 0.06 },
      hiddenFlags: [],
      description: "Strategy consulting, monthly retainer.",
      teachingPoint: "Standard.",
    },
    {
      id: id(),
      vendor: VENDORS[17],
      amount: 2670,
      type: "standard",
      poMatch: "yes",
      confidence: { modelCertainty: 0.95, ruleMatch: 0.97, dataCompleteness: 0.98, anomalySignal: 0.04 },
      hiddenFlags: [],
      description: "Mining equipment service contract.",
      teachingPoint: "Standard.",
    },
  ]);
}

// ────────────────────────────────────────────────────────────────────────────
// ROUND 3 — 15 invoices including the split-invoice multi-agent scenario
// ────────────────────────────────────────────────────────────────────────────

export function round3Batch(): Invoice[] {
  resetIds(3001);
  return build([
    {
      id: id(),
      vendor: VENDORS[0],
      amount: 1490,
      type: "standard",
      poMatch: "yes",
      confidence: { modelCertainty: 0.94, ruleMatch: 0.96, dataCompleteness: 0.97, anomalySignal: 0.06 },
      hiddenFlags: [],
      description: "Logistics, recurring.",
      teachingPoint: "Standard.",
    },
    {
      id: id(),
      vendor: VENDORS[1],
      amount: 880,
      type: "standard",
      poMatch: "yes",
      confidence: { modelCertainty: 0.93, ruleMatch: 0.95, dataCompleteness: 0.96, anomalySignal: 0.06 },
      hiddenFlags: [],
      description: "Recurring print services.",
      teachingPoint: "Standard.",
    },
    {
      id: id(),
      vendor: VENDORS[2],
      amount: 2210,
      type: "standard",
      poMatch: "yes",
      confidence: { modelCertainty: 0.92, ruleMatch: 0.93, dataCompleteness: 0.96, anomalySignal: 0.07 },
      hiddenFlags: [],
      description: "Catering deposit.",
      teachingPoint: "Standard.",
    },
    {
      id: id(),
      vendor: VENDORS[3],
      amount: 3940,
      type: "standard",
      poMatch: "partial",
      confidence: { modelCertainty: 0.84, ruleMatch: 0.69, dataCompleteness: 0.86, anomalySignal: 0.16 },
      hiddenFlags: [],
      description: "Industrial services, partial PO match.",
      teachingPoint: "Borderline standard.",
    },
    {
      id: id(),
      vendor: VENDORS[4],
      amount: 2940,
      type: "standard",
      poMatch: "yes",
      confidence: { modelCertainty: 0.95, ruleMatch: 0.97, dataCompleteness: 0.98, anomalySignal: 0.04 },
      hiddenFlags: [],
      description: "Cloud infra monthly.",
      teachingPoint: "Standard.",
    },
    {
      id: id(),
      vendor: VENDORS[5],
      amount: 1860,
      type: "standard",
      poMatch: "yes",
      confidence: { modelCertainty: 0.93, ruleMatch: 0.95, dataCompleteness: 0.96, anomalySignal: 0.06 },
      hiddenFlags: [],
      description: "Component supplier.",
      teachingPoint: "Standard.",
    },
    {
      id: id(),
      vendor: VENDORS[7],
      amount: 22700,
      type: "high_value",
      poMatch: "yes",
      confidence: { modelCertainty: 0.91, ruleMatch: 0.94, dataCompleteness: 0.96, anomalySignal: 0.06 },
      hiddenFlags: ["above_5k_threshold"],
      description: "Workshop fit-out, high value.",
      teachingPoint: "High-value.",
    },
    {
      id: id(),
      vendor: VENDORS[8],
      amount: 2090,
      type: "duplicate",
      poMatch: "yes",
      confidence: { modelCertainty: 0.81, ruleMatch: 0.65, dataCompleteness: 0.92, anomalySignal: 0.40 },
      hiddenFlags: ["possible_resend"],
      description: "Possible duplicate of last week's invoice.",
      teachingPoint: "Triage & Route candidate.",
    },
    // ── modified terms — tests escalation gap
    {
      id: id(),
      vendor: VENDORS[9],
      amount: 4380,
      type: "modified_terms",
      poMatch: "yes",
      confidence: { modelCertainty: 0.90, ruleMatch: 0.92, dataCompleteness: 0.95, anomalySignal: 0.11 },
      hiddenFlags: ["modified_terms_net15_with_2pct_discount"],
      description: "Trusted vendor shifts payment terms; high model confidence.",
      teachingPoint: "Tests whether the player closed the escalation gap.",
    },
    // ── new vendor
    {
      id: id(),
      vendor: "Aegean Energia OY",
      amount: 2860,
      type: "new_vendor",
      poMatch: "no",
      confidence: { modelCertainty: 0.84, ruleMatch: 0.51, dataCompleteness: 0.76, anomalySignal: 0.22 },
      hiddenFlags: ["unverified_vendor"],
      description: "New vendor, KYC pending.",
      teachingPoint: "Vendor verification.",
    },
    // ── split-invoice scenario, two parts
    {
      id: id(),
      vendor: "Tirana Mechatronik Sh.p.k.",
      amount: 3200,
      type: "split_invoice",
      poMatch: "yes",
      confidence: { modelCertainty: 0.92, ruleMatch: 0.95, dataCompleteness: 0.96, anomalySignal: 0.07 },
      hiddenFlags: ["paired_with_INV-3012"],
      description: "Same-day invoice from a vendor that just sent another for €3,800.",
      teachingPoint:
        "Cross-document context: individually under €5k, jointly over.",
    },
    {
      id: id(),
      vendor: "Tirana Mechatronik Sh.p.k.",
      amount: 3800,
      type: "split_invoice",
      poMatch: "yes",
      confidence: { modelCertainty: 0.91, ruleMatch: 0.94, dataCompleteness: 0.96, anomalySignal: 0.07 },
      hiddenFlags: ["paired_with_INV-3011"],
      description: "Companion to the previous invoice — together they exceed €5k.",
      teachingPoint:
        "Coordinate & Escalate: needs cross-agent context to catch.",
    },
    {
      id: id(),
      vendor: VENDORS[10],
      amount: 1880,
      type: "standard",
      poMatch: "yes",
      confidence: { modelCertainty: 0.93, ruleMatch: 0.95, dataCompleteness: 0.96, anomalySignal: 0.06 },
      hiddenFlags: [],
      description: "Data services, recurring.",
      teachingPoint: "Standard.",
    },
    {
      id: id(),
      vendor: VENDORS[11],
      amount: 2550,
      type: "standard",
      poMatch: "yes",
      confidence: { modelCertainty: 0.94, ruleMatch: 0.96, dataCompleteness: 0.97, anomalySignal: 0.05 },
      hiddenFlags: [],
      description: "Steel components.",
      teachingPoint: "Standard.",
    },
    {
      id: id(),
      vendor: VENDORS[12],
      amount: 3120,
      type: "standard",
      poMatch: "yes",
      confidence: { modelCertainty: 0.93, ruleMatch: 0.95, dataCompleteness: 0.96, anomalySignal: 0.07 },
      hiddenFlags: [],
      description: "Strategy consulting.",
      teachingPoint: "Standard.",
    },
  ]);
}

export function fallbackBatch(round: RoundNumber): Invoice[] {
  if (round === 1) return round1Batch();
  if (round === 2) return round2Batch();
  return round3Batch();
}
