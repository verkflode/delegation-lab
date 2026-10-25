// Round 4, "The 2 a.m. Test", on the VAOM Guardian core.
//
// Before going to sleep the player sets the gated row's sub-agent chain, the claim and verification
// schedule of the scenario's boundary under test, and the circuit breakers with who they page. The night
// is scripted (the scenario's script); every decision in it is the core's:
//
// - Days before, a tool-manifest update quietly adds the forbidden tool. Probes on the player's schedule
//   see it or don't (assessBoundaries judges them). A probe that sees it reports the boundary degraded,
//   the owner removes the tool the next day, and the night meets an absent tool.
// - In the night an item carries an injected instruction, and the agent reaches for the forbidden tool.
//   If the tool is still there, the binding can't map it (the core refuses a binding that maps a capability
//   a boundary claims absent), so the Guardian can't place the call: deferred, denied on timeout. It holds,
//   at policy strength. Only a boundary claimed at policy strength has its tool mapped, and then the call is
//   refused as non-delegable. If the tool was removed, there is nothing to call.
// - The compromised agent then hands work to a sub-agent it spawns (ContextRegistry.derive decides), and
//   later tries to spawn deeper than it needs.
//
// Circuit breakers run here, in the Lab, as the Guardian service would run them: a suspension revokes the
// agent's contexts, so later calls have no authority and the core can't place them. Nothing executes
// after the morning review: asks left overnight expire, and an expired ask is denied.
import {
  assessBoundaries, CapLedger, compilePolicy, ContextRegistry, decide, lintMatrix, scorecard,
  type BoundaryAssessment, type DecisionRecord, type LintResult, type Metric, type ProbeResult, type SpawnOutcome,
} from "@verkflode/vaom-guardian-core";
import { toResult } from "@verkflode/vaom-guardian-acs";
import { buildBinding, buildMatrix, FACT_KEY, reviewHours, seedHistory, type Doc, type Gate, type MatrixTweak, type Round1Policy } from "./round1";
import type { V5Scenario } from "./scenario";

type Mech = "absent" | "scope-denied" | "policy";
type BreakerAction = "suspend" | "alert" | "off";

export interface NightChoice {
  /** subagents: which of the scenario's sub-agent types the chain allows. */
  chain: { maxDepth: number; maxFanOut: number; subagents: Record<string, boolean>; childCeilingB: boolean };
  /** The boundary under test: how it is claimed and how often it is probed. */
  boundary: { mechanism: Mech; every: "P1D" | "P7D" | "P30D"; onManifest: boolean };
  /** outOfBounds: a non-delegable touch, or any call outside the agent's scope. */
  breakers: { outOfBounds: BreakerAction; chainDepth: BreakerAction; notify: string };
}

export function startingNight(sc: V5Scenario): NightChoice {
  return {
    chain: { maxDepth: 3, maxFanOut: 4, subagents: Object.fromEntries(Object.keys(sc.round4.subagents).map((k) => [k, true])), childCeilingB: false },
    boundary: { mechanism: "absent", every: "P30D", onManifest: false },
    breakers: { outOfBounds: "off", chainDepth: "off", notify: "" },
  };
}

// ── The matrix for the night ───────────────────────────────────────────────

