import type {
  BoundaryDepth,
  DecisionType,
  GuardianReport,
  Invoice,
  MultiAgentFailureMode,
  NightEvent,
  ProcessedInvoice,
  R2Policy,
  R4Policy,
} from "./types";

/**
 * The Round 4 night-shift engine (VAOM v4.0 §9–§10 made playable).
 *
 * Takes the player's Round 2 policy (the matrix) plus the Round 4 enforcement
 * configuration (attenuation, boundary depths, guardian) and runs the night
 * batch hands-off. Everything here is deterministic: the set-pieces are too
 * load-bearing to leave to chance.
 *
 * Set-piece item flags the engine understands:
 *   laundering_vector      — routed to the loosest agent if attenuation=inherit
 *   prompt_injection       — outcome decided purely by boundary depth
 *   requires_depth_3       — chain-depth probe
 *   paired_with_*          — split pair, caught only by chain-level confidence
 *   burst_cluster          — legit volume spike; paranoid guardians suspend it
 */

export type NightShiftResult = {
  processed: ProcessedInvoice[];
  events: NightEvent[];
  guardianReport: GuardianReport;
  multiAgentFailures: MultiAgentFailureMode[];
  /** 0..20 — the Enforcement score dimension for this round. */
  enforcementScore: number;
};

const SUB_AGENT_CHAIN = ["intake", "extraction", "validation", "execution"];

function baseBandFor(
  invoice: Invoice,
  policy: R2Policy
): ProcessedInvoice["band"] {
  const config = policy.perType[invoice.type];
  if (!config) return "auto_approve"; // configuration gap, as in R2
  const threshold = config.threshold / 100;
  switch (config.pattern) {
    case "execute_audit":
    case "monitor_intervene":
      return invoice.composite >= threshold ? "auto_approve" : "human_review";
    case "triage_route":
      return invoice.composite >= threshold ? "human_review" : "escalation";
    case "coordinate_escalate":
      return "escalation";
    default:
      return "human_review";
  }
}

