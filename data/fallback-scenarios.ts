import { compositeConfidence } from "../lib/scoring";
import type { Invoice, RoundNumber, ScenarioDomain } from "../lib/types";
import { fallbackBatch } from "./fallback-rounds";

/**
 * Fallback item batches for the three non-invoice scenarios:
 *   - Customer Complaints  (COMP- prefix)
 *   - AML Triage            (ALR- prefix)
 *   - HR Investigation      (HR- prefix)
 *
 * Same teaching-arc structure as fallback-rounds.ts:
 *   Round 1 — 8 items, mostly routine, 2 hidden hazards
 *   Round 2 — 12 items, full decision-type mix, includes a "Friday afternoon" trap
 *   Round 3 — 15 items, multi-agent coordination scenario
 *
 * The Invoice type is reused across all scenarios:
 *   vendor  → source name (customer / system name / employee)
 *   amount  → compensation (COMP), transaction amount (ALR), 0 (HR)
 *   poMatch → "yes" = clear precedent, "partial" = ambiguous, "no" = no precedent
 */

type RawInvoice = Omit<Invoice, "composite">;

function build(invoices: RawInvoice[]): Invoice[] {
  return invoices.map((inv) => ({
    ...inv,
    composite: compositeConfidence(inv.confidence),
  }));
}

let _nextId = 0;
let _prefix = "";

function resetIds(prefix: string, start: number) {
  _prefix = prefix;
  _nextId = start;
}

function id(): string {
  return `${_prefix}-${_nextId++}`;
}

// ════════════════════════════════════════════════════════════════════════════
// CUSTOMER COMPLAINTS
// ════════════════════════════════════════════════════════════════════════════

// ────────────────────────────────────────────────────────────────────────────
// Round 1 — 8 complaints, mostly routine classification, 2 hidden hazards
// ────────────────────────────────────────────────────────────────────────────

export function complaintsRound1Batch(): Invoice[] {
  resetIds("COMP", 1001);
  return build([
    {
      id: id(),
      vendor: "Katarina Johansson",
      amount: 0,
      type: "complaint_classification",
      poMatch: "yes",
      confidence: { modelCertainty: 0.93, ruleMatch: 0.95, dataCompleteness: 0.97, anomalySignal: 0.05 },
      hiddenFlags: [],
      description: "Card transaction dispute, standard chargeback path.",
      teachingPoint: "Standard classification — clear precedent.",
    },
    {
      id: id(),
      vendor: "Luca Bianchi",
      amount: 45,
      type: "complaint_classification",
      poMatch: "yes",
      confidence: { modelCertainty: 0.91, ruleMatch: 0.93, dataCompleteness: 0.96, anomalySignal: 0.07 },
      hiddenFlags: [],
      description: "Fee dispute on current account, €45 overdraft charge.",
      teachingPoint: "Standard classification.",
    },
    {
      id: id(),
      vendor: "Annika Bergström",
      amount: 120,
      type: "complaint_classification",
      poMatch: "yes",
      confidence: { modelCertainty: 0.92, ruleMatch: 0.94, dataCompleteness: 0.95, anomalySignal: 0.06 },
      hiddenFlags: [],
      description: "Online banking login issue, service disruption complaint.",
      teachingPoint: "Standard classification.",
    },
    {
      id: id(),
      vendor: "Pierre Delacroix",
      amount: 0,
      type: "complaint_classification",
      poMatch: "partial",
      confidence: { modelCertainty: 0.80, ruleMatch: 0.73, dataCompleteness: 0.88, anomalySignal: 0.15 },
      hiddenFlags: [],
      description: "Mortgage rate query that includes dissatisfaction — borderline complaint vs enquiry.",
      teachingPoint: "Borderline — should land in review band for most thresholds.",
    },
    {
      id: id(),
      vendor: "Sofia Papadopoulos",
      amount: 250,
      type: "compensation_authorization",
      poMatch: "yes",
      confidence: { modelCertainty: 0.94, ruleMatch: 0.96, dataCompleteness: 0.98, anomalySignal: 0.04 },
      hiddenFlags: [],
      description: "Branch service failure, customer requests €250 goodwill gesture, within standard authority.",
      teachingPoint: "Standard compensation within auto-authorization limits.",
    },
    {
      id: id(),
      vendor: "Erik Lindqvist",
      amount: 0,
      type: "complaint_classification",
      poMatch: "yes",
      confidence: { modelCertainty: 0.93, ruleMatch: 0.95, dataCompleteness: 0.96, anomalySignal: 0.06 },
      hiddenFlags: [],
      description: "ATM withdrawal complaint, routine.",
      teachingPoint: "Standard classification.",
    },
    // ── Hazard 1: regulatory reporting obligation hidden in routine language ──
    {
      id: id(),
      vendor: "Marguerite Lefèvre",
      amount: 0,
      type: "regulatory_reporting",
      poMatch: "yes",
      confidence: { modelCertainty: 0.91, ruleMatch: 0.92, dataCompleteness: 0.94, anomalySignal: 0.10 },
      hiddenFlags: ["complaint_triggers_fca_reporting_obligation"],
      description:
        "Customer describes being unable to access funds for three weeks — language triggers vulnerable customer regulatory reporting.",
      teachingPoint:
        "Confidence is high, but regulatory reporting obligations are non-delegable. The Friday afternoon scenario: confidence cannot define authority.",
    },
    // ── Hazard 2: customer mentions the ombudsman ────────────────────────────
    {
      id: id(),
      vendor: "Hans-Peter Müller",
      amount: 480,
      type: "escalation_to_ombudsman",
      poMatch: "no",
      confidence: { modelCertainty: 0.85, ruleMatch: 0.58, dataCompleteness: 0.79, anomalySignal: 0.24 },
      hiddenFlags: ["ombudsman_reference", "legal_coordination_required"],
      description:
        "Customer explicitly states intent to contact the financial ombudsman if not resolved within 48 hours.",
      teachingPoint:
        "Ombudsman escalation is a delegation question, not a confidence question — requires legal coordination.",
    },
  ]);
}

// ────────────────────────────────────────────────────────────────────────────
// Round 2 — 12 complaints, full decision-type mix
// ────────────────────────────────────────────────────────────────────────────

