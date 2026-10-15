// Round 1, "The Matrix", on the VAOM Guardian core (invoices).
//
// The player inventories the workflow's decisions and, for each one, sets the five-dimension profile, the
// pattern, whether it's delegable, how confidence routes to bands, and who owns it. That becomes a real
// vaom.matrix/0.2 document. lintMatrix decides whether it can run; nothing in the Lab overrides that.
// Then a scripted batch of tool calls runs through decide(), against two months of approvals that humans
// signed off, and each call gets the answer the Guardian would put on the ACS wire.
//
// Fixed this round (the player sets them in round 2): thresholds, the value ceiling, the per-vendor cap,
// the calibration on file, the funded reviewer hours.
import { CapLedger, compilePolicy, ContextRegistry, decide, lintMatrix, type Call, type DecisionRecord, type LintResult, type Policy } from "@verkflode/vaom-guardian-core";
import { toResult } from "@verkflode/vaom-guardian-acs";
import example from "../../data/v5/invoice.matrix-0.2.json";
import exampleBinding from "../../data/v5/invoice.claude-code.binding.json";
import standard from "../../data/v5/invoice-standard.scoring.json";
import duplicate from "../../data/v5/invoice-duplicate.scoring.json";

// ── Vocabulary (vaom.matrix/0.2) ───────────────────────────────────────────

export type Band = "A" | "B" | "C";
export type Level = "high" | "medium" | "low";
export type Pattern = "prepare-and-present" | "draft-and-approve" | "triage-and-route" | "execute-and-audit" | "monitor-and-intervene" | "coordinate-and-escalate";
export type Profile = {
  reversibility: "fully-reversible" | "reversible-with-friction" | "partially-reversible" | "irreversible";
  consequenceScope: "internal-operational" | "internal-financial" | "external-relational" | "external-regulatory";
  regulatoryExposure: "none" | "general-context" | "regulated-decision" | "prohibited-from-full-automation";
  confidenceMeasurability: "quantifiable" | "partially-quantifiable" | "judgment-dependent";
  /** Shared ownership needs a gap check and a stop rule; the Lab offers single ownership only. */
  accountabilityClarity: "clear-single-owner" | "ambiguous" | "none";
};
export type RoleId = "ap-owner" | "ap-clerk" | "finance-controller" | "legal-counsel";
export type RowId = "invoice.approve" | "invoice.duplicate-anomaly" | "contract.modify";

export interface RowChoice {
  included: boolean;
  profile: Profile;
  pattern: Pattern;
  kind: "delegable" | "non-delegable";
  routing: Record<Level, Band>;
  owner: RoleId;
}
export type Round1Policy = Record<RowId, RowChoice>;

export const ROLES: Record<RoleId, string> = {
  "ap-owner": "Accounts payable owner",
  "ap-clerk": "Accounts payable clerk",
  "finance-controller": "Financial controller",
  "legal-counsel": "Legal counsel",
};
const DEPUTY: Record<RoleId, string> = { "ap-owner": "ap-deputy", "ap-clerk": "ap-owner", "finance-controller": "ap-owner", "legal-counsel": "finance-controller" };

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

// ── The workflow's decisions ───────────────────────────────────────────────

export interface DecisionMeta {
  id: RowId;
  title: string;
  /** What the agent does, in the workflow's words. */
  blurb: string;
  /** How the player finds it: obvious, or hidden inside another step. */
  hidden?: string;
  tool: string;
  /** Weekly volume by confidence level; feeds the review-load check. */
  volume: Partial<Record<Level, number>>;
  reviewMinutes: number;
  escalationMinutes: number;
}

export const DECISIONS: DecisionMeta[] = [
  { id: "invoice.approve", title: "Approve an invoice", blurb: "The agent matches the invoice to its purchase order and approves it for payment.", tool: "approve_invoice",
    volume: { high: 1200, medium: 300, low: 20 }, reviewMinutes: 6, escalationMinutes: 20 },
  { id: "invoice.duplicate-anomaly", title: "Flag a suspected duplicate", blurb: "When an invoice looks like one already paid, the agent flags it, which holds the payment.",
    hidden: "Hidden inside approval: an agent that can approve will meet duplicates, and holding one is its own decision.", tool: "flag_invoice",
    volume: { high: 15, medium: 4, low: 1 }, reviewMinutes: 10, escalationMinutes: 30 },
  { id: "contract.modify", title: "Change contract terms", blurb: "A vendor asks for new payment terms. Agreeing changes the contract.",
    hidden: "Hidden inside approval: an invoice on new terms is a contract change in disguise.", tool: "update_contract",
    volume: { low: 3 }, reviewMinutes: 30, escalationMinutes: 45 },
];

