import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(process.cwd(), 'src/components');

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return tsxFiles(path);
    return path.endsWith('.tsx') ? [path] : [];
  });
}

function celebrationBlocks(source: string): string[] {
  const blocks: string[] = [];
  let from = source.indexOf('<CelebrationCard');
  while (from >= 0) {
    const end = source.indexOf('/>', from);
    blocks.push(source.slice(from, end));
    from = source.indexOf('<CelebrationCard', end);
  }
  return blocks;
}

describe('CelebrationCard feedback', () => {
  it('never receives a fixed message that could contradict the score', () => {
    const offenders = tsxFiles(ROOT).filter((file) =>
      celebrationBlocks(readFileSync(file, 'utf8')).some(
        (block) => /feedback="/.test(block) || /celebrationFeedback/.test(block),
      ),
    );
    expect(offenders).toEqual([]);
  });
});