export function complaintsRound2Batch(): Invoice[] {
  resetIds("COMP", 2001);
  return build([
    {
      id: id(),
      vendor: "Isabelle Moreau",
      amount: 0,
      type: "complaint_classification",
      poMatch: "yes",
      confidence: { modelCertainty: 0.94, ruleMatch: 0.96, dataCompleteness: 0.97, anomalySignal: 0.05 },
      hiddenFlags: [],
      description: "Direct debit timing complaint, clear category.",
      teachingPoint: "Standard classification.",
    },
    {
      id: id(),
      vendor: "Niklas Ström",
      amount: 0,
      type: "complaint_classification",
      poMatch: "yes",
      confidence: { modelCertainty: 0.92, ruleMatch: 0.93, dataCompleteness: 0.96, anomalySignal: 0.07 },
      hiddenFlags: [],
      description: "Savings account interest rate change complaint.",
      teachingPoint: "Standard classification.",
    },
    {
      id: id(),
      vendor: "Elena Vassileva",
      amount: 180,
      type: "compensation_authorization",
      poMatch: "yes",
      confidence: { modelCertainty: 0.93, ruleMatch: 0.95, dataCompleteness: 0.97, anomalySignal: 0.06 },
      hiddenFlags: [],
      description: "€180 goodwill for delayed card replacement, within standard authority.",
      teachingPoint: "Standard compensation — within auto-authorization band.",
    },
    {
      id: id(),
      vendor: "Adriana Petrescu",
      amount: 2400,
      type: "compensation_authorization",
      poMatch: "partial",
      confidence: { modelCertainty: 0.82, ruleMatch: 0.70, dataCompleteness: 0.86, anomalySignal: 0.19 },
      hiddenFlags: ["above_compensation_threshold"],
      description: "Customer claims €2,400 loss from incorrect FX conversion — exceeds standard authority.",
      teachingPoint: "High-value compensation needs human sign-off regardless of confidence.",
    },
    {
      id: id(),
      vendor: "Giovanni Esposito",
      amount: 0,
      type: "response_generation",
      poMatch: "yes",
      confidence: { modelCertainty: 0.91, ruleMatch: 0.93, dataCompleteness: 0.95, anomalySignal: 0.08 },
      hiddenFlags: [],
      description: "Draft acknowledgement letter for a routine service complaint.",
      teachingPoint: "Response generation — draft & approve pattern.",
    },
    {
      id: id(),
      vendor: "Astrid Henriksen",
      amount: 0,
      type: "response_generation",
      poMatch: "partial",
      confidence: { modelCertainty: 0.84, ruleMatch: 0.76, dataCompleteness: 0.88, anomalySignal: 0.16 },
      hiddenFlags: [],
      description: "Response to a complaint about investment advice — tone and regulatory language matter.",
      teachingPoint: "Response involving regulated advice needs careful human review.",
    },
    // ── regulatory reporting
    {
      id: id(),
      vendor: "Beatriz Fernández",
      amount: 0,
      type: "regulatory_reporting",
      poMatch: "no",
      confidence: { modelCertainty: 0.78, ruleMatch: 0.62, dataCompleteness: 0.80, anomalySignal: 0.28 },
      hiddenFlags: ["complaint_triggers_fca_reporting_obligation"],
      description: "Complaint about denied insurance claim includes allegation of mis-selling — regulatory reporting triggered.",
      teachingPoint: "Regulatory reporting is non-delegable — Prepare & Present only.",
    },
    // ── Friday afternoon: looks routine but triggers reporting ────────────────
    {
      id: id(),
      vendor: "Marek Kowalski",
      amount: 75,
      type: "regulatory_reporting",
      poMatch: "yes",
      confidence: { modelCertainty: 0.90, ruleMatch: 0.91, dataCompleteness: 0.94, anomalySignal: 0.09 },
      hiddenFlags: ["hidden_vulnerability_indicator", "complaint_triggers_fca_reporting_obligation"],
      description:
        "Routine-looking €75 fee complaint, but customer mentions being on disability benefits and unable to manage finances — vulnerable customer regulatory obligation.",
      teachingPoint:
        "The Friday afternoon trap: confidence is high, complaint looks routine, but the vulnerability language triggers a regulatory reporting obligation that no agent should auto-process.",
    },
    // ── ombudsman escalation
    {
      id: id(),
      vendor: "Camille Dubois",
      amount: 1200,
      type: "escalation_to_ombudsman",
      poMatch: "no",
      confidence: { modelCertainty: 0.79, ruleMatch: 0.55, dataCompleteness: 0.76, anomalySignal: 0.26 },
      hiddenFlags: ["ombudsman_reference", "legal_coordination_required"],
      description: "Third complaint from same customer in 90 days, now referencing the ombudsman.",
      teachingPoint: "Coordinate & Escalate: repeated complaints + ombudsman threat require multi-team coordination.",
    },
    // ── routine fillers
    {
      id: id(),
      vendor: "Thomas Bergman",
      amount: 0,
      type: "complaint_classification",
      poMatch: "yes",
      confidence: { modelCertainty: 0.93, ruleMatch: 0.95, dataCompleteness: 0.97, anomalySignal: 0.05 },
      hiddenFlags: [],
      description: "Mobile app crash complaint, technical category.",
      teachingPoint: "Standard classification.",
    },
    {
      id: id(),
      vendor: "Marta Novak",
      amount: 0,
      type: "complaint_classification",
      poMatch: "yes",
      confidence: { modelCertainty: 0.94, ruleMatch: 0.96, dataCompleteness: 0.98, anomalySignal: 0.04 },
      hiddenFlags: [],
      description: "Delayed international transfer complaint.",
      teachingPoint: "Standard classification.",
    },
    {
      id: id(),
      vendor: "Frederik Jensen",
      amount: 90,
      type: "compensation_authorization",
      poMatch: "yes",
      confidence: { modelCertainty: 0.95, ruleMatch: 0.97, dataCompleteness: 0.98, anomalySignal: 0.04 },
      hiddenFlags: [],
      description: "€90 goodwill payment for service delay, well within authority.",
      teachingPoint: "Standard compensation.",
    },
  ]);
}

// ────────────────────────────────────────────────────────────────────────────
// Round 3 — 15 complaints, split-complaint scenario + systemic issue
// ────────────────────────────────────────────────────────────────────────────

