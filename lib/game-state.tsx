"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
} from "react";
import type {
  FinalProfile,
  GamePhase,
  GameState,
  R1Policy,
  R2Policy,
  R3PreEvents,
  RoundNumber,
  RoundResult,
  ScenarioDomain,
} from "./types";

/**
 * Game state lives in a single reducer. It is intentionally small —
 * the simulation engine and scoring are pure functions in scoring.ts;
 * this only tracks "where in the game am I and what choices has the
 * player made so far?".
 */

type Action =
  | { type: "start"; scenario?: ScenarioDomain }
  | { type: "advance"; phase: GamePhase }
  | { type: "set_round"; round: RoundNumber }
  | { type: "set_scenario"; domain: ScenarioDomain }
  | { type: "set_r1"; policy: R1Policy }
  | { type: "set_r2"; policy: R2Policy }
  | { type: "set_r3"; pre: R3PreEvents }
  | { type: "record_result"; result: RoundResult }
  | { type: "set_profile"; profile: FinalProfile }
  | { type: "reset" };

const initialState: GameState = {
  phase: "title",
  round: 1,
  scenario: "invoice_processing",
  audioMuted: false,
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
    case "set_r1":
      return { ...state, r1: action.policy };
    case "set_r2":
      return { ...state, r2: action.policy };
    case "set_r3":
      return { ...state, r3: action.pre };
    case "record_result":
      return { ...state, results: [...state.results, action.result] };
    case "set_profile":
      return { ...state, profile: action.profile };
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
  setR1: (policy: R1Policy) => void;
  setR2: (policy: R2Policy) => void;
  setR3: (pre: R3PreEvents) => void;
  recordResult: (result: RoundResult) => void;
  setProfile: (profile: FinalProfile) => void;
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
      setR1: (policy) => dispatch({ type: "set_r1", policy }),
      setR2: (policy) => dispatch({ type: "set_r2", policy }),
      setR3: (pre) => dispatch({ type: "set_r3", pre }),
      recordResult: (result) => dispatch({ type: "record_result", result }),
      setProfile: (profile) => dispatch({ type: "set_profile", profile }),
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
