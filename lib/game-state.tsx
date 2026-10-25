"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
} from "react";
import type { GamePhase, GameState, RoundNumber, RoundResult, ScenarioDomain } from "./types";
import type { Round1Policy } from "./v5/round1";
import type { GateChoice } from "./v5/round2";
import type { V5Scenario } from "./v5/scenario";
import { SCENARIOS } from "./v5/scenarios";
import type { ReviewChoice } from "./v5/round3";
import type { NightChoice } from "./v5/round4";

/**
 * Game state lives in a single reducer. It is intentionally small: the rounds are pure functions in
 * lib/v5; this only tracks where in the game the player is and what they have chosen so far.
 */

type Action =
  | { type: "start"; scenario?: ScenarioDomain }
  | { type: "advance"; phase: GamePhase }
  | { type: "set_round"; round: RoundNumber }
  | { type: "set_scenario"; domain: ScenarioDomain }
  | { type: "set_v5r1"; policy: Round1Policy }
  | { type: "set_v5r2"; gate: GateChoice }
  | { type: "set_v5r3"; review: ReviewChoice }
  | { type: "set_v5r4"; night: NightChoice }
  | { type: "record_result"; result: RoundResult }
  | { type: "reset" };

const initialState: GameState = {
  phase: "title",
  round: 1,
  scenario: "invoice_processing",
  results: [],
};

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "start":
      return { ...state, phase: "briefing", round: 1, scenario: action.scenario ?? state.scenario };
    case "advance":
      return { ...state, phase: action.phase };
    case "set_round":
      return { ...state, round: action.round };
    case "set_scenario":
      return { ...state, scenario: action.domain };
    case "set_v5r1":
      return { ...state, v5r1: action.policy };
    case "set_v5r2":
      return { ...state, v5r2: action.gate };
    case "set_v5r3":
      return { ...state, v5r3: action.review };
    case "set_v5r4":
      return { ...state, v5r4: action.night };
    case "record_result":
      return { ...state, results: [...state.results, action.result] };
    case "reset":
      return { ...initialState, scenario: state.scenario };
    default:
      return state;
  }
}

type GameContextValue = {
  state: GameState;
  start: (scenario?: ScenarioDomain) => void;
  advance: (phase: GamePhase) => void;
  setRound: (round: RoundNumber) => void;
  setScenario: (domain: ScenarioDomain) => void;
  setV5R1: (policy: Round1Policy) => void;
  setV5R2: (gate: GateChoice) => void;
  setV5R3: (review: ReviewChoice) => void;
  setV5R4: (night: NightChoice) => void;
  recordResult: (result: RoundResult) => void;
  reset: () => void;
};

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const value = useMemo<GameContextValue>(
    () => ({
      state,
      start: (scenario) => dispatch({ type: "start", scenario }),
      advance: (phase) => dispatch({ type: "advance", phase }),
      setRound: (round) => dispatch({ type: "set_round", round }),
      setScenario: (domain) => dispatch({ type: "set_scenario", domain }),
      setV5R1: (policy) => dispatch({ type: "set_v5r1", policy }),
      setV5R2: (gate) => dispatch({ type: "set_v5r2", gate }),
      setV5R3: (review) => dispatch({ type: "set_v5r3", review }),
      setV5R4: (night) => dispatch({ type: "set_v5r4", night }),
      recordResult: (result) => dispatch({ type: "record_result", result }),
      reset: () => dispatch({ type: "reset" }),
    }),
    [state]
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used inside <GameProvider>");
  return ctx;
}

/** The scenario being played: its workflow, calls and words (lib/v5/scenarios). */
export function useScenario(): V5Scenario {
  return SCENARIOS[useGame().state.scenario];
}

/** Convenience hook so screen components don't need to destructure twice. */
export function useAdvance() {
  const { advance } = useGame();
  return useCallback(
    (phase: GamePhase) => {
      advance(phase);
    },
    [advance]
  );
}
