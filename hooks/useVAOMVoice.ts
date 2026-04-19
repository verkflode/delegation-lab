"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameMoment } from "../lib/ssml";

export type VoiceStatus = "idle" | "loading" | "playing" | "error";

const MUTE_KEY = "delegation-lab:muted";

export function useVAOMVoice() {
  const [muted, setMuted] = useState(false);
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

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
    // Abort any in-flight fetch so it never resolves and plays
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
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
      // Cancel any previous in-flight request + audio
      stop();

      const controller = new AbortController();
      abortRef.current = controller;
      setStatus("loading");

      try {
        const res = await fetch("/api/voice", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text, moment }),
          signal: controller.signal,
        });
        // If aborted while waiting, fetch throws — caught below
        if (!res.ok) {
          setStatus("idle");
          return;
        }
        const blob = await res.blob();

        // Check if we were aborted during blob download
        if (controller.signal.aborted) return;

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
        // AbortError or network failure — silent
        if (!controller.signal.aborted) {
          setStatus("idle");
        }
      }
    },
    [muted, stop]
  );

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
      if (!muted) stop();
    },
  };
}
