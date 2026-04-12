"use client";

import { GameProvider, useGame } from "../lib/game-state";
import { TitleScreen } from "../components/TitleScreen";
import { Briefing } from "../components/Briefing";
import { ConfigBasic } from "../components/ConfigBasic";
import { ConfigMatrix } from "../components/ConfigMatrix";
import { ConfigAudit } from "../components/ConfigAudit";
import { Simulation } from "../components/Simulation";
import { Debrief } from "../components/Debrief";
import { FinalScore } from "../components/FinalScore";

/**
 * Single-page app shell. The game phase in GameContext determines which
 * screen renders. Phases:
 *
 *   title      → TitleScreen
 *   briefing   → Briefing (VAOM intro for the round)
 *   config     → ConfigBasic (R1) | ConfigMatrix (R2)
 *   preEvents  → ConfigAudit (R3 only — drift, audit, escalation)
 *   simulation → Simulation (animated invoice pipeline)
 *   debrief    → Debrief (VAOM analysis + score bar)
 *   final      → FinalScore (profile card + CTAs)
 */

export default function Page() {
  return (
    <GameProvider>
      <Router />
    </GameProvider>
  );
}

function Router() {
  const { state } = useGame();

  switch (state.phase) {
    case "title":
      return <TitleScreen />;
    case "briefing":
      return <Briefing />;
    case "config":
      return state.round === 1 ? <ConfigBasic /> : <ConfigMatrix />;
    case "preEvents":
      return <ConfigAudit />;
    case "simulation":
      return <Simulation />;
    case "debrief":
      return <Debrief />;
    case "final":
      return <FinalScore />;
    default:
      return <TitleScreen />;
  }
}
