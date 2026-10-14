"use client";

import { Shield, ShieldCheck, Eye, Zap } from "lucide-react";
import type { AttenuationMode, NightEvent } from "../lib/types";

/**
 * Round 4 agent-chain visualization. Shows the parent chain, the derived
 * scope counts (attenuation made visible), the guardian, and live pulses
 * as items route through. Scope denials flash a shield on the denying node;
 * circuit breakers freeze the chain amber.
 */
export function SpawnTree({
  agents,
  attenuation,
  lastRoute,
  lastEvent,
  guardianEnabled,
  guardianOwned,
}: {
  agents: string[];
  attenuation: AttenuationMode;
  lastRoute?: string[];
  lastEvent?: NightEvent;
  guardianEnabled: boolean;
  guardianOwned: boolean;
}) {
  const baseScopes = 12;
  const scopesFor = (i: number) =>
    attenuation === "inherit" ? baseScopes : Math.max(2, baseScopes - i * 4);

  const denial =
    lastEvent?.kind === "scope_denial" || lastEvent?.kind === "injection_blocked";
  const breaker = lastEvent?.kind === "circuit_breaker";
  const breach =
    lastEvent?.kind === "laundering" || lastEvent?.kind === "injection_executed";

  return (
    <div className="surface-strong px-5 py-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan font-bold">
          Agent chain
        </div>
        <div className="flex-1 h-px bg-ink/8" />
        <div className="font-mono text-[10px] text-muted-2">
          attenuation:{" "}
          <span className={attenuation === "derive" ? "text-mint" : "text-red-bright"}>
            {attenuation}
          </span>
        </div>
      </div>

      <div className="flex items-stretch gap-2 overflow-x-auto scroll-slim pb-1">
        {agents.map((agent, i) => {
          const active = lastRoute?.some((r) =>
            r.toLowerCase().startsWith(agent.toLowerCase().slice(0, 4))
          );
          const isDenier = denial && i === 1;
          const isBreachNode =
            breach && (lastRoute?.[lastRoute.length - 1] ?? "").includes("*") && i === 1;
          return (
            <div key={agent} className="flex items-center gap-2 flex-shrink-0">
              <div
                className={`tile px-3 py-2.5 min-w-[104px] transition-all duration-300 ${
                  breaker
                    ? "border-amber/60 bg-amber/10"
                    : isBreachNode
                      ? "border-red/70 bg-red/10 animate-hazard-flash"
                      : active
                        ? "border-cyan/60 bg-cyan/8"
                        : ""
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Zap
                    size={10}
                    className={active ? "text-cyan" : "text-muted-2"}
                  />
                  <span className="font-mono text-[10px] font-bold text-ink uppercase tracking-[0.1em]">
                    {agent}
                  </span>
                  {isDenier && (
                    <ShieldCheck size={12} className="text-mint animate-shield" />
                  )}
                </div>
                <div className="font-mono text-[9.5px] text-muted-2 mt-1">
                  {i === 0 ? baseScopes : scopesFor(i)} scopes
                  {attenuation === "derive" && i > 0 && (
                    <span className="text-mint"> ↓</span>
                  )}
                </div>
              </div>
              {i < agents.length - 1 && (
                <div className="font-mono text-[10px] text-muted-2">→</div>
              )}
            </div>
          );
        })}

        {/* Guardian node — off to the side, watching */}
        <div className="flex items-center gap-2 flex-shrink-0 ml-3 pl-3 border-l border-ink/8">
          <div
            className={`tile px-3 py-2.5 min-w-[104px] transition-all duration-300 ${
              breaker
                ? "border-amber/70 bg-amber/12 animate-pulse-soft"
                : guardianEnabled
                  ? "border-lav/40"
                  : "opacity-40"
            }`}
          >
            <div className="flex items-center gap-1.5">
              {guardianEnabled ? (
                <Eye size={10} className={breaker ? "text-amber" : "text-lav"} />
              ) : (
                <Shield size={10} className="text-muted-2" />
              )}
              <span className="font-mono text-[10px] font-bold text-ink uppercase tracking-[0.1em]">
                Guardian
              </span>
            </div>
            <div className="font-mono text-[9.5px] mt-1">
              {!guardianEnabled ? (
                <span className="text-muted-2">offline</span>
              ) : guardianOwned ? (
                <span className="text-mint">owned · watching</span>
              ) : (
                <span className="text-amber">unwatched watcher</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
