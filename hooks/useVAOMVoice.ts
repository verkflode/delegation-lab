"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameMoment } from "../lib/ssml";

/**
 * useVAOMVoice — manages spoken VAOM narration.
 *
 * - Calls /api/voice with plain text + game moment
 * - Plays the returned audio stream
 * - Handles mute toggle (persisted across rounds)
 * - Graceful: if /api/voice returns 503 (no key configured), no error is
 *   shown — the game just runs text-only, which is the baseline.
 *
 * Browsers block autoplay until a user gesture has occurred. The title
 * screen "Start" button satisfies that — speak() should not be called
 * before the player clicks Start.
 */

export type VoiceStatus = "idle" | "loading" | "playing" | "error";

const MUTE_KEY = "delegation-lab:muted";

export function useVAOMVoice() {
  const [muted, setMuted] = useState(false);
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  // Hydrate mute preference from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(MUTE_KEY);
    if (saved === "1") setMuted(true);
  }, []);

  const persistMuted = useCallback((next: boolean) => {
    setMuted(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(MUTE_KEY, next ? "1" : "0");
    }
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    setStatus("idle");
  }, []);

  const speak = useCallback(
    async (text: string, moment: GameMoment) => {
      if (muted || !text) return;
      stop();
      setStatus("loading");
      try {
        const res = await fetch("/api/voice", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text, moment }),
        });
        if (!res.ok) {
          // 503 → voice not configured. Quiet failure.
          setStatus("idle");
          return;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        urlRef.current = url;
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onplay = () => setStatus("playing");
        audio.onended = () => {
          setStatus("idle");
          if (urlRef.current) {
            URL.revokeObjectURL(urlRef.current);
            urlRef.current = null;
          }
        };
        audio.onerror = () => setStatus("error");
        await audio.play().catch(() => setStatus("error"));
      } catch {
        setStatus("idle");
      }
    },
    [muted, stop]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => stop();
  }, [stop]);

  return {
    muted,
    status,
    speak,
    stop,
    toggleMute: () => {
      persistMuted(!muted);
      if (!muted) stop(); // muting cancels current playback
    },
  };
}
