import type { LevelPolicyInput, LevelPolicyResult } from './types';

/**
 * @param input LevelPolicyInput
 * @returns LevelPolicyResult
 */
export function resolveLevelPolicy(input: LevelPolicyInput): LevelPolicyResult {
  const skipPlacement = input.cefrLevelLocked && input.cefrActiveLevel !== null;
  return {
    skipPlacement,
    allowManualSelection: input.testerOverrideEnabled,
  };
}

/**
 * @param envValue string
 * @returns boolean
 */
export function isLevelSelectorTesterEnabled(envValue: string | undefined): boolean {
  return envValue === 'true';
}
