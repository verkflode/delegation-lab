/* eslint-disable @typescript-eslint/no-explicit-any -- test casts into error unions and mocks */
import { llmConfigFromEnv, complete, mistralText } from "../lib/llm.ts";
let fails = 0;
const eq = (name: string, got: unknown, want: unknown) => { const g = JSON.stringify(got), w = JSON.stringify(want); if (g !== w) { fails++; console.log("FAIL", name, "\n  got ", g, "\n  want", w); } };

// Configuration
eq("default is anthropic + current model", llmConfigFromEnv({ ANTHROPIC_API_KEY: "a" }), { provider: "anthropic", model: "claude-sonnet-5", apiKey: "a", baseUrl: "https://api.mistral.ai" });
eq("no key -> no_api_key", (llmConfigFromEnv({}) as any).error, "no_api_key");
eq("mistral default model", (llmConfigFromEnv({ LLM_PROVIDER: "mistral", MISTRAL_API_KEY: "m" }) as any).model, "mistral-large-latest");
eq("mistral model override", (llmConfigFromEnv({ LLM_PROVIDER: "Mistral ", MISTRAL_API_KEY: "m", MISTRAL_MODEL: "mistral-medium-latest" }) as any).model, "mistral-medium-latest");
eq("mistral without its key fails, even with an anthropic key", (llmConfigFromEnv({ LLM_PROVIDER: "mistral", ANTHROPIC_API_KEY: "a" }) as any).error, "no_api_key");
eq("unknown provider fails closed", (llmConfigFromEnv({ LLM_PROVIDER: "openai", ANTHROPIC_API_KEY: "a" }) as any).error, "unknown_provider");
eq("base url trailing slash trimmed", (llmConfigFromEnv({ LLM_PROVIDER: "mistral", MISTRAL_API_KEY: "m", MISTRAL_BASE_URL: "https://eu.example/" }) as any).baseUrl, "https://eu.example");

// Content formats
eq("string content", mistralText("  hi "), "hi");
eq("chunk content", mistralText([{ type: "text", text: "a" }, { type: "reference" }, { type: "text", text: "b" }] as any), "ab");
eq("null content", mistralText(null), "");

// Mistral request/response via a fake fetch
let seen: any = null;
const fake = (status: number, body: unknown) => { globalThis.fetch = (async (url: string, init: any) => { seen = { url, init, body: JSON.parse(init.body) }; return new Response(JSON.stringify(body), { status }); }) as any; };
const cfg = llmConfigFromEnv({ LLM_PROVIDER: "mistral", MISTRAL_API_KEY: "m-key", MISTRAL_BASE_URL: "https://eu.example" }) as any;

fake(200, { choices: [{ finish_reason: "stop", message: { content: "{\"a\":1}" } }] });
eq("json reply", await complete(cfg, { system: "S", prompt: "P", maxTokens: 50, json: true }), { text: "{\"a\":1}", truncated: false });
eq("endpoint", seen.url, "https://eu.example/v1/chat/completions");
eq("auth header", seen.init.headers.Authorization, "Bearer m-key");
eq("messages", seen.body.messages, [{ role: "system", content: "S" }, { role: "user", content: "P" }]);
eq("max_tokens + model", [seen.body.max_tokens, seen.body.model], [50, "mistral-large-latest"]);
eq("json mode on", seen.body.response_format, { type: "json_object" });

fake(200, { choices: [{ finish_reason: "length", message: { content: "cut" } }] });
eq("length -> truncated", (await complete(cfg, { system: "S", prompt: "P", maxTokens: 5 })).truncated, true);
eq("json mode off for text", seen.body.response_format, undefined);
fake(200, { choices: [{ finish_reason: "model_length", message: { content: "cut" } }] });
eq("model_length -> truncated", (await complete(cfg, { system: "S", prompt: "P", maxTokens: 5 })).truncated, true);

fake(401, { message: "Unauthorized" });
let err = ""; try { await complete(cfg, { system: "S", prompt: "P", maxTokens: 5 }); } catch (e: any) { err = e.message; }
eq("http error throws (route maps to 502)", err.startsWith("mistral 401"), true);
eq("error message doesn't carry the key", err.includes("m-key"), false);

console.log(fails ? `${fails} failed` : "all llm switch tests passed");
process.exit(fails ? 1 : 0);
