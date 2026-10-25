// Plain-words explanations for the core's lint findings, for VAOM to say out loud.
//
// lintMatrix alone decides whether a matrix runs. This only explains. The core's semantic rules have
// stable ids and readable messages already. Its schema findings don't say which rule failed (they read
// "must NOT be valid"), so for a row with schema findings the Lab names the schema rules that the
// player's choices for that row break, each quoting the rule's comment in the matrix schema. If none
// matches, the core's own messages are shown unchanged.
import type { Finding, LintResult } from "@verkflode/vaom-guardian-core";
import { reachesA, type Round1Policy } from "./round1";
import type { V5Scenario } from "./scenario";

export interface Explained {
  severity: "error" | "warning";
  /** The row it's about, if any. */
  row?: string;
  /** What VAOM says. */
  text: string;
  /** The core's findings behind it, verbatim. */
  findings: Finding[];
}

const RULE_TEXT: Record<string, string> = {
  "oversight.unfunded": "Oversight is funded, not assumed. The review load your routing creates doesn't fit the reviewer hours anyone has funded.",
  "structural.missing": "Non-delegable, but nothing keeps it out of reach. A rule that says no is policy; make the capability absent.",
  "structural.weak": "Non-delegable, kept out of reach by a mechanism weaker than absence.",
};

type Doc = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** The schema rules a row's choices break, in the schema's own words (its $comment), shortened. */
function schemaRulesBroken(sc: V5Scenario, id: string, policy: Round1Policy, row: Doc | undefined): string[] {
  const c = policy[id];
  const p = c.profile;
  const out: string[] = [];
  const order = { A: 0, B: 1, C: 2 } as const;
  const ov = row?.oversight;
  if (ov?.seeding?.enabled && (ov.recordsFeed ?? []).length > 0) out.push(`Seeding is never allowed where records feed ${ov.recordsFeed.join(", ")}: a planted case would end up in the filing.`);
  if (c.kind === "delegable") {
    if (p.accountabilityClarity !== "clear-single-owner") out.push("Ambiguous or missing ownership cannot be delegated. Name one owner who has accepted it, or keep it with a human.");
    if (order[c.routing.medium] < order[c.routing.high] || order[c.routing.low] < order[c.routing.medium]) out.push("Monotone routing: lower confidence never loosens. Medium must be at least as strict as high, and low at least as strict as medium.");
  }
  if (reachesA(c)) {
    if (p.confidenceMeasurability === "judgment-dependent" || p.regulatoryExposure === "prohibited-from-full-automation") out.push("No Band A where regulation requires human involvement, or where confidence cannot be measured.");
    if (p.regulatoryExposure === "regulated-decision") out.push("A regulated decision reaches Band A only with a written justification, and this matrix has none.");
    if (!row?.authority?.confidence?.calibration) out.push(id === sc.round1.gatedRow
      ? "Band A needs calibrated confidence, and your calibration test passed no threshold at the error target you chose."
      : "Band A needs calibrated confidence. Nobody has calibrated this decision yet.");
    if (p.consequenceScope !== "internal-operational" && !row?.authority?.valueCeiling && !row?.authority?.noValueCeiling) out.push("A row that can act on its own with financial or external consequences states its value limit. This one has none, so Band A would be unbounded.");
  }
  return out;
}

function workflowRulesBroken(matrix: Doc): string[] {
  const m = matrix.oversight?.reviewerLevelMetrics;
  return m?.enabled && !m.approvalRef ? ["Per-reviewer metrics are employee monitoring. Turning them on needs a recorded approval, such as a DPIA."] : [];
}

export function explain(sc: V5Scenario, lint: LintResult, matrix: Doc, policy: Round1Policy): Explained[] {
  const out: Explained[] = [];
  const rowAt = (path: string): { id?: string; row?: Doc } => {
    const m = /^\/rows\/(\d+)/.exec(path);
    const row = m ? (matrix.rows as Doc[])[Number(m[1])] : undefined;
    return { id: sc.round1.decisions.some((d) => d.id === row?.id) ? (row!.id as string) : undefined, row };
  };

  const bySchemaRow = new Map<string, Finding[]>();
  for (const f of lint.findings) {
    if (f.rule === "schema") {
      const key = /^\/rows\/\d+/.exec(f.path)?.[0] ?? "";
      bySchemaRow.set(key, [...(bySchemaRow.get(key) ?? []), f]);
      continue;
    }
    const { id } = rowAt(f.path);
    out.push({ severity: f.severity, ...(id ? { row: id } : {}), text: RULE_TEXT[f.rule] ?? f.message, findings: [f] });
  }
  for (const [key, findings] of bySchemaRow) {
    const { id, row } = rowAt(key);
    const rules = id ? schemaRulesBroken(sc, id, policy, row) : workflowRulesBroken(matrix);
    if (rules.length === 0) out.push({ severity: "error", ...(id ? { row: id } : {}), text: "The matrix doesn't pass its schema here, for a reason the Lab can't put in plain words.", findings });
    else rules.forEach((text, i) => out.push({ severity: "error", ...(id ? { row: id } : {}), text, findings: i === 0 ? findings : [] }));
  }
  return out.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "error" ? -1 : 1));
}