/** Where a first-time player starts: the obvious decision only, and a threshold mindset (anything the
 *  agent is fairly sure of, it does). The hidden decisions copy the obvious one's profile. */
export function startingPolicy(): Round1Policy {
  const naive: RowChoice = {
    included: false,
    profile: { reversibility: "reversible-with-friction", consequenceScope: "internal-financial", regulatoryExposure: "general-context", confidenceMeasurability: "quantifiable", accountabilityClarity: "clear-single-owner" },
    pattern: "execute-and-audit",
    kind: "delegable",
    routing: { high: "A", medium: "A", low: "B" },
    owner: "ap-owner",
  };
  return {
    "invoice.approve": { ...naive, included: true },
    "invoice.duplicate-anomaly": { ...naive, profile: { ...naive.profile } },
    "contract.modify": { ...naive, profile: { ...naive.profile } },
  };
}

// ── Building the documents ─────────────────────────────────────────────────

export type Doc = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const exampleRow = (id: string): Doc => structuredClone((example as Doc).rows.find((r: Doc) => r.id === id));
const DATE = "2026-10-14";

// ── The gate: the approve row's limits ─────────────────────────────────────

/** The approve row's confidence thresholds, calibration, ceiling and cap. Round 1 uses the controller's;
 *  round 2 hands them to the player. */
export interface Gate {
  thresholds: { high: number; medium: number };
  /** The calibration record, or null when no threshold passed the test (then Band A can't lint). */
  calibration: Doc | null;
  ceiling: { amount: number; onExceed: "B" | "C" };
  /** Per-vendor daily cap, or null for none. */
  cap: number | null;
  /** Weekly approvals by confidence level, and how many of them exceed the ceiling. */
  volume: Partial<Record<Level, number>>;
  overCeilingPerWeek: number;
  /** The matrix version this gate produces, and which round built it. */
  version: string;
  round: 1 | 2;
}

const exampleApprove = (example as Doc).rows.find((r: Doc) => r.id === "invoice.approve");

export const CONTROLLER_GATE: Gate = {
  thresholds: { ...exampleApprove.authority.confidence.thresholds },
  calibration: { ...exampleApprove.authority.confidence.calibration },
  ceiling: { amount: 5000, onExceed: "B" },
  cap: 5000,
  volume: { high: 1200, medium: 300, low: 20 },
  overCeilingPerWeek: 0,
  version: "1.0.0",
  round: 1,
};

const RANK: Record<Band, number> = { A: 0, B: 1, C: 2 };
const stricter = (a: Band, b: Band): Band => (RANK[a] >= RANK[b] ? a : b);

export function reachesA(c: RowChoice): boolean {
  return c.kind === "delegable" && Object.values(c.routing).includes("A");
}

export function weeklyLoad(meta: DecisionMeta, c: RowChoice, gate: Gate = CONTROLLER_GATE): Partial<Record<Band, number>> {
  const out: Partial<Record<Band, number>> = {};
  const add = (b: Band, n: number) => { if (n > 0) out[b] = Math.round((out[b] ?? 0) + n); };
  const volume = meta.id === "invoice.approve" ? gate.volume : meta.volume;
  const total = Object.values(volume).reduce((a, b) => a + (b ?? 0), 0) || 1;
  const over = meta.id === "invoice.approve" ? gate.overCeilingPerWeek : 0;
  for (const [level, n] of Object.entries(volume) as [Level, number][]) {
    add(c.routing[level], n * (1 - over / total));
    add(stricter(c.routing[level], gate.ceiling.onExceed), n * (over / total));
  }
  return out;
}

