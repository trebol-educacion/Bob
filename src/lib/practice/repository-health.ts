const DEGRADED_TTL_MS = 60_000;

let degradedSince: number | null = null;

/** @returns boolean */
export function isPracticeRepositoryDegraded(): boolean {
  if (degradedSince === null) return false;
  if (Date.now() - degradedSince > DEGRADED_TTL_MS) {
    degradedSince = null;
    return false;
  }
  return true;
}

export function markPracticeRepositoryDegraded(): void {
  degradedSince = Date.now();
}

export function markPracticeRepositoryHealthy(): void {
  degradedSince = null;
}

export function resetPracticeRepositoryHealthForTests(): void {
  degradedSince = null;
}
