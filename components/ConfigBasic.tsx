"use client";

import { useState } from "react";
import { ArrowRight, AlertTriangle, Zap, Users } from "lucide-react";
import { useGame } from "../lib/game-state";

/**
 * Round 1 configuration: a single confidence threshold slider.
 * Intentionally minimal — the point is for the player to discover that
 * "set a threshold" is not a delegation policy.
 */
export function ConfigBasic() {
  const { setR1, advance } = useGame();
  const [threshold, setThreshold] = useState(80);

  const handleStart = () => {
    setR1({ threshold });
    advance("simulation");
  };

  // Visual hint: project the consequence of the chosen threshold
  const projection = projectConsequence(threshold);

  return (
    <div className="min-h-screen flex items-center px-6 py-16 animate-fade-in">
      <div className="w-full max-w-4xl mx-auto">
        <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-cyan font-bold mb-2">
          Round 1 · Configuration
        </div>
        <h1 className="font-mono text-[28px] md:text-[36px] leading-[1.1] font-bold text-mint mb-3">
          Set the auto-approval threshold.
        </h1>
        <p className="text-[14px] text-muted leading-relaxed max-w-2xl">
          Above the threshold, the agent auto-approves invoices. Below it, they queue for human review. One number, one workflow. What could go wrong.
        </p>

        <div className="surface-strong mt-10 px-8 py-10">
          <div className="flex items-baseline justify-between mb-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-2">
              Confidence threshold
            </div>
            <div className="font-sans text-[44px] font-bold text-amber leading-none tabular-nums">
              {threshold}
              <span className="text-[24px] text-amber/60">%</span>
            </div>
          </div>
          <input
            type="range"
            min={50}
            max={99}
            step={1}
            value={threshold}
            onChange={(e) => setThreshold(parseInt(e.target.value, 10))}
            className="w-full accent-amber cursor-pointer"
            style={{
              background: `linear-gradient(to right, rgba(232,185,49,0.5) 0%, rgba(232,185,49,0.5) ${((threshold - 50) / 49) * 100}%, rgba(255,255,255,0.08) ${((threshold - 50) / 49) * 100}%, rgba(255,255,255,0.08) 100%)`,
            }}
          />
          <div className="flex justify-between mt-2 font-mono text-[10px] text-muted-2">
            <span>50% · permissive</span>
            <span>99% · maximally cautious</span>
          </div>

          {/* Projection cards */}
          <div className="grid grid-cols-3 gap-3 mt-8">
            <ProjCard
              icon={<Zap size={14} />}
              label="Throughput"
              value={projection.throughput}
              tone="cyan"
            />
            <ProjCard
              icon={<AlertTriangle size={14} />}
              label="Risk exposure"
              value={projection.risk}
              tone={projection.riskTone}
            />
            <ProjCard
              icon={<Users size={14} />}
              label="Human burden"
              value={projection.humans}
              tone="mint"
            />
          </div>
        </div>

        <div className="mt-8 flex items-center justify-end">
          <button
            onClick={handleStart}
            className="group inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-amber to-amber/80 text-bg-1 font-bold font-mono uppercase tracking-[0.18em] text-[11px] px-6 py-3 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(232,185,49,0.35)] transition-all focus-ring"
          >
            Run simulation
            <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ProjCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "cyan" | "amber" | "mint" | "red";
}) {
  const toneClasses: Record<string, string> = {
    cyan: "text-cyan border-cyan/30",
    amber: "text-amber border-amber/30",
    mint: "text-mint border-mint/30",
    red: "text-red-bright border-red/30",
  };
  return (
    <div className={`surface px-4 py-3 border ${toneClasses[tone]}`}>
      <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-2">
        {icon}
        {label}
      </div>
      <div className={`mt-1.5 font-sans text-[13px] font-bold ${toneClasses[tone].split(" ")[0]}`}>
        {value}
      </div>
    </div>
  );
}

function projectConsequence(threshold: number): {
  throughput: string;
  risk: string;
  riskTone: "cyan" | "amber" | "mint" | "red";
  humans: string;
} {
  if (threshold < 70) {
    return {
      throughput: "Very high",
      risk: "Elevated",
      riskTone: "red",
      humans: "Low",
    };
  }
  if (threshold < 85) {
    return {
      throughput: "High",
      risk: "Moderate",
      riskTone: "amber",
      humans: "Manageable",
    };
  }
  if (threshold < 95) {
    return {
      throughput: "Conservative",
      risk: "Low",
      riskTone: "mint",
      humans: "Higher",
    };
  }
  return {
    throughput: "Bottlenecked",
    risk: "Very low",
    riskTone: "mint",
    humans: "Saturated",
  };
}
