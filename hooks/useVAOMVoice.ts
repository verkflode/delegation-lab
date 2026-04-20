"use client";

import { useCallback, useRef, useState } from "react";
import type { GameMoment } from "../lib/ssml";

export type VoiceStatus = "idle" | "loading" | "playing" | "error";

/**
 * useVAOMVoice — manages spoken VAOM narration with chunked playback.
 *
 * To reduce perceived latency, the text is split into a short first
 * chunk (first 1-2 sentences) and the rest. Both chunks are sent to
 * Azure in parallel. The first chunk plays as soon as it arrives
 * (~2-3s), and the rest is queued to play immediately after.
 */
export function useVAOMVoice() {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<HTMLAudioElement | null>(null);
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
    if (queueRef.current) {
      queueRef.current.pause();
      queueRef.current.src = "";
      queueRef.current = null;
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
    async (text: string, moment: GameMoment) => {
      if (!text) return;
      stop();

      const controller = new AbortController();
      abortRef.current = controller;
      setStatus("loading");

      // Split into first chunk (~first 2 sentences) and the rest.
      // Short first chunk → fast Azure synthesis → audio starts quickly.
      const chunks = splitIntoChunks(text);

      // Fire all chunks in parallel
      const promises = chunks.map((chunk) =>
        fetchChunk(chunk, moment, controller.signal)
      );

      // Wait for the first chunk and play immediately
      const firstAudio = await promises[0];
      if (controller.signal.aborted || !firstAudio) {
        if (!controller.signal.aborted) setStatus("idle");
        return;
      }

      audioRef.current = firstAudio;

      // If there's a second chunk, set it up to play after the first ends
      if (promises.length > 1) {
        firstAudio.onended = async () => {
          if (controller.signal.aborted) return;
          const nextAudio = await promises[1];
          if (controller.signal.aborted || !nextAudio) {
            setStatus("idle");
            return;
          }
          audioRef.current = nextAudio;
          queueRef.current = null;
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

/**
 * Split text into two chunks: a short first part (1-2 sentences, max ~200 chars)
 * for fast initial playback, and the rest. If the text is short enough,
 * returns a single chunk.
 */
function splitIntoChunks(text: string): string[] {
  if (text.length <= 250) return [text];

  // Find a good split point: end of first or second sentence
  const sentences = text.match(/[^.!?]+[.!?]+/g);
  if (!sentences || sentences.length <= 2) return [text];

  // Take first 2 sentences as the opening chunk
  const first = sentences.slice(0, 2).join("").trim();
  const rest = text.slice(first.length).trim();

  if (!rest) return [first];
  return [first, rest];
}
