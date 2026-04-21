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
import { RestartButton } from "../components/RestartButton";

export default function Page() {
  return (
    <GameProvider>
      <Router />
    </GameProvider>
  );
}

function Router() {
  const { state } = useGame();

  return (
    <>
      {state.phase !== "title" && <RestartButton />}
      <Screen phase={state.phase} round={state.round} />
    </>
  );
}

function Screen({ phase, round }: { phase: string; round: number }) {
  switch (phase) {
    case "title":
      return <TitleScreen />;
    case "briefing":
      return <Briefing />;
    case "config":
      return round === 1 ? <ConfigBasic /> : <ConfigMatrix key={phase + round} />;
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
