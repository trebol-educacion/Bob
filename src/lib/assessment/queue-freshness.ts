export const ASSESSMENT_QUEUE_STALE_MINUTES = 15;

/**
 * @param now Date
 * @returns string
 */
export function assessmentQueueFreshSince(now: Date = new Date()): string {
  return new Date(now.getTime() - ASSESSMENT_QUEUE_STALE_MINUTES * 60_000).toISOString();
}
