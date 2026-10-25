"use client";

import { useEffect, useState } from "react";
import { Loader2, Play, Square, Volume2 } from "lucide-react";
import type { GameMoment } from "../lib/ssml";
import { useVAOMVoice } from "../hooks/useVAOMVoice";

/**
 * VAOMVoice — distinctive amber-bordered panel that shows VAOM's narration
 * with a typing animation. Voice is opt-in: the player clicks "Listen" to
 * have VAOM read it aloud. No auto-play, no latency race, no overlapping
 * clips. Text is the baseline; voice is the enrichment.
 */

// Live speech needs /api/voice, which stays off (and blocked at the server's proxy) until the Voxtral voice
// with narration signing ships. Until then the Listen button shows only where a recording exists; set
// NEXT_PUBLIC_VOICE=1 at build time to show it everywhere.
const LIVE_VOICE = process.env.NEXT_PUBLIC_VOICE === "1";

type Props = {
  text: string;
  moment: GameMoment;
  /** Seconds the typing takes at most, whatever the text's length; 0 shows the text at once. */
  typingSeconds?: number;
  label?: string;
  /** A pre-recorded reading of the text, played instead of live speech. */
  cachedAudioUrl?: string;
};

// The typing is a cue that VAOM is speaking, not a reading pace: it runs faster than anyone reads (a few
// characters a frame, at least MIN_CPS a second), a click or Escape shows the rest, and reduced motion skips it.
const MIN_CPS = 160;

export function VAOMVoice({
  text,
  moment,
  typingSeconds = 3.5,
  label = "VAOM",
  cachedAudioUrl,
}: Props) {
  const [count, setCount] = useState(0);
  const { status, speak, stop } = useVAOMVoice();
  const done = count >= text.length;

  // Type out the text a few characters per animation frame
  useEffect(() => {
    const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cps = Math.max(MIN_CPS, text.length / Math.max(typingSeconds, 0.001));
    const instant = !text || typingSeconds === 0 || reduced;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const n = instant ? text.length : Math.min(text.length, Math.floor(((now - start) / 1000) * cps));
      setCount(n);
      if (n < text.length) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [text, typingSeconds]);

  const finish = () => { if (!done) setCount(text.length); };
  useEffect(() => {
    if (done) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setCount(text.length); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [done, text]);

  // Stop audio if the text changes (new screen / new round)
  useEffect(() => {
    return () => stop();
  }, [text, stop]);

  const handleListen = () => {
    if (status === "playing") {
      stop();
    } else {
      void speak(text, moment, cachedAudioUrl);
    }
  };

  return (
    <div className="vaom-panel relative px-6 py-5 animate-fade-up">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-3">
          <PresenceDot active={status === "playing" || !done} />
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber font-bold">
            {label}
          </div>
        </div>
        {(LIVE_VOICE || cachedAudioUrl) && <ListenButton status={status} onClick={handleListen} />}
      </div>
      <div onClick={finish} className="font-mono text-[13.5px] leading-[1.75] text-ink whitespace-pre-wrap">
        {text.slice(0, count)}
        {!done && (
          <span className="inline-block w-[0.55em] h-[1.05em] bg-amber/80 ml-0.5 align-middle animate-pulse-soft" />
        )}
      </div>
    </div>
  );
}

function ListenButton({
  status,
  onClick,
}: {
  status: "idle" | "loading" | "playing" | "error";
  onClick: () => void;
}) {
  const isPlaying = status === "playing";
  const isLoading = status === "loading";

  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className="inline-flex items-center gap-2 rounded-md border border-amber/30 bg-amber/5 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-amber hover:bg-amber/10 transition focus-ring disabled:opacity-50 disabled:cursor-wait"
      aria-label={isPlaying ? "Stop VAOM" : "Listen to VAOM"}
    >
      {isLoading ? (
        <>
          <Loader2 size={12} className="animate-spin" />
          Loading
        </>
      ) : isPlaying ? (
        <>
          <Square size={10} />
          Stop
        </>
      ) : (
        <>
          <Volume2 size={12} />
          Listen
        </>
      )}
    </button>
  );
}

function PresenceDot({ active }: { active: boolean }) {
  return (
    <span className="relative inline-flex">
      <span
        className={`w-2 h-2 rounded-full bg-amber ${active ? "animate-pulse-soft" : ""}`}
      />
      {active && (
        <span className="absolute inset-0 w-2 h-2 rounded-full animate-pulse-ring" />
      )}
    </span>
  );
}
