import { describe, expect, it } from 'vitest';
import { EXAM_PART_COMPONENT_MAP } from '@/lib/routing';
import { inferSkillFromMode, inferModeMetadata } from '@/lib/skill-from-mode';
import { sessionTitle } from '@/lib/session/title';

const MODES = Object.keys(EXAM_PART_COMPONENT_MAP);

describe('route map modes', () => {
  it('covers every family', () => {
    expect(MODES.length).toBeGreaterThanOrEqual(60);
  });

  it.each(MODES)('%s resolves a skill, metadata and a student title', (mode) => {
    expect(inferSkillFromMode(mode)).not.toBeNull();
    const metadata = inferModeMetadata(mode);
    expect(metadata.framework).not.toBeNull();
    expect(metadata.cefr_level).not.toBeNull();
    const title = sessionTitle(mode);
    expect(title).not.toMatch(/^Cambridge /);
    expect(title.length).toBeGreaterThan(0);
  });
});
