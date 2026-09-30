/**
 * Server-side text generation with a provider switch.
 *
 *   LLM_PROVIDER       "anthropic" (default) or "mistral"
 *   ANTHROPIC_API_KEY  ANTHROPIC_MODEL (default "claude-sonnet-5")
 *   MISTRAL_API_KEY    MISTRAL_MODEL (default "mistral-large-latest")
 *                      MISTRAL_BASE_URL (default "https://api.mistral.ai"; set it for a regional endpoint)
 *
 * With no settings at all this behaves exactly as before the switch existed:
 * Anthropic, same model. An unrecognised provider name or a missing key is a
 * configuration error, never a silent fallback to some other provider; the
 * route answers 503 and the client uses its built-in text bank.
 */
import Anthropic from "@anthropic-ai/sdk";

export type Provider = "anthropic" | "mistral";

export type LlmConfig = {
  provider: Provider;
  model: string;
  apiKey: string;
  baseUrl: string;
};

export type LlmConfigError = { error: "unknown_provider" | "no_api_key"; detail: string };

export type CompletionRequest = {
  system: string;
  prompt: string;
  maxTokens: number;
  /** The caller expects a JSON object back. Mistral gets JSON mode; Anthropic relies on the prompt, as before. */
  json?: boolean;
};

export type Completion = {
  text: string;
  /** The reply stopped at maxTokens, so it may be cut off. */
  truncated: boolean;
};

type Env = Record<string, string | undefined>;

const DEFAULT_MODEL: Record<Provider, string> = {
  anthropic: "claude-sonnet-5",
  mistral: "mistral-large-latest",
};

export function llmConfigFromEnv(env: Env = process.env): LlmConfig | LlmConfigError {
  const name = (env.LLM_PROVIDER ?? "anthropic").trim().toLowerCase();
  if (name !== "anthropic" && name !== "mistral") {
    return { error: "unknown_provider", detail: `LLM_PROVIDER=${name}` };
  }
  const provider: Provider = name;
  const prefix = provider === "anthropic" ? "ANTHROPIC" : "MISTRAL";
  const apiKey = env[`${prefix}_API_KEY`]?.trim();
  if (!apiKey) return { error: "no_api_key", detail: `${prefix}_API_KEY is not set` };
  return {
    provider,
    model: env[`${prefix}_MODEL`]?.trim() || DEFAULT_MODEL[provider],
    apiKey,
    baseUrl: (env.MISTRAL_BASE_URL?.trim() || "https://api.mistral.ai").replace(/\/+$/, ""),
  };
}

export async function complete(cfg: LlmConfig, req: CompletionRequest): Promise<Completion> {
  return cfg.provider === "anthropic" ? completeAnthropic(cfg, req) : completeMistral(cfg, req);
}

async function completeAnthropic(cfg: LlmConfig, req: CompletionRequest): Promise<Completion> {
  const client = new Anthropic({ apiKey: cfg.apiKey });
  const msg = await client.messages.create({
    model: cfg.model,
    max_tokens: req.maxTokens,
    system: req.system,
    messages: [{ role: "user", content: req.prompt }],
  });
  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  return { text, truncated: msg.stop_reason === "max_tokens" };
}

type MistralChunk = { type?: string; text?: string };
type MistralResponse = {
  choices?: { finish_reason?: string; message?: { content?: string | MistralChunk[] | null } }[];
};

/** Mistral returns message content as a string or as a list of typed chunks. */
export function mistralText(content: string | MistralChunk[] | null | undefined): string {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content
    .filter((c) => c?.type === "text" && typeof c.text === "string")
    .map((c) => c.text)
    .join("")
    .trim();
}

async function completeMistral(cfg: LlmConfig, req: CompletionRequest): Promise<Completion> {
  const res = await fetch(`${cfg.baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: req.maxTokens,
      messages: [
        { role: "system", content: req.system },
        { role: "user", content: req.prompt },
      ],
      ...(req.json ? { response_format: { type: "json_object" } } : {}),
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    throw new Error(`mistral ${res.status}: ${detail}`);
  }
  const data = (await res.json()) as MistralResponse;
  const choice = data.choices?.[0];
  const finish = choice?.finish_reason ?? "";
  return {
    text: mistralText(choice?.message?.content),
    truncated: finish === "length" || finish === "model_length",
  };
}
