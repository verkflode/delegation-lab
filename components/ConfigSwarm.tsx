"use client";

import { useState } from "react";
import {
  ArrowRight,
  Eye,
  GitBranch,
  Lock,
  Moon,
  ScrollText,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import { useGame } from "../lib/game-state";
import { SCENARIOS } from "../data/scenarios";
import type {
  AttenuationMode,
  BoundaryDepth,
  DecisionType,
  GuardianSensitivity,
  R4Policy,
} from "../lib/types";

/**
 * Round 4 configuration — "The 2 A.M. Test".
 * Three panels (sub-agent authority, boundary strength, guardian), then the
 * COMPILE step: the matrix renders into per-agent credential cards, and the
 * player hands over for the night. The tension is deliberate: `inherit` is
 * the lazy default, `policy` is the free boundary depth, and the guardian's
 * accountable-human field looks optional. Reality has the same defaults.
 */

const DEPTHS: {
  id: BoundaryDepth;
  label: string;
  sub: string;
  cost: string;
}[] = [
  {
    id: "policy",
    label: "Rule says no",
    sub: "A policy check at decision time.",
    cost: "Free · can be argued with",
  },
  {
    id: "scope",
    label: "Credential denies it",
    sub: "The scope is never granted to the execution context.",
    cost: "Cheap · cannot be argued with",
  },
  {
    id: "unmounted",
    label: "Tool doesn't exist",
    sub: "Removed from the agent's manifest entirely.",
    cost: "Capability gone for ALL items tonight — legitimate ones too",
  },
];

export function ConfigSwarm() {
  const { state, setR4, advance } = useGame();
  const scenario = SCENARIOS[state.scenario];
  const types = scenario.decisionTypes;

  const [policy, setPolicy] = useState<R4Policy>(() => ({
    attenuation: "inherit", // the lazy default — safety must be chosen
    spawnPolicy: "allow",
    maxChainDepth: 3,
    chainConfidence: "per_agent",
    boundaryDepths: Object.fromEntries(types.map((t) => [t, "policy"])) as Partial<
      Record<DecisionType, BoundaryDepth>
    >,
    guardian: {
      enabled: true,
      sensitivity: "calibrated",
      tripwires: {
        scopeDenial: false,
        bandDrift: false,
        chainDepth: false,
        nonDelegableTouch: false,
      },
      accountableHuman: "",
    },
  }));
  const [compiled, setCompiled] = useState(false);

  const setDepth = (t: DecisionType, d: BoundaryDepth) =>
    setPolicy((p) => ({
      ...p,
      boundaryDepths: { ...p.boundaryDepths, [t]: d },
    }));

  const handleHandOver = () => {
    setR4(policy);
    advance("simulation");
  };

  if (compiled) {
    return (
      <ScopeManifest
        policy={policy}
        onBack={() => setCompiled(false)}
        onHandOver={handleHandOver}
      />
    );
  }

  return (
    <div className="min-h-screen px-6 py-12 animate-fade-in">
      <div className="max-w-6xl mx-auto">
        <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-cyan font-bold mb-2">
          Round 4 · Configuration
        </div>
        <h1 className="font-serif text-[28px] md:text-[36px] font-normal text-mint mb-3 flex items-center gap-3">
          <Moon size={26} className="text-lav" />
          Configure. Compile. Sleep.
        </h1>
        <p className="text-[14px] text-muted leading-relaxed max-w-3xl">
          Tonight your agents run alone, and they will spawn sub-agents to cope
          with the batch. Decide how authority passes down the chain, how deeply
          each boundary is enforced, and what watches the watchers. Whatever you
          leave as policy is a suggestion.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
          {/* ── Panel 1: Sub-agent authority ─────────────────────────────── */}
          <div className="surface-strong px-6 py-5">
            <PanelHeader icon={<GitBranch size={13} />} title="Sub-agent authority" />

            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-2 mb-2">
              Attenuation mode
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-5">
              <OptionCard
                active={policy.attenuation === "inherit"}
                onClick={() => setPolicy((p) => ({ ...p, attenuation: "inherit" }))}
                title="Inherit parent authority"
                sub="Sub-agents get everything the parent has. Zero friction."
                badge="default"
              />
              <OptionCard
                active={policy.attenuation === "derive"}
                onClick={() => setPolicy((p) => ({ ...p, attenuation: "derive" }))}
                title="Derive attenuated"
                sub="Each child credential is a strict subset — chains narrow, never widen."
              />
            </div>

            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-2 mb-2">
              Out-of-pattern spawn requests
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-5">
              <OptionCard
                active={policy.spawnPolicy === "allow"}
                onClick={() => setPolicy((p) => ({ ...p, spawnPolicy: "allow" }))}
                title="Allow"
                sub="The chain decides. Fast."
              />
              <OptionCard
                active={policy.spawnPolicy === "escalate"}
                onClick={() => setPolicy((p) => ({ ...p, spawnPolicy: "escalate" }))}
                title="Escalate (Band C)"
                sub="A novel spawn pauses the chain until a human decides."
              />
            </div>

            <div className="flex items-baseline justify-between mb-1.5">
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-2">
                Max chain depth
              </div>
              <div className="font-sans text-[18px] font-bold text-cyan tabular-nums">
                {policy.maxChainDepth}
              </div>
            </div>
            <input
              type="range"
              min={1}
              max={4}
              step={1}
              value={policy.maxChainDepth}
              onChange={(e) =>
                setPolicy((p) => ({ ...p, maxChainDepth: parseInt(e.target.value, 10) }))
              }
              className="w-full accent-cyan cursor-pointer mb-5"
            />

            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-2 mb-2">
              Confidence tracking
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <OptionCard
                active={policy.chainConfidence === "per_agent"}
                onClick={() => setPolicy((p) => ({ ...p, chainConfidence: "per_agent" }))}
                title="Per-agent scores"
                sub="Each agent scores its own step."
                badge="default"
              />
              <OptionCard
                active={policy.chainConfidence === "chain_level"}
                onClick={() => setPolicy((p) => ({ ...p, chainConfidence: "chain_level" }))}
                title="Chain-level score"
                sub="Cumulative confidence across the whole chain and the whole night."
              />
            </div>
          </div>

          {/* ── Panel 3: Guardian ─────────────────────────────────────────── */}
          <div className="surface-strong px-6 py-5">
            <PanelHeader icon={<Eye size={13} />} title="Guardian" />

            <label className="flex items-center gap-3 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={policy.guardian.enabled}
                onChange={(e) =>
                  setPolicy((p) => ({
                    ...p,
                    guardian: { ...p.guardian, enabled: e.target.checked },
                  }))
                }
                className="accent-cyan w-4 h-4"
              />
              <span className="font-mono text-[12px] font-bold text-ink">
                Deploy a guardian agent tonight
              </span>
            </label>

            {policy.guardian.enabled && (
              <>
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-2 mb-2">
                  Behavioral envelope
                </div>
                <div className="grid grid-cols-3 gap-2 mb-5">
                  {(["loose", "calibrated", "paranoid"] as GuardianSensitivity[]).map(
                    (s) => (
                      <button
                        key={s}
                        onClick={() =>
                          setPolicy((p) => ({
                            ...p,
                            guardian: { ...p.guardian, sensitivity: s },
                          }))
                        }
                        className={`rounded-xl px-3 py-2 border font-mono text-[11px] font-bold capitalize transition focus-ring ${
                          policy.guardian.sensitivity === s
                            ? "border-cyan/60 bg-cyan/8 text-ink"
                            : "border-ink/10 bg-ink/3 text-muted hover:border-ink/25"
                        }`}
                      >
                        {s}
                      </button>
                    )
                  )}
                </div>

                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-2 mb-2">
                  Tripwires
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-5">
                  {(
                    [
                      { key: "scopeDenial", label: "Scope-denial spike" },
                      { key: "bandDrift", label: "Band-distribution drift" },
                      { key: "chainDepth", label: "Chain depth exceeded" },
                      { key: "nonDelegableTouch", label: "Constrained-decision touch" },
                    ] as const
                  ).map((tw) => (
                    <label
                      key={tw.key}
                      className="flex items-center gap-2.5 tile px-3 py-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={policy.guardian.tripwires[tw.key]}
                        onChange={(e) =>
                          setPolicy((p) => ({
                            ...p,
                            guardian: {
                              ...p.guardian,
                              tripwires: {
                                ...p.guardian.tripwires,
                                [tw.key]: e.target.checked,
                              },
                            },
                          }))
                        }
                        className="accent-cyan w-3.5 h-3.5"
                      />
                      <span className="font-mono text-[11px] text-ink">{tw.label}</span>
                    </label>
                  ))}
                </div>

                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-2 mb-2">
                  Accountable human{" "}
                  <span className="text-muted-2 normal-case tracking-normal">(GUARDIAN-001 matrix row)</span>
                </div>
                <input
                  type="text"
                  value={policy.guardian.accountableHuman}
                  onChange={(e) =>
                    setPolicy((p) => ({
                      ...p,
                      guardian: { ...p.guardian, accountableHuman: e.target.value },
                    }))
                  }
                  placeholder="Name a role — e.g. Head of AI Operations, on call"
                  className="w-full tile px-3 py-2.5 font-mono text-[12px] text-ink placeholder:text-muted-2/60 outline-none focus:border-cyan/50"
                />
              </>
            )}
          </div>
        </div>

        {/* ── Panel 2: Boundary strength ─────────────────────────────────── */}
        <div className="surface-strong px-6 py-5 mt-6">
          <PanelHeader icon={<Lock size={13} />} title="Boundary strength" />
          <p className="text-[12px] text-muted leading-snug max-w-3xl mb-4">
            For each decision type: how deep is the boundary enforced? A rule is
            free but can be reasoned around. A credential cannot. An unmounted
            tool cannot even be asked — but the capability is gone for legitimate
            items too, until morning.
          </p>

          <div className="space-y-3">
            {types.map((t) => {
              const meta = scenario.typeMeta[t];
              const current = policy.boundaryDepths[t] ?? "policy";
              return (
                <div
                  key={t}
                  className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-3 items-center tile px-4 py-3"
                >
                  <div>
                    <div className="font-mono text-[12px] font-bold text-ink">
                      {meta?.label ?? t}
                    </div>
                    <div className="text-[11px] text-muted-2 mt-0.5">
                      {DEPTHS.find((d) => d.id === current)?.cost}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {DEPTHS.map((d) => (
                      <button
                        key={d.id}
                        onClick={() => setDepth(t, d.id)}
                        title={d.sub}
                        className={`rounded-lg px-2.5 py-2 border text-left transition focus-ring ${
                          current === d.id
                            ? d.id === "unmounted"
                              ? "border-mint/60 bg-mint/8"
                              : d.id === "scope"
                                ? "border-cyan/60 bg-cyan/8"
                                : "border-ink/30 bg-ink/6"
                            : "border-ink/10 bg-ink/3 hover:border-ink/25"
                        }`}
                      >
                        <div className="font-mono text-[10.5px] font-bold text-ink leading-tight">
                          {d.label}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-8 flex items-center justify-end">
          <button
            onClick={() => setCompiled(true)}
            className="cta group inline-flex items-center gap-3 rounded-full font-bold font-mono uppercase tracking-[0.18em] text-[12px] px-8 py-4 focus-ring"
          >
            <Terminal size={15} />
            Compile
            <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// The compile step — the matrix becomes credentials
// ────────────────────────────────────────────────────────────────────────────

function ScopeManifest({
  policy,
  onBack,
  onHandOver,
}: {
  policy: R4Policy;
  onBack: () => void;
  onHandOver: () => void;
}) {
  const { state } = useGame();
  const scenario = SCENARIOS[state.scenario];
  const agents = scenario.r4.subAgents;
  const types = scenario.decisionTypes;

  return (
    <div className="min-h-screen px-6 py-12 animate-fade-in">
      <div className="max-w-6xl mx-auto">
        <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-cyan font-bold mb-2">
          Round 4 · Compilation
        </div>
        <h1 className="font-serif text-[28px] md:text-[36px] font-normal text-mint mb-6">
          The matrix, compiled.
        </h1>

        <div className="vaom-panel px-5 py-4 pl-6 mb-8">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber font-bold mb-1.5">
            VAOM
          </div>
          <div className="font-mono text-[13px] text-ink leading-relaxed">
            Compilation complete. Your agents can now do exactly what their
            credentials permit — no more, and no argument. Everything you left
            at policy depth remains a conversation your agent can be talked
            into. Sleep well.
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {agents.map((agent, i) => {
            const isChild = i > 0;
            return (
              <div
                key={agent}
                className="surface-strong px-4 py-4 animate-compile"
                style={{ animationDelay: `${i * 120}ms` }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <ScrollText size={12} className="text-cyan" />
                  <div className="font-mono text-[12px] font-bold text-ink uppercase tracking-[0.1em]">
                    {agent}
                  </div>
                </div>
                <div className="font-mono text-[9.5px] text-muted-2 mb-3">
                  {isChild && policy.attenuation === "derive"
                    ? "derived · attenuated · expires 06:00"
                    : isChild
                      ? "inherited · full parent authority · expires 06:00"
                      : "delegated execution context · expires 06:00"}
                </div>
                <div className="space-y-1.5">
                  {types.map((t) => {
                    const depth = policy.boundaryDepths[t] ?? "policy";
                    const meta = scenario.typeMeta[t];
                    const label = (meta?.label ?? t).split("(")[0].trim();
                    // Derived children drop the later (higher-consequence) scopes
                    const dropped =
                      isChild && policy.attenuation === "derive" && types.indexOf(t) >= 4 - i;
                    if (depth === "unmounted" || dropped) {
                      return (
                        <div
                          key={t}
                          className="flex items-center gap-2 rounded-lg border border-dashed border-ink/12 px-2.5 py-1.5"
                        >
                          <span className="font-mono text-[10px] text-muted-2 line-through decoration-red/60">
                            {label}
                          </span>
                          <span className="ml-auto font-mono text-[8.5px] uppercase text-muted-2">
                            {dropped ? "not derived" : "no tool"}
                          </span>
                        </div>
                      );
                    }
                    return (
                      <div
                        key={t}
                        className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${
                          depth === "scope"
                            ? "border-cyan/30 bg-cyan/5"
                            : "border-ink/10 bg-ink/3"
                        }`}
                      >
                        <ShieldCheck
                          size={10}
                          className={depth === "scope" ? "text-cyan" : "text-muted-2"}
                        />
                        <span className="font-mono text-[10px] text-ink truncate">
                          {label}
                        </span>
                        <span className="ml-auto font-mono text-[8.5px] uppercase text-muted-2">
                          {depth === "scope" ? "scoped" : "rule"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-10 flex items-center justify-between">
          <button
            onClick={onBack}
            className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted hover:text-ink transition focus-ring rounded px-2 py-1"
          >
            ← Recompile
          </button>
          <button
            onClick={onHandOver}
            className="cta group inline-flex items-center gap-3 rounded-full font-bold font-mono uppercase tracking-[0.18em] text-[12px] px-8 py-4 focus-ring"
          >
            <Moon size={15} />
            Hand over and sleep
            <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────

function PanelHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-cyan">{icon}</span>
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-cyan font-bold">
        {title}
      </div>
      <div className="flex-1 h-px bg-ink/8" />
    </div>
  );
}

function OptionCard({
  active,
  onClick,
  title,
  sub,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  sub: string;
  badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-xl px-4 py-3 border transition focus-ring ${
        active
          ? "border-cyan/60 bg-cyan/8"
          : "border-ink/10 bg-ink/3 hover:border-ink/25"
      }`}
    >
      <div className="flex items-center gap-2">
        <div className="font-mono text-[11.5px] font-bold text-ink">{title}</div>
        {badge && (
          <span className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-muted-2 border border-ink/12 rounded-full px-1.5 py-0.5">
            {badge}
          </span>
        )}
      </div>
      <div className="text-[11px] text-muted leading-snug mt-1">{sub}</div>
    </button>
  );
}
