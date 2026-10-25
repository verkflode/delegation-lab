// Round 1, "The Matrix", on the VAOM Guardian core.
//
// The player inventories the workflow's decisions and, for each one, sets the five-dimension profile, the
// pattern, whether it's delegable, how confidence routes to bands, and who owns it. That becomes a real
// vaom.matrix/0.2 document. lintMatrix decides whether it can run; nothing in the Lab overrides that.
// Then a scripted batch of tool calls runs through decide(), against the history that humans signed off,
// and each call gets the answer the Guardian would put on the ACS wire. The workflow, its decisions and
// its calls come from the scenario (lib/v5/scenario.ts).
//
// Fixed this round (the player sets them in round 2): thresholds, the value ceiling, the cumulative cap,
// the calibration on file, the funded reviewer hours.
import { CapLedger, compilePolicy, ContextRegistry, decide, lintMatrix, type DecisionRecord, type LintResult, type Policy } from "@verkflode/vaom-guardian-core";
import { toResult } from "@verkflode/vaom-guardian-acs";
import type { BatchItem, Band, DecisionMeta, Doc, Gate, Lane, Level, Pattern, Profile, Round1Policy, RowChoice, V5Scenario, Verdict } from "./scenario";

export type { Band, BatchItem, DecisionMeta, Doc, Gate, Lane, Level, Pattern, Profile, Round1Policy, RowChoice, Truth, Verdict } from "./scenario";

export const PATTERNS: Record<Pattern, string> = {
  "prepare-and-present": "Prepare and present",
  "draft-and-approve": "Draft and approve",
  "triage-and-route": "Triage and route",
  "execute-and-audit": "Execute and audit",
  "monitor-and-intervene": "Monitor and intervene",
  "coordinate-and-escalate": "Coordinate and escalate",
};

export const DIMENSIONS: { key: keyof Profile; label: string; options: { value: string; label: string }[] }[] = [
  { key: "reversibility", label: "Reversibility", options: [
    { value: "fully-reversible", label: "Fully reversible" }, { value: "reversible-with-friction", label: "With friction" },
    { value: "partially-reversible", label: "Partly" }, { value: "irreversible", label: "Irreversible" }] },
  { key: "consequenceScope", label: "Consequence scope", options: [
    { value: "internal-operational", label: "Internal, operational" }, { value: "internal-financial", label: "Internal, financial" },
    { value: "external-relational", label: "External, relational" }, { value: "external-regulatory", label: "External, regulatory" }] },
  { key: "regulatoryExposure", label: "Regulatory exposure", options: [
    { value: "none", label: "None" }, { value: "general-context", label: "General context" },
    { value: "regulated-decision", label: "Regulated decision" }, { value: "prohibited-from-full-automation", label: "No full automation" }] },
  { key: "confidenceMeasurability", label: "Confidence measurability", options: [
    { value: "quantifiable", label: "Quantifiable" }, { value: "partially-quantifiable", label: "Partly" }, { value: "judgment-dependent", label: "Judgment" }] },
  { key: "accountabilityClarity", label: "Accountability", options: [
    { value: "clear-single-owner", label: "One clear owner" }, { value: "ambiguous", label: "Ambiguous" }, { value: "none", label: "Nobody" }] },
];

const exampleRow = (sc: V5Scenario, id: string): Doc => structuredClone(sc.docs.matrix.rows.find((r: Doc) => r.id === id));

const RANK: Record<Band, number> = { A: 0, B: 1, C: 2 };
const stricter = (a: Band, b: Band): Band => (RANK[a] >= RANK[b] ? a : b);

export function reachesA(c: RowChoice): boolean {
  return c.kind === "delegable" && Object.values(c.routing).includes("A");
}

export function weeklyLoad(sc: V5Scenario, meta: DecisionMeta, c: RowChoice, gate: Gate = sc.round1.controllerGate): Partial<Record<Band, number>> {
  const out: Partial<Record<Band, number>> = {};
  const add = (b: Band, n: number) => { if (n > 0) out[b] = Math.round((out[b] ?? 0) + n); };
  const gated = meta.id === sc.round1.gatedRow;
  const volume = gated ? gate.volume : meta.volume;
  const total = Object.values(volume).reduce((a, b) => a + (b ?? 0), 0) || 1;
  const over = gated && gate.ceiling ? gate.overCeilingPerWeek : 0;
  for (const [level, n] of Object.entries(volume) as [Level, number][]) {
    add(c.routing[level], n * (1 - over / total));
    if (gate.ceiling) add(stricter(c.routing[level], gate.ceiling.onExceed), n * (over / total));
  }
  return out;
}

