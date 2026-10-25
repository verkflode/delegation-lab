"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Check, Plus, X } from "lucide-react";
import { useGame, useScenario } from "../../lib/game-state";
import {
  DIMENSIONS, lintPolicy, PATTERNS, reviewHours,
  type Band, type DecisionMeta, type Level, type Pattern, type Profile, type Round1Policy, type RowChoice,
} from "../../lib/v5/round1";
import { explain, type Explained } from "../../lib/v5/explain";

/**
 * Round 1 (v5), "The Matrix": the player builds the delegation matrix row by row. The VAOM Guardian's
 * linter runs on every change, and the batch runs only on a matrix that lints.
 */
export function MatrixBuilder() {
  const { state, setV5R1, advance } = useGame();
  const sc = useScenario();
  const [policy, setPolicy] = useState<Round1Policy>(() => state.v5r1 ?? sc.round1.startingPolicy());
  const { matrix, lint } = useMemo(() => lintPolicy(sc, policy), [sc, policy]);
  const explained = useMemo(() => explain(sc, lint, matrix, policy), [sc, lint, matrix, policy]);
  const load = useMemo(() => reviewHours(sc, policy), [sc, policy]);

  const update = (id: DecisionMeta["id"], patch: Partial<RowChoice>) =>
    setPolicy((p) => ({ ...p, [id]: { ...p[id], ...patch } }));

  const run = () => {
    setV5R1(policy);
    advance("simulation");
  };

  return (
    <div className="min-h-screen px-4 sm:px-6 py-12 animate-fade-in">
      <div className="max-w-6xl mx-auto">
        <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-cyan font-bold mb-2">Round 1 · The Matrix</div>
        <h1 className="font-serif text-[28px] md:text-[36px] leading-[1.1] font-normal text-mint mb-3">Build the delegation matrix.</h1>
        <p className="text-[14px] text-muted leading-relaxed max-w-2xl">
          {sc.ui.matrixIntro} For each decision it makes, set the profile, the pattern, whether it can be delegated at all, which
          band each confidence level lands in, and who owns it. The VAOM Guardian checks the matrix as you build it.
          If it doesn&apos;t pass, it doesn&apos;t run.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-6 mt-8 items-start">
          <div className="space-y-4 min-w-0">
            {sc.round1.decisions.map((d) => (
              <DecisionCard key={d.id} meta={d} choice={policy[d.id]} onChange={(p) => update(d.id, p)} issues={explained.filter((e) => e.row === d.id)} />
            ))}
          </div>

          <div className="space-y-4 lg:sticky lg:top-6 min-w-0">
            <LintPanel ok={lint.ok} explained={explained} />
            <LoadBar hours={load.hours} funded={load.funded} />
            <FixedThisRound />
            <button
              onClick={run}
              disabled={!lint.ok}
              className="cta w-full group inline-flex items-center justify-center gap-3 rounded-full font-bold font-mono uppercase tracking-[0.18em] text-[11px] px-6 py-4 focus-ring disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {lint.ok ? "Run the batch" : "Fix the matrix to run it"}
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── One decision ───────────────────────────────────────────────────────────

function DecisionCard({ meta, choice, onChange, issues }: { meta: DecisionMeta; choice: RowChoice; onChange: (p: Partial<RowChoice>) => void; issues: Explained[] }) {
  const sc = useScenario();
  if (!choice.included) {
    return (
      <div className="rounded-2xl border border-dashed border-ink/25 px-5 py-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-2 mb-1">Not in your matrix</div>
            <div className="font-serif text-[20px] text-mint">{meta.title}</div>
            {meta.hidden && <p className="text-[13px] text-muted mt-1 max-w-xl">{meta.hidden}</p>}
          </div>
          <button onClick={() => onChange({ included: true })} className="inline-flex items-center gap-2 rounded-full border border-cyan/40 text-cyan font-mono text-[11px] uppercase tracking-[0.14em] px-4 py-2 hover:bg-cyan/5 focus-ring">
            <Plus size={13} /> Add to the matrix
          </button>
        </div>
      </div>
    );
  }
  const errors = issues.filter((i) => i.severity === "error").length;
  return (
    <div className={`surface-strong px-5 py-5 ${errors ? "border-red/40" : ""}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-2 mb-1">
            {meta.id} · <span className="text-muted">{sc.ui.toolPrefix}{meta.tool}</span>
          </div>
          <div className="font-serif text-[22px] text-mint leading-tight">{meta.title}</div>
          <p className="text-[13px] text-muted mt-1">{meta.blurb}</p>
        </div>
        {meta.hidden && (
          <button onClick={() => onChange({ included: false })} aria-label={`Remove ${meta.title} from the matrix`} className="text-muted-2 hover:text-red p-1 rounded focus-ring">
            <X size={16} />
          </button>
        )}
      </div>

      <Section label="Profile">
        <div className="space-y-2">
          {DIMENSIONS.map((dim) => (
            <Row key={dim.key} label={dim.label}>
              <Segmented
                options={dim.options}
                value={choice.profile[dim.key]}
                onChange={(v) => onChange({ profile: { ...choice.profile, [dim.key]: v } as Profile })}
              />
            </Row>
          ))}
        </div>
      </Section>

      <Section label="Pattern and authority">
        <div className="space-y-2">
          <Row label="Pattern">
            <select
              value={choice.pattern}
              onChange={(e) => onChange({ pattern: e.target.value as Pattern })}
              className="w-full sm:w-auto bg-surface border border-border rounded-lg px-3 py-1.5 text-[13px] text-ink focus-ring"
            >
              {Object.entries(PATTERNS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Row>
          <Row label="Authority">
            <Segmented
              options={[{ value: "delegable", label: "Delegable" }, { value: "non-delegable", label: "Non-delegable" }]}
              value={choice.kind}
              onChange={(v) => onChange({ kind: v as RowChoice["kind"] })}
            />
          </Row>
          {choice.kind === "delegable" && (
            <Row label="Routing">
              <div className="flex flex-col gap-1.5">
                {(["high", "medium", "low"] as Level[]).map((lvl) => (
                  <div key={lvl} className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-muted w-[92px] shrink-0">{lvl} confidence</span>
                    <BandPicker value={choice.routing[lvl]} onChange={(b) => onChange({ routing: { ...choice.routing, [lvl]: b } })} />
                  </div>
                ))}
              </div>
            </Row>
          )}
          <Row label="Owner">
            <select
              value={choice.owner}
              onChange={(e) => onChange({ owner: e.target.value })}
              className="w-full sm:w-auto bg-surface border border-border rounded-lg px-3 py-1.5 text-[13px] text-ink focus-ring"
            >
              {Object.entries(sc.roles).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Row>
        </div>
      </Section>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-5 pt-4 border-t border-ink/8">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan font-bold mb-3">{label}</div>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[150px_1fr] gap-1 sm:gap-3 items-start">
      <div className="text-[12px] text-muted pt-1.5">{label}</div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function Segmented({ options, value, onChange }: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={`rounded-full px-3 py-1 text-[12px] border transition-colors focus-ring ${on ? "bg-cyan text-white border-cyan" : "bg-surface text-ink border-border hover:border-cyan/50"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const BAND_STYLE: Record<Band, { on: string; label: string }> = {
  A: { on: "bg-band-a border-band-a", label: "A · agent acts" },
  B: { on: "bg-band-b border-band-b", label: "B · review" },
  C: { on: "bg-band-c border-band-c", label: "C · escalate" },
};

export function BandPicker({ value, onChange }: { value: Band; onChange: (b: Band) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group">
      {(Object.keys(BAND_STYLE) as Band[]).map((b) => {
        const on = b === value;
        return (
          <button
            key={b}
            aria-pressed={on}
            onClick={() => onChange(b)}
            className={`rounded-full px-3 py-1 font-mono text-[11px] border transition-colors focus-ring ${on ? `${BAND_STYLE[b].on} text-white` : "bg-surface text-ink border-border hover:border-ink/30"}`}
          >
            {BAND_STYLE[b].label}
          </button>
        );
      })}
    </div>
  );
}

// ── Right column ───────────────────────────────────────────────────────────

export function LintPanel({ ok, explained }: { ok: boolean; explained: Explained[] }) {
  const errors = explained.filter((e) => e.severity === "error").length;
  const warnings = explained.length - errors;
  const sc = useScenario();
  const rowTitle = (id?: string) => sc.round1.decisions.find((d) => d.id === id)?.title;
  return (
    <div className="surface-strong px-5 py-4" aria-live="polite">
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-white ${ok ? "bg-band-a" : "bg-band-held"}`}>
          {ok ? <Check size={12} /> : <X size={12} />}
        </span>
        <div className="font-mono text-[11px] uppercase tracking-[0.16em] font-bold text-ink">
          {ok ? "Lints · ready to run" : `${errors} ${errors === 1 ? "error" : "errors"} · can't run`}
        </div>
        {warnings > 0 && <div className="ml-auto font-mono text-[10px] text-amber">{warnings} {warnings === 1 ? "warning" : "warnings"}</div>}
      </div>
      <div className="font-mono text-[10px] text-muted-2 mt-1">lintMatrix · vaom.matrix/0.2 · VAOM Guardian core</div>
      {explained.length > 0 && (
        <div className="space-y-2.5 mt-3">
          {explained.map((e, i) => (
            <div key={i} className="vaom-panel px-3.5 py-2.5 pl-4">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className={`font-mono text-[9px] uppercase tracking-[0.2em] font-bold ${e.severity === "error" ? "text-red" : "text-amber"}`}>VAOM</span>
                {e.row && <span className="font-mono text-[10px] text-muted-2">{rowTitle(e.row)}</span>}
              </div>
              <p className="text-[13px] text-ink leading-snug mt-0.5">{e.text}</p>
              {e.findings.length > 0 && (
                <details className="mt-1.5">
                  <summary className="font-mono text-[10px] text-muted-2 cursor-pointer">core: {e.findings.length} {e.findings.length === 1 ? "finding" : "findings"}</summary>
                  <ul className="mt-1 space-y-0.5">
                    {e.findings.slice(0, 6).map((f, j) => (
                      <li key={j} className="font-mono text-[10px] text-muted leading-snug break-words">{f.rule} {f.path}: {f.message}</li>
                    ))}
                    {e.findings.length > 6 && <li className="font-mono text-[10px] text-muted-2">and {e.findings.length - 6} more</li>}
                  </ul>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function LoadBar({ hours, funded }: { hours: number; funded: number }) {
  const sc = useScenario();
  const over = hours > funded;
  const pct = Math.min(100, (hours / funded) * 100);
  return (
    <div className="surface px-5 py-4">
      <div className="flex items-baseline justify-between">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-2">Review load</div>
        <div className={`font-mono text-[12px] tabular-nums ${over ? "text-red font-bold" : "text-ink"}`}>
          {hours.toFixed(1)} h of {funded.toFixed(0)} h a week
        </div>
      </div>
      <div className="h-2 rounded-full bg-ink/8 mt-2 overflow-hidden">
        <div className={`h-full rounded-full ${over ? "bg-band-held" : "bg-band-b"}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[11px] text-muted-2 mt-2">{Math.round(funded / 0.8)} reviewer hours funded, at most 80% used. {sc.ui.loadNote}</p>
    </div>
  );
}

function FixedThisRound() {
  const sc = useScenario();
  return (
    <div className="surface px-5 py-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-2 mb-2">Already set by the controller</div>
      <ul className="text-[12px] text-muted space-y-1">
        {sc.ui.controllerLimits.map((l) => <li key={l}>{l}</li>)}
      </ul>
      <p className="text-[11px] text-muted-2 mt-2">They become yours in round 2.</p>
    </div>
  );
}
