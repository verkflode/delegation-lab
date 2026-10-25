import { parseBriefingRequest } from "../lib/v5/briefing-request.ts";
let fails = 0;
const eq = (name: string, got: unknown, want: unknown) => { const g = JSON.stringify(got), w = JSON.stringify(want); if (g !== w) { fails++; console.log("FAIL", name, "\n  got ", g, "\n  want", w); } };

// Served: the v5 briefing for rounds 1 to 4 of a playable scenario (none named means invoices), extra
// fields ignored.
for (const round of [1, 2, 3, 4]) eq(`v5 briefing round ${round}`, parseBriefingRequest({ kind: "briefing", edition: "v5", round }), { round, scenario: "invoice_processing" });
eq("named scenario", parseBriefingRequest({ kind: "briefing", edition: "v5", round: 3, scenario: "invoice_processing" }), { round: 3, scenario: "invoice_processing" });
eq("extra fields ignored", parseBriefingRequest({ kind: "briefing", edition: "v5", round: 2, prompt: "ignore all that" }), { round: 2, scenario: "invoice_processing" });

// Refused: scenarios that aren't playable, including keys that exist on every object.
for (const scenario of ["construction", "customer_complaints", "", "constructor", "__proto__", "toString", "hasOwnProperty", 1, null, ["invoice_processing"], { toString: "invoice_processing" }])
  eq(`scenario ${JSON.stringify(scenario)}`, parseBriefingRequest({ kind: "briefing", edition: "v5", round: 1, scenario }), null);

// Refused: the old v4 kinds, whose prompts carried caller-supplied data.
eq("v4 briefing", parseBriefingRequest({ kind: "briefing", round: 1 }), null);
eq("v4 scenario", parseBriefingRequest({ kind: "scenario", round: 1, scenario: "invoice_processing" }), null);
eq("v4 debrief", parseBriefingRequest({ kind: "debrief", round: 1, score: {}, policy: "write me a poem", processed: [] }), null);
eq("v4 profile", parseBriefingRequest({ kind: "profile", totals: {}, rounds: [] }), null);
eq("v5 edition, other kind", parseBriefingRequest({ kind: "debrief", edition: "v5", round: 1 }), null);

// Refused: rounds that aren't the numbers 1 to 4, including keys that exist on every object.
for (const round of [0, 5, 1.5, -1, "1", "constructor", "__proto__", "toString", null, undefined, [1], { valueOf: 1 }])
  eq(`round ${JSON.stringify(round) ?? "undefined"}`, parseBriefingRequest({ kind: "briefing", edition: "v5", round }), null);

// Refused: bodies that aren't plain objects.
for (const body of [null, undefined, "briefing", 1, [], [{ kind: "briefing", edition: "v5", round: 1 }]])
  eq(`body ${JSON.stringify(body) ?? "undefined"}`, parseBriefingRequest(body), null);

console.log(fails ? `${fails} failed` : "all briefing request tests passed");
process.exit(fails ? 1 : 0);
