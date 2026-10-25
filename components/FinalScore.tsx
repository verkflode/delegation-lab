"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  ExternalLink,
  Share2,
  Mail,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { isV5Round, useGame } from "../lib/game-state";
import { totalScore, totalNumeric } from "../lib/scoring";
import { ARCHETYPE_DETAILS, chooseArchetype } from "../data/vaom-text";
import { computeScorecard } from "../lib/scorecard";
import { fetchProfile } from "../lib/api";
import { ProfileCard } from "./ProfileCard";
import { VAOMVoice } from "./VAOMVoice";
import { ScoreBar } from "./Debrief";
import { Scorecard } from "./Scorecard";
import { FinalV5 } from "./v5/FinalV5";
import { ARCHETYPES_V5, chooseArchetypeV5 } from "../lib/v5/archetypes";

/**
 * Final dashboard + shareable profile card. Tries to fetch a Claude-generated
 * profile (richer prose); falls back to the deterministic archetype assignment
 * based on score ranges.
 */
export function FinalScore() {
  const { state, reset } = useGame();
  const totals = totalScore(state.results);
  const totalN = totalNumeric(totals);
  const v5 = isV5Round(4, state.scenario);
  const fallbackArch = v5 ? chooseArchetypeV5(state.results) : chooseArchetype(state.results);
  const fallbackDetails = (v5 ? ARCHETYPES_V5 : ARCHETYPE_DETAILS)[fallbackArch];

  const [profile, setProfile] = useState({
    archetype: fallbackArch,
    name: fallbackDetails.name,
    quote: fallbackDetails.quote,
    assessment: fallbackDetails.assessment,
  });

  useEffect(() => {
    let cancelled = false;
    // v5 profiles are scripted from the game (lib/v5/archetypes.ts).
    if (v5) return;
    const t0 = Date.now();
    fetchProfile({
      totals,
      rounds: state.results.map((r) => ({ round: r.round, score: r.score })),
    }).then((p) => {
      if (cancelled || !p) return;
      // Only swap if Claude was fast enough (~1.5s) to avoid jarring mid-read resets
      if (Date.now() - t0 > 1500) return;
      setProfile((cur) => ({
        ...cur,
        name: typeof p.name === "string" && p.name ? p.name : cur.name,
        quote: typeof p.quote === "string" && p.quote ? p.quote : cur.quote,
        assessment:
          typeof p.assessment === "string" && p.assessment
            ? p.assessment
            : cur.assessment,
      }));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

        {/* The Delegation Scorecard: the core's for v5 games, with the wire view and the export */}
        <div className="mt-8">
          {isV5Round(4, state.scenario) ? (
            <FinalV5 choices={{ v5r1: state.v5r1, v5r2: state.v5r2, v5r3: state.v5r3, v5r4: state.v5r4 }} results={state.results} />
          ) : (
            <Scorecard
              metrics={computeScorecard({
                results: state.results,
                r2: state.r2,
                r4: state.r4,
              })}
            />
          )}
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
