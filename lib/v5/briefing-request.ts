import type { Round } from "./prompts";

/**
 * The only request /api/claude serves: a v5 round briefing, `{ kind: "briefing", edition: "v5", round: 1..4 }`.
 * The prompt is fixed per round (lib/v5/prompts.ts), so no caller-supplied text ever reaches the model.
 * Anything else, including the old v4 kinds whose prompts carried caller data, is refused.
 */
export function parseBriefingRequest(body: unknown): { round: Round } | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  const { kind, edition, round } = body as Record<string, unknown>;
  if (kind !== "briefing" || edition !== "v5") return null;
  if (round !== 1 && round !== 2 && round !== 3 && round !== 4) return null;
  return { round };
}
