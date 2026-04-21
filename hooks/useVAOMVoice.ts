"use client";

import { useCallback, useRef, useState } from "react";
import type { GameMoment } from "../lib/ssml";

export type VoiceStatus = "idle" | "loading" | "playing" | "error";

/**
 * useVAOMVoice — manages spoken VAOM narration with chunked playback.
 *
 * Supports an optional `cachedUrl` for pre-generated audio (e.g. Round 1
 * briefings cached in public/audio/). When provided, playback is instant.
 * Otherwise, text is split into chunks and sent to Azure TTS in parallel.
 */
export function useVAOMVoice() {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlsRef = useRef<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const cleanup = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    for (const url of urlsRef.current) {
      URL.revokeObjectURL(url);
    }
    urlsRef.current = [];
  }, []);

  const stop = useCallback(() => {
    cleanup();
    setStatus("idle");
  }, [cleanup]);

  const fetchChunk = async (
    text: string,
    moment: GameMoment,
    signal: AbortSignal
  ): Promise<HTMLAudioElement | null> => {
    try {
      const res = await fetch("/api/voice", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, moment }),
        signal,
      });
      if (!res.ok || signal.aborted) return null;
      const blob = await res.blob();
      if (signal.aborted) return null;
      const url = URL.createObjectURL(blob);
      urlsRef.current.push(url);
      return new Audio(url);
    } catch {
      return null;
    }
  };

  const speak = useCallback(
    async (text: string, moment: GameMoment, cachedUrl?: string) => {
      if (!text) return;
      stop();

      // If a pre-cached audio file is available, play it instantly
      if (cachedUrl) {
        setStatus("loading");
        const audio = new Audio(cachedUrl);
        audioRef.current = audio;
        audio.onplay = () => setStatus("playing");
        audio.onended = () => setStatus("idle");
        audio.onerror = () => setStatus("error");
        await audio.play().catch(() => setStatus("error"));
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;
      setStatus("loading");

      const chunks = splitIntoChunks(text);
      const promises = chunks.map((chunk) =>
        fetchChunk(chunk, moment, controller.signal)
      );

      const firstAudio = await promises[0];
      if (controller.signal.aborted || !firstAudio) {
        if (!controller.signal.aborted) setStatus("idle");
        return;
      }

      audioRef.current = firstAudio;

      if (promises.length > 1) {
        firstAudio.onended = async () => {
          if (controller.signal.aborted) return;
          const nextAudio = await promises[1];
          if (controller.signal.aborted || !nextAudio) {
            setStatus("idle");
            return;
          }
          audioRef.current = nextAudio;
          nextAudio.onended = () => setStatus("idle");
          nextAudio.onerror = () => setStatus("error");
          await nextAudio.play().catch(() => setStatus("idle"));
        };
      } else {
        firstAudio.onended = () => setStatus("idle");
      }

      firstAudio.onplay = () => setStatus("playing");
      firstAudio.onerror = () => setStatus("error");
      await firstAudio.play().catch(() => setStatus("error"));
    },
    [stop]
  );

  return { status, speak, stop };
}

function splitIntoChunks(text: string): string[] {
  if (text.length <= 250) return [text];
  const sentences = text.match(/[^.!?]+[.!?]+/g);
  if (!sentences || sentences.length <= 2) return [text];
  const first = sentences.slice(0, 2).join("").trim();
  const rest = text.slice(first.length).trim();
  if (!rest) return [first];
  return [first, rest];
}