export function complaintsRound3Batch(): Invoice[] {
  resetIds("COMP", 3001);
  return build([
    {
      id: id(),
      vendor: "Anders Lund",
      amount: 0,
      type: "complaint_classification",
      poMatch: "yes",
      confidence: { modelCertainty: 0.94, ruleMatch: 0.96, dataCompleteness: 0.97, anomalySignal: 0.06 },
      hiddenFlags: [],
      description: "Routine card dispute classification.",
      teachingPoint: "Standard.",
    },
    {
      id: id(),
      vendor: "Chiara Ricci",
      amount: 0,
      type: "complaint_classification",
      poMatch: "yes",
      confidence: { modelCertainty: 0.93, ruleMatch: 0.95, dataCompleteness: 0.96, anomalySignal: 0.06 },
      hiddenFlags: [],
      description: "Branch wait time complaint.",
      teachingPoint: "Standard.",
    },
    {
      id: id(),
      vendor: "Willem de Groot",
      amount: 150,
      type: "compensation_authorization",
      poMatch: "yes",
      confidence: { modelCertainty: 0.92, ruleMatch: 0.94, dataCompleteness: 0.96, anomalySignal: 0.07 },
      hiddenFlags: [],
      description: "€150 goodwill for delayed statement, within authority.",
      teachingPoint: "Standard compensation.",
    },
    {
      id: id(),
      vendor: "Karolina Wojciechowska",
      amount: 0,
      type: "response_generation",
      poMatch: "yes",
      confidence: { modelCertainty: 0.91, ruleMatch: 0.93, dataCompleteness: 0.95, anomalySignal: 0.08 },
      hiddenFlags: [],
      description: "Acknowledgement letter for PPI-related query.",
      teachingPoint: "Response generation — standard draft & approve.",
    },
    {
      id: id(),
      vendor: "Henrik Aalto",
      amount: 0,
      type: "complaint_classification",
      poMatch: "yes",
      confidence: { modelCertainty: 0.95, ruleMatch: 0.97, dataCompleteness: 0.98, anomalySignal: 0.04 },
      hiddenFlags: [],
      description: "Online banking feature request mislabelled as complaint.",
      teachingPoint: "Standard.",
    },
    {
      id: id(),
      vendor: "Ines Almeida",
      amount: 300,
      type: "compensation_authorization",
      poMatch: "yes",
      confidence: { modelCertainty: 0.93, ruleMatch: 0.95, dataCompleteness: 0.96, anomalySignal: 0.06 },
      hiddenFlags: [],
      description: "€300 goodwill for delayed mortgage completion.",
      teachingPoint: "Standard compensation.",
    },
    // ── high-value compensation
    {
      id: id(),
      vendor: "Dimitris Antonopoulos",
      amount: 5200,
      type: "compensation_authorization",
      poMatch: "partial",
      confidence: { modelCertainty: 0.84, ruleMatch: 0.71, dataCompleteness: 0.86, anomalySignal: 0.18 },
      hiddenFlags: ["above_compensation_threshold"],
      description: "Customer claims €5,200 consequential loss from blocked account — above standard authority.",
      teachingPoint: "High-value compensation requires human decision regardless of model confidence.",
    },
    // ── regulatory reporting
    {
      id: id(),
      vendor: "Nathalie Perrin",
      amount: 0,
      type: "regulatory_reporting",
      poMatch: "no",
      confidence: { modelCertainty: 0.81, ruleMatch: 0.65, dataCompleteness: 0.82, anomalySignal: 0.25 },
      hiddenFlags: ["complaint_triggers_fca_reporting_obligation"],
      description: "Complaint alleges discriminatory lending practices — regulatory reporting mandatory.",
      teachingPoint: "Regulatory reporting is non-delegable.",
    },
    // ── modified terms / escalation test
    {
      id: id(),
      vendor: "Rui Carvalho",
      amount: 0,
      type: "response_generation",
      poMatch: "partial",
      confidence: { modelCertainty: 0.88, ruleMatch: 0.82, dataCompleteness: 0.90, anomalySignal: 0.14 },
      hiddenFlags: ["tone_risk_legal_language"],
      description: "Response draft for a complaint that includes legal terminology — tone and accuracy critical.",
      teachingPoint: "Tests whether the player closed the escalation gap for sensitive responses.",
    },
    // ── ombudsman escalation
    {
      id: id(),
      vendor: "Eva Horváth",
      amount: 1800,
      type: "escalation_to_ombudsman",
      poMatch: "no",
      confidence: { modelCertainty: 0.76, ruleMatch: 0.52, dataCompleteness: 0.74, anomalySignal: 0.30 },
      hiddenFlags: ["ombudsman_reference", "legal_coordination_required"],
      description: "Customer has engaged a solicitor and references the Financial Ombudsman Service by name.",
      teachingPoint: "Ombudsman involvement is irreversible — requires Prepare & Present at minimum.",
    },
    // ── Split-complaint scenario: same customer, two individually minor complaints
    {
      id: id(),
      vendor: "Lars-Erik Söderström",
      amount: 60,
      type: "complaint_classification",
      poMatch: "yes",
      confidence: { modelCertainty: 0.92, ruleMatch: 0.94, dataCompleteness: 0.95, anomalySignal: 0.08 },
      hiddenFlags: ["paired_with_COMP-3012", "systemic_pattern_indicator"],
      description: "Minor fee dispute from a customer who also filed a separate service complaint today.",
      teachingPoint:
        "Cross-document context: individually minor, but together they indicate a systemic issue in the fee-charging process.",
    },
    {
      id: id(),
      vendor: "Lars-Erik Söderström",
      amount: 0,
      type: "complaint_classification",
      poMatch: "yes",
      confidence: { modelCertainty: 0.91, ruleMatch: 0.93, dataCompleteness: 0.95, anomalySignal: 0.09 },
      hiddenFlags: ["paired_with_COMP-3011", "systemic_pattern_indicator"],
      description: "Service complaint about misleading fee disclosure — companion to the fee dispute above.",
      teachingPoint:
        "Coordinate & Escalate: needs cross-complaint context to spot the systemic issue.",
    },
    // ── routine fillers
    {
      id: id(),
      vendor: "Zuzana Procházková",
      amount: 0,
      type: "complaint_classification",
      poMatch: "yes",
      confidence: { modelCertainty: 0.93, ruleMatch: 0.95, dataCompleteness: 0.96, anomalySignal: 0.06 },
      hiddenFlags: [],
      description: "Routine card replacement delay.",
      teachingPoint: "Standard.",
    },
    {
      id: id(),
      vendor: "Jens Kristiansen",
      amount: 0,
      type: "complaint_classification",
      poMatch: "yes",
      confidence: { modelCertainty: 0.94, ruleMatch: 0.96, dataCompleteness: 0.97, anomalySignal: 0.05 },
      hiddenFlags: [],
      description: "Standing order setup error.",
      teachingPoint: "Standard.",
    },
    {
      id: id(),
      vendor: "Maria Svensson",
      amount: 200,
      type: "compensation_authorization",
      poMatch: "yes",
      confidence: { modelCertainty: 0.93, ruleMatch: 0.95, dataCompleteness: 0.96, anomalySignal: 0.06 },
      hiddenFlags: [],
      description: "€200 goodwill for service failure.",
      teachingPoint: "Standard compensation.",
    },
  ]);
}

// ════════════════════════════════════════════════════════════════════════════
// AML TRIAGE
// ════════════════════════════════════════════════════════════════════════════

// ────────────────────────────────────────────────────────────────────────────
// Round 1 — 8 alerts, mostly clear false positives, 2 hidden hazards
// ────────────────────────────────────────────────────────────────────────────

export function amlRound1Batch(): Invoice[] {
  resetIds("ALR", 1001);
  return build([
    {
      id: id(),
      vendor: "TM-Engine v4.2 / Acct 8821-DE",
      amount: 12500,
      type: "alert_classification",
      poMatch: "yes",
      confidence: { modelCertainty: 0.94, ruleMatch: 0.96, dataCompleteness: 0.98, anomalySignal: 0.05 },
      hiddenFlags: [],
      description: "Salary payment from known employer, monthly pattern, amount consistent.",
      teachingPoint: "Standard false positive — clear precedent.",
    },
    {
      id: id(),
      vendor: "TM-Engine v4.2 / Acct 3307-NL",
      amount: 4800,
      type: "auto_dismissal",
      poMatch: "yes",
      confidence: { modelCertainty: 0.93, ruleMatch: 0.95, dataCompleteness: 0.97, anomalySignal: 0.06 },
      hiddenFlags: [],
      description: "Recurring rent payment, same beneficiary for 18 months.",
      teachingPoint: "Standard auto-dismissal candidate.",
    },
    {
      id: id(),
      vendor: "TM-Engine v4.2 / Acct 5590-FR",
      amount: 8200,
      type: "alert_classification",
      poMatch: "yes",
      confidence: { modelCertainty: 0.91, ruleMatch: 0.93, dataCompleteness: 0.96, anomalySignal: 0.08 },
      hiddenFlags: [],
      description: "Supplier payment, invoice reference matches, within historical range.",
      teachingPoint: "Standard classification.",
    },
    {
      id: id(),
      vendor: "TM-Engine v4.2 / Acct 2214-AT",
      amount: 3100,
      type: "auto_dismissal",
      poMatch: "partial",
      confidence: { modelCertainty: 0.79, ruleMatch: 0.72, dataCompleteness: 0.87, anomalySignal: 0.17 },
      hiddenFlags: [],
      description: "Cash deposit at branch, slightly above customer's normal pattern but within seasonal variation.",
      teachingPoint: "Borderline — should land in review band for most thresholds.",
    },
    {
      id: id(),
      vendor: "TM-Engine v4.2 / Acct 6643-BE",
      amount: 15000,
      type: "alert_classification",
      poMatch: "yes",
      confidence: { modelCertainty: 0.95, ruleMatch: 0.97, dataCompleteness: 0.99, anomalySignal: 0.04 },
      hiddenFlags: [],
      description: "Insurance payout, reference matches pending claim.",
      teachingPoint: "Standard classification.",
    },
    {
      id: id(),
      vendor: "TM-Engine v4.2 / Acct 1178-FI",
      amount: 2200,
      type: "auto_dismissal",
      poMatch: "yes",
      confidence: { modelCertainty: 0.92, ruleMatch: 0.94, dataCompleteness: 0.96, anomalySignal: 0.07 },
      hiddenFlags: [],
      description: "E-commerce merchant settlement, daily batch, amount consistent.",
      teachingPoint: "Standard auto-dismissal.",
    },
    // ── Hazard 1: looks like a false positive but has cross-border element ───
    {
      id: id(),
      vendor: "TM-Engine v4.2 / Acct 4456-CY",
      amount: 9500,
      type: "cross_border_coordination",
      poMatch: "yes",
      confidence: { modelCertainty: 0.90, ruleMatch: 0.91, dataCompleteness: 0.93, anomalySignal: 0.14 },
      hiddenFlags: ["cross_border_cy_to_lv", "shell_company_indicator"],
      description:
        "Payment from a Cyprus-registered entity to a Latvian beneficiary — appears to be a routine trade payment but counterparty is a recently incorporated shell.",
      teachingPoint:
        "Confidence is high, but the cross-border element with a shell company triggers multi-jurisdictional coordination. Confidence cannot define authority here.",
    },
    // ── Hazard 2: transaction pattern matches known typology ─────────────────
    {
      id: id(),
      vendor: "TM-Engine v4.2 / Acct 7789-ES",
      amount: 14800,
      type: "investigation_escalation",
      poMatch: "partial",
      confidence: { modelCertainty: 0.88, ruleMatch: 0.85, dataCompleteness: 0.90, anomalySignal: 0.22 },
      hiddenFlags: ["typology_match_trade_based_ml", "elevated_risk_jurisdiction"],
      description:
        "Trade finance payment matching the FATF trade-based money laundering typology — overvalued goods, mismatched shipping documents.",
      teachingPoint:
        "Typology match is a delegation question, not a confidence question — requires analyst escalation even when model confidence is moderate-to-high.",
    },
  ]);
}