/** Reviewer hours a week, computed the way the core's oversight.unfunded rule computes them. */
export function reviewHours(sc: V5Scenario, policy: Round1Policy, gate: Gate = sc.round1.controllerGate, tweak?: MatrixTweak): { hours: number; funded: number } {
  const m = buildMatrix(sc, policy, gate);
  tweak?.(m);
  let minutes = 0;
  for (const row of m.rows as Doc[]) {
    const o = row.oversight;
    if (!o?.expectedPerWeek) continue;
    const e = o.expectedPerWeek;
    minutes += (e.B ?? 0) * (o.reviewMinutes ?? 0) + (e.C ?? 0) * (o.escalationMinutes ?? 0) + (e.A ?? 0) * (o.auditSampleRate ?? 0) * (o.auditMinutes ?? 0);
  }
  return { hours: minutes / 60, funded: m.oversight.fundedReviewerHoursPerWeek * (m.oversight.maxUtilization ?? 0.8) };
}

export function buildMatrix(sc: V5Scenario, policy: Round1Policy, gate: Gate = sc.round1.controllerGate): Doc {
  const DATE = sc.round1.date;
  const m: Doc = structuredClone(sc.docs.matrix);
  delete m.$schema;
  m.id = sc.matrix.id;
  m.version = gate.version;
  m.title = sc.matrix.title;
  m.description = `Built in the Delegation Lab, round ${gate.round}.`;
  m.approval = { role: sc.matrix.approvedBy, date: DATE, ref: `placeholder://lab/round-${gate.round}` };

  const rows: Doc[] = [];
  for (const meta of sc.round1.decisions) {
    const c = policy[meta.id];
    if (!c.included) continue;
    const row: Doc = { id: meta.id, title: meta.title, pattern: c.pattern, profile: { ...c.profile } };
    row.accountability = { form: "single", role: c.owner, deputy: sc.deputies[c.owner], accepted: { role: c.owner, date: DATE } };
    const base = exampleRow(sc, meta.id);
    row.capabilities = base.capabilities;
    if (base.requiresFacts) row.requiresFacts = base.requiresFacts;

    if (c.kind === "non-delegable") {
      row.authority = base.authority.kind === "non-delegable"
        ? base.authority
        : { kind: "non-delegable", reason: "Kept with a human in the Lab matrix.", agentMayPrepare: true };
    } else {
      const a: Doc = base.authority.kind === "delegable"
        ? base.authority
        : { kind: "delegable", reviewer: sc.fallbackAuthority.reviewer, escalation: { ...sc.fallbackAuthority.escalation } };
      a.routing = { ...c.routing };
      if (meta.id === sc.round1.gatedRow) applyGate(sc, a, gate);
      row.authority = a;
      const o: Doc = base.oversight ?? {};
      row.oversight = { ...o, expectedPerWeek: weeklyLoad(sc, meta, c, gate), reviewMinutes: meta.reviewMinutes, escalationMinutes: meta.escalationMinutes };
      if (reachesA(c)) row.oversight = { auditSampleRate: 0.05, auditMinutes: 4, ...row.oversight };
    }
    rows.push(row);
  }

  // The example's preparatory rows, each serving only the decisions that are in the matrix (none: left out).
  for (const base of sc.docs.matrix.rows as Doc[]) {
    if (base.authority.kind !== "preparatory") continue;
    const prep = exampleRow(sc, base.id);
    prep.authority.serves = (prep.authority.serves as string[]).filter((id) => policy[id]?.included);
    if (prep.authority.serves.length) rows.push(prep);
  }

  m.rows = rows;
  return m;
}

/** Put the gate's limits on the gated row's authority, in the example's currency. A ceiling the player
 *  moved loses the example's derivation, which justified its own amount and nothing else. Where the gated
 *  row has no value ceiling, the example's own statement of why (noValueCeiling) stands. */
