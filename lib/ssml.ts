/**
 * SSML builder — wraps plain text in MAI-Voice-1-compatible markup with the
 * appropriate express-as style and prosody adjustments for the current
 * game moment. Centralized so the Claude prompt stays simple (Claude
 * generates plain text) and the voice control lives in one place.
 *
 * Style mapping comes directly from the spec table:
 *   "Round briefing"          → newscast-formal
 *   "Mid-simulation alert"    → newscast-serious
 *   "Debrief (good)"          → newscast-casual
 *   "Debrief (missed)"        → newscast-serious
 *   "Final assessment"        → newscast-casual
 *   "Naming a VAOM concept"   → newscast-formal (slow, emphasized)
 *
 * IMPORTANT: VOICE_NAME is intentionally a stub. Alex will test candidates
 * in Azure Speech Studio and pick the one that fits VAOM's persona ("calm
 * senior risk officer"). Until then, /api/voice will reject calls if
 * AZURE_SPEECH_KEY is missing — and the game falls back to text-only,
 * which is the baseline experience anyway.
 */

export type GameMoment =
  | "title_welcome"
  | "round_briefing"
  | "mid_alert"
  | "debrief_good"
  | "debrief_missed"
  | "final_assessment";

export type SSMLOptions = {
  voiceName: string;
  text: string;
  moment: GameMoment;
};

const STYLE_FOR_MOMENT: Record<GameMoment, string> = {
  title_welcome: "newscast-formal",
  round_briefing: "newscast-formal",
  mid_alert: "newscast-serious",
  debrief_good: "newscast-casual",
  debrief_missed: "newscast-serious",
  final_assessment: "newscast-casual",
};

/**
 * Pronunciation map — words that need a `<sub alias>` hint because the
 * TTS engine can't pronounce them from spelling alone. Add entries here
 * for brand names, vendor names, or any term VAOM mispronounces.
 */
const PRONUNCIATION: Record<string, string> = {
  "Verkflöde": "Vairk flur deh",
  "Verkflode": "Vairk flur deh",
  "VAOM": "V A O M",
  // Swedish/European vendor names from the fallback scenarios
  "Nordström": "Nord strum",
  "Båtsman": "Boats man",
  "Lumière": "Loo mee air",
  "Aalto": "Aal toh",
  "Stadsbyggnad": "Stads big nad",
};

/**
 * Light prosody pass: apply pronunciation hints, slow VAOM concept names,
 * insert short breaks at paragraph boundaries, and pace key phrases.
 */
function applyProsody(text: string): string {
  // Escape XML special chars first
  let s = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Apply pronunciation substitutions before any other SSML wrapping
  for (const [word, alias] of Object.entries(PRONUNCIATION)) {
    const pattern = new RegExp(
      word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "gi"
    );
    s = s.replace(pattern, `<sub alias="${alias}">${word}</sub>`);
  }

  // Insert breath pauses at paragraph breaks
  s = s.replace(/\n\n+/g, ' <break time="500ms"/> ');
  s = s.replace(/\n/g, ' <break time="250ms"/> ');

  // Slow down + emphasize the named VAOM concepts when they appear
  const slowPhrases = [
    "Delegation Gap",
    "Confidence Gate",
    "Authority Decomposition",
    "Delegation Authority Matrix",
    "Readiness Assessment",
    "confidence informs authority",
    "Review Queue Flood",
    "Confidence Mirage",
    "Exception Graveyard",
    "Stale Threshold",
    "Dimension Collapse",
    "cascading confidence erosion",
    "authority conflict",
    "coordination state loss",
  ];
  for (const phrase of slowPhrases) {
    const pattern = new RegExp(
      `\\b(${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})\\b`,
      "gi"
    );
    s = s.replace(pattern, '<prosody rate="-8%">$1</prosody>');
  }

  return s;
}

export function buildSSML(opts: SSMLOptions): string {
  const style = STYLE_FOR_MOMENT[opts.moment];
  const inner = applyProsody(opts.text);
  return [
    '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis"',
    '  xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="en-US">',
    `  <voice name="${opts.voiceName}">`,
    `    <mstts:express-as style="${style}">`,
    `      ${inner}`,
    `    </mstts:express-as>`,
    `  </voice>`,
    `</speak>`,
  ].join("\n");
}
