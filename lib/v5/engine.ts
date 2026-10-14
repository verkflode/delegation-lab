// SPIKE (v5): the invoice worked example run through the VAOM Guardian core, in the browser, and each
// decision translated to the answer the Guardian would put on the ACS wire.
import { CapLedger, compilePolicy, ContextRegistry, decide, lintMatrix, type Call, type DecisionRecord } from "@verkflode/vaom-guardian-core";
import { toResult } from "@verkflode/vaom-guardian-acs";
import matrix from "../../data/v5/invoice.matrix-0.2.json";
import binding from "../../data/v5/invoice.claude-code.binding.json";
import standard from "../../data/v5/invoice-standard.scoring.json";
import duplicate from "../../data/v5/invoice-duplicate.scoring.json";

export interface SpikeStep {
  label: string;
  call: Call;
  record: DecisionRecord;
  wire: Record<string, unknown>;
}

const approve = (invoice: string, vendor: string, amount: string, po = "PO-4471"): Call => ({
  tool: "mcp__erp__approve_invoice",
  arguments: { invoice_id: invoice, vendor_id: vendor, amount, currency: "EUR", po_number: po },
});

const SCRIPT: { label: string; call: Call }[] = [
  { label: "Read the invoice first (preparatory)", call: { tool: "mcp__erp__get_invoice", arguments: { invoice_id: "INV-1001" } } },
  { label: "Approve €1,200 with a matching PO", call: approve("INV-1001", "V-ACME", "1200") },
  { label: "Approve €7,400: over the €5,000 ceiling", call: approve("INV-1002", "V-NORD", "7400") },
  { label: "Split invoice, part 1 of 3 (€2,000)", call: approve("INV-1003", "V-SPLIT", "2000") },
  { label: "Split invoice, part 2 of 3 (€2,000)", call: approve("INV-1004", "V-SPLIT", "2000") },
  { label: "Split invoice, part 3 of 3 (€2,000)", call: approve("INV-1005", "V-SPLIT", "2000") },
  { label: "Change contract terms: no such tool is bound (absent)", call: { tool: "mcp__erp__update_contract", arguments: { contract_id: "C-9" } } },
  { label: "A tool the binding doesn't know", call: { tool: "mcp__erp__pay_now", arguments: { invoice_id: "INV-1001" } } },
];

export function runSpike(): { lint: ReturnType<typeof lintMatrix>; steps: SpikeStep[]; ms: number } {
  const t0 = performance.now();
  const lint = lintMatrix(matrix);
  const compiled = compilePolicy(matrix, binding, [standard, duplicate]);
  if (!compiled.ok) throw new Error(`the invoice example didn't compile: ${compiled.findings.map((f) => f.message).join("; ")}`);
  const policy = compiled.policy;
  const ledger = new CapLedger();
  ledger.load([]);
  const start = Date.parse("2026-10-14T09:00:00Z");
  const contexts = new ContextRegistry(policy);
  contexts.open({ id: "ctx-1", session: "lab", agent: { id: "ap-agent" }, rows: ["invoice.approve", "invoice.duplicate-anomaly", "contract.modify"] }, start);
  const factKey = new Uint8Array(32).fill(7);
  const steps = SCRIPT.map((s, i) => {
    const ts = new Date(start + (i + 1) * 60_000).toISOString();
    const record = decide(policy, s.call, ledger, { id: `lab-${i + 1}`, ts, agent: { id: "ap-agent" }, session: { id: "lab" }, contexts, factKey });
    const d = record.decision;
    const wire = toResult(
      { outcome: d.outcome, band: d.band, ...(d.approver_role ? { approverRole: d.approver_role } : {}), placements: d.placements, reasons: d.reasons, policy: record.policy },
      { requestId: `req-${i + 1}`, acsVersion: "0.1.0", approvalTimeoutSeconds: 300, deferTimeoutMs: 1000, evaluatorVersion: "lab-spike" },
    );
    return { label: s.label, call: s.call, record, wire };
  });
  return { lint, steps, ms: performance.now() - t0 };
}
