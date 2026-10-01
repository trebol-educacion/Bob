import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sources(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('schema bob table names', () => {
  it('no query targets a table with the legacy bob_ prefix', () => {
    const offenders = sources(join(process.cwd(), 'src')).filter((file) =>
      /\.from\(\s*['"]bob_/.test(readFileSync(file, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});
