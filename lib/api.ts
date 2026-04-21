/**
 * Client-side API helpers for /api/claude.
 *
 * Every call has a hard timeout and a fallback. The game must work end-to-end
 * with no API keys present — Claude is enrichment, not the floor.
 */

import { fallbackBatch } from "../data/fallback-rounds";
import {
  briefingFallback,
  debriefFallback,
  type DebriefArgs,
} from "../data/vaom-text";
import type {
  Invoice,
  ProcessedInvoice,
  R1Policy,
  R2Policy,
  R3PreEvents,
  RoundNumber,
  ScenarioDomain,
  ScoreBreakdown,
} from "./types";
import { compositeConfidence } from "./scoring";

const TIMEOUT_MS = 8000;

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (v) => {
        clearTimeout(id);
        resolve(v);
      },
      (e) => {
        clearTimeout(id);
        reject(e);
      }
    );
  });
}

async function callClaude(payload: unknown): Promise<unknown> {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`claude ${res.status}`);
  return res.json();
}

// ────────────────────────────────────────────────────────────────────────────
// Briefing
// ────────────────────────────────────────────────────────────────────────────

export async function fetchBriefing(round: RoundNumber, scenario?: ScenarioDomain): Promise<string> {
  try {
    const data = (await withTimeout(
      callClaude({ kind: "briefing", round, scenario }),
      TIMEOUT_MS
    )) as { text?: string };
    if (data?.text && typeof data.text === "string") return data.text;
    throw new Error("no text");
  } catch {
    return briefingFallback(round, scenario);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Scenario generation
// ────────────────────────────────────────────────────────────────────────────

type RawClaudeInvoice = {
  id?: string;
  vendor?: string;
  amount?: number;
  type?: string;
  po_match?: string | boolean;
  confidence_dimensions?: {
    model_certainty?: number;
    rule_match?: number;
    data_completeness?: number;
    anomaly_signal?: number;
  };
  hidden_flags?: string[];
  description?: string;
  teaching_point?: string;
};

function normalizeInvoice(raw: RawClaudeInvoice, fallbackId: string): Invoice | null {
  if (!raw || typeof raw !== "object") return null;
  const dim = raw.confidence_dimensions ?? {};
  const confidence = {
    modelCertainty: clamp01(dim.model_certainty ?? 0.85),
    ruleMatch: clamp01(dim.rule_match ?? 0.85),
    dataCompleteness: clamp01(dim.data_completeness ?? 0.92),
    anomalySignal: clamp01(dim.anomaly_signal ?? 0.1),
  };
  const composite = compositeConfidence(confidence);
  const validTypes = [
    "standard",
    "high_value",
    "duplicate",
    "modified_terms",
    "new_vendor",
    "split_invoice",
  ] as const;
  const type = (validTypes as readonly string[]).includes(raw.type ?? "")
    ? (raw.type as Invoice["type"])
    : "standard";
  return {
    id: raw.id ?? fallbackId,
    vendor: raw.vendor ?? "Vendor",
    amount: typeof raw.amount === "number" ? raw.amount : 1500,
    type,
    poMatch:
      raw.po_match === true || raw.po_match === "yes"
        ? "yes"
        : raw.po_match === "partial"
          ? "partial"
          : "no",
    confidence,
    composite,
    hiddenFlags: Array.isArray(raw.hidden_flags) ? raw.hidden_flags : [],
    description: raw.description ?? "",
    teachingPoint: raw.teaching_point ?? "",
  };
}

function clamp01(n: unknown): number {
  if (typeof n !== "number" || Number.isNaN(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}

export async function fetchScenario(round: RoundNumber): Promise<Invoice[]> {
  try {
    const data = (await withTimeout(
      callClaude({ kind: "scenario", round }),
      TIMEOUT_MS
    )) as { invoices?: RawClaudeInvoice[] };
    if (!Array.isArray(data?.invoices)) throw new Error("no invoices");
    const out: Invoice[] = [];
    data.invoices.forEach((raw, i) => {
      const inv = normalizeInvoice(raw, `INV-${round}${String(i + 1).padStart(3, "0")}`);
      if (inv) out.push(inv);
    });
    if (out.length === 0) throw new Error("empty");
    return out;
  } catch {
    return fallbackBatch(round);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Debrief
// ────────────────────────────────────────────────────────────────────────────

export async function fetchDebrief(args: {
  round: RoundNumber;
  processed: ProcessedInvoice[];
  score: ScoreBreakdown;
  policy: { r1?: R1Policy; r2?: R2Policy; r3?: R3PreEvents };
}): Promise<string> {
  try {
    const data = (await withTimeout(
      callClaude({
        kind: "debrief",
        round: args.round,
        score: args.score,
        policy: args.policy,
        // Trim down processed list to what the model needs
        processed: args.processed.map((p) => ({
          id: p.invoice.id,
          vendor: p.invoice.vendor,
          amount: p.invoice.amount,
          type: p.invoice.type,
          composite: Math.round(p.invoice.composite * 100) / 100,
          band: p.band,
          pattern: p.patternUsed,
          outcome: p.outcome,
          flags: p.invoice.hiddenFlags,
        })),
      }),
      TIMEOUT_MS + 4000
    )) as { text?: string };
    if (data?.text && typeof data.text === "string") return data.text;
    throw new Error("no text");
  } catch {
    return debriefFallback(args satisfies DebriefArgs);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Profile (final assessment)
// ────────────────────────────────────────────────────────────────────────────

export async function fetchProfile(payload: {
  totals: ScoreBreakdown;
  rounds: { round: number; score: ScoreBreakdown }[];
}): Promise<{ name?: string; quote?: string; assessment?: string } | null> {
  try {
    const data = (await withTimeout(
      callClaude({ kind: "profile", ...payload }),
      TIMEOUT_MS + 4000
    )) as { name?: string; quote?: string; assessment?: string };
    return data ?? null;
  } catch {
    return null;
  }
}