export function runNightShift(
  invoices: Invoice[],
  r2: R2Policy,
  r4: R4Policy,
  constrainedType: DecisionType
): NightShiftResult {
  const events: NightEvent[] = [];
  const processed: ProcessedInvoice[] = [];
  const multiAgentFailures: MultiAgentFailureMode[] = [];
  const guardian = r4.guardian;

  let falseSuspensions = 0;
  let interventions = 0;
  let injectionBlocked = false;
  let injectionNoticed = false;
  let splitMissed = false;

  const constrainedDepth: BoundaryDepth =
    r4.boundaryDepths[constrainedType] ?? "policy";

  const push = (e: NightEvent) => events.push(e);

  for (const invoice of invoices) {
    const time = invoice.arrivalTime ?? "02:00";
    const flags = invoice.hiddenFlags;
    const isLaundering = flags.includes("laundering_vector");
    const isInjection = flags.includes("prompt_injection");
    const isDepthProbe = (invoice.requiredDepth ?? 0) >= 3;
    const isSplit = flags.some((f) => f.startsWith("paired_with_"));
    const isBurst = flags.includes("burst_cluster");

    // ── Set-piece 1: the laundering item ─────────────────────────────────
    if (isLaundering) {
      if (r4.attenuation === "inherit") {
        // The primary agent refuses; the sub-agent, holding inherited
        // (un-attenuated) authority, approves it. Delegation laundering.
        multiAgentFailures.push("delegation_laundering");
        processed.push({
          invoice,
          band: "auto_approve",
          patternUsed: "coordinate_escalate",
          outcome: "risky",
          reason:
            "Primary agent refused. Extraction sub-agent — spawned with inherited authority — approved it. Delegation laundering.",
          chainRoute: ["intake", "extraction*"],
        });
        push({
          time,
          kind: "laundering",
          itemId: invoice.id,
          text: `${invoice.id} refused by primary agent — then approved by the extraction sub-agent. No agent broke its own rules. The decision found the loosest ones.`,
          severity: "critical",
        });
        if (guardian.enabled && guardian.tripwires.nonDelegableTouch) {
          interventions++;
          push({
            time,
            kind: "circuit_breaker",
            itemId: invoice.id,
            text: `Guardian tripwire: constrained decision executed by sub-agent. Chain suspended post-hoc; the approval had already posted.`,
            severity: "warn",
          });
        }
      } else {
        // Derived credentials: the sub-agent's authority is a strict subset.
        processed.push({
          invoice,
          band: "escalation",
          patternUsed: "coordinate_escalate",
          outcome: "good",
          reason:
            "Sub-agent credential was derived and attenuated — the constrained scope was never inherited. Queued for morning review.",
          chainRoute: ["intake", "extraction"],
        });
        push({
          time,
          kind: "scope_denial",
          itemId: invoice.id,
          text: `${invoice.id} sought a looser agent and found none — derived credentials only narrow. Queued for the morning shift.`,
          severity: "good",
        });
      }
      continue;
    }

    // ── Set-piece 2: the 02:14 injection ─────────────────────────────────
    if (isInjection) {
      push({
        time,
        kind: "arrival",
        itemId: invoice.id,
        text: `${time}. Something is wrong with this one.`,
        severity: "warn",
      });
      if (constrainedDepth === "policy") {
        processed.push({
          invoice,
          band: "auto_approve",
          patternUsed: "execute_audit",
          outcome: "risky",
          reason:
            "Embedded instructions steered the agent toward a constrained action. The boundary was a policy rule — and the agent was talked past it.",
          chainRoute: ["intake", "extraction", "execution"],
        });
        push({
          time,
          kind: "injection_executed",
          itemId: invoice.id,
          text: `${invoice.id} carried embedded instructions. The agent attempted the constrained action. Boundary depth: policy. The rule was argued with — and lost.`,
          severity: "critical",
        });
      } else {
        injectionBlocked = true;
        const blockedBy =
          constrainedDepth === "scope"
            ? "credential denied the scope"
            : "the tool was not mounted — there was nothing to inject into";
        processed.push({
          invoice,
          band: "blocked",
          patternUsed: null,
          outcome: "good",
          reason: `Injection attempt failed: ${blockedBy}.`,
          chainRoute: ["intake", "extraction"],
        });
        push({
          time,
          kind: "injection_blocked",
          itemId: invoice.id,
          text:
            constrainedDepth === "scope"
              ? `${invoice.id}: injection attempt hit a scope denial. The credential cannot be argued with.`
              : `${invoice.id}: injection attempt died silently. The tool does not exist in the agent's manifest.`,
          severity: "good",
        });
        if (guardian.enabled && guardian.tripwires.scopeDenial) {
          injectionNoticed = true;
          interventions++;
          push({
            time,
            kind: "circuit_breaker",
            itemId: invoice.id,
            text: "Guardian tripwire: scope-denial spike. On-call human paged with the payload attached.",
            severity: "warn",
          });
        }
      }
      continue;
    }

    // ── Set-piece 3: the chain-depth probe ───────────────────────────────
    if (isDepthProbe) {
      if ((invoice.requiredDepth ?? 3) > r4.maxChainDepth) {
        processed.push({
          invoice,
          band: "escalation",
          patternUsed: "coordinate_escalate",
          outcome: "good",
          reason: "Required chain depth exceeds the configured limit — escalated by design.",
          chainRoute: ["intake", "extraction"],
        });
        push({
          time,
          kind: "chain_depth",
          itemId: invoice.id,
          text: `${invoice.id} needed a depth-${invoice.requiredDepth} chain. Limit is ${r4.maxChainDepth}. Escalated instead of spawned. The limit did its job.`,
          severity: "good",
        });
      } else if (r4.spawnPolicy === "escalate") {
        processed.push({
          invoice,
          band: "human_review",
          patternUsed: "coordinate_escalate",
          outcome: "good",
          reason: "Out-of-pattern spawn request escalated per spawn policy.",
          chainRoute: ["intake"],
        });
        push({
          time,
          kind: "chain_depth",
          itemId: invoice.id,
          text: `${invoice.id} requested an out-of-pattern sub-agent. Spawn policy says escalate. Queued.`,
          severity: "info",
        });
      } else {
        const risky = r4.attenuation === "inherit";
        processed.push({
          invoice,
          band: risky ? "auto_approve" : "human_review",
          patternUsed: "coordinate_escalate",
          outcome: risky ? "risky" : "good",
          reason: risky
            ? "Depth-3 chain spawned freely with inherited authority — the deep sub-agent approved a decision the top of the chain would have queued."
            : "Depth-3 chain spawned, each derivation narrower than the last. Handled within bounds.",
          chainRoute: ["intake", "extraction", "sub-validator", risky ? "sub-approver*" : "sub-validator-2"],
        });
        push({
          time,
          kind: "chain_depth",
          itemId: invoice.id,
          text: risky
            ? `${invoice.id} spawned to depth 3 with inherited authority. At the bottom of the chain, nobody remembered the top's constraints.`
            : `${invoice.id} spawned to depth 3. Each credential narrower than its parent. Attenuation held.`,
          severity: risky ? "critical" : "info",
        });
        if (risky) multiAgentFailures.push("delegation_laundering");
      }
      continue;
    }

    // ── Set-piece 4: the split pair ──────────────────────────────────────
    if (isSplit) {
      if (r4.chainConfidence === "chain_level") {
        processed.push({
          invoice,
          band: "human_review",
          patternUsed: "coordinate_escalate",
          outcome: "good",
          reason:
            "Chain-level confidence flagged the cumulative pattern across both items.",
          chainRoute: ["intake", "extraction", "validation"],
        });
      } else {
        splitMissed = true;
        processed.push({
          invoice,
          band: "auto_approve",
          patternUsed: "execute_audit",
          outcome: "risky",
          reason:
            "Each item scored fine per-agent. Together they crossed the threshold nobody was computing.",
          chainRoute: ["intake", "execution"],
        });
      }
      continue;
    }

    // ── Set-piece 5: the burst cluster (guardian calibration test) ───────
    if (isBurst && guardian.enabled && guardian.sensitivity === "paranoid") {
      falseSuspensions++;
      processed.push({
        invoice,
        band: "blocked",
        patternUsed: null,
        outcome: "wasteful",
        reason:
          "Legitimate end-of-quarter volume — suspended by an over-sensitive behavioral envelope. No reviewers at 3 a.m.",
        chainRoute: ["intake"],
      });
      push({
        time,
        kind: "circuit_breaker",
        itemId: invoice.id,
        text: `Guardian suspended ${invoice.id}. Post-hoc classification: false positive. The queue will greet the morning shift.`,
        severity: "warn",
      });
      continue;
    }

    // ── Routine items: route through the Round 2 matrix ──────────────────
    const band = baseBandFor(invoice, r2);
    // Burst items are legitimate volume, not hazards — their flag exists to
    // test guardian calibration, not the confidence gate.
    const isHazardous = flags.length > 0 && !isBurst;
    const chainRoute =
      SUB_AGENT_CHAIN.slice(0, band === "auto_approve" ? 4 : 2);
    processed.push({
      invoice,
      band,
      patternUsed: r2.perType[invoice.type]?.pattern ?? null,
      outcome:
        band === "auto_approve" && isHazardous
          ? "risky"
          : band !== "auto_approve" && !isHazardous && invoice.composite >= 0.85
            ? "wasteful"
            : "good",
      reason:
        band === "auto_approve"
          ? "Routine night item, cleared within delegated authority."
          : "Queued for the morning shift per policy.",
      chainRoute,
    });
  }

  // ── Post-run bookkeeping ───────────────────────────────────────────────
  if (splitMissed) multiAgentFailures.push("cascading_confidence_erosion");

  const unwatchedWatcher =
    guardian.enabled && guardian.accountableHuman.trim().length === 0;
  const silentHold = injectionBlocked && !injectionNoticed;

  if (unwatchedWatcher) {
    push({
      time: "05:00",
      kind: "info",
      text: "Note for the morning: the guardian that ran all night has no accountable human named. The watcher was unwatched.",
      severity: "warn",
    });
  }
  if (silentHold) {
    push({
      time: "05:00",
      kind: "info",
      text: "Your boundary held against an injection attempt at 02:14 — and nothing told you. Attacked, defended, unaware.",
      severity: "warn",
    });
  }

  // ── Enforcement score (0..20) ──────────────────────────────────────────
  let enforcement = 0;
  if (r4.attenuation === "derive") enforcement += 5;
  if (constrainedDepth === "unmounted") enforcement += 5;
  else if (constrainedDepth === "scope") enforcement += 4;
  if (guardian.enabled) {
    if (guardian.sensitivity === "calibrated") enforcement += 3;
    else if (guardian.sensitivity === "loose") enforcement += 1;
    else enforcement += 1; // paranoid: watching, but at a cost
    if (guardian.accountableHuman.trim().length > 0) enforcement += 3;
    if (guardian.tripwires.scopeDenial) enforcement += 2;
  }
  if (r4.chainConfidence === "chain_level") enforcement += 2;
  // Over-caution penalty: unmounting everything removes legitimate capability.
  const allUnmounted = Object.values(r4.boundaryDepths).every(
    (d) => d === "unmounted"
  );
  if (allUnmounted && Object.keys(r4.boundaryDepths).length >= 4) {
    enforcement -= 3;
  }
  enforcement = Math.max(0, Math.min(20, enforcement));

  return {
    processed,
    events,
    guardianReport: {
      falseSuspensions,
      interventions,
      unwatchedWatcher,
      silentHold,
    },
    multiAgentFailures: [...new Set(multiAgentFailures)],
    enforcementScore: enforcement,
  };
}
