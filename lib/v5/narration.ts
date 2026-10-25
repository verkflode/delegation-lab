// Model-written briefings for v5, fetched ahead of the screen that shows them. The briefing waits briefly
// for its text, then keeps the scripted text if the model hasn't answered (or can't: no key, bad reply).
import { fetchBriefingV5 } from "../api";
import type { RoundNumber, ScenarioDomain } from "../types";

const cache = new Map<string, Promise<unknown>>();

function once<T>(key: string, f: () => Promise<T | null>): void {
  if (!cache.has(key)) cache.set(key, f().catch(() => null));
}

/** The narration for `key` if it arrives within `waitMs`, else null. */
export async function ready<T>(key: string, waitMs: number): Promise<T | null> {
  const p = cache.get(key) as Promise<T | null> | undefined;
  if (!p) return null;
  return Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), waitMs))]);
}

export const briefingKey = (scenario: ScenarioDomain, round: RoundNumber) => `briefing:${scenario}:${round}`;

export function prefetchBriefing(scenario: ScenarioDomain, round: RoundNumber): void {
  once(briefingKey(scenario, round), () => fetchBriefingV5(round, scenario));
}

/** A new game starts with nothing cached. */
export function clearNarration(): void {
  cache.clear();
}
