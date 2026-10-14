"use client";

// SPIKE (v5): proves the Guardian core and the ACS translation run client-side in Next 16, and shows the
// VAOM v5 light identity on one screen. Not linked from the game.
import { useEffect, useState } from "react";
import { runSpike, type SpikeStep } from "../../lib/v5/engine";

const BAND: Record<string, { label: string; color: string }> = {
  allow: { label: "Band A · allow", color: "var(--band-a)" },
  review: { label: "Band B · review", color: "var(--band-b)" },
  escalate: { label: "Band C · escalate", color: "var(--band-c)" },
  refuse: { label: "Non-delegable · refuse", color: "var(--band-refuse)" },
  unplaceable: { label: "Can't place · defer", color: "var(--band-none)" },
};

export default function Spike() {
  const [run, setRun] = useState<ReturnType<typeof runSpike> | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    try { setRun(runSpike()); } catch (e) { setError((e as Error).message); }
  }, []);

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "48px 16px 80px" }}>
      <p className="eyebrow">Delegation Lab · v5 spike</p>
      <h1 style={{ fontSize: 44, lineHeight: 1.1, margin: "8px 0 12px" }}>Invoices, decided by the Guardian</h1>
      <p style={{ fontSize: 17, lineHeight: 1.6, maxWidth: 620 }}>
        Each call below runs through the VAOM Guardian&apos;s core in your browser: the real matrix, binding and scoring
        policies from worked example 7. Under each one is what the Guardian would answer on the OWASP ACS wire.
      </p>
      {error && <p className="card" style={{ padding: 16, color: "var(--red)", background: "var(--red-bg)" }}>{error}</p>}
      {run && (
        <p className="mono muted" style={{ fontSize: 12, margin: "20px 0 28px" }}>
          matrix lint: {run.lint.ok ? "ok" : "fails"} · {run.lint.findings.length} findings · {run.steps.length} decisions in {run.ms.toFixed(0)} ms
        </p>
      )}
      <div style={{ display: "grid", gap: 14 }}>
        {run?.steps.map((s) => <Step key={s.record.id} step={s} />)}
      </div>
    </main>
  );
}

function Step({ step }: { step: SpikeStep }) {
  const d = step.record.decision;
  const b = BAND[d.outcome] ?? BAND.unplaceable;
  const reason = d.reasons[0];
  const wire = step.wire as { decision?: string; reason_codes?: string[]; ask_details?: { approver?: { id?: string } } };
  return (
    <article className="card" style={{ overflow: "hidden" }}>
      <div style={{ padding: "16px 18px", display: "flex", gap: 14, alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontSize: 20, margin: 0 }}>{step.label}</h2>
          <p className="mono muted" style={{ fontSize: 12, margin: "6px 0 0", overflowWrap: "anywhere" }}>
            {step.call.tool} {JSON.stringify(step.call.arguments)}
          </p>
          {reason && <p style={{ fontSize: 14, margin: "8px 0 0", color: "var(--ink3)" }}>{reason.detail ?? reason.code}</p>}
        </div>
        <span className="chip" style={{ background: b.color }}>{b.label}</span>
      </div>
      <div className="wire" style={{ padding: "8px 18px", overflowWrap: "anywhere" }}>
        ACS → {wire.decision ?? "?"}
        {wire.ask_details?.approver?.id ? ` · approver: ${wire.ask_details.approver.id}` : ""}
        {wire.reason_codes?.length ? ` · ${wire.reason_codes.join(", ")}` : ""}
        {` · ${step.record.policy.matrix.id}@${step.record.policy.matrix.version}`}
      </div>
    </article>
  );
}