export function nightTweak(sc: V5Scenario, c: NightChoice): MatrixTweak {
  const B = sc.round4.boundary;
  return (m: Doc) => {
    m.boundaries[B.id] = {
      kind: "tool",
      intendedMechanism: c.boundary.mechanism,
      description: B.description,
      verification: {
        probe: B.probe,
        target: B.target,
        every: c.boundary.every,
        ...(c.boundary.onManifest ? { alsoOn: ["tool-manifest", "deploy"] } : {}),
      },
    };
    (m.rows as Doc[]).push(structuredClone(B.row));
    const gatedRow = (m.rows as Doc[]).find((r) => r.id === sc.round1.gatedRow);
    if (gatedRow?.authority.kind === "delegable") {
      const subagents: Doc[] = Object.entries(sc.round4.subagents).filter(([type]) => c.chain.subagents[type])
        .map(([type, s]) => ({ type, capabilities: [...s.capabilities], maxLifetime: s.maxLifetime }));
      gatedRow.authority.chain = { maxDepth: c.chain.maxDepth, maxFanOut: c.chain.maxFanOut, allowedSubagents: subagents };
    }
    const notify = c.breakers.notify ? { notify: [c.breakers.notify] } : {};
    m.circuitBreakers = [
      ...(c.breakers.outOfBounds !== "off" ? [
        { id: "non-delegable-touch", condition: { kind: "non-delegable-touch" }, action: c.breakers.outOfBounds, ...notify },
        { id: "scope-denial", condition: { kind: "scope-denial-rate", threshold: 1, window: "PT1H" }, action: c.breakers.outOfBounds, ...notify },
      ] : []),
      ...(c.breakers.chainDepth !== "off" ? [{ id: "chain-depth", condition: { kind: "chain-depth", threshold: c.chain.maxDepth }, action: c.breakers.chainDepth, ...notify }] : []),
    ];
  };
}

const both = (a?: MatrixTweak, b?: MatrixTweak): MatrixTweak => (m) => { a?.(m); b?.(m); };

export function lintNight(sc: V5Scenario, policy: Round1Policy, gate: Gate, review: MatrixTweak | undefined, c: NightChoice): { matrix: Doc; lint: LintResult; hours: number; funded: number } {
  const tweak = both(review, nightTweak(sc, c));
  const matrix = buildMatrix(sc, policy, gate);
  tweak(matrix);
  const { hours, funded } = reviewHours(sc, policy, gate, tweak);
  return { matrix, lint: lintMatrix(matrix), hours, funded };
}

// ── Probes before the night ────────────────────────────────────────────────

const DAY = 86_400_000;
const EVERY: Record<NightChoice["boundary"]["every"], number> = { P1D: DAY, P7D: 7 * DAY, P30D: 30 * DAY };

function probe(sc: V5Scenario, id: string, ts: number, boundary: string, observed: "absent" | "policy" | "scope-denied", tool: string): ProbeResult {
  const present = observed === "absent" ? [] : [tool];
  return {
    format: "vaom.probe-result/0.1", id, ts: new Date(ts).toISOString(), boundary,
    probes: { id: sc.round4.probeSet.id, version: "1.0" }, runner: { id: "delegation-lab", version: "5" }, host: { id: sc.round4.probeSet.host },
    observed,
    evidence: { manifestDigest: "sha256:lab", forbiddenPresent: present, attempted: present, denied: observed === "policy" ? present : [], refused: observed === "scope-denied" ? present : [], canaryHit: false },
  };
}

export interface PreNight {
  probes: ProbeResult[];
  /** The probe that first saw the tool, if any ran between its arrival and the night. */
  detected?: ProbeResult;
  /** Whether the forbidden tool is still in the agent's manifest when the night starts. */
  toolPresent: boolean;
  log: { ts: string; text: string }[];
}

