"use client";

import { CheckCircle2, Eye, AlertOctagon, ShieldAlert } from "lucide-react";
import type { ProcessedInvoice, RoutingBand } from "../lib/types";

const BAND_STYLES: Record<
  RoutingBand,
  { label: string; bg: string; border: string; text: string; icon: React.ReactNode }
> = {
  auto_approve: {
    label: "Auto-approved",
    bg: "bg-green/10",
    border: "border-green-bright/40",
    text: "text-green-bright",
    icon: <CheckCircle2 size={14} />,
  },
  human_review: {
    label: "Human review",
    bg: "bg-amber/10",
    border: "border-amber/40",
    text: "text-amber",
    icon: <Eye size={14} />,
  },
  escalation: {
    label: "Escalated",
    bg: "bg-red/10",
    border: "border-red/40",
    text: "text-red-bright",
    icon: <AlertOctagon size={14} />,
  },
  blocked: {
    label: "Blocked",
    bg: "bg-red/15",
    border: "border-red/60",
    text: "text-red-bright",
    icon: <ShieldAlert size={14} />,
  },
};

const TYPE_LABELS: Record<string, string> = {
  // Invoice processing
  standard: "Std",
  high_value: "High €",
  duplicate: "Dupe?",
  modified_terms: "Mod terms",
  new_vendor: "New vendor",
  split_invoice: "Split",
  // Customer complaints
  complaint_classification: "Classify",
  response_generation: "Response",
  regulatory_reporting: "Reg report",
  compensation_authorization: "Comp auth",
  escalation_to_ombudsman: "Ombudsman",
  // AML triage
  alert_classification: "Classify",
  auto_dismissal: "Dismiss",
  investigation_escalation: "Escalate",
  sar_preparation: "SAR prep",
  cross_border_coordination: "Cross-border",
  // HR investigation
  hr_complaint_classification: "Classify",
  evidence_assessment: "Evidence",
  witness_interview_prep: "Interview",
  outcome_recommendation: "Outcome",
  disciplinary_action: "Discipline",
};

export function InvoiceCard({ p, compact = false }: { p: ProcessedInvoice; compact?: boolean }) {
  const style = BAND_STYLES[p.band];
  const isHazard = p.invoice.hiddenFlags.length > 0;
  return (
    <div
      className={`surface px-3 py-2.5 border ${style.border} ${style.bg} animate-fade-up`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-muted-2 whitespace-nowrap overflow-hidden">
            <span className="text-cyan">{p.invoice.id}</span>
            <span>·</span>
            <span>{TYPE_LABELS[p.invoice.type] ?? p.invoice.type}</span>
            {isHazard && <span className="text-amber">⚠</span>}
          </div>
          <div className="font-sans text-[13px] text-ink truncate mt-0.5">
            {p.invoice.vendor}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="font-sans text-[14px] font-bold text-ink tabular-nums">
            €{p.invoice.amount.toLocaleString("de-DE")}
          </div>
          <div className="font-sans text-[10px] text-muted-2 tabular-nums">
            {(p.invoice.composite * 100).toFixed(0)}% confidence
          </div>
        </div>
      </div>
      <div
        className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] font-bold ${style.text} ${style.bg} border ${style.border}`}
      >
        {style.icon}
        {style.label}
        {p.patternUsed && <span className="opacity-70">· {p.patternUsed.replace("_", " & ")}</span>}
      </div>
      {!compact && p.invoice.description && (
        <div className="mt-2 text-[11.5px] text-muted leading-snug">
          {p.invoice.description}
        </div>
      )}
    </div>
  );
}