function applyGate(sc: V5Scenario, a: Doc, gate: Gate): void {
  const currency = a.valueCeiling?.limit.currency;
  a.confidence.thresholds = { ...gate.thresholds };
  if (gate.calibration) a.confidence.calibration = { ...gate.calibration };
  else delete a.confidence.calibration;
  if (gate.ceiling) {
    if (gate.ceiling.amount !== Number(a.valueCeiling.limit.amount)) delete a.valueCeiling.derivation;
    a.valueCeiling.limit = { amount: String(gate.ceiling.amount), currency };
    a.valueCeiling.onExceed = gate.ceiling.onExceed;
  }
  const cap = sc.round2.limits.cap;
  if (gate.cap === null) delete a.cumulativeCaps;
  else if (cap.kind === "count") a.cumulativeCaps = [{ ...structuredClone(cap.template), count: gate.cap }];
  else a.cumulativeCaps = [{ ...a.cumulativeCaps[0], total: { amount: String(gate.cap), currency } }];
}

/** The example binding, cut to the capabilities the matrix governs, plus any tool the player's choices
 *  hand the agent (the scenario's extraTools). */
export function buildBinding(sc: V5Scenario, policy: Round1Policy, matrix: Doc): Doc {
  const b: Doc = structuredClone(sc.docs.binding);
  delete b.$schema;
  b.matrix = { id: matrix.id, versions: ">=1.0.0 <2.0.0" };
  const caps = new Set((matrix.rows as Doc[]).flatMap((r) => r.capabilities as string[]));
  b.tools = (b.tools as Doc[]).filter((t) => caps.has(t.capability));
  b.tools.push(...sc.round1.extraTools(policy));
  return b;
}

/** A change a later round makes to the built matrix (round 3: oversight funding and seeding). */
export type MatrixTweak = (matrix: Doc) => void;

export function lintPolicy(sc: V5Scenario, policy: Round1Policy, gate: Gate = sc.round1.controllerGate, tweak?: MatrixTweak): { matrix: Doc; lint: LintResult } {
  const matrix = buildMatrix(sc, policy, gate);
  tweak?.(matrix);
  return { matrix, lint: lintMatrix(matrix) };
}

// ── History ────────────────────────────────────────────────────────────────

export const FACT_KEY = new Uint8Array(32).fill(7);

/** The scenario's past decisions, made under its published example and signed off by a human, so the
 *  ledger knows what is familiar and what is usual. */
export function seedHistory(sc: V5Scenario, ledger: CapLedger): void {
  const ref: Doc = structuredClone(sc.docs.matrix);
  ref.effective = { from: sc.round1.history.effective };
  const compiled = compilePolicy(ref, sc.docs.binding, sc.docs.scoring);
  if (!compiled.ok) throw new Error(`history policy didn't compile: ${compiled.findings.map((f) => f.message).join("; ")}`);
  const contexts = new ContextRegistry(compiled.policy);
  const agent = { id: sc.agent };
  for (const { id, ts, call } of sc.round1.history.calls) {
    contexts.open({ id: `ctx-${id}`, session: "history", agent, rows: sc.round1.history.rows }, Date.parse(ts));
    decide(compiled.policy, call, ledger, { id, ts, agent, session: { id: "history" }, contexts, factKey: FACT_KEY });
    ledger.settle(id, "executed");
  }
}

// ── Running the batch ──────────────────────────────────────────────────────

export interface Round1Step {
  item: BatchItem;
  record: DecisionRecord;
  wire: { decision?: string; reason_codes?: string[]; ask_details?: { approver?: { id?: string } } };
  lane: Lane;
  verdict: Verdict;
  /** One line on why this verdict. */
  why: string;
}

function laneOf(r: DecisionRecord): Lane {
  const o = r.decision.outcome;
  return o === "allow" ? "A" : o === "review" ? "B" : o === "escalate" ? "C" : "held";
}

