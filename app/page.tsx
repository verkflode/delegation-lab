"use client";

import { useEffect } from "react";
import { GameProvider, useGame } from "../lib/game-state";
import { clearNarration, prefetchBriefing } from "../lib/v5/narration";
import { pageview, track } from "../lib/analytics";
import { TitleScreen } from "../components/TitleScreen";
import { Briefing } from "../components/Briefing";
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

  // How far visits get, for the Lab's analytics (lib/analytics.ts): a virtual page per stage (each round from
  // its briefing, and the final screen), plus a start, each round finished, and the end as events.
  useEffect(() => {
    if (state.phase === "briefing") pageview(`/play/round-${state.round}`, `Round ${state.round}`);
    if (state.phase === "final") pageview("/play/final", "Final");
    if (state.phase === "briefing" && state.round === 1) track("game-start", { scenario: state.scenario });
    if (state.phase === "debrief") track("round-done", { round: state.round, scenario: state.scenario });
    if (state.phase === "final") track("game-complete", { scenario: state.scenario });
  }, [state.phase, state.round, state.scenario]);

  // v5 briefings are fetched ahead of the screen that shows them (lib/v5/narration.ts).
  useEffect(() => {
    if (state.phase === "title") clearNarration();
    if (state.phase === "briefing" && state.round === 1) prefetchBriefing(1);
    if (state.phase === "debrief" && state.round < 4) prefetchBriefing((state.round + 1) as 2 | 3 | 4);
  }, [state.phase, state.round]);

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
      return round === 4 ? <NightSetup /> : round === 3 ? <ReviewSetup /> : round === 2 ? <GateBuilder /> : <MatrixBuilder />;
    case "simulation":
      return round === 4 ? <NightRun /> : round === 3 ? <ReviewShift /> : <BatchRun />;
    case "debrief":
      return <Debrief />;
    case "final":
      return <FinalScore />;
    default:
      return <TitleScreen />;
  }
}