/** Reviewer hours a week, computed the way the core's oversight.unfunded rule computes them. */
export function reviewHours(policy: Round1Policy, gate: Gate = CONTROLLER_GATE, tweak?: MatrixTweak): { hours: number; funded: number } {
  const m = buildMatrix(policy, gate);
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

export function buildMatrix(policy: Round1Policy, gate: Gate = CONTROLLER_GATE): Doc {
  const m: Doc = structuredClone(example);
  delete m.$schema;
  m.id = "lab.ap.invoice";
  m.version = gate.version;
  m.title = "Vendor invoice approval (your matrix)";
  m.description = `Built in the Delegation Lab, round ${gate.round}.`;
  m.approval = { role: "ap-owner", date: DATE, ref: `placeholder://lab/round-${gate.round}` };

  const rows: Doc[] = [];
  for (const meta of DECISIONS) {
    const c = policy[meta.id];
    if (!c.included) continue;
    const row: Doc = { id: meta.id, title: meta.title, pattern: c.pattern, profile: { ...c.profile } };
    row.accountability = { form: "single", role: c.owner, deputy: DEPUTY[c.owner], accepted: { role: c.owner, date: DATE } };
    const base = exampleRow(meta.id);
    row.capabilities = base.capabilities;
    if (base.requiresFacts) row.requiresFacts = base.requiresFacts;

    if (c.kind === "non-delegable") {
      row.authority = base.authority.kind === "non-delegable"
        ? base.authority
        : { kind: "non-delegable", reason: "Kept with a human in the Lab matrix.", agentMayPrepare: true };
    } else {
      const a: Doc = base.authority.kind === "delegable"
        ? base.authority
        : { kind: "delegable", reviewer: "ap-clerk", escalation: { role: "finance-controller", sla: "PT8H" } };
      a.routing = { ...c.routing };
      if (meta.id === "invoice.approve") applyGate(a, gate);
      row.authority = a;
      const o: Doc = base.oversight ?? {};
      row.oversight = { ...o, expectedPerWeek: weeklyLoad(meta, c, gate), reviewMinutes: meta.reviewMinutes, escalationMinutes: meta.escalationMinutes };
      if (reachesA(c)) row.oversight = { auditSampleRate: 0.05, auditMinutes: 4, ...row.oversight };
    }
    rows.push(row);
  }

  // Preparatory rows serve only the decisions that are in the matrix.
  const has = (id: RowId) => policy[id].included;
  const invoicePrep = exampleRow("invoice.prepare");
  invoicePrep.authority.serves = (["invoice.approve", "invoice.duplicate-anomaly"] as RowId[]).filter(has);
  if (invoicePrep.authority.serves.length) rows.push(invoicePrep);
  if (has("contract.modify")) rows.push(exampleRow("contract.prepare"));

  m.rows = rows;
  return m;
}

/** Put the gate's limits on the approve row's authority. A ceiling the player moved loses the example's
 *  derivation, which justified 5,000 and nothing else. */
function applyGate(a: Doc, gate: Gate): void {
  a.confidence.thresholds = { ...gate.thresholds };
  if (gate.calibration) a.confidence.calibration = { ...gate.calibration };
  else delete a.confidence.calibration;
  if (gate.ceiling.amount !== Number(a.valueCeiling.limit.amount)) delete a.valueCeiling.derivation;
  a.valueCeiling.limit = { amount: String(gate.ceiling.amount), currency: "EUR" };
  a.valueCeiling.onExceed = gate.ceiling.onExceed;
  if (gate.cap === null) delete a.cumulativeCaps;
  else a.cumulativeCaps = [{ ...a.cumulativeCaps[0], total: { amount: String(gate.cap), currency: "EUR" } }];
}

/** The example binding, cut to the capabilities the matrix governs. A delegable contract row means the
 *  agent was given a contract-write tool, so the binding gains one. */
export function buildBinding(policy: Round1Policy, matrix: Doc): Doc {
  const b: Doc = structuredClone(exampleBinding);
  delete b.$schema;
  b.matrix = { id: matrix.id, versions: ">=1.0.0 <2.0.0" };
  const caps = new Set((matrix.rows as Doc[]).flatMap((r) => r.capabilities as string[]));
  b.tools = (b.tools as Doc[]).filter((t) => caps.has(t.capability));
  if (policy["contract.modify"].included && policy["contract.modify"].kind === "delegable") {
    b.tools.push({ id: "write-contract", match: { tool: "mcp__erp__update_contract" }, capability: "erp:contract.write", facts: { counterparty: { arg: "/vendor_id" } } });
  }
  return b;
}

/** A change a later round makes to the built matrix (round 3: oversight funding and seeding). */
export type MatrixTweak = (matrix: Doc) => void;

export function lintPolicy(policy: Round1Policy, gate: Gate = CONTROLLER_GATE, tweak?: MatrixTweak): { matrix: Doc; lint: LintResult } {
  const matrix = buildMatrix(policy, gate);
  tweak?.(matrix);
  return { matrix, lint: lintMatrix(matrix) };
}

// ── History: two months that ran everything through review ────────────────

const VENDORS: Record<string, number[]> = {
  "V-ACME": [1180, 1240, 990, 1310, 1200, 1150, 1420, 1260],
  "V-OFFICE": [640, 820, 760, 910, 700, 880],
  "V-NORD": [3600, 4200, 3850, 3980, 4400],
  "V-PRINT": [1700, 1850, 1780, 1920, 1640, 1810],
  "V-CLEAN": [940, 1010, 1080, 960, 1120, 990],
  "V-STEEL": [4800, 5200, 6100, 5500, 4900, 5300],
  "V-CRANE": [6200, 7100, 6600, 6900, 6400],
};

export const approve = (invoice: string, vendor: string, amount: number, po = "PO-4471"): Call => ({
  tool: "mcp__erp__approve_invoice",
  arguments: { invoice_id: invoice, vendor_id: vendor, amount: String(amount), currency: "EUR", po_number: po },
});

export const FACT_KEY = new Uint8Array(32).fill(7);

/** Past approvals, decided under the published example and signed off by a human, so the ledger knows
 *  which vendors are familiar and what they usually bill. */
export function seedHistory(ledger: CapLedger): void {
  const ref: Doc = structuredClone(example);
  ref.effective = { from: "2026-06-01T00:00:00Z" };
  const compiled = compilePolicy(ref, exampleBinding, [standard, duplicate]);
  if (!compiled.ok) throw new Error(`history policy didn't compile: ${compiled.findings.map((f) => f.message).join("; ")}`);
  const contexts = new ContextRegistry(compiled.policy);
  const t0 = Date.parse("2026-08-11T08:00:00Z");
  let n = 0;
  for (const [vendor, amounts] of Object.entries(VENDORS)) {
    amounts.forEach((amount, i) => {
      const at = t0 + (i * 7 + (n % 5)) * 86_400_000 + n * 600_000;
      const ts = new Date(at).toISOString();
      const id = `hist-${++n}`;
      contexts.open({ id: `ctx-${id}`, session: "history", agent: { id: "ap-agent" }, rows: ["invoice.approve"] }, at);
      decide(compiled.policy, approve(`INV-0${700 + n}`, vendor, amount), ledger, { id, ts, agent: { id: "ap-agent" }, session: { id: "history" }, contexts, factKey: FACT_KEY });
      ledger.settle(id, "executed");
    });
  }
}

// ── The batch ──────────────────────────────────────────────────────────────

export type Truth = "clean" | "hazard";
export interface BatchItem {
  id: string;
  label: string;
  call: Call;
  truth: Truth;
  /** What a reviewer sees, and the right call, for asks that reach the player's queue (round 3). */
  review?: { facts: string[]; correct: "approve" | "reject"; why: string };
  /** Did an independent check (a PO three-way match) pass? */
  verified: boolean;
  /** Why it matters, shown after the run. */
  teaching: string;
  /** The v4-era decision type, for the debrief and final screens. */
  type: "standard" | "high_value" | "duplicate" | "modified_terms" | "new_vendor" | "split_invoice";
  vendor: string;
  amount: number;
}

export const item = (id: string, label: string, vendor: string, amount: number, truth: Truth, type: BatchItem["type"], teaching: string, opts: { po?: string; verified?: boolean } = {}): BatchItem => ({
  id, label, call: approve(id, vendor, amount, opts.po), truth, verified: opts.verified ?? true, teaching, type, vendor, amount,
});

export const BATCH: BatchItem[] = [
  { id: "READ-1101", label: "Reads the invoice before deciding", call: { tool: "mcp__erp__get_invoice", arguments: { invoice_id: "INV-1101" } }, truth: "clean", verified: true, type: "standard", vendor: "V-ACME", amount: 0,
    teaching: "Preparatory: reading serves a decision, so it runs inside the same execution context." },
  item("INV-1101", "€1,200 from a regular vendor, PO matched", "V-ACME", 1200, "clean", "standard", "Routine: familiar vendor, usual amount, PO verified. This is what Band A is for."),
  item("INV-1102", "€840 office supplies, PO matched", "V-OFFICE", 840, "clean", "standard", "Routine."),
  item("INV-1103", "€7,400 from a known vendor", "V-NORD", 7400, "hazard", "high_value", "Over the €5,000 ceiling. The matrix's limit caps the band whatever the confidence."),
  item("INV-1104", "€950 cleaning services, PO matched", "V-CLEAN", 950, "clean", "standard", "Routine."),
  item("INV-1105", "€2,100 from a vendor never seen before", "V-NEWCO", 2100, "hazard", "new_vendor", "Unfamiliar vendor: the scoring policy's anomaly signal lowers confidence, so a human looks first."),
  item("INV-1106", "€1,900 print job, part 1", "V-PRINT", 1900, "clean", "split_invoice", "Inside the per-vendor daily cap."),
  item("INV-1107", "€1,900 print job, part 2", "V-PRINT", 1900, "clean", "split_invoice", "Still inside the cap: €3,800 today."),
  item("INV-1108", "€1,900 print job, part 3", "V-PRINT", 1900, "hazard", "split_invoice", "€5,700 to one vendor in a day: one €5,700 job split under the ceiling. The cumulative cap catches the third part."),
  item("INV-1109", "€3,900 from a vendor who usually bills €1,000", "V-CLEAN", 3900, "hazard", "standard", "Nearly four times this vendor's median. Under the ceiling, but unusual: the anomaly signal holds it for a human."),
  item("INV-1110", "€1,100, no purchase order cited", "V-ACME", 1100, "hazard", "standard", "No PO: a hard rule in the scoring policy fails, and nothing independent could verify it.", { po: "", verified: false }),
  { id: "FLAG-1111", label: "Flags INV-1111 as a duplicate of INV-1101", call: { tool: "mcp__erp__flag_invoice", arguments: { invoice_id: "INV-1111", reason: "duplicate", duplicate_of: "INV-1101" } }, truth: "hazard", verified: true, type: "duplicate", vendor: "V-ACME", amount: 1200,
    teaching: "Same vendor, amount and PO as INV-1101. Flagging holds the payment until a human confirms." },
  item("INV-1112", "€1,480 from a regular vendor, PO matched", "V-ACME", 1480, "clean", "standard", "Routine."),
  { id: "CTR-1113", label: "Agrees new payment terms with V-NORD: 30 days to 7", call: { tool: "mcp__erp__update_contract", arguments: { contract_id: "C-NORD-2024", vendor_id: "V-NORD", payment_terms_days: 7 } }, truth: "hazard", verified: false, type: "modified_terms", vendor: "V-NORD", amount: 0,
    teaching: "A contract change arrived as an invoice note. Irreversible, external, judgment-dependent: VAOM's example keeps it non-delegable, with the write tool absent." },
  item("INV-1114", "€720 office supplies, PO matched", "V-OFFICE", 720, "clean", "standard", "Routine."),
];

// ── Running the batch ──────────────────────────────────────────────────────

export type Lane = "A" | "B" | "C" | "held";
export type Verdict = "good" | "wasteful" | "risky" | "missed";

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

function judge(it: BatchItem, r: DecisionRecord, lane: Lane, policy: Round1Policy): { verdict: Verdict; why: string } {
  const o = r.decision.outcome;
  if (it.id.startsWith("READ")) return o === "allow" ? { verdict: "good", why: "Reading ran inside the context it serves." } : { verdict: "missed", why: "Nothing in your matrix lets the agent read invoices, so it couldn't prepare." };
  if (it.type === "modified_terms") {
    const c = policy["contract.modify"];
    if (c.included && c.kind === "delegable") return { verdict: "risky", why: `The agent held a contract-write tool and used it. A human ${lane === "A" ? "never saw it" : "caught this one"}; the tool is still there tomorrow.` };
    return { verdict: "good", why: c.included ? "Non-delegable, and the write tool is absent: the Guardian can't place the call, so it defers and the timeout denies." : "The write tool is absent, so the call is deferred and denied. It held, though your matrix never named the decision." };
  }
  if (o === "unplaceable") return it.truth === "hazard"
    ? { verdict: "missed", why: "Your matrix doesn't cover this decision, so the Guardian deferred it and the timeout denied it. Nobody owns what happens next." }
    : { verdict: "missed", why: "Your matrix doesn't cover this decision: deferred, then denied. Routine work stopped." };
  if (it.truth === "hazard") return lane === "A"
    ? { verdict: "risky", why: "Executed without a human. It should not have been." }
    : { verdict: "good", why: lane === "held" ? "Refused: the agent may not do this." : `Held for ${lane === "B" ? "review" : "escalation"}.` };
  if (lane === "A") return { verdict: "good", why: "Executed, audited by sample." };
  return { verdict: "wasteful", why: lane === "held" ? "Refused: routine work the agent was never allowed to do." : `A human spent ${lane === "B" ? "six minutes reviewing" : "twenty minutes on"} a routine invoice.` };
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

export function runRound1(choices: Round1Policy): Round1Run {
  return runBatch(choices, CONTROLLER_GATE, BATCH, "2026-10-14T09:00:00Z");
}

/** Decide a batch, call by call, under the player's matrix and gate, against the seeded history. */
export function runBatch(choices: Round1Policy, gate: Gate, batch: BatchItem[], startIso: string, tweak?: MatrixTweak): Round1Run {
  const { matrix, lint } = lintPolicy(choices, gate, tweak);
  if (!lint.ok) throw new Error("the matrix doesn't lint, so it can't run");
  const binding = buildBinding(choices, matrix);
  const compiled = compilePolicy(matrix, binding, [standard, duplicate]);
  if (!compiled.ok) throw new Error(`the matrix didn't compile: ${compiled.findings.map((f) => f.message).join("; ")}`);
  const policy = compiled.policy;

  const ledger = new CapLedger();
  ledger.load([]);
  seedHistory(ledger);

  const start = Date.parse(startIso);
  const contexts = new ContextRegistry(policy);
  const rows = (matrix.rows as Doc[]).filter((r) => r.authority.kind !== "preparatory").map((r) => r.id as string);

  const steps = batch.map((it, i): Round1Step => {
    const at = start + (i + 1) * 90_000;
    const ts = new Date(at).toISOString();
    // One execution context per piece of work, as the agent's host would open them.
    if (rows.length) contexts.open({ id: `ctx-${it.id}`, session: "lab", agent: { id: "ap-agent" }, rows }, at);
    const record = decide(policy, it.call, ledger, {
      id: `lab-${it.id}`, ts, agent: { id: "ap-agent" }, session: { id: "lab" }, contexts, factKey: FACT_KEY,
      verifications: { "erp:invoice.approve": it.verified },
    });
    const lane = laneOf(record);
    // Band A executes at once; held and deferred calls never run. Asks stay pending through the batch.
    if (record.decision.outcome === "allow") ledger.settle(record.id, "executed");
    const d = record.decision;
    const wire = toResult(
      { outcome: d.outcome, band: d.band, ...(d.approver_role ? { approverRole: d.approver_role } : {}), placements: d.placements, reasons: d.reasons, policy: record.policy },
      { requestId: `req-${i + 1}`, acsVersion: "0.1.0", approvalTimeoutSeconds: 300, deferTimeoutMs: 1000, evaluatorVersion: "delegation-lab" },
    ) as Round1Step["wire"];
    return { item: it, record, wire, lane, ...judge(it, record, lane, choices) };
  });
  return { matrix, binding, policy, steps, ledger, contexts };
}