// ────────────────────────────────────────────────────────────────────────────
// Round 2 — 12 alerts, full mix, includes structuring scenario
// ────────────────────────────────────────────────────────────────────────────

export function amlRound2Batch(): Invoice[] {
  resetIds("ALR", 2001);
  return build([
    {
      id: id(),
      vendor: "TM-Engine v4.2 / Acct 9912-DE",
      amount: 7500,
      type: "alert_classification",
      poMatch: "yes",
      confidence: { modelCertainty: 0.94, ruleMatch: 0.96, dataCompleteness: 0.97, anomalySignal: 0.05 },
      hiddenFlags: [],
      description: "Payroll batch processing, standard pattern.",
      teachingPoint: "Standard classification.",
    },
    {
      id: id(),
      vendor: "TM-Engine v4.2 / Acct 3348-NL",
      amount: 3200,
      type: "auto_dismissal",
      poMatch: "yes",
      confidence: { modelCertainty: 0.93, ruleMatch: 0.95, dataCompleteness: 0.96, anomalySignal: 0.06 },
      hiddenFlags: [],
      description: "Pension fund distribution, monthly, beneficiary verified.",
      teachingPoint: "Standard auto-dismissal.",
    },
    {
      id: id(),
      vendor: "TM-Engine v4.2 / Acct 5567-IT",
      amount: 18000,
      type: "alert_classification",
      poMatch: "yes",
      confidence: { modelCertainty: 0.92, ruleMatch: 0.94, dataCompleteness: 0.96, anomalySignal: 0.07 },
      hiddenFlags: [],
      description: "Corporate tax payment to revenue authority.",
      teachingPoint: "Standard classification.",
    },
    {
      id: id(),
      vendor: "TM-Engine v4.2 / Acct 8834-PT",
      amount: 6400,
      type: "auto_dismissal",
      poMatch: "partial",
      confidence: { modelCertainty: 0.83, ruleMatch: 0.74, dataCompleteness: 0.88, anomalySignal: 0.16 },
      hiddenFlags: [],
      description: "Property rental deposit, slightly higher than previous lease.",
      teachingPoint: "Borderline auto-dismissal.",
    },
    // ── investigation escalation
    {
      id: id(),
      vendor: "TM-Engine v4.2 / Acct 2201-LU",
      amount: 45000,
      type: "investigation_escalation",
      poMatch: "no",
      confidence: { modelCertainty: 0.74, ruleMatch: 0.60, dataCompleteness: 0.80, anomalySignal: 0.32 },
      hiddenFlags: ["high_value_no_economic_rationale"],
      description: "Large payment to a newly opened account in Luxembourg with no declared source of wealth.",
      teachingPoint: "Investigation escalation — analyst must review source of funds.",
    },
    {
      id: id(),
      vendor: "TM-Engine v4.2 / Acct 4478-IE",
      amount: 22000,
      type: "investigation_escalation",
      poMatch: "partial",
      confidence: { modelCertainty: 0.80, ruleMatch: 0.68, dataCompleteness: 0.84, anomalySignal: 0.24 },
      hiddenFlags: ["layering_indicator"],
      description: "Rapid fund movement through three accounts in 48 hours — potential layering.",
      teachingPoint: "Investigation escalation — layering pattern requires human judgment.",
    },
    // ── SAR preparation
    {
      id: id(),
      vendor: "TM-Engine v4.2 / Acct 6690-MT",
      amount: 38000,
      type: "sar_preparation",
      poMatch: "no",
      confidence: { modelCertainty: 0.72, ruleMatch: 0.55, dataCompleteness: 0.78, anomalySignal: 0.38 },
      hiddenFlags: ["sar_deadline_approaching", "regulatory_filing_required"],
      description: "Transaction linked to a PEP, multiple red flags already documented — SAR filing deadline in 72 hours.",
      teachingPoint: "SAR preparation is non-delegable — Prepare & Present only. Deadline pressure does not change authority boundaries.",
    },
    // ── Structuring scenario (Friday afternoon equivalent) ───────────────────
    {
      id: id(),
      vendor: "TM-Engine v4.2 / Acct 1156-DE",
      amount: 9800,
      type: "investigation_escalation",
      poMatch: "yes",
      confidence: { modelCertainty: 0.89, ruleMatch: 0.90, dataCompleteness: 0.93, anomalySignal: 0.12 },
      hiddenFlags: ["structuring_pattern", "multiple_sub_threshold_transactions"],
      description:
        "Five cash deposits of €9,800 each over three days — each below the €10,000 reporting threshold. Individually each looks routine; together they are textbook structuring.",
      teachingPoint:
        "The Friday afternoon trap: confidence per transaction is high, but the pattern across transactions is structuring. Cross-item context is essential.",
    },
    // ── cross-border coordination
    {
      id: id(),
      vendor: "TM-Engine v4.2 / Acct 7723-CZ",
      amount: 28000,
      type: "cross_border_coordination",
      poMatch: "no",
      confidence: { modelCertainty: 0.77, ruleMatch: 0.58, dataCompleteness: 0.76, anomalySignal: 0.28 },
      hiddenFlags: ["cross_border_cz_to_ae", "correspondent_bank_risk"],
      description: "Wire transfer from Prague to Dubai via a correspondent bank flagged in FATF mutual evaluation.",
      teachingPoint: "Cross-border coordination — multiple compliance teams must align before any action.",
    },
    // ── routine fillers
    {
      id: id(),
      vendor: "TM-Engine v4.2 / Acct 8801-SE",
      amount: 5500,
      type: "alert_classification",
      poMatch: "yes",
      confidence: { modelCertainty: 0.93, ruleMatch: 0.95, dataCompleteness: 0.97, anomalySignal: 0.05 },
      hiddenFlags: [],
      description: "Mortgage repayment, monthly direct debit.",
      teachingPoint: "Standard classification.",
    },
    {
      id: id(),
      vendor: "TM-Engine v4.2 / Acct 2290-DK",
      amount: 1800,
      type: "auto_dismissal",
      poMatch: "yes",
      confidence: { modelCertainty: 0.94, ruleMatch: 0.96, dataCompleteness: 0.98, anomalySignal: 0.04 },
      hiddenFlags: [],
      description: "Utility bill payment, recurring.",
      teachingPoint: "Standard auto-dismissal.",
    },
    {
      id: id(),
      vendor: "TM-Engine v4.2 / Acct 3356-CH",
      amount: 4100,
      type: "alert_classification",
      poMatch: "yes",
      confidence: { modelCertainty: 0.92, ruleMatch: 0.94, dataCompleteness: 0.96, anomalySignal: 0.07 },
      hiddenFlags: [],
      description: "University tuition payment, annual pattern.",
      teachingPoint: "Standard classification.",
    },
  ]);
}

