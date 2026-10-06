import { describe, expect, it } from 'vitest';
import { attachPresentation, presentationKey, type RawPresentationRow } from '@/lib/organization/presentation';
import { getModeBadge, getModeDescription, getModeIcon, getModeTitle } from '@/lib/mode-ui';
import type { DynamicCard } from '@/lib/types/practice';

const card = (examPart: string, cefr: DynamicCard['cefr_level'], framework = 'cambridge'): DynamicCard => ({
  framework,
  exam_part: examPart,
  cefr_level: cefr,
  label: 'Internal label',
  description: 'Pre-generated as JSON group + items.',
  mode_key: `${framework}_${examPart}`,
  status: 'enabled',
  skill: 'reading',
});

const row = (examPart: string, cefr: string, overrides: Partial<RawPresentationRow> = {}): RawPresentationRow => ({
  framework: 'cambridge',
  exam_part: examPart,
  cefr_level: cefr,
  student_title: 'Open Cloze',
  student_description: 'Read a text and write the missing word in each gap.',
  minutes: 8,
  icon_key: 'PenLine',
  rules: {},
  ...overrides,
});

describe('catalog presentation', () => {
  it('keys a null level as empty', () => {
    expect(presentationKey('generic', 'conversation', null)).toBe('generic|conversation|');
  });

  it('student-facing title, description, minutes and icon come from the presentation row', () => {
    const [attached] = attachPresentation([card('fce_reading_part2', 'b2')], [row('fce_reading_part2', 'b2')]);
    expect(getModeTitle(attached)).toBe('Open Cloze');
    expect(getModeDescription(attached)).not.toMatch(/JSON/);
    expect(getModeBadge(attached)).toBe('B2 · 8 min');
    expect(getModeIcon(attached)).toBe('PenLine');
  });

  it('parts of the same skill can have different icons and minutes', () => {
    const cards = attachPresentation(
      [card('fce_reading_part2', 'b2'), card('fce_reading_part5', 'b2')],
      [row('fce_reading_part2', 'b2'), row('fce_reading_part5', 'b2', { icon_key: 'BookOpen', minutes: 15 })],
    );
    expect(cards.map(getModeIcon)).toEqual(['PenLine', 'BookOpen']);
    expect(cards.map(getModeBadge)).toEqual(['B2 · 8 min', 'B2 · 15 min']);
  });

  it('a generic card without level matches the row with empty level', () => {
    const [attached] = attachPresentation(
      [card('conversation', null, 'generic')],
      [row('conversation', '', { framework: 'generic', student_title: 'Conversation' })],
    );
    expect(getModeTitle(attached)).toBe('Conversation');
  });

  it('falls back to the prompt label when no row exists', () => {
    const [attached] = attachPresentation([card('fce_reading_part9', 'b2')], []);
    expect(attached.presentation).toBeUndefined();
    expect(getModeTitle(attached)).toBe('Internal label');
  });

  it('parses the repeat-options rule', () => {
    const [attached] = attachPresentation(
      [card('fce_reading_part6', 'b2')],
      [row('fce_reading_part6', 'b2', { rules: { allowRepeatOptions: false } })],
    );
    expect(attached.presentation?.rules.allowRepeatOptions).toBe(false);
  });
});
