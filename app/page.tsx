"use client";

import { GameProvider, isV5Round, useGame } from "../lib/game-state";
import { TitleScreen } from "../components/TitleScreen";
import { Briefing } from "../components/Briefing";
import { ConfigBasic } from "../components/ConfigBasic";
import { ConfigMatrix } from "../components/ConfigMatrix";
import { ConfigAudit } from "../components/ConfigAudit";
import { ConfigSwarm } from "../components/ConfigSwarm";
import { Simulation } from "../components/Simulation";
import { Debrief } from "../components/Debrief";
import { FinalScore } from "../components/FinalScore";
import { RestartButton } from "../components/RestartButton";
import { MatrixBuilder } from "../components/v5/MatrixBuilder";
import { Round1Run } from "../components/v5/Round1Run";

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
      <Screen phase={state.phase} round={state.round} v5={isV5Round(state.round, state.scenario)} />
    </>
  );
}

function Screen({ phase, round, v5 }: { phase: string; round: number; v5: boolean }) {
  switch (phase) {
    case "title":
      return <TitleScreen />;
    case "briefing":
      return <Briefing />;
    case "config":
      if (v5) return <MatrixBuilder />;
      if (round === 1) return <ConfigBasic />;
      if (round === 4) return <ConfigSwarm />;
      return <ConfigMatrix key={phase + round} />;
    case "preEvents":
      return <ConfigAudit />;
    case "simulation":
      return v5 ? <Round1Run /> : <Simulation />;
    case "debrief":
      return <Debrief />;
    case "final":
      return <FinalScore />;
    default:
      return <TitleScreen />;
  }
}