function judge(sc: V5Scenario, it: BatchItem, r: DecisionRecord, lane: Lane, policy: Round1Policy): { verdict: Verdict; why: string } {
  const special = sc.round1.judgeSpecial(it, r, lane, policy);
  if (special) return special;
  const o = r.decision.outcome;
  if (o === "unplaceable") return it.truth === "hazard"
    ? { verdict: "missed", why: "Your matrix doesn't cover this decision, so the Guardian deferred it and the timeout denied it. Nobody owns what happens next." }
    : { verdict: "missed", why: "Your matrix doesn't cover this decision: deferred, then denied. Routine work stopped." };
  if (it.truth === "hazard") return lane === "A"
    ? { verdict: "risky", why: "Executed without a human. It should not have been." }
    : { verdict: "good", why: lane === "held" ? "Refused: the agent may not do this." : `Held for ${lane === "B" ? "review" : "escalation"}.` };
  if (lane === "A") return { verdict: "good", why: "Executed, audited by sample." };
  const w = sc.round1.routine;
  return { verdict: "wasteful", why: lane === "held" ? "Refused: routine work the agent was never allowed to do." : `A human spent ${lane === "B" ? w.review : w.escalation} ${w.noun}.` };
}

export interface Round1Run {
  matrix: Doc;
  binding: Doc;
  policy: Policy;
  steps: Round1Step[];
  /** The ledger and contexts after the batch, for planting seeds (round 3). */
  ledger: CapLedger;
  contexts: ContextRegistry;
}

export function runRound1(sc: V5Scenario, choices: Round1Policy): Round1Run {
  return runBatch(sc, choices, sc.round1.controllerGate, sc.round1.batch, sc.round1.start);
}

/** Decide a batch, call by call, under the player's matrix and gate, against the seeded history. */
export function runBatch(sc: V5Scenario, choices: Round1Policy, gate: Gate, batch: BatchItem[], startIso: string, tweak?: MatrixTweak): Round1Run {
  const { matrix, lint } = lintPolicy(sc, choices, gate, tweak);
  if (!lint.ok) throw new Error("the matrix doesn't lint, so it can't run");
  const binding = buildBinding(sc, choices, matrix);
  const compiled = compilePolicy(matrix, binding, sc.docs.scoring);
  if (!compiled.ok) throw new Error(`the matrix didn't compile: ${compiled.findings.map((f) => f.message).join("; ")}`);
  const policy = compiled.policy;

  const ledger = new CapLedger();
  ledger.load([]);
  seedHistory(sc, ledger);

  const start = Date.parse(startIso);
  const contexts = new ContextRegistry(policy);
  // The rows an execution context may name: not preparatory ones, nor a non-delegable row the agent may
  // not even prepare for.
  const rows = (matrix.rows as Doc[]).filter((r) => r.authority.kind !== "preparatory" && !(r.authority.kind === "non-delegable" && r.authority.agentMayPrepare !== true)).map((r) => r.id as string);

  const steps = batch.map((it, i): Round1Step => {
    const at = start + (i + 1) * 90_000;
    const ts = new Date(at).toISOString();
    // One execution context per piece of work, as the agent's host would open them.
    if (rows.length) contexts.open({ id: `ctx-${it.id}`, session: "lab", agent: { id: sc.agent }, rows }, at);
    const record = decide(policy, it.call, ledger, {
      id: `lab-${it.id}`, ts, agent: { id: sc.agent }, session: { id: "lab" }, contexts, factKey: FACT_KEY,
      verifications: { [sc.round1.verifiedCapability]: it.verified },
    });
    const lane = laneOf(record);
    // Band A executes at once; held and deferred calls never run. Asks stay pending through the batch.
    if (record.decision.outcome === "allow") ledger.settle(record.id, "executed");
    const d = record.decision;
    const wire = toResult(
      { outcome: d.outcome, band: d.band, ...(d.approver_role ? { approverRole: d.approver_role } : {}), placements: d.placements, reasons: d.reasons, policy: record.policy },
      { requestId: `req-${i + 1}`, acsVersion: "0.1.0", approvalTimeoutSeconds: 300, deferTimeoutMs: 1000, evaluatorVersion: "delegation-lab" },
    ) as Round1Step["wire"];
    return { item: it, record, wire, lane, ...judge(sc, it, record, lane, choices) };
  });
  return { matrix, binding, policy, steps, ledger, contexts };
}
