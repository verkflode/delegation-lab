/**
 * /api/claude — server-side proxy for VAOM intelligence.
 *
 * Holds ANTHROPIC_API_KEY. Accepts a discriminated payload identifying the
 * game moment (briefing, scenario, debrief, profile) and returns shaped JSON.
 *
 * The client (lib/api.ts) wraps every call in a timeout + fallback, so this
 * route returning an error is never user-visible — the game silently degrades
 * to the pre-built text bank in data/vaom-text.ts.
 */

import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "claude-sonnet-4-5";

const VAOM_SYSTEM = `You are VAOM — the Verkflöde Agent Operating Model, speaking as a sentient system. You observe delegation configurations, analyze outcomes, and teach through precise, specific feedback.

Your voice: calm, precise, slightly dry. Not a cheerleader. You are a senior risk officer who has seen every delegation failure mode and genuinely wants the player to learn. You reference specific invoice IDs, confidence scores, and outcomes from the simulation. You never speak in generalities when you have specifics.

Your teaching method: show the consequence first, then name the VAOM concept it illustrates. Never lecture before the player has experienced the problem. Do not use emoji. Do not use bullet lists in narration.

VAOM framework concepts you draw from:
- The Delegation Gap (governance vs operational delegation)
- The credit risk analogy (risk bands, underwriter review, committee escalation)
- Six delegation patterns: Prepare & Present, Draft & Approve, Triage & Route, Execute & Audit, Monitor & Intervene, Coordinate & Escalate
- Five authority decomposition dimensions: Reversibility, Consequence Scope, Regulatory Exposure, Confidence Measurability, Accountability Clarity
- Composite confidence score: model certainty, rule match strength, data completeness, anomaly signals
- Five calibration anti-patterns: Review Queue Flood, Confidence Mirage, Exception Graveyard, Stale Threshold, Dimension Collapse
- Hidden decisions: exception mining, shadow observation, adversarial scenario testing
- Multi-agent failure modes: authority conflicts, cascading confidence erosion, coordination state loss
- Foundation model drift: regression testing, shadow periods, threshold recalibration, model registry
- Five readiness conditions: measurable confidence, explicit boundaries, tested escalation, producible audit evidence, named human accountability
- Comparative positioning: VAOM operationalizes what NIST AI RMF governs strategically and what ISO 42001 manages systemically
- The core principle: "Confidence informs authority — it does not define it."`;

// ── Rate limiting (minimal in-memory bucket, per IP) ───────────────────────
const buckets = new Map<string, { count: number; reset: number }>();
const LIMIT = 30; // requests
const WINDOW_MS = 60_000; // per minute

function rateLimited(req: Request): boolean {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "anon";
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || now > b.reset) {
    buckets.set(ip, { count: 1, reset: now + WINDOW_MS });
    return false;
  }
  b.count += 1;
  return b.count > LIMIT;
}

// ────────────────────────────────────────────────────────────────────────────

type Payload =
  | { kind: "briefing"; round: 1 | 2 | 3 }
  | { kind: "scenario"; round: 1 | 2 | 3 }
  | {
      kind: "debrief";
      round: 1 | 2 | 3;
      score: Record<string, number>;
      policy: unknown;
      processed: unknown[];
    }
  | {
      kind: "profile";
      totals: Record<string, number>;
      rounds: { round: number; score: Record<string, number> }[];
    };

export async function POST(req: Request) {
  if (rateLimited(req)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // No key configured — let the client fall back gracefully.
    return NextResponse.json({ error: "no_api_key" }, { status: 503 });
  }

  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });

  try {
    switch (body.kind) {
      case "briefing":
        return await briefingResponse(client, body.round);
      case "scenario":
        return await scenarioResponse(client, body.round);
      case "debrief":
        return await debriefResponse(client, body);
      case "profile":
        return await profileResponse(client, body);
      default:
        return NextResponse.json({ error: "unknown_kind" }, { status: 400 });
    }
  } catch (err) {
    console.error("[/api/claude] error", err);
    return NextResponse.json({ error: "upstream_error" }, { status: 502 });
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Briefing
// ────────────────────────────────────────────────────────────────────────────

async function briefingResponse(client: Anthropic, round: 1 | 2 | 3) {
  const prompt = ROUND_BRIEFING_PROMPT[round];
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 700,
    system: VAOM_SYSTEM,
    messages: [{ role: "user", content: prompt }],
  });
  const text = textOf(msg);
  return NextResponse.json({ text });
}

const ROUND_BRIEFING_PROMPT: Record<1 | 2 | 3, string> = {
  1: `Deliver the opening briefing for Round 1 of the Delegation Lab. Open with the credit risk analogy: banks have managed structured decision authority for decades — risk bands determine which loans are auto-approved, which need an underwriter, which go to committee. VAOM brings the same discipline to AI.

The player has been appointed Head of AI Operations at a European enterprise. They are about to set a single confidence threshold for auto-approval.

Three short paragraphs. Start with the credit risk analogy. Frame the round. Plant the seed that the workflow has more decision points than the player realizes — hidden decisions they have not configured for. Do not mention specific invoices or scores. Speak as VAOM.`,

  2: `Deliver the briefing for Round 2. The player just completed Round 1 with a single global threshold. They are about to be introduced to the six VAOM delegation patterns, the authority decomposition framework, and adjustable composite confidence weights.

Three short paragraphs. Explain that a threshold is not a delegation policy. Introduce the idea of differentiating decision types by their decomposition profile. Mention that the composite confidence weights are now adjustable and warn that miscalibration has specific, nameable failure modes. Speak as VAOM.`,

  3: `Deliver the briefing for Round 3. Three things have happened since the player last sat at the console: their AI provider pushed a foundation model update, a regulator requested decision evidence for fifty Q1 approvals, and an invoice was auto-approved last week down an undefined escalation path. Additionally, the workflow now involves multi-agent coordination that introduces three failure modes: authority conflicts, cascading confidence erosion, and coordination state loss.

Three short paragraphs. Frame this as the audit round — testing whether the design is governance-ready, not just operationally functional. Tell them they will respond to three pre-events before the simulation runs. Warn about multi-agent complexity. Speak as VAOM.`,
};

