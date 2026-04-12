"use client";

import { VerkflodeLogo } from "./VerkflodeLogo";
import type { ScoreBreakdown } from "../lib/types";

/**
 * The shareable profile card. Designed to look polished as a LinkedIn
 * screenshot — clean lockup with the brand mark, profile name, VAOM
 * quote, score breakdown, and the verkflode.eu URL for the viral loop.
 */
export function ProfileCard({
  name,
  quote,
  totals,
  totalN,
}: {
  name: string;
  quote: string;
  totals: ScoreBreakdown;
  totalN: number;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-amber/30 px-7 py-7 animate-fade-up"
      style={{
        background:
          "linear-gradient(135deg, rgba(13,27,42,0.95) 0%, rgba(27,73,101,0.85) 100%)",
        boxShadow:
          "0 0 80px rgba(98,182,203,0.08), inset 0 1px 0 rgba(190,233,232,0.08)",
      }}
    >
      {/* Top brand row */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <VerkflodeLogo height={36} />
          <div className="border-l border-white/10 pl-3">
            <div className="font-mono text-[8px] uppercase tracking-[0.28em] text-cyan font-bold">
              Delegation Lab
            </div>
            <div className="font-mono text-[10px] text-muted-2 mt-0.5">
              VAOM v3.0
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[8px] uppercase tracking-[0.2em] text-muted-2">
            Total score
          </div>
          <div className="font-sans text-[36px] font-bold leading-none text-amber tabular-nums">
            {totalN}
            <span className="text-[16px] text-amber/60">/100</span>
          </div>
        </div>
      </div>

      {/* Profile name */}
      <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-amber font-bold mb-1">
        Delegation profile
      </div>
      <h2 className="font-mono text-[32px] md:text-[42px] leading-[1.05] font-bold text-transparent bg-clip-text bg-gradient-to-r from-mint via-cyan to-mint mb-4">
        {name}
      </h2>

      {/* Quote */}
      <blockquote className="font-mono text-[14px] text-ink leading-[1.65] italic border-l-2 border-amber/50 pl-4 mb-6 max-w-2xl">
        &ldquo;{quote}&rdquo;
        <div className="mt-2 not-italic font-mono text-[9px] uppercase tracking-[0.2em] text-muted-2 font-bold">
          — VAOM
        </div>
      </blockquote>

      {/* Score breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Stat label="Efficiency" value={totals.efficiency} tone="cyan" />
        <Stat label="Risk control" value={totals.riskControl} tone="mint" />
        <Stat label="Compliance" value={totals.compliance} tone="amber" />
        <Stat label="Adaptability" value={totals.adaptability} tone="lav" />
      </div>

      {/* Footer URL */}
      <div className="flex items-center justify-between border-t border-white/8 pt-4">
        <div className="font-mono text-[10px] text-muted-2">
          Take it for yourself
        </div>
        <div className="font-mono text-[12px] text-mint font-bold">
          verkflode.eu
        </div>
      </div>

      {/* Subtle decorative grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg width='40' height='40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h40v40H0z' fill='none'/%3E%3Cpath d='M0 40L40 0' stroke='rgba(255,255,255,0.025)'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "cyan" | "mint" | "amber" | "lav";
}) {
  const tones: Record<string, { text: string; bar: string }> = {
    cyan: { text: "text-cyan", bar: "from-cyan to-cyan/40" },
    mint: { text: "text-mint", bar: "from-mint to-mint/40" },
    amber: { text: "text-amber", bar: "from-amber to-amber/40" },
    lav: { text: "text-lav", bar: "from-lav to-lav/40" },
  };
  return (
    <div>
      <div className="font-mono text-[8px] uppercase tracking-[0.18em] text-muted-2">
        {label}
      </div>
      <div className={`font-sans text-[18px] font-bold mt-0.5 tabular-nums ${tones[tone].text}`}>
        {value}
        <span className="text-muted-2 text-[11px]">/25</span>
      </div>
      <div className="h-1 mt-1 rounded-full bg-white/5 overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${tones[tone].bar}`}
          style={{ width: `${(value / 25) * 100}%` }}
        />
      </div>
    </div>
  );
}
