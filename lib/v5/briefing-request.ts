import type { Round } from "./prompts";
import type { ScenarioDomain } from "../types";
import { SCENARIOS } from "./scenarios";

/**
 * The only request /api/claude serves: a v5 round briefing,
 * `{ kind: "briefing", edition: "v5", round: 1..4, scenario?: <a playable scenario id> }`.
 * The prompt is fixed per scenario and round (lib/v5/scenarios), so no caller-supplied text ever reaches
 * the model; the scenario is checked against the registry, and a request without one means invoices.
 * Anything else, including the old v4 kinds whose prompts carried caller data, is refused.
 */
export function parseBriefingRequest(body: unknown): { round: Round; scenario: ScenarioDomain } | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  const { kind, edition, round, scenario = "invoice_processing" } = body as Record<string, unknown>;
  if (kind !== "briefing" || edition !== "v5") return null;
  if (round !== 1 && round !== 2 && round !== 3 && round !== 4) return null;
  if (typeof scenario !== "string" || !Object.hasOwn(SCENARIOS, scenario)) return null;
  return { round, scenario: scenario as ScenarioDomain };
}
