"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, Download, X } from "lucide-react";
import type { Metric, Scorecard } from "@verkflode/vaom-guardian-core";
import type { RoundResult } from "../../lib/types";
import { evidence, exportFiles, finalScorecard, GAME_MIN_SAMPLE, wireOf, type Choices } from "../../lib/v5/final";
import { track } from "../../lib/analytics";

/**
 * The final screen's v5 panels: the core's Delegation Scorecard over the game's four days, every decision
 * as the Guardian answered it on the ACS wire, and the player's files to take away.
 */
export function FinalV5({ choices, results }: { choices: Choices; results: RoundResult[] }) {
  const card = useMemo(() => {
    try { return finalScorecard(choices, results); } catch { return null; }
  }, [choices, results]);
  return (
    <div className="space-y-8">
      {card && <ScorecardPanel card={card} />}
      <WirePanel results={results} />
      <ExportPanel choices={choices} />
    </div>
  );
}

// ── The scorecard ──────────────────────────────────────────────────────────

const ROW_METRICS: [string, string][] = [
  ["bandDistribution", "1 · Band distribution"],
  ["bandAErrorRate", "2 · Band A error rate"],
  ["exceptionPathShare", "3 · Exception-path share"],
  ["dimensionCorrelation", "4 · Dimension correlation"],
  ["verifierEffectiveness", "5 · Verifier effectiveness"],
  ["staleKnowledgeShare", "6 · Stale knowledge"],
  ["reviewEngagement", "8 · Review engagement"],
  ["seededDetection", "9 · Seeded-error detection"],
  ["escalationSla", "10 · Escalations"],
];
const WORKFLOW_METRICS: [string, string][] = [
  ["oversightLoad", "7 · Oversight load"],
  ["chainIntegrity", "12 · Chain integrity"],
  ["boundaryVerification", "13 · Boundary verification"],
];

const STATUS: Record<string, { label: string; cls: string }> = {
  healthy: { label: "healthy", cls: "text-band-a" },
  breach: { label: "breach", cls: "text-red font-bold" },
  "insufficient-sample": { label: "too few", cls: "text-muted-2" },
  "not-measured": { label: "not measured", cls: "text-muted-2" },
  "no-target": { label: "no target", cls: "text-muted" },
};

function MetricLine({ label, m }: { label: string; m?: Metric }) {
  const [open, setOpen] = useState(false);
  if (!m) return null;
  const s = STATUS[m.status] ?? { label: m.status, cls: "text-muted" };
  return (
    <li className="border-t border-ink/8 first:border-t-0">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="w-full flex items-baseline justify-between gap-3 py-1.5 text-left focus-ring rounded">
        <span className="text-[13px] text-ink">{label}</span>
        <span className={`font-mono text-[11px] shrink-0 ${s.cls}`}>{s.label}</span>
      </button>
      {(open || m.status === "breach") && (
        <div className="pb-2 font-mono text-[10px] text-muted leading-relaxed break-words">
          {m.diagnosis ? <div className="text-red">{String(m.diagnosis)}</div> : null}
          {m.note ? <div>{String(m.note)}</div> : null}
        </div>
      )}
    </li>
  );
}

