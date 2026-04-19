/**
 * /api/voice — server-side proxy to Azure Cognitive Services Speech
 * (MAI-Voice-1). Holds AZURE_SPEECH_KEY. Region is Sweden Central by
 * default for EU data residency (matches Verkflöde's positioning).
 *
 * Wraps incoming plain text + game moment in SSML using the central
 * builder, calls Azure Speech, and streams back audio.
 *
 * STATUS: Wired but unconfigured. The voice name is intentionally a
 * stub — Alex will pick the final voice in Azure Speech Studio after
 * testing 2-3 candidates against VAOM's "calm senior risk officer"
 * persona. Until both AZURE_SPEECH_KEY and AZURE_SPEECH_VOICE are set
 * in the environment, this route returns 503 and the client falls
 * back to text-only (which is the baseline experience).
 */

import { NextResponse } from "next/server";
import { buildSSML, type GameMoment } from "../../../lib/ssml";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REGION = process.env.AZURE_SPEECH_REGION ?? "swedencentral";
// DragonHD voices don't support opus — use mp3 which works across all voice types
const OUTPUT_FORMAT = "audio-24khz-96kbitrate-mono-mp3";

// ── Rate limiting ──────────────────────────────────────────────────────────
const buckets = new Map<string, { count: number; reset: number }>();
const LIMIT = 60;
const WINDOW_MS = 60_000;

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

type VoicePayload = {
  text: string;
  moment: GameMoment;
};

export async function POST(req: Request) {
  if (rateLimited(req)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const apiKey = process.env.AZURE_SPEECH_KEY;
  const voiceName = process.env.AZURE_SPEECH_VOICE;
  if (!apiKey || !voiceName) {
    // Voice not configured — graceful degradation. Game still works, text-only.
    return NextResponse.json(
      { error: "voice_not_configured" },
      { status: 503 }
    );
  }

  let body: VoicePayload;
  try {
    body = (await req.json()) as VoicePayload;
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  if (!body?.text || !body?.moment) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const ssml = buildSSML({ voiceName, text: body.text, moment: body.moment });

  const endpoint = `https://${REGION}.tts.speech.microsoft.com/cognitiveservices/v1`;

  try {
    const azureRes = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": apiKey,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": OUTPUT_FORMAT,
        "User-Agent": "delegation-lab",
      },
      body: ssml,
    });
    if (!azureRes.ok) {
      const detail = await azureRes.text().catch(() => "");
      console.error("[/api/voice] azure error", azureRes.status, detail);
      return NextResponse.json(
        { error: "upstream_error", status: azureRes.status },
        { status: 502 }
      );
    }
    return new Response(azureRes.body, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[/api/voice] fetch error", err);
    return NextResponse.json({ error: "fetch_failed" }, { status: 502 });
  }
}
