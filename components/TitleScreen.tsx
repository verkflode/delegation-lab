"use client";

import { useState } from "react";
import { ArrowRight, Cpu, FileText, Lock, Moon, ShieldCheck, Users, Workflow } from "lucide-react";
import { VerkflodeLogo } from "./VerkflodeLogo";
import { useGame } from "../lib/game-state";
import type { ScenarioDomain } from "../lib/types";

const SCENARIOS: {
  id: ScenarioDomain;
  label: string;
  sub: string;
  icon: React.ReactNode;
  available: boolean;
}[] = [
  { id: "invoice_processing", label: "Invoice processing", sub: "Accounts payable at a European financial services firm", icon: <FileText size={14} />, available: true },
  { id: "aml_triage", label: "AML triage", sub: "Transaction monitoring alert classification · coming later", icon: <ShieldCheck size={14} />, available: false },
  { id: "customer_complaints", label: "Customer complaints", sub: "Retail banking complaint triage and response · coming later", icon: <Users size={14} />, available: false },
  { id: "hr_investigation", label: "HR investigation", sub: "Policy violation assessment · coming later", icon: <Cpu size={14} />, available: false },
];

export function TitleScreen() {
  const { start, setScenario } = useGame();
  const [selectedScenario, setSelectedScenario] = useState<ScenarioDomain>("invoice_processing");

  const handleStart = () => {
    start(selectedScenario);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-16 animate-fade-in">
      <div className="w-full max-w-5xl">
        {/* Logo + brand row */}
        <div className="flex items-center gap-5 mb-10">
          <VerkflodeLogo height={56} />
          <div className="border-l border-ink/10 pl-5">
            <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-cyan font-bold">
              An Open Framework Simulation
            </div>
            <div className="font-sans text-[13px] text-muted mt-0.5">
              Verkflöde Agent Operating Model (VAOM) · v5.0
            </div>
          </div>
        </div>

        {/* Headline */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-12 items-start">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-amber font-bold mb-3">
              Delegation Lab
            </div>
            <h1 className="font-serif text-[44px] md:text-[56px] leading-[1.05] font-normal tracking-tight text-mint mb-6">
              A flight simulator
              <br />
              for AI governance.
            </h1>
            <p className="text-[15px] leading-[1.75] text-muted max-w-xl mb-3">
              You are the new Head of AI Operations at a European enterprise. The board has approved an AI agent for accounts payable. Your job: write its delegation matrix, put the VAOM Guardian in front of it, run the workflow, and live with the consequences.
            </p>
            <p className="text-[15px] leading-[1.75] text-muted max-w-xl">
              Four rounds. About ten minutes. One delegation design, tested at 2 a.m.
            </p>

            <button
              onClick={handleStart}
              className="cta mt-10 group inline-flex items-center gap-3 rounded-full font-bold font-mono uppercase tracking-[0.18em] text-[12px] px-7 py-4 focus-ring"
            >
              Start the campaign
              <ArrowRight
                size={16}
                className="group-hover:translate-x-1 transition-transform"
              />
            </button>

            <div className="mt-6 flex flex-wrap items-center gap-3 text-[11px] font-mono text-muted-2">
              <span className="rounded-full border border-ink/8 bg-ink/3 px-3 py-1">
                Open framework
              </span>
              <span className="rounded-full border border-ink/8 bg-ink/3 px-3 py-1">
                CC BY 4.0
              </span>
              <span className="rounded-full border border-ink/8 bg-ink/3 px-3 py-1">
                Hosted in the EU · no cookies
              </span>
              <span className="rounded-full border border-ink/8 bg-ink/3 px-3 py-1">
                ~10 minutes
              </span>
            </div>

            <p className="mt-4 font-mono text-[10px] text-muted-2 leading-relaxed max-w-xl">
              Built by Claude Fable 5 under Verkflöde direction, using the
              Draft &amp; Approve pattern this game teaches. Every decision in it
              is made by the VAOM Guardian; VAOM&apos;s voice is written live by a
              language model from the game&apos;s own facts.{" "}
              <a href="/privacy" className="underline hover:text-cyan">Privacy</a>
            </p>
          </div>

          <div className="space-y-5">
            {/* Scenario picker */}
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan font-bold mb-2">
                Choose scenario
              </div>
              <div className="grid grid-cols-1 gap-2">
                {SCENARIOS.map((sc) => (
                  <button
                    key={sc.id}
                    disabled={!sc.available}
                    onClick={() => sc.available && setSelectedScenario(sc.id)}
                    className={`text-left rounded-2xl px-4 py-3 transition focus-ring ${
                      selectedScenario === sc.id && sc.available
                        ? "border-2 border-cyan bg-cyan/8"
                        : sc.available
                          ? "border border-border bg-surface hover:border-cyan/40"
                          : "border border-border-soft bg-surface-2 opacity-40 cursor-not-allowed"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-cyan">{sc.icon}</span>
                      <span className="font-mono text-[12px] font-bold text-ink">{sc.label}</span>
                      {!sc.available && <Lock size={10} className="text-muted-2 ml-auto" />}
                      {sc.available && selectedScenario === sc.id && (
                        <span className="ml-auto font-mono text-[9px] uppercase tracking-wider text-mint">Selected</span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted leading-snug mt-1">{sc.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Round preview cards */}
            <div className="space-y-2">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-2 mb-1">
                Four rounds
              </div>
              <RoundPreview
                icon={<Workflow size={16} />}
                num={1}
                title="The Matrix"
                concept="Decision Inventory"
                line="Name the decisions, hidden ones included. Profile them, route them, give each an owner."
              />
              <RoundPreview
                icon={<Cpu size={16} />}
                num={2}
                title="The Gate"
                concept="Calibrated Thresholds"
                line="Choose an error target and let calibration set the threshold. Then the ceiling and the caps."
              />
              <RoundPreview
                icon={<ShieldCheck size={16} />}
                num={3}
                title="The Reviewer"
                concept="Funded Oversight"
                line="Fund the review, then do it yourself. The scorecard reads your clicks."
              />
              <RoundPreview
                icon={<Moon size={16} />}
                num={4}
                title="The 2 A.M. Test"
                concept="Proven Boundaries"
                line="Sub-agents spawn. Something tests your boundaries. You are asleep."
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RoundPreview({
  icon,
  num,
  title,
  concept,
  line,
}: {
  icon: React.ReactNode;
  num: number;
  title: string;
  concept: string;
  line: string;
}) {
  return (
    <div className="surface-strong px-5 py-4 transition hover:translate-x-[-2px] hover:bg-ink/5">
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-cyan font-bold">
        <span className="inline-flex items-center justify-center w-5 h-5 rounded border border-cyan/40 text-[10px]">
          {num}
        </span>
        Round {num}
        <span className="text-muted-2">·</span>
        <span className="text-mint">{concept}</span>
      </div>
      <div className="mt-2 flex items-start gap-3">
        <div className="text-mint mt-0.5">{icon}</div>
        <div>
          <div className="font-mono text-[14px] font-bold text-ink">{title}</div>
          <div className="text-[12.5px] text-muted leading-snug mt-1">{line}</div>
        </div>
      </div>
    </div>
  );
}
