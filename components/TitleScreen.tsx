"use client";

import { useState } from "react";
import { ArrowRight, Cpu, FileText, Lock, ShieldCheck, Users, Workflow } from "lucide-react";
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
  { id: "customer_complaints", label: "Customer complaints", sub: "Retail banking complaint triage and response", icon: <Users size={14} />, available: true },
  { id: "aml_triage", label: "AML triage", sub: "Transaction monitoring alert classification", icon: <ShieldCheck size={14} />, available: true },
  { id: "hr_investigation", label: "HR investigation", sub: "Policy violation assessment and outcome recommendation", icon: <Cpu size={14} />, available: true },
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
          <div className="border-l border-white/10 pl-5">
            <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-cyan font-bold">
              An Open Framework Simulation
            </div>
            <div className="font-sans text-[13px] text-muted mt-0.5">
              Verkflöde Agent Operating Model · v3.5
            </div>
          </div>
        </div>

        {/* Headline */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-12 items-start">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-amber font-bold mb-3">
              Delegation Lab
            </div>
            <h1 className="font-mono text-[44px] md:text-[56px] leading-[1.05] font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-mint via-cyan to-mint mb-6">
              A flight simulator
              <br />
              for AI governance.
            </h1>
            <p className="text-[15px] leading-[1.75] text-muted max-w-xl mb-3">
              You are the new Head of AI Operations at a European financial services firm. The board has approved AI for accounts payable. Your job: design the delegation policy, run the simulation, and live with the consequences.
            </p>
            <p className="text-[15px] leading-[1.75] text-muted max-w-xl">
              Three rounds. Five to seven minutes. One delegation philosophy.
            </p>

            <button
              onClick={handleStart}
              className="mt-10 group inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-amber to-amber/80 text-bg-1 font-bold font-mono uppercase tracking-[0.18em] text-[12px] px-7 py-4 hover:scale-[1.02] hover:shadow-[0_0_40px_rgba(232,185,49,0.35)] transition-all focus-ring"
            >
              Start the campaign
              <ArrowRight
                size={16}
                className="group-hover:translate-x-1 transition-transform"
              />
            </button>

            <div className="mt-6 flex flex-wrap items-center gap-3 text-[11px] font-mono text-muted-2">
              <span className="rounded-full border border-white/8 bg-white/3 px-3 py-1">
                Open framework
              </span>
              <span className="rounded-full border border-white/8 bg-white/3 px-3 py-1">
                CC BY 4.0
              </span>
              <span className="rounded-full border border-white/8 bg-white/3 px-3 py-1">
                EU data residency
              </span>
              <span className="rounded-full border border-white/8 bg-white/3 px-3 py-1">
                ~6 minutes
              </span>
            </div>
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
                        ? "border-2 border-amber bg-[rgba(232,185,49,0.12)]"
                        : sc.available
                          ? "border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.2)]"
                          : "border border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.02)] opacity-40 cursor-not-allowed"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={selectedScenario === sc.id ? "text-amber" : "text-cyan"}>{sc.icon}</span>
                      <span className="font-mono text-[12px] font-bold text-ink">{sc.label}</span>
                      {!sc.available && <Lock size={10} className="text-muted-2 ml-auto" />}
                      {sc.available && selectedScenario === sc.id && (
                        <span className="ml-auto font-mono text-[9px] uppercase tracking-wider text-amber">Selected</span>
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
                Three rounds
              </div>
              <RoundPreview
                icon={<Workflow size={16} />}
                num={1}
                title="The Basics"
                concept="Confidence Gate"
                line="Set a single threshold. Watch what slips through."
              />
              <RoundPreview
                icon={<Cpu size={16} />}
                num={2}
                title="The Edge Cases"
                concept="Delegation Patterns"
                line="A threshold is not a policy. Assign patterns and calibrate weights."
              />
              <RoundPreview
                icon={<ShieldCheck size={16} />}
                num={3}
                title="The Audit"
                concept="Readiness Assessment"
                line="Drift, multi-agent failures, and the regulator. Be ready."
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
    <div className="surface-strong px-5 py-4 transition hover:translate-x-[-2px] hover:bg-white/5">
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-cyan font-bold">
        <span className="inline-flex items-center justify-center w-5 h-5 rounded border border-cyan/40 text-[10px]">
          {num}
        </span>
        Round {num}
        <span className="text-muted-2">·</span>
        <span className="text-mint">{concept}</span>
      </div>
      <div className="mt-2 flex items-start gap-3">
        <div className="text-amber mt-0.5">{icon}</div>
        <div>
          <div className="font-mono text-[14px] font-bold text-ink">{title}</div>
          <div className="text-[12.5px] text-muted leading-snug mt-1">{line}</div>
        </div>
      </div>
    </div>
  );
}
