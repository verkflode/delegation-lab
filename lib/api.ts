/**
 * Client-side API helper for /api/claude, which serves only v5 round briefings.
 *
 * The call has a hard timeout and returns null on any failure, and the caller keeps its scripted text:
 * the game works end to end with no model key present. The model is enrichment, not the floor.
 */

import type { RoundNumber } from "./types";

const TIMEOUT_MS = 8000;

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (v) => {
        clearTimeout(id);
        resolve(v);
      },
      (e) => {
        clearTimeout(id);
        reject(e);
      }
    );
  });
}

async function callClaude(payload: unknown): Promise<unknown> {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`claude ${res.status}`);
  return res.json();
}

// ────────────────────────────────────────────────────────────────────────────
// v5: model-written briefings for the game on the VAOM Guardian core. Null on any failure (no key, timeout,
// a reply the server rejected), and the caller keeps its scripted text.
// ────────────────────────────────────────────────────────────────────────────

export async function fetchBriefingV5(round: RoundNumber): Promise<string | null> {
  try {
    const data = (await withTimeout(callClaude({ kind: "briefing", edition: "v5", round }), TIMEOUT_MS)) as { text?: string };
    return typeof data?.text === "string" && data.text.length > 150 ? data.text : null;
  } catch {
    return null;
  }
}
