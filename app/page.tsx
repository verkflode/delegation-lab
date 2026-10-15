"use client";

import { useEffect } from "react";
import { GameProvider, isV5Round, useGame } from "../lib/game-state";
import { clearNarration, prefetchBriefing } from "../lib/v5/narration";
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
import { BatchRun } from "../components/v5/BatchRun";
import { GateBuilder } from "../components/v5/GateBuilder";
import { ReviewSetup } from "../components/v5/ReviewSetup";
import { ReviewShift } from "../components/v5/ReviewShift";
import { NightSetup } from "../components/v5/NightSetup";
import { NightRun } from "../components/v5/NightRun";

export default function Page() {
  return (
    <GameProvider>
      <Router />
    </GameProvider>
  );
}

function Router() {
  const { state } = useGame();
  const v5 = isV5Round(state.round, state.scenario);

  // v5 briefings are fetched ahead of the screen that shows them (lib/v5/narration.ts).
  useEffect(() => {
    if (state.phase === "title") clearNarration();
    if (!v5) return;
    if (state.phase === "briefing" && state.round === 1) prefetchBriefing(1);
    if (state.phase === "debrief" && state.round < 4) prefetchBriefing((state.round + 1) as 2 | 3 | 4);
  }, [state.phase, state.round, v5]);

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
      if (v5) return round === 4 ? <NightSetup /> : round === 3 ? <ReviewSetup /> : round === 2 ? <GateBuilder /> : <MatrixBuilder />;
      if (round === 1) return <ConfigBasic />;
      if (round === 4) return <ConfigSwarm />;
      return <ConfigMatrix key={phase + round} />;
    case "preEvents":
      return <ConfigAudit />;
    case "simulation":
      return v5 ? (round === 4 ? <NightRun /> : round === 3 ? <ReviewShift /> : <BatchRun />) : <Simulation />;
    case "debrief":
      return <Debrief />;
    case "final":
      return <FinalScore />;
    default:
      return <TitleScreen />;
  }
}
