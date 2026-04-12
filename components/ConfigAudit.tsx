"use client";

import { useState } from "react";
import { ArrowRight, AlertTriangle, FileSearch, GitBranch } from "lucide-react";
import { useGame } from "../lib/game-state";
import { PRE_EVENTS } from "../data/vaom-text";
import type { R3PreEvents } from "../lib/types";

/**
 * Round 3 pre-events. Three governance decisions the player must make
 * BEFORE the simulation runs:
 *
 *   1. Foundation model drift response — affects whether thresholds stay
 *      calibrated when the upstream model shifts.
 *   2. Audit evidence level — affects whether the regulator's request
 *      can be answered.
 *   3. Escalation gap fix — affects whether the modified-terms invoice
 *      slips through again.
 *
 * Each choice is a fragment of the Readiness Assessment in disguise.
 */

const DRIFT_OPTIONS = PRE_EVENTS.drift.options;
const AUDIT_OPTIONS = PRE_EVENTS.audit.options;
const ESC_OPTIONS = PRE_EVENTS.escalation.options;

type DriftId = (typeof DRIFT_OPTIONS)[number]["id"];
type AuditId = (typeof AUDIT_OPTIONS)[number]["id"];
type EscId = (typeof ESC_OPTIONS)[number]["id"];

export function ConfigAudit() {
  const { setR3, advance } = useGame();
  const [drift, setDrift] = useState<DriftId>("regression_test");
  const [audit, setAudit] = useState<AuditId>("standard");
  const [esc, setEsc] = useState<EscId>("define_path");

  const handleStart = () => {
    const pre: R3PreEvents = {
      driftResponse: drift,
      evidenceLevel: audit,
      escalationFix: esc,
    };
    setR3(pre);
    advance("simulation");
  };

  return (
    <div className="min-h-screen px-6 py-12 animate-fade-in">
      <div className="max-w-5xl mx-auto">
        <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-cyan font-bold mb-2">
          Round 3 · Pre-events
        </div>
        <h1 className="font-mono text-[28px] md:text-[36px] font-bold text-mint mb-3">
          Three things require your attention.
        </h1>
        <p className="text-[14px] text-muted leading-relaxed max-w-3xl">
          Before the next simulation can run, you need to address three governance events. Each one tests a different readiness condition. Each one has consequences when the invoices start arriving.
        </p>

        <div className="space-y-5 mt-8">
          <PreEventCard
            num={1}
            icon={<AlertTriangle size={16} />}
            title={PRE_EVENTS.drift.title}
            body={PRE_EVENTS.drift.body}
            options={DRIFT_OPTIONS}
            value={drift}
            onChange={(v) => setDrift(v as DriftId)}
          />
          <PreEventCard
            num={2}
            icon={<FileSearch size={16} />}
            title={PRE_EVENTS.audit.title}
            body={PRE_EVENTS.audit.body}
            options={AUDIT_OPTIONS}
            value={audit}
            onChange={(v) => setAudit(v as AuditId)}
          />
          <PreEventCard
            num={3}
            icon={<GitBranch size={16} />}
            title={PRE_EVENTS.escalation.title}
            body={PRE_EVENTS.escalation.body}
            options={ESC_OPTIONS}
            value={esc}
            onChange={(v) => setEsc(v as EscId)}
          />
        </div>

        <div className="mt-8 flex items-center justify-end">
          <button
            onClick={handleStart}
            className="group inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-amber to-amber/80 text-bg-1 font-bold font-mono uppercase tracking-[0.18em] text-[11px] px-6 py-3 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(232,185,49,0.35)] transition-all focus-ring"
          >
            Run final simulation
            <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
}

type Option = { id: string; label: string; detail: string };

function PreEventCard({
  num,
  icon,
  title,
  body,
  options,
  value,
  onChange,
}: {
  num: number;
  icon: React.ReactNode;
  title: string;
  body: string;
  options: readonly Option[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="surface-strong px-6 py-5">
      <div className="flex items-start gap-4 mb-4">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber/15 border border-amber/40 flex items-center justify-center text-amber">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-cyan font-bold">
            Pre-event {num}
          </div>
          <div className="font-mono text-[16px] font-bold text-mint mt-0.5">
            {title}
          </div>
          <p className="text-[12.5px] text-muted leading-relaxed mt-1.5">{body}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {options.map((opt) => {
          const active = value === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => onChange(opt.id)}
              className={`text-left rounded-xl px-3.5 py-3 border transition focus-ring ${
                active
                  ? "border-amber/60 bg-amber/8"
                  : "border-white/10 bg-white/3 hover:border-white/25"
              }`}
            >
              <div className="font-mono text-[11.5px] font-bold text-ink">
                {opt.label}
              </div>
              <div className="text-[11px] text-muted leading-snug mt-1">
                {opt.detail}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