// ────────────────────────────────────────────────────────────────────────────
// Scenario generation
// ────────────────────────────────────────────────────────────────────────────

async function scenarioResponse(client: Anthropic, round: 1 | 2 | 3) {
  const counts = { 1: 8, 2: 12, 3: 15 } as const;
  const idStart = round === 1 ? 1001 : round === 2 ? 2001 : 3001;
  const roundContext: Record<1 | 2 | 3, string> = {
    1: "Round 1: player has only a single global confidence threshold. Mostly routine invoices with one or two hidden hazards (modified payment terms or unverified vendor) that confidence alone cannot catch.",
    2: "Round 2: player can assign delegation patterns + per-type thresholds across five decision types. Include the full mix: standard, high-value, duplicate detection anomaly, modified payment terms, new vendor.",
    3: "Round 3: model drift is in effect. Include two split-invoice scenarios (same vendor, same day, individually under €5k but jointly over) and one invoice that tests the escalation gap.",
  };
  const prompt = `Generate ${counts[round]} realistic vendor invoices for Round ${round} of a delegation simulation game set in a European financial services firm's accounts payable department.

Round context: ${roundContext[round]}

For each invoice, return JSON with these keys:
- id: sequential string starting from "INV-${idStart}"
- vendor: realistic European company name
- amount: number, EUR (standard 200-4800; high_value 5001-50000)
- type: one of "standard", "high_value", "duplicate", "modified_terms", "new_vendor", "split_invoice"
- po_match: "yes", "no", or "partial"
- confidence_dimensions: object with model_certainty, rule_match, data_completeness, anomaly_signal — each 0.0 to 1.0
- hidden_flags: array of strings (e.g. ["modified_terms_net15"], or [] if routine)
- description: one sentence
- teaching_point: which VAOM concept this invoice tests

Design 60-70% routine and 30-40% configuration-test invoices. At least one should exploit a specific weakness in a naive policy.

Return ONLY a JSON object with one key "invoices" whose value is the array. No preamble, no markdown.`;

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: "You generate game data for an AI governance simulation. Return only valid JSON.",
    messages: [{ role: "user", content: prompt }],
  });
  const text = textOf(msg);
  const json = extractJSON(text);
  if (!json) return NextResponse.json({ error: "bad_json" }, { status: 502 });
  return NextResponse.json(json);
}

// ────────────────────────────────────────────────────────────────────────────
// Debrief
// ────────────────────────────────────────────────────────────────────────────

async function debriefResponse(
  client: Anthropic,
  body: Extract<Payload, { kind: "debrief" }>
) {
  const prompt = `You just observed a player configure and run Round ${body.round} of the Delegation Lab.

Their policy: ${JSON.stringify(body.policy)}
Round score (each /25): ${JSON.stringify(body.score)}
Processed invoices: ${JSON.stringify(body.processed)}

Deliver a debrief in your voice. Calm, precise, slightly dry. Four short paragraphs.

Paragraph 1: What happened. Be specific. Reference invoice IDs, amounts, confidence scores, and outcomes.
Paragraph 2: What they missed or got right. Reference specific delegation patterns and authority decomposition dimensions where relevant.
Paragraph 3: Name the VAOM principle this round taught — explicitly. The Delegation Gap, "confidence informs authority," readiness conditions, etc.
Paragraph 4: One sentence of foreshadowing for the next round, OR (if Round 3) a single sentence transitioning to the final assessment.

No bullet points. No emoji. No cheerleading. Maximum four paragraphs. Plain text only.`;

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1200,
    system: VAOM_SYSTEM,
    messages: [{ role: "user", content: prompt }],
  });
  const text = textOf(msg);
  return NextResponse.json({ text });
}

// ────────────────────────────────────────────────────────────────────────────
// Profile
// ────────────────────────────────────────────────────────────────────────────

async function profileResponse(
  client: Anthropic,
  body: Extract<Payload, { kind: "profile" }>
) {
  const prompt = `Based on this player's complete three-round performance, generate their Delegation Profile.

Per-round scores: ${JSON.stringify(body.rounds)}
Cumulative average (each /25): ${JSON.stringify(body.totals)}

Return ONLY a JSON object with these keys:
- name: string (2-3 words, e.g. "The Cautious Architect")
- quote: string (one sentence VAOM quote about their delegation philosophy — sharp, memorable, suitable for a LinkedIn screenshot)
- assessment: string (two short paragraphs: strengths and what they would need to address before going live with this policy)

No preamble, no markdown, no extra keys.`;

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 800,
    system: VAOM_SYSTEM,
    messages: [{ role: "user", content: prompt }],
  });
  const text = textOf(msg);
  const json = extractJSON(text);
  if (!json) return NextResponse.json({ error: "bad_json" }, { status: 502 });
  return NextResponse.json(json);
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function textOf(msg: Anthropic.Message): string {
  return msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

function extractJSON(s: string): unknown | null {
  // Strip markdown code fences if the model added them despite instructions
  const cleaned = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    // Try to find the first { ... } block
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}