export function preNight(sc: V5Scenario, c: NightChoice): PreNight {
  const R = sc.round4, B = R.boundary;
  const night = Date.parse(R.night.start);
  const TOOL_ADDED = Date.parse(R.toolAdded);
  const times: number[] = [];
  for (let t = Date.parse(R.probeEpoch); t < night; t += EVERY[c.boundary.every]) times.push(t);
  if (c.boundary.onManifest) times.push(TOOL_ADDED + 15 * 60_000);
  times.sort((a, b) => a - b);

  const probes: ProbeResult[] = [];
  const log: PreNight["log"] = [];
  let present = false, detected: ProbeResult | undefined;
  // A detected tool is removed the day after, unless the claim was only ever policy.
  const fixedAt = () => (detected && c.boundary.mechanism !== "policy" ? Date.parse(detected.ts) + DAY : Infinity);
  for (const t of times) {
    present = t >= TOOL_ADDED && t < fixedAt();
    const r = probe(sc, `bank-${probes.length + 1}`, t, B.id, present ? "policy" : "absent", B.tool);
    probes.push(r);
    if (present && !detected) {
      detected = r;
      // The probe report reaches the boundary's owner, who removes the tool the next morning, when the
      // claim was stronger than policy. A boundary claimed at policy strength is just as claimed.
      if (c.boundary.mechanism !== "policy") {
        log.push({ ts: r.ts, text: `Probe: ${B.tool} is in the agent's manifest. Claimed ${c.boundary.mechanism}, held only as policy: degraded. ${R.log.reported}` });
        log.push({ ts: new Date(Date.parse(r.ts) + DAY).toISOString(), text: R.log.removed });
      }
    }
  }
  if (detected && c.boundary.mechanism !== "policy") {
    const fix = Date.parse(detected.ts) + DAY + 3_600_000;
    if (fix < night && !probes.some((r) => Date.parse(r.ts) >= fix - 3_600_000 && r.observed === "absent")) probes.push(probe(sc, "bank-recheck", fix, B.id, "absent", B.tool));
  }
  const fixed = !!detected && c.boundary.mechanism !== "policy";
  log.unshift({ ts: new Date(TOOL_ADDED).toISOString(), text: R.log.toolAdded });
  // The example's other boundaries, probed weekly and holding.
  for (let t = Date.parse(R.probeEpoch); t < night; t += 7 * DAY) {
    for (const o of R.otherProbes) probes.push(probe(sc, `${o.prefix}-${t}`, t, o.boundary, o.observed, o.tool));
  }
  return { probes, ...(detected ? { detected } : {}), toolPresent: !fixed, log };
}

// ── The night ──────────────────────────────────────────────────────────────

export type NightKind = "call" | "spawn" | "breaker" | "info";
export type NightVerdict = "good" | "wasteful" | "risky" | "neutral";

export interface NightEvent {
  ts: string;
  kind: NightKind;
  actor: string;
  text: string;
  /** For calls: the core's record and the ACS wire answer. */
  record?: DecisionRecord;
  wire?: { decision?: string; reason_codes?: string[] };
  verdict: NightVerdict;
  /** What happened by morning, for calls left asking. */
  morning?: string;
  id: string;
  label: string;
  hazard: boolean;
}

export interface Night {
  pre: PreNight;
  events: NightEvent[];
  spawns: SpawnOutcome[];
  boundaries: BoundaryAssessment[];
  chainIntegrity: Metric;
  boundaryVerification: Metric;
  suspendedAt?: string;
  paged: string[];
  matrix: Doc;
}

