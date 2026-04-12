"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import type { GameMoment } from "../lib/ssml";
import { useVAOMVoice } from "../hooks/useVAOMVoice";

/**
 * VAOMVoice — distinctive amber-bordered panel that shows VAOM's narration
 * with a typing animation, plays the spoken version in parallel via the
 * useVAOMVoice hook, and exposes a mute toggle.
 *
 * The text experience is the baseline. Voice is enrichment. If voice is
 * unconfigured (no Azure key) the panel still works perfectly silent.
 */

type Props = {
  text: string;
  moment: GameMoment;
  /** Speed of the typing animation (ms per character). 0 = instant. */
  typingSpeed?: number;
  /** Show the speaker / mute toggle. */
  showMute?: boolean;
  /** Optional eyebrow label above the text (e.g. "VAOM · Briefing"). */
  label?: string;
};

export function VAOMVoice({
  text,
  moment,
  typingSpeed = 12,
  showMute = true,
  label = "VAOM",
}: Props) {
  const [shown, setShown] = useState("");
  const [done, setDone] = useState(false);
  const { muted, status, speak, stop, toggleMute } = useVAOMVoice();
  const spokeForRef = useRef<string | null>(null);

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

  // Kick off speech once the text is set (parallel to typing)
  useEffect(() => {
    if (!text) return;
    if (spokeForRef.current === text) return;
    spokeForRef.current = text;
    void speak(text, moment);
    // We intentionally do not include `speak` in the dep array — it's a stable
    // callback returned by the hook, but referencing it would re-trigger if
    // the hook re-renders. The text guard is what we want.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, moment]);

  return (
    <div className="vaom-panel relative px-6 py-5 animate-fade-up">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-3">
          <PresenceDot active={status === "playing" || !done} />
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber font-bold">
            {label}
          </div>
        </div>
        {showMute && (
          <button
            onClick={() => {
              toggleMute();
              if (status === "playing") stop();
            }}
            className="inline-flex items-center gap-2 rounded-md border border-amber/30 bg-amber/5 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-amber hover:bg-amber/10 transition focus-ring"
            aria-label={muted ? "Unmute VAOM" : "Mute VAOM"}
          >
            {muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
            {muted ? "Muted" : "Voice"}
          </button>
        )}
      </div>
      <div className="font-mono text-[13.5px] leading-[1.75] text-ink whitespace-pre-wrap">
        {shown}
        {!done && <span className="inline-block w-[0.55em] h-[1.05em] bg-amber/80 ml-0.5 align-middle animate-pulse-soft" />}
      </div>
    </div>
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
