import type {
  DecisionType,
  DecompositionProfile,
  DelegationPattern,
  ScenarioDomain,
} from "../lib/types";

export type ScenarioConfig = {
  label: string;
  domain: string;
  itemPrefix: string; // INV, COMP, ALR, HR
  itemNoun: string; // "invoice", "complaint", "alert", "case"
  itemNounPlural: string;
  sourceNoun: string; // "vendor", "customer", "system", "employee"
  decisionTypes: DecisionType[];
  /** Subset of patterns the player can assign in Round 2 config. */
  assignablePatterns: DelegationPattern[];
  typeMeta: Record<
    string,
    {
      label: string;
      blurb: string;
      decomposition: DecompositionProfile;
      recommendedPattern: DelegationPattern;
      acceptablePatterns: DelegationPattern[];
    }
  >;
};

export const SCENARIOS: Record<ScenarioDomain, ScenarioConfig> = {
  // ────────────────────────────────────────────────────────────────────
  // INVOICE PROCESSING (default, fully fleshed out from v3.0)
  // ────────────────────────────────────────────────────────────────────
  invoice_processing: {
    label: "Invoice Processing",
    domain: "Accounts payable at a European financial services firm",
    itemPrefix: "INV",
    itemNoun: "invoice",
    itemNounPlural: "invoices",
    sourceNoun: "vendor",
    decisionTypes: ["standard", "high_value", "duplicate", "modified_terms", "new_vendor"],
    assignablePatterns: ["execute_audit", "draft_approve", "triage_route", "prepare_present"],
    typeMeta: {
      standard: {
        label: "Standard invoice (\u2264 \u20AC5k)",
        blurb: "Routine vendor invoice, clear PO match, amount within historical norms.",
        decomposition: { reversibility: "reversible_friction", consequenceScope: "internal_financial", regulatoryExposure: "general_context", confidenceMeasurability: "quantifiable", accountabilityClarity: "clear_owner" },
        recommendedPattern: "execute_audit",
        acceptablePatterns: ["execute_audit", "draft_approve"],
      },
      high_value: {
        label: "High-value invoice (> \u20AC5k)",
        blurb: "Larger amount, often crosses an authority threshold or vendor cap.",
        decomposition: { reversibility: "partially_reversible", consequenceScope: "internal_financial", regulatoryExposure: "general_context", confidenceMeasurability: "quantifiable", accountabilityClarity: "clear_owner" },
        recommendedPattern: "draft_approve",
        acceptablePatterns: ["draft_approve", "prepare_present"],
      },
      duplicate: {
        label: "Duplicate detection anomaly",
        blurb: "Looks like an existing invoice. Could be a re-send, could be fraud.",
        decomposition: { reversibility: "partially_reversible", consequenceScope: "internal_financial", regulatoryExposure: "general_context", confidenceMeasurability: "partially_quantifiable", accountabilityClarity: "shared_defined" },
        recommendedPattern: "triage_route",
        acceptablePatterns: ["triage_route", "draft_approve"],
      },
      modified_terms: {
        label: "Modified payment terms",
        blurb: "Vendor has shifted contract terms (e.g., net-30 \u2192 net-15 with discount). Contractual modification.",
        decomposition: { reversibility: "partially_reversible", consequenceScope: "external_relational", regulatoryExposure: "general_context", confidenceMeasurability: "judgment_dependent", accountabilityClarity: "shared_defined" },
        recommendedPattern: "prepare_present",
        acceptablePatterns: ["prepare_present", "draft_approve"],
      },
      new_vendor: {
        label: "New / unverified vendor",
        blurb: "Vendor not yet in the approved list. KYC and onboarding incomplete.",
        decomposition: { reversibility: "reversible_friction", consequenceScope: "external_relational", regulatoryExposure: "regulated", confidenceMeasurability: "partially_quantifiable", accountabilityClarity: "shared_defined" },
        recommendedPattern: "draft_approve",
        acceptablePatterns: ["draft_approve", "triage_route", "prepare_present"],
      },
    },
  },

  // ────────────────────────────────────────────────────────────────────
  // CUSTOMER COMPLAINTS (VAOM v3.5 §7A)
  // ────────────────────────────────────────────────────────────────────
  customer_complaints: {
    label: "Customer Complaints",
    domain: "Retail banking complaint handling",
    itemPrefix: "COMP",
    itemNoun: "complaint",
    itemNounPlural: "complaints",
    sourceNoun: "customer",
    decisionTypes: [
      "complaint_classification",
      "response_generation",
      "regulatory_reporting",
      "compensation_authorization",
      "escalation_to_ombudsman",
    ],
    assignablePatterns: ["execute_audit", "draft_approve", "triage_route", "prepare_present"],
    typeMeta: {
      complaint_classification: {
        label: "Complaint classification",
        blurb: "Categorize incoming complaint by type, severity, and regulatory relevance.",
        decomposition: { reversibility: "fully_reversible", consequenceScope: "internal_operational", regulatoryExposure: "general_context", confidenceMeasurability: "quantifiable", accountabilityClarity: "clear_owner" },
        recommendedPattern: "triage_route",
        acceptablePatterns: ["triage_route", "execute_audit"],
      },
      response_generation: {
        label: "Response generation",
        blurb: "Draft a response to the customer. Tone, accuracy, and regulatory compliance all matter.",
        decomposition: { reversibility: "partially_reversible", consequenceScope: "external_relational", regulatoryExposure: "general_context", confidenceMeasurability: "partially_quantifiable", accountabilityClarity: "clear_owner" },
        recommendedPattern: "draft_approve",
        acceptablePatterns: ["draft_approve", "prepare_present"],
      },
      regulatory_reporting: {
        label: "Regulatory reporting",
        blurb: "Complaint triggers a regulatory reporting obligation. Filing is non-delegable.",
        decomposition: { reversibility: "irreversible", consequenceScope: "external_regulatory", regulatoryExposure: "regulated", confidenceMeasurability: "judgment_dependent", accountabilityClarity: "clear_owner" },
        recommendedPattern: "prepare_present",
        acceptablePatterns: ["prepare_present"],
      },
      compensation_authorization: {
        label: "Compensation authorization",
        blurb: "Customer requests monetary compensation. Amount and authority threshold determine the path.",
        decomposition: { reversibility: "partially_reversible", consequenceScope: "internal_financial", regulatoryExposure: "general_context", confidenceMeasurability: "quantifiable", accountabilityClarity: "shared_defined" },
        recommendedPattern: "draft_approve",
        acceptablePatterns: ["draft_approve", "prepare_present"],
      },
      escalation_to_ombudsman: {
        label: "Ombudsman escalation",
        blurb: "Customer threatens to escalate to the financial ombudsman. Coordination between complaint handler and legal team.",
        decomposition: { reversibility: "irreversible", consequenceScope: "external_regulatory", regulatoryExposure: "regulated", confidenceMeasurability: "judgment_dependent", accountabilityClarity: "ambiguous" },
        recommendedPattern: "prepare_present",
        acceptablePatterns: ["prepare_present", "coordinate_escalate"],
      },
    },
  },

  // ────────────────────────────────────────────────────────────────────
  // AML TRIAGE (VAOM v3.5 §7B)
  // ────────────────────────────────────────────────────────────────────
  aml_triage: {
    label: "AML Triage",
    domain: "Transaction monitoring at a European bank",
    itemPrefix: "ALR",
    itemNoun: "alert",
    itemNounPlural: "alerts",
    sourceNoun: "system",
    decisionTypes: [
      "alert_classification",
      "auto_dismissal",
      "investigation_escalation",
      "sar_preparation",
      "cross_border_coordination",
    ],
    assignablePatterns: ["execute_audit", "draft_approve", "triage_route", "prepare_present"],
    typeMeta: {
      alert_classification: {
        label: "Alert classification",
        blurb: "Classify the transaction monitoring alert by typology and risk tier.",
        decomposition: { reversibility: "fully_reversible", consequenceScope: "internal_operational", regulatoryExposure: "regulated", confidenceMeasurability: "quantifiable", accountabilityClarity: "clear_owner" },
        recommendedPattern: "triage_route",
        acceptablePatterns: ["triage_route", "execute_audit"],
      },
      auto_dismissal: {
        label: "Auto-dismissal",
        blurb: "Clear false positive — known pattern, low risk, historical precedent supports dismissal.",
        decomposition: { reversibility: "reversible_friction", consequenceScope: "internal_operational", regulatoryExposure: "regulated", confidenceMeasurability: "quantifiable", accountabilityClarity: "clear_owner" },
        recommendedPattern: "execute_audit",
        acceptablePatterns: ["execute_audit", "draft_approve"],
      },
      investigation_escalation: {
        label: "Investigation escalation",
        blurb: "Alert warrants deeper investigation. Assign to an analyst with full context.",
        decomposition: { reversibility: "partially_reversible", consequenceScope: "external_regulatory", regulatoryExposure: "regulated", confidenceMeasurability: "partially_quantifiable", accountabilityClarity: "shared_defined" },
        recommendedPattern: "draft_approve",
        acceptablePatterns: ["draft_approve", "prepare_present"],
      },
      sar_preparation: {
        label: "SAR preparation",
        blurb: "Suspicious Activity Report must be filed. Regulatory deadline applies. Filing is non-delegable.",
        decomposition: { reversibility: "irreversible", consequenceScope: "external_regulatory", regulatoryExposure: "prohibited", confidenceMeasurability: "judgment_dependent", accountabilityClarity: "clear_owner" },
        recommendedPattern: "prepare_present",
        acceptablePatterns: ["prepare_present"],
      },
      cross_border_coordination: {
        label: "Cross-border coordination",
        blurb: "Transaction spans multiple jurisdictions. Multiple compliance teams must coordinate.",
        decomposition: { reversibility: "irreversible", consequenceScope: "external_regulatory", regulatoryExposure: "regulated", confidenceMeasurability: "partially_quantifiable", accountabilityClarity: "ambiguous" },
        recommendedPattern: "coordinate_escalate",
        acceptablePatterns: ["coordinate_escalate", "prepare_present"],
      },
    },
  },

  // ────────────────────────────────────────────────────────────────────
  // HR INVESTIGATION (VAOM v3.5 §7C)
  // ────────────────────────────────────────────────────────────────────
  hr_investigation: {
    label: "HR Investigation",
    domain: "HR policy violation assessment",
    itemPrefix: "HR",
    itemNoun: "case",
    itemNounPlural: "cases",
    sourceNoun: "employee",
    decisionTypes: [
      "hr_complaint_classification",
      "evidence_assessment",
      "witness_interview_prep",
      "outcome_recommendation",
      "disciplinary_action",
    ],
    assignablePatterns: ["execute_audit", "draft_approve", "triage_route", "prepare_present"],
    typeMeta: {
      hr_complaint_classification: {
        label: "Complaint classification",
        blurb: "Categorize the reported violation by type and severity. Routes the investigation.",
        decomposition: { reversibility: "fully_reversible", consequenceScope: "internal_operational", regulatoryExposure: "general_context", confidenceMeasurability: "quantifiable", accountabilityClarity: "clear_owner" },
        recommendedPattern: "triage_route",
        acceptablePatterns: ["triage_route", "execute_audit"],
      },
      evidence_assessment: {
        label: "Evidence sufficiency",
        blurb: "Assess whether gathered evidence meets the threshold for formal proceedings.",
        decomposition: { reversibility: "reversible_friction", consequenceScope: "internal_operational", regulatoryExposure: "general_context", confidenceMeasurability: "partially_quantifiable", accountabilityClarity: "shared_defined" },
        recommendedPattern: "draft_approve",
        acceptablePatterns: ["draft_approve", "prepare_present"],
      },
      witness_interview_prep: {
        label: "Witness interview preparation",
        blurb: "Assemble context, prior statements, and relevant policy for the investigator.",
        decomposition: { reversibility: "fully_reversible", consequenceScope: "internal_operational", regulatoryExposure: "general_context", confidenceMeasurability: "quantifiable", accountabilityClarity: "clear_owner" },
        recommendedPattern: "prepare_present",
        acceptablePatterns: ["prepare_present"],
      },
      outcome_recommendation: {
        label: "Outcome recommendation",
        blurb: "Recommend a finding (substantiated/unsubstantiated). Affects careers. Non-delegable.",
        decomposition: { reversibility: "irreversible", consequenceScope: "external_relational", regulatoryExposure: "regulated", confidenceMeasurability: "judgment_dependent", accountabilityClarity: "clear_owner" },
        recommendedPattern: "prepare_present",
        acceptablePatterns: ["prepare_present"],
      },
      disciplinary_action: {
        label: "Disciplinary action",
        blurb: "Determine and authorize the disciplinary measure. Requires senior HR sign-off.",
        decomposition: { reversibility: "irreversible", consequenceScope: "external_relational", regulatoryExposure: "regulated", confidenceMeasurability: "judgment_dependent", accountabilityClarity: "shared_defined" },
        recommendedPattern: "prepare_present",
        acceptablePatterns: ["prepare_present", "draft_approve"],
      },
    },
  },
};
