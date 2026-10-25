"use client";

import {
  ArrowRight,
  ExternalLink,
  Share2,
  Mail,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useGame } from "../lib/game-state";
import { totalScore, totalNumeric } from "../lib/score";
import { ProfileCard } from "./ProfileCard";
import { VAOMVoice } from "./VAOMVoice";
import { ScoreBar } from "./Debrief";
import { FinalV5 } from "./v5/FinalV5";
import { ARCHETYPES_V5, chooseArchetypeV5 } from "../lib/v5/archetypes";

/**
 * Final dashboard and shareable profile card. The profile is scripted from the game (lib/v5/archetypes.ts).
 */
export function FinalScore() {
  const { state, reset } = useGame();
  const totals = totalScore(state.results);
  const totalN = totalNumeric(totals);
  const profile = ARCHETYPES_V5[chooseArchetypeV5(state.results)];

  return (
    <div className="min-h-screen px-6 py-12 animate-fade-in">
      <div className="max-w-5xl mx-auto">
        <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-cyan font-bold mb-2">
          Campaign complete
        </div>
        <h1 className="font-serif text-[32px] md:text-[44px] font-normal leading-[1.05] text-mint mb-2">
          Your delegation philosophy.
        </h1>
        <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.2em] text-mint mb-8">
          <Sparkles size={14} />
          <span className="font-sans tabular-nums">{totalN}</span> of 100 across four rounds
        </div>

        {/* Profile card — shareable */}
        <ProfileCard
          name={profile.name}
          quote={profile.quote}
          totals={totals}
          totalN={totalN}
        />

        {/* The Delegation Scorecard from the Guardian core, the wire view and the export */}
        <div className="mt-8">
          <FinalV5 choices={{ v5r1: state.v5r1, v5r2: state.v5r2, v5r3: state.v5r3, v5r4: state.v5r4 }} results={state.results} />
        </div>

        {/* VAOM final assessment */}
        <div className="mt-8">
          <VAOMVoice
            text={profile.assessment}
            moment="final_assessment"
            label="VAOM · Final assessment"
          />
        </div>

        {/* Per-round breakdown */}
        <div className="mt-8">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan font-bold mb-3">
            Per-round breakdown
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {state.results.map((r) => (
              <div key={r.round}>
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan font-bold mb-2 px-1">
                  Round {r.round}
                </div>
                <ScoreBar score={r.score} compact />
              </div>
            ))}
          </div>
        </div>

        {/* CTAs */}
        <div className="mt-10 surface-strong px-6 py-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan font-bold mb-3">
            The Verkflöde Agent Operating Model (VAOM)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <CTA
              href="https://vaom.ai"
              icon={<ExternalLink size={14} />}
              label="Explore the framework"
              sub="vaom.ai"
            />
            <CTA
              href="https://vaom.ai/whitepaper.pdf"
              icon={<ArrowRight size={14} />}
              label="Download the whitepaper"
              sub="VAOM 5.0 · PDF · CC BY 4.0"
            />
            <CTA
              href="mailto:hello@verkflode.com"
              icon={<Mail size={14} />}
              label="Connect with Verkflöde"
              sub="hello@verkflode.com"
            />
          </div>
          <div className="mt-4 flex items-center gap-3 text-[11px] font-mono text-muted-2">
            <Share2 size={12} />
            Screenshot the profile card above for LinkedIn — or
            <button
              onClick={() => {
                reset();
              }}
              className="inline-flex items-center gap-1 text-amber hover:text-mint transition focus-ring rounded"
            >
              <RotateCcw size={11} /> play again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CTA({
  href,
  icon,
  label,
  sub,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  sub: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="surface px-4 py-3 hover:border-cyan/40 hover:bg-cyan/5 transition group focus-ring rounded-2xl"
    >
      <div className="flex items-center gap-2 text-cyan">
        {icon}
        <div className="font-mono text-[12px] font-bold text-ink group-hover:text-mint transition">
          {label}
        </div>
      </div>
      <div className="font-mono text-[10px] text-muted-2 mt-1">{sub}</div>
    </a>
  );
}
