export const ASSESSMENT_QUEUE_STALE_MINUTES = 15;
export const ASSESSMENT_QUEUE_WINDOW_DAYS = 7;

/**
 * @param now Date
 * @returns string
 */
export function assessmentQueueFreshSince(now: Date = new Date()): string {
  return new Date(now.getTime() - ASSESSMENT_QUEUE_STALE_MINUTES * 60_000).toISOString();
}

/**
 * @param now Date
 * @returns string
 */
export function assessmentQueueWindowSince(now: Date = new Date()): string {
  return new Date(now.getTime() - ASSESSMENT_QUEUE_WINDOW_DAYS * 24 * 60 * 60_000).toISOString();
}