// ────────────────────────────────────────────────────────────────────────────
// Round 3 — 15 alerts, cross-border coordination + SAR deadline pressure
// ────────────────────────────────────────────────────────────────────────────

export function amlRound3Batch(): Invoice[] {
  resetIds("ALR", 3001);
  return build([
    {
      id: id(),
      vendor: "TM-Engine v4.2 / Acct 1102-DE",
      amount: 8900,
      type: "alert_classification",
      poMatch: "yes",
      confidence: { modelCertainty: 0.94, ruleMatch: 0.96, dataCompleteness: 0.97, anomalySignal: 0.06 },
      hiddenFlags: [],
      description: "Supplier payment, invoice-matched, recurring.",
      teachingPoint: "Standard.",
    },
    {
      id: id(),
      vendor: "TM-Engine v4.2 / Acct 4421-NL",
      amount: 2900,
      type: "auto_dismissal",
      poMatch: "yes",
      confidence: { modelCertainty: 0.93, ruleMatch: 0.95, dataCompleteness: 0.96, anomalySignal: 0.06 },
      hiddenFlags: [],
      description: "Childcare subsidy disbursement, government source.",
      teachingPoint: "Standard auto-dismissal.",
    },
    {
      id: id(),
      vendor: "TM-Engine v4.2 / Acct 6678-FR",
      amount: 11000,
      type: "alert_classification",
      poMatch: "yes",
      confidence: { modelCertainty: 0.92, ruleMatch: 0.93, dataCompleteness: 0.96, anomalySignal: 0.07 },
      hiddenFlags: [],
      description: "Corporate dividend distribution, annual.",
      teachingPoint: "Standard classification.",
    },
    {
      id: id(),
      vendor: "TM-Engine v4.2 / Acct 3390-BE",
      amount: 4200,
      type: "auto_dismissal",
      poMatch: "partial",
      confidence: { modelCertainty: 0.82, ruleMatch: 0.74, dataCompleteness: 0.87, anomalySignal: 0.16 },
      hiddenFlags: [],
      description: "Insurance premium, new policy — slightly elevated amount.",
      teachingPoint: "Borderline auto-dismissal.",
    },
    {
      id: id(),
      vendor: "TM-Engine v4.2 / Acct 5534-ES",
      amount: 6700,
      type: "alert_classification",
      poMatch: "yes",
      confidence: { modelCertainty: 0.95, ruleMatch: 0.97, dataCompleteness: 0.98, anomalySignal: 0.04 },
      hiddenFlags: [],
      description: "Lease payment, commercial property, recurring.",
      teachingPoint: "Standard.",
    },
    {
      id: id(),
      vendor: "TM-Engine v4.2 / Acct 9901-FI",
      amount: 3600,
      type: "auto_dismissal",
      poMatch: "yes",
      confidence: { modelCertainty: 0.93, ruleMatch: 0.95, dataCompleteness: 0.96, anomalySignal: 0.06 },
      hiddenFlags: [],
      description: "Payroll tax remittance, monthly.",
      teachingPoint: "Standard auto-dismissal.",
    },
    // ── investigation escalation
    {
      id: id(),
      vendor: "TM-Engine v4.2 / Acct 7745-LU",
      amount: 52000,
      type: "investigation_escalation",
      poMatch: "no",
      confidence: { modelCertainty: 0.75, ruleMatch: 0.61, dataCompleteness: 0.80, anomalySignal: 0.30 },
      hiddenFlags: ["high_value_no_economic_rationale", "pep_connection"],
      description: "Large transfer to a private investment vehicle, beneficial owner linked to a PEP.",
      teachingPoint: "Investigation escalation — PEP connection requires enhanced due diligence.",
    },
    // ── SAR preparation with deadline pressure
    {
      id: id(),
      vendor: "TM-Engine v4.2 / Acct 2267-MT",
      amount: 41000,
      type: "sar_preparation",
      poMatch: "no",
      confidence: { modelCertainty: 0.70, ruleMatch: 0.52, dataCompleteness: 0.75, anomalySignal: 0.40 },
      hiddenFlags: ["sar_deadline_24h", "regulatory_filing_required", "tipping_off_risk"],
      description:
        "Multiple suspicious transactions aggregated — SAR filing deadline in 24 hours. Customer has called asking about the account freeze, creating tipping-off risk.",
      teachingPoint:
        "SAR under time pressure with tipping-off risk: non-delegable, and the deadline does not change the authority boundary. Tests whether the player's policy handles pressure correctly.",
    },
    // ── cross-border coordination scenario
    {
      id: id(),
      vendor: "TM-Engine v4.2 / Acct 8856-CY",
      amount: 67000,
      type: "cross_border_coordination",
      poMatch: "no",
      confidence: { modelCertainty: 0.73, ruleMatch: 0.56, dataCompleteness: 0.74, anomalySignal: 0.34 },
      hiddenFlags: ["cross_border_cy_mt_ae", "multi_jurisdiction_coordination", "paired_with_ALR-3010"],
      description:
        "Complex fund flow: Cyprus holding → Malta SPV → UAE beneficiary. Three compliance teams need to coordinate.",
      teachingPoint:
        "Cross-border coordination: multi-jurisdictional authority means no single agent can decide. Coordinate & Escalate is the only viable pattern.",
    },
    {
      id: id(),
      vendor: "TM-Engine v4.2 / Acct 1189-LV",
      amount: 23000,
      type: "cross_border_coordination",
      poMatch: "no",
      confidence: { modelCertainty: 0.76, ruleMatch: 0.59, dataCompleteness: 0.77, anomalySignal: 0.29 },
      hiddenFlags: ["cross_border_lv_cy", "paired_with_ALR-3009", "correspondent_bank_risk"],
      description:
        "Return leg of the Cyprus-Malta-UAE flow — funds routed back through Latvia. Companion to ALR-3009.",
      teachingPoint:
        "Coordinate & Escalate: needs cross-alert context to identify the round-trip pattern.",
    },
    // ── structuring follow-up
    {
      id: id(),
      vendor: "TM-Engine v4.2 / Acct 4467-DE",
      amount: 9900,
      type: "investigation_escalation",
      poMatch: "yes",
      confidence: { modelCertainty: 0.87, ruleMatch: 0.88, dataCompleteness: 0.92, anomalySignal: 0.14 },
      hiddenFlags: ["structuring_pattern", "repeat_offender"],
      description: "Same account from Round 2 structuring scenario — customer continues sub-threshold deposits despite previous investigation.",
      teachingPoint: "Tests whether the player's drift response caught the repeat pattern.",
    },
    // ── routine fillers
    {
      id: id(),
      vendor: "TM-Engine v4.2 / Acct 5512-AT",
      amount: 7800,
      type: "alert_classification",
      poMatch: "yes",
      confidence: { modelCertainty: 0.93, ruleMatch: 0.95, dataCompleteness: 0.96, anomalySignal: 0.06 },
      hiddenFlags: [],
      description: "Consulting fee payment, monthly retainer.",
      teachingPoint: "Standard.",
    },
    {
      id: id(),
      vendor: "TM-Engine v4.2 / Acct 6623-SE",
      amount: 1500,
      type: "auto_dismissal",
      poMatch: "yes",
      confidence: { modelCertainty: 0.94, ruleMatch: 0.96, dataCompleteness: 0.97, anomalySignal: 0.05 },
      hiddenFlags: [],
      description: "Gym membership annual payment.",
      teachingPoint: "Standard auto-dismissal.",
    },
    {
      id: id(),
      vendor: "TM-Engine v4.2 / Acct 7790-DK",
      amount: 5100,
      type: "alert_classification",
      poMatch: "yes",
      confidence: { modelCertainty: 0.93, ruleMatch: 0.95, dataCompleteness: 0.96, anomalySignal: 0.07 },
      hiddenFlags: [],
      description: "Vehicle leasing payment, recurring.",
      teachingPoint: "Standard classification.",
    },
    {
      id: id(),
      vendor: "TM-Engine v4.2 / Acct 8845-NO",
      amount: 2800,
      type: "auto_dismissal",
      poMatch: "yes",
      confidence: { modelCertainty: 0.94, ruleMatch: 0.96, dataCompleteness: 0.97, anomalySignal: 0.05 },
      hiddenFlags: [],
      description: "Electricity bill, quarterly.",
      teachingPoint: "Standard auto-dismissal.",
    },
  ]);
}