function ScorecardPanel({ card }: { card: Scorecard }) {
  const all: Metric[] = [...card.rows.flatMap((r) => Object.values(r.metrics)), ...Object.values(card.workflow), ...Object.values(card.agents)];
  const breaches = all.filter((m) => m.status === "breach").length;
  const healthy = all.filter((m) => m.status === "healthy").length;
  return (
    <div className="surface-strong px-6 py-5">
      <div className="flex items-center gap-2 mb-1">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan font-bold">The Delegation Scorecard</div>
        <div className="flex-1 h-px bg-ink/8" />
        <div className="font-mono text-[11px] tabular-nums"><span className="text-band-a">{healthy} healthy</span> · <span className={breaches ? "text-red" : "text-muted-2"}>{breaches} breach{breaches === 1 ? "" : "es"}</span></div>
      </div>
      <p className="text-[12px] text-muted mb-4">
        Computed by the VAOM Guardian&apos;s scorecard() from your {card.records} decision records over four days, against
        your final matrix. A game is small: verdicts here need {GAME_MIN_SAMPLE} decisions where the Guardian&apos;s default is 20,
        and anything it can&apos;t judge it says so.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {card.rows.map((r) => (
          <div key={r.row}>
            <div className="font-serif text-[18px] text-mint">{r.title ?? r.row}</div>
            <div className="font-mono text-[10px] text-muted-2 mb-1">{r.row} · {r.decisions} decisions</div>
            <ul>{ROW_METRICS.map(([k, label]) => <MetricLine key={k} label={label} m={r.metrics[k]} />)}</ul>
          </div>
        ))}
        <div>
          <div className="font-serif text-[18px] text-mint">The workflow</div>
          <div className="font-mono text-[10px] text-muted-2 mb-1">oversight, sub-agents, boundaries</div>
          <ul>
            {WORKFLOW_METRICS.map(([k, label]) => <MetricLine key={k} label={label} m={card.workflow[k]} />)}
            {Object.entries(card.agents).map(([agent, m]) => <MetricLine key={agent} label={`11 · Scope denials · ${agent}`} m={m} />)}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ── On the wire ────────────────────────────────────────────────────────────

const DAYS: Record<number, string> = { 1: "Tuesday", 2: "Wednesday", 3: "Thursday", 4: "The night" };

function WirePanel({ results }: { results: RoundResult[] }) {
  const [open, setOpen] = useState(false);
  const total = evidence(results).records.length;
  return (
    <div className="surface px-6 py-5">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="w-full flex items-center gap-2 text-left focus-ring rounded">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan font-bold">On the wire · OWASP ACS</div>
        <div className="flex-1 h-px bg-ink/8" />
        <span className="font-mono text-[11px] text-muted-2">{total} decisions</span>
        <ChevronDown size={14} className={`text-muted-2 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <p className="text-[12px] text-muted mt-2">What the Guardian answered for each call, as an agent host speaking OWASP&apos;s Agent Control Standard would receive it.</p>
      {open && (
        <div className="mt-4 space-y-4">
          {results.filter((r) => r.v5Evidence).map((r) => (
            <div key={r.round}>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-2 mb-1">{DAYS[r.round]}</div>
              <ul className="space-y-1">
                {r.v5Evidence!.records.map((rec) => {
                  const w = wireOf(rec);
                  const p = rec.decision.placements[0];
                  return (
                    <li key={rec.id} className="font-mono text-[11px] text-ink break-words">
                      <span className="text-muted-2">{rec.request.ts.slice(11, 16)}</span> {rec.request.action.tool.replace("mcp__erp__", "")}
                      {" → "}<b>{w.decision}</b>
                      {w.ask_details?.approver?.id ? ` · approver: ${w.ask_details.approver.id}` : ""}
                      {p?.band ? ` · band ${p.band}` : ""}
                      {rec.resolution ? <span className="text-muted"> · {rec.resolution.result}</span> : null}
                      <span className="text-muted-2"> · {rec.policy.matrix.id}@{rec.policy.matrix.version}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Export ─────────────────────────────────────────────────────────────────

function download(name: string, doc: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(doc, null, 2) + "\n"], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ExportPanel({ choices }: { choices: Choices }) {
  const ex = useMemo(() => exportFiles(choices), [choices]);
  return (
    <div className="surface-strong px-6 py-5">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan font-bold mb-1">Export your matrix</div>
      <h2 className="font-serif text-[24px] text-mint leading-tight">Take your design with you.</h2>
      <p className="text-[13px] text-muted mt-2 max-w-2xl">
        These are the files the VAOM Guardian enforces: your matrix with every round&apos;s choices, its binding to tool
        calls, the scoring policies it cites, your planted cases, and a config that loads them. Checked here the way the
        Guardian checks them on startup.
      </p>
      <div className={`mt-3 inline-flex items-center gap-2 font-mono text-[11px] ${ex.ok ? "text-band-a" : "text-red"}`}>
        {ex.ok ? <Check size={13} /> : <X size={13} />}
        {ex.ok ? "Lints, compiles and loads" : `${ex.problems.length} problems`}
      </div>
      {!ex.ok && <ul className="mt-2 space-y-0.5">{ex.problems.map((p) => <li key={p} className="font-mono text-[10px] text-red break-words">{p}</li>)}</ul>}
      <ul className="mt-4 divide-y divide-ink/8">
        {ex.files.map((f) => (
          <li key={f.name} className="flex items-center justify-between gap-3 py-2">
            <div className="min-w-0">
              <div className="font-mono text-[12px] text-ink">{f.name}</div>
              <div className="text-[12px] text-muted">{f.what}{f.lint ? ` · ${f.lint.ok ? "lints" : "doesn't lint"}${f.lint.findings.some((x) => x.severity === "warning") ? " with warnings" : ""}` : ""}</div>
            </div>
            <button onClick={() => { download(f.name, f.doc); track("export", { file: f.name }); }} className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-cyan/40 text-cyan font-mono text-[11px] uppercase tracking-[0.12em] px-3 py-1.5 hover:bg-cyan/5 focus-ring">
              <Download size={12} /> Save
            </button>
          </li>
        ))}
      </ul>
      <p className="font-mono text-[11px] text-muted mt-4 break-words">node packages/guardian/src/cli.ts verify --config your-folder/guardian.config.json</p>
      <p className="text-[12px] text-muted-2 mt-1">
        Save them in one folder. In a clone of the <a className="text-cyan underline" href="https://github.com/verkflode/vaom-guardian#check-a-matrix" target="_blank" rel="noreferrer">VAOM Guardian</a>,
        the line above checks them the way the Guardian does before it starts. The binding speaks to a placeholder ERP server: it shows the shape, not a live integration.
      </p>
    </div>
  );
}
