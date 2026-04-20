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

type Props = {
  text: string;
  moment: GameMoment;
  typingSpeed?: number;
  label?: string;
};

export function VAOMVoice({
  text,
  moment,
  typingSpeed = 18,
  label = "VAOM",
}: Props) {
  const [shown, setShown] = useState("");
  const [done, setDone] = useState(false);
  const { status, speak, stop } = useVAOMVoice();

  // Type out the text character by character
  useEffect(() => {
    setShown("");
    setDone(false);
    if (!text) return;
    if (typingSpeed === 0) {
      setShown(text);
      setDone(true);
      return;
    }
    let i = 0;
    const tick = () => {
      i++;
      setShown(text.slice(0, i));
      if (i >= text.length) {
        setDone(true);
        return;
      }
      timer = window.setTimeout(tick, typingSpeed);
    };
    let timer = window.setTimeout(tick, typingSpeed);
    return () => window.clearTimeout(timer);
  }, [text, typingSpeed]);

  // Stop audio if the text changes (new screen / new round)
  useEffect(() => {
    return () => stop();
  }, [text, stop]);

  const handleListen = () => {
    if (status === "playing") {
      stop();
    } else {
      void speak(text, moment);
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
        <ListenButton status={status} onClick={handleListen} />
      </div>
      <div className="font-mono text-[13.5px] leading-[1.75] text-ink whitespace-pre-wrap">
        {shown}
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
