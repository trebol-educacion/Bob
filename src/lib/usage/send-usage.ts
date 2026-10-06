export const USAGE_ENDPOINT = '/api/usage';

/**
 * @param mode string
 * @param seconds number
 * @returns void
 */
export function sendUsage(mode: string, seconds: number): void {
  const body = JSON.stringify({ mode, seconds });
  try {
    const queued =
      typeof navigator !== 'undefined' &&
      typeof navigator.sendBeacon === 'function' &&
      navigator.sendBeacon(USAGE_ENDPOINT, new Blob([body], { type: 'application/json' }));
    if (queued) return;
    void fetch(USAGE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    return;
  }
}
