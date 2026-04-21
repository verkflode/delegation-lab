# Delegation Lab

**A flight simulator for AI governance.**

Delegation Lab is an interactive simulation that teaches the [Verkflode Agent Operating Model (VAOM)](https://verkflode.com/vaom) through play. Players take the role of Head of AI Operations at a European enterprise, design delegation policies for AI-powered workflows, and experience the consequences in real time.

Three rounds. Five to seven minutes. One delegation philosophy.

**Live at [verkflode.eu](https://verkflode.eu)**

## How It Works

The game runs in three rounds, each teaching a core VAOM concept:

| Round | Title | What You Learn |
|---|---|---|
| **1** | The Basics | A single confidence threshold isn't a delegation policy. Hidden decisions exist in every workflow. |
| **2** | The Edge Cases | Different decisions need different delegation patterns. Miscalibration has specific, nameable failure modes. |
| **3** | The Audit | The system changes underneath you. Model drift, multi-agent failures, and regulatory audits test whether your design is governance-ready. |

**VAOM** narrates the experience as a sentient framework -- calm, precise, slightly dry. It references your specific decisions by ID, names the anti-patterns you committed, and teaches through consequences rather than lectures. Optionally, VAOM speaks aloud via Azure Speech (MAI-Voice-1).

### Scenario Domains

Players choose from four workflow domains. All teach the same VAOM concepts; the domain provides context:

- **Invoice Processing** -- accounts payable at a financial services firm
- **Customer Complaints** -- retail banking complaint handling
- **AML Triage** -- transaction monitoring alert classification
- **HR Investigation** -- policy violation assessment

### What Gets Taught

- The Delegation Gap (governance vs operational delegation)
- Six named delegation patterns (Prepare & Present through Coordinate & Escalate)
- Five-dimension authority decomposition (reversibility, consequence scope, regulatory exposure, confidence measurability, accountability clarity)
- Composite confidence scoring with adjustable dimension weights
- Five calibration anti-patterns (Review Queue Flood, Confidence Mirage, Exception Graveyard, Stale Threshold, Dimension Collapse)
- Multi-agent failure modes (authority conflicts, cascading confidence erosion, coordination state loss)
- Foundation model drift and the Readiness Assessment

## Architecture

Next.js 16 (App Router) on Vercel. Two API routes proxy external services:

- `/api/claude` -- Claude API (claude-sonnet-4-5) generates dynamic scenarios, personalised debriefs, and the final delegation profile. Falls back to pre-built content if no key is configured.
- `/api/voice` -- Azure Speech API (MAI-Voice-1) synthesises VAOM's spoken narration with SSML emotion control. Falls back to text-only.

**The game is fully playable with zero API keys.** Claude adds personalisation and variety. Voice adds presence and memorability. The core teaching works with neither.

### Stack

- Next.js 16 / React 19 / TypeScript
- Tailwind CSS v4
- Claude API (`@anthropic-ai/sdk`)
- Azure Cognitive Services Speech (MAI-Voice-1)
- Lucide React (icons)
- Deployed on Vercel

## Running Locally

```bash
git clone https://github.com/verkflode/delegation-lab.git
cd delegation-lab
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The game works immediately with no configuration.

### Optional: Enable Claude API

Add an Anthropic API key for dynamic VAOM narration and scenario generation:

```bash
cp .env.example .env.local
# Edit .env.local and add your ANTHROPIC_API_KEY
```

### Optional: Enable Voice

Add Azure Speech credentials for spoken VAOM narration:

```
AZURE_SPEECH_KEY=your-key
AZURE_SPEECH_VOICE=en-US-Steffan:DragonHDLatestNeural
AZURE_SPEECH_REGION=swedencentral
```

## VAOM Framework

The Verkflode Agent Operating Model (VAOM) is an open framework for structuring AI decision authority in enterprise workflows. It defines how AI systems are permitted to act -- separating statistical confidence from organisational authority.

- **Whitepaper:** [verkflode.com/vaom](https://verkflode.com/vaom)
- **License:** CC BY 4.0

## License

This game is open source. The VAOM framework it teaches is published under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) by Verkflode AB.
