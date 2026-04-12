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
import { useGame } from "../lib/game-state";
import { totalScore, totalNumeric } from "../lib/scoring";
import { ARCHETYPE_DETAILS, chooseArchetype } from "../data/vaom-text";
import { fetchProfile } from "../lib/api";
import { ProfileCard } from "./ProfileCard";
import { VAOMVoice } from "./VAOMVoice";
import { ScoreBar } from "./Debrief";

/**
 * Final dashboard + shareable profile card. Tries to fetch a Claude-generated
 * profile (richer prose); falls back to the deterministic archetype assignment
 * based on score ranges.
 */
export function FinalScore() {
  const { state, reset } = useGame();
  const totals = totalScore(state.results);
  const totalN = totalNumeric(totals);
  const fallbackArch = chooseArchetype(state.results);
  const fallbackDetails = ARCHETYPE_DETAILS[fallbackArch];

  const [profile, setProfile] = useState({
    archetype: fallbackArch,
    name: fallbackDetails.name,
    quote: fallbackDetails.quote,
    assessment: fallbackDetails.assessment,
  });

  useEffect(() => {
    let cancelled = false;
    fetchProfile({
      totals,
      rounds: state.results.map((r) => ({ round: r.round, score: r.score })),
    }).then((p) => {
      if (cancelled || !p) return;
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
        <h1 className="font-mono text-[32px] md:text-[44px] font-bold leading-[1.05] text-transparent bg-clip-text bg-gradient-to-r from-mint via-cyan to-mint mb-2">
          Your delegation philosophy.
        </h1>
        <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.2em] text-amber mb-8">
          <Sparkles size={14} />
          <span className="font-sans tabular-nums">{totalN}</span> of 100 across three rounds
        </div>

        {/* Profile card — shareable */}
        <ProfileCard
          name={profile.name}
          quote={profile.quote}
          totals={totals}
          totalN={totalN}
        />

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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            Take VAOM further
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <CTA
              href="https://verkflode.com/vaom"
              icon={<ExternalLink size={14} />}
              label="Explore the framework"
              sub="verkflode.com/vaom"
            />
            <CTA
              href="https://verkflode.com/vaom"
              icon={<ArrowRight size={14} />}
              label="Download the whitepaper"
              sub="VAOM v3.0 · PDF"
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
