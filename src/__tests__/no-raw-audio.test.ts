import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';

const ROOTS = ['actions', 'app', 'components', 'hooks', 'lib'].map((dir) => path.resolve(__dirname, '..', dir));
const AUDIO_OWNER = path.join('lib', 'audio-clip.ts');
const RAW_AUDIO = /new Audio\(/;
const SILENT_PLAY = /\.play\(\)\s*\.catch\(\s*\(\)\s*=>\s*(?:\{\s*\}|undefined|null)\s*\)/;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return entry === '__tests__' ? [] : walk(full);
    return /\.(ts|tsx)$/.test(entry) && !/\.test\./.test(entry) ? [full] : [];
  });
}

const FILES = ROOTS.flatMap(walk).map((full) => ({
  relative: path.relative(path.resolve(__dirname, '..'), full),
  source: readFileSync(full, 'utf8'),
}));

describe('audio playback contract', () => {
  it('only audio-clip creates HTMLAudioElement instances', () => {
    const offenders = FILES.filter((file) => RAW_AUDIO.test(file.source) && !file.relative.endsWith(AUDIO_OWNER)).map(
      (file) => file.relative,
    );
    expect(offenders).toEqual([]);
  });

  it('no playback failure is swallowed silently', () => {
    const offenders = FILES.filter((file) => SILENT_PLAY.test(file.source)).map((file) => file.relative);
    expect(offenders).toEqual([]);
  });
});
