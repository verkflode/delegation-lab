# Delegation Lab

**A flight simulator for AI governance.**

Delegation Lab teaches the [Verkflöde Agent Operating Model (VAOM)](https://vaom.ai) by play. You are the
new Head of AI Operations. The board has approved an AI agent for a live workflow, and before it acts
you write its delegation matrix: which decisions it may take, in which band, under which limits, and who
answers for each. Then you run the workflow and live with the consequences, including a night shift
you sleep through.

Four rounds. About ten minutes. One delegation design, tested at 2 a.m.

**Play it at [lab.vaom.ai](https://lab.vaom.ai).**

## Every decision is the Guardian's

The game doesn't simulate a policy engine. Every call the agent makes is decided by the
[VAOM Guardian](https://github.com/verkflode/vaom-guardian), a reference implementation of VAOM 5.0 as an
OWASP Agent Control Standard (ACS) Guardian, running in your browser against the matrix you wrote:

- your matrix is a real `vaom.matrix/0.2` document, and the Guardian's linter decides whether it runs;
- each tool call goes through the Guardian's `decide()`, and the screen shows the answer an agent host
  would receive on the ACS wire;
- review, seeded errors, sub-agent chains, boundary probes and circuit breakers are the Guardian's own
  mechanisms, and the final scorecard is the Guardian's `scorecard()` over every decision record;
- at the end you can save the files a Guardian would enforce (matrix, binding, scoring policies, seeds and
  a config), checked the way the Guardian checks them on startup, and verify them with the Guardian's CLI.

The game is honest about strength. A Guardian refusal is policy: it holds because the Guardian holds.
Only a capability the agent doesn't have is stronger, and a boundary counts at the strength a probe last
showed it to have. The night round is about telling the two apart.

## The rounds

| Round | | What it teaches |
|---|---|---|
| **1** | **The Matrix** | Decision inventory and authority decomposition: the workflow hides decisions inside the obvious one, and what the matrix doesn't name, the Guardian can't place. |
| **2** | **The Gate** | Calibrated thresholds (the threshold for Band A is the output of a calibration test at your error target, not a setting), value ceilings, cumulative caps and independent checks. |
| **3** | **The Reviewer** | Funded and effective oversight. You work the Band B queue yourself against a clock; planted cases with known errors test whether review catches anything, where the matrix allows them. |
| **4** | **The 2 A.M. Test** | Sub-agent chains and attenuation, boundary verification, and circuit breakers, on a night with an injected instruction and a tool that slipped into the agent's manifest. |

## The scenarios

Each scenario is one of the VAOM 5.0 whitepaper's worked examples, built on the Guardian's published
example matrix, binding and scoring policies for it.

| Scenario | Worked example | What makes it different |
|---|---|---|
| **Invoice processing** | 7 | Accounts payable: a value ceiling and a per-vendor cap, with a duplicate flag and a contract change hiding inside approval. |
| **Incident remediation** | 7D | A SaaS provider's agent restarting services. A restart carries no amount, so its bounds are restrictions, a pre-flight check and a cap on restarts per service. |
| **AML triage** | 7B | A regulated decision. The reporting threshold and the overrides for politically exposed persons and sanctions are the law's, not yours, and planted cases are forbidden because the records feed regulatory reporting. |
| **Delegated purchasing** | 7E | Re-ordering supplies under a monthly mandate: a per-order ceiling, the mandate as a cumulative cap, and a supplier decision hiding inside a better price. |

## VAOM's voice

VAOM narrates the game: calm, precise, slightly dry. A language model writes the round briefings, from a
fixed prompt per scenario and round; nothing about the player or their game is sent to it. The debriefs
and the final profile are scripted from what the Guardian decided, because a teaching game can't afford a
model that misstates a governance concept. Without a model key the briefings are scripted too, and the
game is fully playable.

The live Lab uses Mistral through its EU endpoint. Voice narration exists in the code but is switched off
until it is ready.

## Running locally

Requires Node.js 22.

```bash
git clone https://github.com/verkflode/delegation-lab.git
cd delegation-lab
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The game works with no configuration.

### Configuration

Copy `.env.example` to `.env.local` and set what you need. Everything is optional.

| Variable | What it does |
|---|---|
| `LLM_PROVIDER` | `anthropic` (default) or `mistral`: which model writes the briefings. |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Key and model for Anthropic. |
| `MISTRAL_API_KEY`, `MISTRAL_MODEL`, `MISTRAL_BASE_URL` | Key, model and endpoint for Mistral (for example `https://api.eu.mistral.ai`). |
| `CLAUDE_RATE_PER_MINUTE`, `CLAUDE_RATE_PER_HOUR`, `CLAUDE_RATE_GLOBAL_PER_HOUR` | Rate limits on the briefing endpoint, per IP and overall. |
| `NEXT_PUBLIC_VOICE` | `1` at build time shows the experimental voice narration. |

`/api/claude` serves exactly one request, a round briefing (`lib/v5/briefing-request.ts`). It keeps its old
name because the client calls it; the model provider is a setting.

## Tests

```bash
npm test
```

The heart of it is the golden replay (`tests/golden.test.mts`): three scripted games per scenario (naive,
careful and mixed), with every output the engine gives the screens pinned in
`tests/golden/<scenario id>.json`. A change to the engine that changes nothing a player sees leaves those
files byte-identical. After a change that is meant to alter the game, rewrite them with
`GOLDEN=update npm test` and read the diff.

## How it's built

Next.js 16, React 19, TypeScript and Tailwind CSS 4.

| Path | What's there |
|---|---|
| `lib/v5/round*.ts` | The four rounds: VAOM's mechanics on the Guardian core, the same for every scenario. |
| `lib/v5/scenario.ts` | What a scenario gives the rounds. |
| `lib/v5/scenarios/` | One file per scenario (its decisions, batches, planted cases, night script and words), and the registry. |
| `data/v5/` | The Guardian's published example matrices, bindings and scoring policies the scenarios are built on. |
| `vendor/vaom-guardian/` | The Guardian's pure core and its ACS translation, vendored at a pinned commit (`scripts/vendor-guardian.mjs`, see `VENDORED.md`). |
| `components/v5/` | The round screens. |
| `app/` | Pages, the briefing endpoint and the privacy page. |

The live Lab runs as a container (`Dockerfile`, Next.js standalone output) on a server in France, behind
Cloudflare. It counts visits with self-hosted, cookieless analytics: see the
[privacy page](https://lab.vaom.ai/privacy).

### Adding a scenario

A scenario is a file in `lib/v5/scenarios/` plus its example documents in `data/v5/`, listed in
`lib/v5/scenarios/index.ts`. Write round 1 first and run it, naive and careful, before writing any words:
a naive design should let something risky through, and a careful one should not. Tune the calibration
sample so different error targets give different thresholds, check that planted cases reach the reviewer's
queue, add three games to the golden replay, and play it through.

## The framework

The Verkflöde Agent Operating Model (VAOM) is an open framework for structuring AI decision authority in
enterprise workflows: it separates statistical confidence from institutional authority. The whitepaper is
at [vaom.ai](https://vaom.ai), published by Verkflöde AB under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

## Licence

Apache-2.0: see `LICENSE` and `NOTICE`. The vendored VAOM Guardian code in `vendor/vaom-guardian/` and the
example documents in `data/v5/` come from the [VAOM Guardian](https://github.com/verkflode/vaom-guardian),
also Apache-2.0. The VAOM framework the game teaches is CC BY 4.0.
