export const HEARTBEAT_INTERVAL_MS = 30_000;
export const INACTIVITY_LIMIT_MS = 2 * 60_000;
export const MAX_SECONDS_PER_TICK = 60;

export interface HeartbeatTickState {
  visible: boolean;
  lastInteractionAt: number;
  now: number;
}

/**
 * @param state HeartbeatTickState
 * @returns boolean
 */
export function isActiveTick(state: HeartbeatTickState): boolean {
  return state.visible && state.now - state.lastInteractionAt <= INACTIVITY_LIMIT_MS;
}

/**
 * @param seconds number
 * @returns number
 */
export function clampSeconds(seconds: number): number {
  return Math.max(0, Math.min(Math.round(seconds), MAX_SECONDS_PER_TICK));
}