// ════════════════════════════════════════════════════════════════════════════
// HR INVESTIGATION
// ════════════════════════════════════════════════════════════════════════════

// ────────────────────────────────────────────────────────────────────────────
// Round 1 — 8 cases, mostly routine, 2 hidden hazards
// ────────────────────────────────────────────────────────────────────────────

export function hrRound1Batch(): Invoice[] {
  resetIds("HR", 1001);
  return build([
    {
      id: id(),
      vendor: "Maja Eriksson",
      amount: 0,
      type: "hr_complaint_classification",
      poMatch: "yes",
      confidence: { modelCertainty: 0.93, ruleMatch: 0.95, dataCompleteness: 0.97, anomalySignal: 0.05 },
      hiddenFlags: [],
      description: "Timekeeping dispute between a team lead and a junior analyst.",
      teachingPoint: "Standard classification — clear precedent in policy handbook.",
    },
    {
      id: id(),
      vendor: "Tomáš Dvořák",
      amount: 0,
      type: "hr_complaint_classification",
      poMatch: "yes",
      confidence: { modelCertainty: 0.91, ruleMatch: 0.93, dataCompleteness: 0.96, anomalySignal: 0.07 },
      hiddenFlags: [],
      description: "Expense report discrepancy — employee submitted duplicate receipts, likely administrative error.",
      teachingPoint: "Standard classification.",
    },
    {
      id: id(),
      vendor: "Elise Vandenberghe",
      amount: 0,
      type: "evidence_assessment",
      poMatch: "yes",
      confidence: { modelCertainty: 0.92, ruleMatch: 0.94, dataCompleteness: 0.95, anomalySignal: 0.06 },
      hiddenFlags: [],
      description: "Sufficient evidence already gathered for a minor dress code violation — straightforward assessment.",
      teachingPoint: "Standard evidence assessment.",
    },
    {
      id: id(),
      vendor: "Sander Klaassen",
      amount: 0,
      type: "hr_complaint_classification",
      poMatch: "partial",
      confidence: { modelCertainty: 0.80, ruleMatch: 0.72, dataCompleteness: 0.87, anomalySignal: 0.16 },
      hiddenFlags: [],
      description: "Anonymous tip about excessive personal phone use — borderline between coaching and investigation.",
      teachingPoint: "Borderline — should land in review band for most thresholds.",
    },
    {
      id: id(),
      vendor: "Pauliina Mäkinen",
      amount: 0,
      type: "witness_interview_prep",
      poMatch: "yes",
      confidence: { modelCertainty: 0.94, ruleMatch: 0.96, dataCompleteness: 0.98, anomalySignal: 0.04 },
      hiddenFlags: [],
      description: "Prepare interview materials for a routine workplace conflict mediation.",
      teachingPoint: "Standard witness prep — Prepare & Present.",
    },
    {
      id: id(),
      vendor: "Rasmus Andersen",
      amount: 0,
      type: "hr_complaint_classification",
      poMatch: "yes",
      confidence: { modelCertainty: 0.93, ruleMatch: 0.95, dataCompleteness: 0.96, anomalySignal: 0.06 },
      hiddenFlags: [],
      description: "Late return from parental leave — scheduling coordination issue.",
      teachingPoint: "Standard classification.",
    },
    // ── Hazard 1: minor-looking case involving a senior executive ────────────
    {
      id: id(),
      vendor: "Jan-Willem Hoekstra",
      amount: 0,
      type: "hr_complaint_classification",
      poMatch: "yes",
      confidence: { modelCertainty: 0.90, ruleMatch: 0.91, dataCompleteness: 0.93, anomalySignal: 0.11 },
      hiddenFlags: ["involves_c_suite_executive", "reputational_risk"],
      description:
        "Complaint about inappropriate comments during a team dinner — the accused is a C-suite executive, though the complaint language makes it sound minor.",
      teachingPoint:
        "Confidence is high, but the seniority of the accused transforms the authority profile. Non-delegable regardless of how minor the allegation appears.",
    },
    // ── Hazard 2: evidence suggests pattern, not single incident ─────────────
    {
      id: id(),
      vendor: "Katariina Laine",
      amount: 0,
      type: "evidence_assessment",
      poMatch: "partial",
      confidence: { modelCertainty: 0.86, ruleMatch: 0.78, dataCompleteness: 0.84, anomalySignal: 0.20 },
      hiddenFlags: ["pattern_of_behavior", "multiple_prior_informal_complaints"],
      description:
        "Evidence review for a single reported bullying incident, but file cross-reference reveals three prior informal complaints against the same individual over 18 months.",
      teachingPoint:
        "Pattern recognition is a delegation question, not a confidence question — a single incident could be auto-processed, but a pattern requires escalation.",
    },
  ]);
}

// ────────────────────────────────────────────────────────────────────────────
// Round 2 — 12 cases, full mix, includes non-delegable outcome recommendation
// ────────────────────────────────────────────────────────────────────────────

