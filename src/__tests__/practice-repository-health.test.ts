import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isPracticeRepositoryDegraded,
  markPracticeRepositoryDegraded,
  markPracticeRepositoryHealthy,
  resetPracticeRepositoryHealthForTests,
} from '@/lib/practice/repository-health';

describe('practice repository health cache', () => {
  beforeEach(() => {
    resetPracticeRepositoryHealthForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('empieza sana', () => {
    expect(isPracticeRepositoryDegraded()).toBe(false);
  });

  it('marca degradado y lo mantiene hasta expirar el TTL', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    markPracticeRepositoryDegraded();
    expect(isPracticeRepositoryDegraded()).toBe(true);

    vi.setSystemTime(59_000);
    expect(isPracticeRepositoryDegraded()).toBe(true);

    vi.setSystemTime(61_000);
    expect(isPracticeRepositoryDegraded()).toBe(false);
  });

  it('markPracticeRepositoryHealthy limpia el estado degradado', () => {
    markPracticeRepositoryDegraded();
    markPracticeRepositoryHealthy();
    expect(isPracticeRepositoryDegraded()).toBe(false);
  });
});
