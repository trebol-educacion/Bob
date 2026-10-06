import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';

const ROOTS = ['actions', 'components', 'hooks', 'lib'].map((dir) => path.resolve(__dirname, '..', dir));
const ALLOWED_SESSION_CREATORS = [
  path.join('lib', 'session', 'lifecycle.ts'),
  path.join('actions', 'sessions.ts'),
];
const FIRE_AND_FORGET = /(?:^|[^\w.])(?:void\s+)?persistMessages?\([\s\S]{0,1500}?\)\s*\.catch\(|void\s+persistMessages?\(/;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return entry === '__tests__' ? [] : walk(full);
    return /\.(ts|tsx)$/.test(entry) && !/\.test\./.test(entry) ? [full] : [];
  });
}

const FILES = ROOTS.flatMap(walk).map((full) => ({
  full,
  relative: path.relative(path.resolve(__dirname, '..'), full),
  source: readFileSync(full, 'utf8'),
}));

describe('session persistence contract', () => {
  it.each(FILES.map((file) => [file.relative, file.source]))('%s has no fire-and-forget persistMessage', (_relative, source) => {
    expect(FIRE_AND_FORGET.test(source)).toBe(false);
  });

  it('createSessionAction is only called from the lifecycle', () => {
    const offenders = FILES.filter(
      (file) =>
        /createSessionAction\(/.test(file.source) &&
        !ALLOWED_SESSION_CREATORS.some((allowed) => file.relative.endsWith(allowed)),
    ).map((file) => file.relative);
    expect(offenders).toEqual([]);
  });
});