export function hrRound2Batch(): Invoice[] {
  resetIds("HR", 2001);
  return build([
    {
      id: id(),
      vendor: "Liselotte Braun",
      amount: 0,
      type: "hr_complaint_classification",
      poMatch: "yes",
      confidence: { modelCertainty: 0.94, ruleMatch: 0.96, dataCompleteness: 0.97, anomalySignal: 0.05 },
      hiddenFlags: [],
      description: "Noise complaint about open-plan seating arrangement.",
      teachingPoint: "Standard classification.",
    },
    {
      id: id(),
      vendor: "Piotr Zieliński",
      amount: 0,
      type: "hr_complaint_classification",
      poMatch: "yes",
      confidence: { modelCertainty: 0.92, ruleMatch: 0.93, dataCompleteness: 0.96, anomalySignal: 0.07 },
      hiddenFlags: [],
      description: "Complaint about unequal distribution of overtime shifts.",
      teachingPoint: "Standard classification.",
    },
    {
      id: id(),
      vendor: "Sigrid Halvorsen",
      amount: 0,
      type: "evidence_assessment",
      poMatch: "yes",
      confidence: { modelCertainty: 0.93, ruleMatch: 0.95, dataCompleteness: 0.97, anomalySignal: 0.06 },
      hiddenFlags: [],
      description: "Evidence sufficient for a minor policy breach — employee used company printer for personal use.",
      teachingPoint: "Standard evidence assessment.",
    },
    {
      id: id(),
      vendor: "Máté Kovács",
      amount: 0,
      type: "evidence_assessment",
      poMatch: "partial",
      confidence: { modelCertainty: 0.83, ruleMatch: 0.72, dataCompleteness: 0.86, anomalySignal: 0.18 },
      hiddenFlags: [],
      description: "Ambiguous evidence in a social media policy case — employee's post could be satire or genuine grievance.",
      teachingPoint: "Borderline evidence assessment — judgment-dependent.",
    },
    // ── witness interview prep
    {
      id: id(),
      vendor: "Amélie Fontaine",
      amount: 0,
      type: "witness_interview_prep",
      poMatch: "yes",
      confidence: { modelCertainty: 0.94, ruleMatch: 0.96, dataCompleteness: 0.98, anomalySignal: 0.04 },
      hiddenFlags: [],
      description: "Assemble interview pack for a harassment claim — three witnesses identified.",
      teachingPoint: "Witness prep — Prepare & Present.",
    },
    {
      id: id(),
      vendor: "Jakub Novotný",
      amount: 0,
      type: "witness_interview_prep",
      poMatch: "partial",
      confidence: { modelCertainty: 0.85, ruleMatch: 0.76, dataCompleteness: 0.88, anomalySignal: 0.16 },
      hiddenFlags: [],
      description: "Interview prep for a whistleblower case — need to protect identity while assembling context.",
      teachingPoint: "Sensitive witness prep — requires careful human review of materials.",
    },
    // ── outcome recommendation (non-delegable)
    {
      id: id(),
      vendor: "Klara Sundström",
      amount: 0,
      type: "outcome_recommendation",
      poMatch: "no",
      confidence: { modelCertainty: 0.78, ruleMatch: 0.62, dataCompleteness: 0.80, anomalySignal: 0.25 },
      hiddenFlags: ["non_delegable_outcome", "career_impact"],
      description: "Recommend substantiated finding for repeated tardiness — affects employee's performance rating and bonus eligibility.",
      teachingPoint: "Outcome recommendation is non-delegable — it affects careers and is irreversible. Prepare & Present only.",
    },
    // ── disciplinary action
    {
      id: id(),
      vendor: "Olivier Petit",
      amount: 0,
      type: "disciplinary_action",
      poMatch: "no",
      confidence: { modelCertainty: 0.76, ruleMatch: 0.58, dataCompleteness: 0.78, anomalySignal: 0.28 },
      hiddenFlags: ["senior_hr_signoff_required", "potential_legal_challenge"],
      description: "Written warning for data handling breach — employee's union representative has already been notified.",
      teachingPoint: "Disciplinary action requires senior HR sign-off — Prepare & Present with legal review.",
    },
    // ── Friday afternoon: looks minor but involves senior executive
    {
      id: id(),
      vendor: "Birgit Schröder",
      amount: 0,
      type: "hr_complaint_classification",
      poMatch: "yes",
      confidence: { modelCertainty: 0.91, ruleMatch: 0.92, dataCompleteness: 0.94, anomalySignal: 0.10 },
      hiddenFlags: ["involves_board_member", "reputational_risk", "media_sensitivity"],
      description:
        "Routine-seeming complaint about meeting conduct, but the accused is a board member and the complainant has hinted at going to the press.",
      teachingPoint:
        "The Friday afternoon trap: confidence is high and the complaint looks routine, but the board member's involvement and media risk make it non-delegable.",
    },
    // ── routine fillers
    {
      id: id(),
      vendor: "Thérèse Dupont",
      amount: 0,
      type: "hr_complaint_classification",
      poMatch: "yes",
      confidence: { modelCertainty: 0.93, ruleMatch: 0.95, dataCompleteness: 0.97, anomalySignal: 0.05 },
      hiddenFlags: [],
      description: "Parking allocation dispute.",
      teachingPoint: "Standard classification.",
    },
    {
      id: id(),
      vendor: "Arne Vestergaard",
      amount: 0,
      type: "hr_complaint_classification",
      poMatch: "yes",
      confidence: { modelCertainty: 0.94, ruleMatch: 0.96, dataCompleteness: 0.98, anomalySignal: 0.04 },
      hiddenFlags: [],
      description: "Remote work policy clarification request logged as complaint.",
      teachingPoint: "Standard classification.",
    },
    {
      id: id(),
      vendor: "Valentina Rossi",
      amount: 0,
      type: "evidence_assessment",
      poMatch: "yes",
      confidence: { modelCertainty: 0.95, ruleMatch: 0.97, dataCompleteness: 0.98, anomalySignal: 0.04 },
      hiddenFlags: [],
      description: "Clear evidence of minor IT acceptable-use policy breach — single incident, employee acknowledged.",
      teachingPoint: "Standard evidence assessment.",
    },
  ]);
}

// ────────────────────────────────────────────────────────────────────────────
// Round 3 — 15 cases, multi-department coordination + conflict of interest
// ────────────────────────────────────────────────────────────────────────────

