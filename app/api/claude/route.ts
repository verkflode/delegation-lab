/**
 * /api/claude — server-side proxy for VAOM's round briefings.
 *
 * Serves exactly one request: a v5 round briefing (lib/v5/briefing-request.ts). Its prompt is fixed per
 * scenario and round (lib/v5/prompts.ts, lib/v5/scenarios), so nothing a caller sends reaches the model; everything else is refused,
 * including the v4 kinds (scenario, debrief, profile) whose prompts carried caller-supplied data. The
 * model provider is a setting (LLM_PROVIDER, see lib/llm.ts); the route keeps its old name because the
 * client calls /api/claude.
 *
 * The client (lib/api.ts) wraps the call in a timeout and keeps its scripted text on any error, so a
 * refusal or failure here is never visible to the player.
 */

import { NextResponse } from "next/server";
import { complete, llmConfigFromEnv } from "../../../lib/llm";
import { createLimiter, limitsFromEnv } from "../../../lib/rate-limit";
import { parseBriefingRequest } from "../../../lib/v5/briefing-request";
import { vaomSystem } from "../../../lib/v5/prompts";
import { SCENARIOS } from "../../../lib/v5/scenarios";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── Rate limiting (per IP, plus a global hourly ceiling; see lib/rate-limit.ts) ──
const rateLimited = createLimiter(
  limitsFromEnv("CLAUDE", { perMinute: 30, perHour: 150, globalPerHour: 600 }),
);

export async function POST(req: Request) {
  const limitedBy = rateLimited(req);
  if (limitedBy) {
    if (limitedBy === "global_hour") console.warn("[/api/claude] global hourly limit reached");
    return NextResponse.json({ error: "rate_limited", reason: limitedBy }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const request = parseBriefingRequest(body);
  if (!request) return NextResponse.json({ error: "unsupported_request" }, { status: 400 });

  const llm = llmConfigFromEnv();
  if ("error" in llm) {
    // Misconfigured or no key — let the client fall back gracefully.
    if (llm.error === "unknown_provider") console.error(`[/api/claude] ${llm.detail}`);
    return NextResponse.json({ error: llm.error }, { status: 503 });
  }

  try {
    const { text, truncated } = await complete(llm, {
      system: vaomSystem(SCENARIOS[request.scenario]),
      prompt: SCENARIOS[request.scenario].prompts.briefings[request.round],
      maxTokens: 900,
    });
    // Replies cut off at maxTokens may read as unfinished.
    if (truncated) console.warn(`[/api/claude] briefing reply hit max_tokens (${llm.provider}/${llm.model})`);
    // A reply that fails this check is a 502, and the client keeps its scripted text.
    if (text.trim().length < 150) return NextResponse.json({ error: "bad_reply" }, { status: 502 });
    return NextResponse.json({ text: text.trim() });
  } catch (err) {
    console.error("[/api/claude] error", err);
    return NextResponse.json({ error: "upstream_error" }, { status: 502 });
  }
}
