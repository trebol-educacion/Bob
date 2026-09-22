import type {
  PlacementConfig,
  PlacementEngineState,
  PlacementGroupOutcome,
  PlacementLevel,
  PlacementStepDecision,
} from './types';

/**
 * @param outcome PlacementGroupOutcome
 * @param passThreshold number
 * @returns boolean
 */
function isGroupPassed(outcome: PlacementGroupOutcome, passThreshold: number): boolean {
  if (outcome.total <= 0) return false;
  return outcome.correct / outcome.total >= passThreshold;
}

/**
 * @param outcomes readonly PlacementGroupOutcome[]
 * @param level PlacementLevel
 * @returns PlacementGroupOutcome[]
 */
function outcomesAtLevel(
  outcomes: readonly PlacementGroupOutcome[],
  level: PlacementLevel
): PlacementGroupOutcome[] {
  return outcomes.filter((outcome) => outcome.level === level);
}

/**
 * @param outcomes readonly PlacementGroupOutcome[]
 * @param passThreshold number
 * @returns number
 */
function countFails(outcomes: readonly PlacementGroupOutcome[], passThreshold: number): number {
  return outcomes.filter((outcome) => !isGroupPassed(outcome, passThreshold)).length;
}

/**
 * @param state PlacementEngineState
 * @param config PlacementConfig
 * @returns PlacementStepDecision
 */
export function nextPlacementStep(
  state: PlacementEngineState,
  config: PlacementConfig
): PlacementStepDecision {
  let lastPassedLevel: PlacementLevel | null = null;

  for (const level of config.levels) {
    const levelOutcomes = outcomesAtLevel(state.outcomes, level);
    const fails = countFails(levelOutcomes, config.passThreshold);

    if (fails >= config.failsToStop) {
      return { done: true, resultLevel: lastPassedLevel };
    }

    if (levelOutcomes.length < config.groupsPerLevel) {
      return { done: false, nextLevel: level, groupIndex: levelOutcomes.length };
    }

    lastPassedLevel = level;
  }

  return { done: true, resultLevel: lastPassedLevel };
}