export function hrRound3Batch(): Invoice[] {
  resetIds("HR", 3001);
  return build([
    {
      id: id(),
      vendor: "Nils Johansson",
      amount: 0,
      type: "hr_complaint_classification",
      poMatch: "yes",
      confidence: { modelCertainty: 0.94, ruleMatch: 0.96, dataCompleteness: 0.97, anomalySignal: 0.06 },
      hiddenFlags: [],
      description: "Routine dress code complaint.",
      teachingPoint: "Standard.",
    },
    {
      id: id(),
      vendor: "Miriam Bauer",
      amount: 0,
      type: "hr_complaint_classification",
      poMatch: "yes",
      confidence: { modelCertainty: 0.93, ruleMatch: 0.95, dataCompleteness: 0.96, anomalySignal: 0.06 },
      hiddenFlags: [],
      description: "Complaint about kitchen cleanliness on the 4th floor.",
      teachingPoint: "Standard.",
    },
    {
      id: id(),
      vendor: "Kristoffer Dahl",
      amount: 0,
      type: "evidence_assessment",
      poMatch: "yes",
      confidence: { modelCertainty: 0.92, ruleMatch: 0.94, dataCompleteness: 0.96, anomalySignal: 0.07 },
      hiddenFlags: [],
      description: "Evidence review for a minor attendance issue — clear documentation.",
      teachingPoint: "Standard evidence assessment.",
    },
    {
      id: id(),
      vendor: "Agnès Martin",
      amount: 0,
      type: "witness_interview_prep",
      poMatch: "yes",
      confidence: { modelCertainty: 0.91, ruleMatch: 0.93, dataCompleteness: 0.95, anomalySignal: 0.08 },
      hiddenFlags: [],
      description: "Prepare interview materials for a straightforward equipment misuse case.",
      teachingPoint: "Standard witness prep.",
    },
    {
      id: id(),
      vendor: "Petr Horák",
      amount: 0,
      type: "hr_complaint_classification",
      poMatch: "yes",
      confidence: { modelCertainty: 0.95, ruleMatch: 0.97, dataCompleteness: 0.98, anomalySignal: 0.04 },
      hiddenFlags: [],
      description: "Holiday request denial complaint — clear policy applies.",
      teachingPoint: "Standard.",
    },
    {
      id: id(),
      vendor: "Hanna Lindgren",
      amount: 0,
      type: "evidence_assessment",
      poMatch: "yes",
      confidence: { modelCertainty: 0.93, ruleMatch: 0.95, dataCompleteness: 0.96, anomalySignal: 0.06 },
      hiddenFlags: [],
      description: "Email evidence sufficient for an information security breach — employee forwarded internal docs to personal email.",
      teachingPoint: "Standard evidence assessment.",
    },
    // ── outcome recommendation (non-delegable)
    {
      id: id(),
      vendor: "Bogdan Ionescu",
      amount: 0,
      type: "outcome_recommendation",
      poMatch: "no",
      confidence: { modelCertainty: 0.77, ruleMatch: 0.60, dataCompleteness: 0.79, anomalySignal: 0.26 },
      hiddenFlags: ["non_delegable_outcome", "career_impact", "potential_termination"],
      description: "Recommend finding for substantiated gross misconduct — potential termination. Investigation revealed falsified expense claims over six months.",
      teachingPoint: "Outcome recommendation is non-delegable, especially when termination is a possible consequence.",
    },
    // ── disciplinary action
    {
      id: id(),
      vendor: "Elodie Marchand",
      amount: 0,
      type: "disciplinary_action",
      poMatch: "no",
      confidence: { modelCertainty: 0.74, ruleMatch: 0.56, dataCompleteness: 0.76, anomalySignal: 0.30 },
      hiddenFlags: ["senior_hr_signoff_required", "potential_legal_challenge", "union_involvement"],
      description: "Final written warning for repeated policy violations — union has filed a formal grievance challenging the process.",
      teachingPoint: "Disciplinary action with union challenge requires senior HR and legal review.",
    },
    // ── escalation test
    {
      id: id(),
      vendor: "Stefan Peeters",
      amount: 0,
      type: "evidence_assessment",
      poMatch: "partial",
      confidence: { modelCertainty: 0.86, ruleMatch: 0.80, dataCompleteness: 0.88, anomalySignal: 0.15 },
      hiddenFlags: ["pattern_of_behavior", "cross_department_pattern"],
      description: "Evidence assessment for a harassment complaint — cross-referencing reveals similar complaints in two other departments.",
      teachingPoint: "Tests whether the player closed the escalation gap for pattern recognition.",
    },
    // ── multi-department coordination case
    {
      id: id(),
      vendor: "Ingrid Magnusson",
      amount: 0,
      type: "hr_complaint_classification",
      poMatch: "no",
      confidence: { modelCertainty: 0.78, ruleMatch: 0.62, dataCompleteness: 0.80, anomalySignal: 0.24 },
      hiddenFlags: ["multi_department_coordination", "it_security_involvement", "legal_hold_required", "paired_with_HR-3011"],
      description:
        "Complaint alleges data exfiltration by a departing employee — requires HR, IT Security, and Legal to coordinate a forensic hold and investigation.",
      teachingPoint:
        "Multi-department coordination: no single team has authority to act alone. Coordinate & Escalate is the only viable pattern.",
    },
    {
      id: id(),
      vendor: "Marcus Lehmann",
      amount: 0,
      type: "evidence_assessment",
      poMatch: "no",
      confidence: { modelCertainty: 0.80, ruleMatch: 0.65, dataCompleteness: 0.82, anomalySignal: 0.22 },
      hiddenFlags: ["multi_department_coordination", "paired_with_HR-3010", "digital_forensics_required"],
      description:
        "IT Security's preliminary findings on the data exfiltration case — needs HR to assess whether evidence meets the threshold for formal proceedings.",
      teachingPoint:
        "Coordinate & Escalate: companion to the multi-department case — cross-team context is essential.",
    },
    // ── conflict of interest: accused is the investigator's manager
    {
      id: id(),
      vendor: "Annelies Vermeer",
      amount: 0,
      type: "hr_complaint_classification",
      poMatch: "no",
      confidence: { modelCertainty: 0.84, ruleMatch: 0.75, dataCompleteness: 0.86, anomalySignal: 0.19 },
      hiddenFlags: ["conflict_of_interest", "accused_is_investigators_manager", "reassignment_required"],
      description:
        "Complaint about expense policy abuse — the accused employee is the direct manager of the assigned investigator, creating an unresolvable conflict of interest.",
      teachingPoint:
        "Conflict of interest cannot be resolved by confidence. The case must be reassigned before any assessment. Authority boundary, not data quality, is the issue.",
    },
    // ── routine fillers
    {
      id: id(),
      vendor: "Ville Heikkinen",
      amount: 0,
      type: "hr_complaint_classification",
      poMatch: "yes",
      confidence: { modelCertainty: 0.93, ruleMatch: 0.95, dataCompleteness: 0.96, anomalySignal: 0.06 },
      hiddenFlags: [],
      description: "Break room microwave usage complaint.",
      teachingPoint: "Standard.",
    },
    {
      id: id(),
      vendor: "Dorothée Lambert",
      amount: 0,
      type: "hr_complaint_classification",
      poMatch: "yes",
      confidence: { modelCertainty: 0.94, ruleMatch: 0.96, dataCompleteness: 0.97, anomalySignal: 0.05 },
      hiddenFlags: [],
      description: "Team restructuring communication complaint.",
      teachingPoint: "Standard.",
    },
    {
      id: id(),
      vendor: "Bence Tóth",
      amount: 0,
      type: "evidence_assessment",
      poMatch: "yes",
      confidence: { modelCertainty: 0.93, ruleMatch: 0.95, dataCompleteness: 0.96, anomalySignal: 0.06 },
      hiddenFlags: [],
      description: "Straightforward evidence review for a laptop damage claim.",
      teachingPoint: "Standard evidence assessment.",
    },
  ]);
}

// ════════════════════════════════════════════════════════════════════════════
// UNIFIED DISPATCH
// ════════════════════════════════════════════════════════════════════════════

/**
 * Returns the correct fallback batch for any scenario + round combination.
 * Falls back to the original invoice processing batches when the scenario
 * is "invoice_processing".
 */
export function fallbackBatchForScenario(
  scenario: ScenarioDomain,
  round: RoundNumber
): Invoice[] {
  switch (scenario) {
    case "invoice_processing":
      return fallbackBatch(round);

    case "customer_complaints":
      if (round === 1) return complaintsRound1Batch();
      if (round === 2) return complaintsRound2Batch();
      return complaintsRound3Batch();

    case "aml_triage":
      if (round === 1) return amlRound1Batch();
      if (round === 2) return amlRound2Batch();
      return amlRound3Batch();

    case "hr_investigation":
      if (round === 1) return hrRound1Batch();
      if (round === 2) return hrRound2Batch();
      return hrRound3Batch();

    default: {
      const _exhaustive: never = scenario;
      return fallbackBatch(round);
    }
  }
}
