// Compare models on the v5 game's real prompts: the four round briefings, the only text a model writes in
// v5. Each reply is checked the way /api/claude checks it (length, truncation) and for style, and the
// report keeps every reply for reading. Debriefs and profiles are scripted from the run since the
// 2026-10-15 comparison (notes kept privately), so they aren't compared here.
//
//   MISTRAL_API_KEY=... ANTHROPIC_API_KEY=... node --import ./tests/v5-hooks.mjs scripts/compare-models.mts out-dir \
//     mistral:mistral-large-2512 mistral:mistral-medium-3-5 anthropic:claude-sonnet-5
//
// Keys come only from the environment and are never written to the report.
import { mkdirSync, writeFileSync } from "node:fs";
import { complete, type LlmConfig, type Provider } from "../lib/llm.ts";
import { BRIEFING_PROMPTS_V5, VAOM_SYSTEM_V5, type Round } from "../lib/v5/prompts.ts";
const [outDir, ...specs] = process.argv.slice(2);
if (!outDir || specs.length === 0) { console.error("usage: compare-models.mts out-dir provider:model [...]"); process.exit(2); }

// ── The calls ──────────────────────────────────────────────────────────────

type Job = { id: string; system: string; prompt: string; maxTokens: number; json?: boolean; check: (text: string) => string | null };
const jobs: Job[] = [];
for (const round of [1, 2, 3, 4] as Round[]) {
  jobs.push({ id: `briefing-r${round}`, system: VAOM_SYSTEM_V5, prompt: BRIEFING_PROMPTS_V5[round], maxTokens: 900, check: (t) => (t.trim().length < 150 ? "too short" : null) });
}

// ── Run ────────────────────────────────────────────────────────────────────

const STYLE: [RegExp, string][] = [[/—/, "em dash"], [/^\s*[-*•] /m, "bullet list"], [/\*\*|^#/m, "markdown"], [/structural/i, "says structural"], [/v4|4\.0/, "mentions v4"]];

mkdirSync(outDir, { recursive: true });
const summary: string[] = ["| model | calls | passed checks | truncated | style flags | median latency |", "|---|---|---|---|---|---|"];
for (const spec of specs) {
  const [provider, model] = spec.split(":") as [Provider, string];
  const apiKey = process.env[provider === "anthropic" ? "ANTHROPIC_API_KEY" : "MISTRAL_API_KEY"];
  if (!apiKey) { summary.push(`| ${spec} | skipped: no key | | | | |`); continue; }
  const llm: LlmConfig = { provider, model, apiKey, baseUrl: provider === "mistral" ? (process.env.MISTRAL_BASE_URL ?? "https://api.mistral.ai") : "" };
  const lines: string[] = [`# ${spec}`, ""];
  let passed = 0, truncated = 0, flagged = 0;
  const latencies: number[] = [];
  for (const j of jobs) {
    const t0 = Date.now();
    let text = "", trunc = false, err = "";
    try { const r = await complete(llm, { system: j.system, prompt: j.prompt, maxTokens: j.maxTokens, ...(j.json ? { json: true } : {}) }); text = r.text; trunc = r.truncated; }
    catch (e) { err = (e as Error).message.slice(0, 200); }
    const ms = Date.now() - t0;
    latencies.push(ms);
    const problem = err ? `error: ${err}` : j.check(text);
    const style = STYLE.filter(([re]) => re.test(text)).map(([, n]) => n);
    if (!problem) passed++;
    if (trunc) truncated++;
    if (style.length) flagged++;
    lines.push(`## ${j.id}`, "", `${problem ? `**rejected: ${problem}**` : "passed"} · ${ms} ms${trunc ? " · **truncated**" : ""}${style.length ? ` · style: ${style.join(", ")}` : ""}`, "", text || "(no reply)", "");
    process.stdout.write(problem ? "x" : ".");
  }
  latencies.sort((a, b) => a - b);
  summary.push(`| ${spec} | ${jobs.length} | ${passed} | ${truncated} | ${flagged} | ${latencies[latencies.length >> 1]} ms |`);
  writeFileSync(`${outDir}/${spec.replace(/[:/]/g, "_")}.md`, lines.join("\n"));
  console.log(` ${spec}`);
}
writeFileSync(`${outDir}/summary.md`, summary.join("\n") + "\n");
console.log(summary.join("\n"));
