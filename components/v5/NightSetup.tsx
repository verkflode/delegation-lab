"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Moon } from "lucide-react";
import { useGame } from "../../lib/game-state";
import { ROLES, startingPolicy, type RoleId } from "../../lib/v5/round1";
import { startingGate, toGate } from "../../lib/v5/round2";
import { reviewTweak } from "../../lib/v5/round3";
import { lintNight, startingNight, type NightChoice } from "../../lib/v5/round4";
import { explain } from "../../lib/v5/explain";
import { LintPanel, Segmented } from "./MatrixBuilder";

/**
 * Round 4 (v5), "The 2 a.m. Test", setup: the sub-agent chain, the bank-details boundary and how it is
 * verified, and the circuit breakers with who they wake.
 */
export function NightSetup() {
  const { state, setV5R4, advance } = useGame();
  const policy = state.v5r1 ?? startingPolicy();
  const gate = useMemo(() => toGate(state.v5r2 ?? startingGate()), [state.v5r2]);
  const review = useMemo(() => (state.v5r3 ? reviewTweak(state.v5r3) : undefined), [state.v5r3]);
  const [c, setC] = useState<NightChoice>(() => state.v5r4 ?? startingNight());
  const { matrix, lint } = useMemo(() => lintNight(policy, gate, review, c), [policy, gate, review, c]);
  const explained = useMemo(() => explain(lint, matrix, policy), [lint, matrix, policy]);
  const chain = (patch: Partial<NightChoice["chain"]>) => setC((x) => ({ ...x, chain: { ...x.chain, ...patch } }));
  const bank = (patch: Partial<NightChoice["bank"]>) => setC((x) => ({ ...x, bank: { ...x.bank, ...patch } }));
  const brk = (patch: Partial<NightChoice["breakers"]>) => setC((x) => ({ ...x, breakers: { ...x.breakers, ...patch } }));
  const approveDelegable = policy["invoice.approve"].kind === "delegable";
  const actions = [{ value: "off", label: "Off" }, { value: "alert", label: "Alert" }, { value: "suspend", label: "Suspend the agent" }];

  const sleep = () => {
    setV5R4(c);
    advance("simulation");
  };

  return (
    <div className="min-h-screen px-4 sm:px-6 py-12 animate-fade-in">
      <div className="max-w-6xl mx-auto">
        <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-cyan font-bold mb-2">Round 4 · The 2 a.m. Test</div>
        <h1 className="font-serif text-[28px] md:text-[36px] leading-[1.1] font-normal text-mint mb-3">Before you sleep.</h1>
        <p className="text-[14px] text-muted leading-relaxed max-w-2xl">
          Tonight the agent works the overnight batch alone. Set how far its authority may travel, how you know its
          boundaries are real, and what happens when something reaches past them.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-6 mt-8 items-start">
          <div className="space-y-4 min-w-0">
            <Card kicker="Sub-agents" title="How far may authority travel?">
              {!approveDelegable && <p className="text-[13px] text-muted mb-3">Your matrix keeps approval with a human, so the agent has no authority to pass on.</p>}
              <div className="space-y-3">
                <Row label="Depth">
                  <Segmented options={[0, 1, 2, 3].map((n) => ({ value: String(n), label: n === 0 ? "No sub-agents" : `${n} ${n === 1 ? "level" : "levels"}` }))} value={String(c.chain.maxDepth)} onChange={(v) => chain({ maxDepth: Number(v) })} />
                </Row>
                <Row label="Children at once">
                  <Segmented options={[1, 2, 4].map((n) => ({ value: String(n), label: String(n) }))} value={String(c.chain.maxFanOut)} onChange={(v) => chain({ maxFanOut: Number(v) })} />
                </Row>
                <Row label="Allowed types">
                  <div className="space-y-1.5">
                    <Check checked={c.chain.vendorCheck} onChange={(v) => chain({ vendorCheck: v })}>vendor-check: reads invoices and vendors</Check>
                    <Check checked={c.chain.batchApprover} onChange={(v) => chain({ batchApprover: v })}>batch-approver: approves invoices</Check>
                  </div>
                </Row>
                <Row label="Children's ceiling">
                  <Check checked={c.chain.childCeilingB} onChange={(v) => chain({ childCeilingB: v })}>A sub-agent may only ask: approvals capped at Band B</Check>
                </Row>
              </div>
              <p className="text-[12px] text-muted-2 mt-3">A child only ever gets a subset of its parent&apos;s authority. A spawn outside the allowed types escalates to Band C; past the depth or fan-out it is refused.</p>
            </Card>

            <Card kicker="Boundary" title="Vendor bank details">
              <p className="text-[13px] text-muted mb-3">
                Changing where a vendor is paid is non-delegable. What keeps it out of the agent&apos;s reach, and how
                often does anyone check?
              </p>
              <div className="space-y-3">
                <Row label="Claimed as">
                  <Segmented
                    options={[{ value: "absent", label: "Absent: no such tool" }, { value: "scope-denied", label: "Scope-denied" }, { value: "policy", label: "Policy: the Guardian refuses" }]}
                    value={c.bank.mechanism}
                    onChange={(v) => bank({ mechanism: v as NightChoice["bank"]["mechanism"] })}
                  />
                </Row>
                <Row label="Probe every">
                  <Segmented options={[{ value: "P1D", label: "Day" }, { value: "P7D", label: "Week" }, { value: "P30D", label: "30 days" }]} value={c.bank.every} onChange={(v) => bank({ every: v as NightChoice["bank"]["every"] })} />
                </Row>
                <Row label="Also probe">
                  <Check checked={c.bank.onManifest} onChange={(v) => bank({ onManifest: v })}>whenever the agent&apos;s tools or deployment change</Check>
                </Row>
              </div>
              <p className="text-[12px] text-muted-2 mt-3">A probe attempts the forbidden action against a canary. A boundary counts at the strength it was last shown to have.</p>
            </Card>

            <Card kicker="Circuit breakers" title="When something reaches past its limits">
              <div className="space-y-3">
                <Row label="Out of bounds">
                  <Segmented options={actions} value={c.breakers.outOfBounds} onChange={(v) => brk({ outOfBounds: v as NightChoice["breakers"]["outOfBounds"] })} />
                </Row>
                <Row label="Chain too deep">
                  <Segmented options={actions} value={c.breakers.chainDepth} onChange={(v) => brk({ chainDepth: v as NightChoice["breakers"]["chainDepth"] })} />
                </Row>
                <Row label="Who is woken">
                  <select
                    value={c.breakers.notify}
                    onChange={(e) => brk({ notify: e.target.value as RoleId | "" })}
                    className="w-full sm:w-auto bg-surface border border-border rounded-lg px-3 py-1.5 text-[13px] text-ink focus-ring"
                  >
                    <option value="">Nobody</option>
                    {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </Row>
              </div>
              <p className="text-[12px] text-muted-2 mt-3">Breakers only contain. None of them resumes or widens anything.</p>
            </Card>
          </div>

          <div className="space-y-4 lg:sticky lg:top-6 min-w-0">
            <LintPanel ok={lint.ok} explained={explained} />
            <button
              onClick={sleep}
              disabled={!lint.ok}
              className="cta w-full group inline-flex items-center justify-center gap-3 rounded-full font-bold font-mono uppercase tracking-[0.18em] text-[11px] px-6 py-4 focus-ring disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Moon size={14} />
              {lint.ok ? "Go to sleep" : "Fix the matrix first"}
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({ kicker, title, children }: { kicker: string; title: string; children: React.ReactNode }) {
  return (
    <div className="surface-strong px-5 py-5">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan font-bold mb-1">{kicker}</div>
      <div className="font-serif text-[21px] text-mint leading-tight mb-3">{title}</div>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-1 sm:gap-3 items-start">
      <div className="text-[12px] text-muted pt-1.5">{label}</div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex items-start gap-2.5 text-[13px] text-ink cursor-pointer">
      <input type="checkbox" className="accent-cyan w-4 h-4 mt-0.5" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}