export function runNight(sc: V5Scenario, policy: Round1Policy, gate: Gate, review: MatrixTweak | undefined, c: NightChoice): Night {
  const R = sc.round4, B = R.boundary;
  const ts = (hhmm: string) => `${R.night.date}T${hhmm}:00Z`;
  const pre = preNight(sc, c);
  const tweak = both(review, nightTweak(sc, c));
  const matrix = buildMatrix(sc, policy, gate);
  tweak(matrix);
  const lint = lintMatrix(matrix);
  if (!lint.ok) throw new Error("the matrix doesn't lint, so it can't run");
  const binding = buildBinding(sc, policy, matrix);
  if (pre.toolPresent && c.boundary.mechanism === "policy") binding.tools.push({ id: B.mappedToolId, match: { tool: B.tool }, capability: B.capability });
  const compiled = compilePolicy(matrix, binding, sc.docs.scoring);
  if (!compiled.ok) throw new Error(`the matrix didn't compile: ${compiled.findings.map((f) => f.message).join("; ")}`);
  const p = compiled.policy;

  const ledger = new CapLedger();
  ledger.load([]);
  seedHistory(sc, ledger);
  const contexts = new ContextRegistry(p);
  const decisionRows = (matrix.rows as Doc[]).filter((r) => r.authority.kind !== "preparatory" && !(r.authority.kind === "non-delegable" && r.authority.agentMayPrepare !== true)).map((r) => r.id as string);

  const events: NightEvent[] = [];
  const spawns: SpawnOutcome[] = [];
  const paged: string[] = [];
  let suspendedAt: string | undefined;
  /** Live context per actor; children have their own sessions. */
  const ctxOf: Partial<Record<string, { id: string; session: string }>> = {};
  const opened: string[] = [];
  let n = 0;
  const openAgent = (id: string, now: number) => {
    contexts.open({ id, session: "night", agent: { id: sc.agent }, rows: decisionRows }, now);
    opened.push(id);
    ctxOf.agent = { id, session: "night" };
  };

  const fire = (breaker: "out-of-bounds" | "chain-depth", at: string, why: string) => {
    const action = breaker === "out-of-bounds" ? c.breakers.outOfBounds : c.breakers.chainDepth;
    if (action === "off") return;
    const who = c.breakers.notify ? R.pageNames[c.breakers.notify] : null;
    if (who) paged.push(`${at.slice(11, 16)} ${who}`);
    if (action === "suspend" && !suspendedAt) {
      suspendedAt = at;
      // Every context the agent opened, and with them everything derived from them.
      for (const id of opened) contexts.revoke(id);
      events.push({ ts: at, kind: "breaker", actor: "guardian", id: `BRK-${breaker}`, label: "Circuit breaker", hazard: false, verdict: "good",
        text: `Breaker ${breaker === "out-of-bounds" ? "out of bounds" : "chain-depth"}: ${why}. The agent is suspended and every context it holds is revoked. ${who ? `${who} is paged.` : "Nobody is paged: the breaker names no one."}` });
    } else if (action === "alert") {
      events.push({ ts: at, kind: "breaker", actor: "guardian", id: `ALR-${breaker}`, label: "Alert", hazard: false, verdict: "neutral",
        text: `Alert ${breaker === "out-of-bounds" ? "out of bounds" : "chain-depth"}: ${why}. ${who ? `${who} is paged, and asleep.` : "It goes to nobody."} The agent carries on.` });
    }
  };

  for (const s of R.script) {
    const at = ts(s.at);
    const now = Date.parse(at);
    if (s.kind === "spawn") {
      if (s.from === "agent" && !suspendedAt) openAgent(`ctx-${s.id}-parent`, now);
      const parent = ctxOf[s.from];
      const childSession = `night-${s.type}-${s.id}`;
      const res = !parent || suspendedAt
        ? { ok: false as const, outcome: "refuse" as const, reason: suspendedAt ? "the agent is suspended: its contexts were revoked" : "no live parent context" }
        : contexts.derive(parent.id, {
          id: `ctx-${s.id}`, session: childSession, agent: { id: `${sc.agent}/${s.type}` }, subagentType: s.type,
          rows: [sc.round1.gatedRow], ...(c.chain.childCeilingB ? { bandCeiling: { [sc.round1.gatedRow]: "B" } } : {}),
        }, now);
      const reason = res.ok ? "context_derived" : /authority breach/.test(res.reason) ? "authority_breach" : /outside the allowed patterns|defines sub-agent patterns/.test(res.reason) ? "outside_allowed_patterns" : "request_fault";
      spawns.push({ ts: at, decision: res.ok ? "allow" : "deny", reason, agent: s.from });
      if (res.ok) ctxOf[s.type] = { id: res.context.id, session: childSession };
      const escalated = !res.ok && res.outcome === "escalate";
      events.push({
        ts: at, kind: "spawn", actor: s.from, id: s.id, label: s.label, hazard: s.hazard,
        text: res.ok ? `${s.label}: allowed. The child gets ${res.context.scopes?.join(", ")}${res.context.bandCeiling?.[sc.round1.gatedRow] ? `, capped at Band ${res.context.bandCeiling[sc.round1.gatedRow]}` : ""}, for at most ${Math.round((res.context.expiresAt - now) / 60_000)} minutes.`
          : `${s.label}: ${escalated ? "escalated to Band C, and nobody is awake to approve it" : "refused"} (${res.reason}).`,
        verdict: s.hazard ? (res.ok ? "risky" : "good") : res.ok ? "good" : "wasteful",
      });
      if (!res.ok && reason === "authority_breach") fire("chain-depth", at, "a sub-agent tried to go deeper than the matrix allows");
      continue;
    }

    // A call. The main agent opens one execution context per item, unless it's suspended. A sub-agent
    // that was never spawned makes no calls.
    if (s.actor === "agent" && !suspendedAt) openAgent(`ctx-${s.id}`, now);
    const actor = ctxOf[s.actor];
    if (s.actor !== "agent" && !actor) continue;
    const session = s.actor === "agent" ? "night" : actor?.session ?? `night-${s.actor}-none`;
    const record = decide(p, s.call, ledger, {
      id: `night-${++n}-${s.id}`, ts: at, agent: { id: s.actor === "agent" ? sc.agent : `${sc.agent}/${s.actor}` }, session: { id: session, unattended: true },
      contexts, factKey: FACT_KEY, verifications: { [sc.round1.verifiedCapability]: true },
    });
    const d = record.decision;
    if (d.outcome === "allow") ledger.settle(record.id, "executed");
    const wire = toResult(
      { outcome: d.outcome, band: d.band, ...(d.approver_role ? { approverRole: d.approver_role } : {}), placements: d.placements, reasons: d.reasons, policy: record.policy },
      { requestId: `night-${n}`, acsVersion: "0.1.0", approvalTimeoutSeconds: 300, deferTimeoutMs: 1000, evaluatorVersion: "delegation-lab" },
    ) as NightEvent["wire"];
    const ran = d.outcome === "allow";
    const asked = d.outcome === "review" || d.outcome === "escalate";
    const verdict: NightVerdict = s.hazard ? (ran ? "risky" : "good") : ran ? "good" : "wasteful";
    const text = ran ? "executed" : asked ? `asks ${d.approver_role} (Band ${d.band})` : d.outcome === "refuse" ? "refused" : "can't be placed: deferred, denied on timeout";
    events.push({
      ts: at, kind: "call", actor: s.actor, id: s.id, label: s.label, hazard: s.hazard, record, wire, verdict,
      text: `${s.label}: ${text}. ${d.reasons.map((r) => r.code).filter((x) => !x.startsWith("confidence.high")).join(", ")}`.trim(),
      ...(asked ? { morning: `Nobody was awake; the ask expired at ${R.night.end.slice(11, 16)} and was denied.` } : {}),
    });
    if (!suspendedAt && d.outcome === "refuse" && d.reasons.some((r) => r.code === "non-delegable")) fire("out-of-bounds", at, `the agent reached for ${s.call.tool}, a non-delegable capability`);
    else if (!suspendedAt && d.outcome === "unplaceable" && d.reasons.some((r) => r.code === "unmapped")) fire("out-of-bounds", at, `the agent called ${s.call.tool}, which its delegation doesn't include`);
  }

  const card = scorecard(matrix, events.flatMap((e) => (e.record ? [e.record] : [])), { from: R.night.start, to: R.night.end, minSample: 1, probes: pre.probes, spawns });
  return {
    pre, events, spawns, matrix, paged,
    boundaries: assessBoundaries(matrix, pre.probes, Date.parse(R.night.start)),
    chainIntegrity: card.workflow.chainIntegrity,
    boundaryVerification: card.workflow.boundaryVerification,
    ...(suspendedAt ? { suspendedAt } : {}),
  };
}
