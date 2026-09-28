export type PlacementLevel = 'a2' | 'b1' | 'b2';

export const PLACEMENT_LEVELS: readonly PlacementLevel[] = ['a2', 'b1', 'b2'];

export interface PlacementConfig {
  levels: readonly PlacementLevel[];
  groupsPerLevel: number;
  passThreshold: number;
  failsToStop: number;
}

export interface PlacementGroupOutcome {
  level: PlacementLevel;
  correct: number;
  total: number;
}

export interface PlacementEngineState {
  outcomes: readonly PlacementGroupOutcome[];
}

export type PlacementStepDecision =
  | { done: false; nextLevel: PlacementLevel; groupIndex: number }
  | { done: true; resultLevel: PlacementLevel | null };
