import { describe, it, expect } from 'vitest';
import { normalizeYlRaw, ylPlanIssues } from '@/lib/bank-plans/yl-plan';
import { pointingCorrectReaction, pointingWrongReaction, spokenTexts } from '@/lib/yl/spoken-texts';

const POINTING_RAW = {
  options: ['cat', 'dog', 'pen', 'bed'],
  option_image_prompts: ['a', 'b', 'c', 'd'],
  cues: [0, 1, 2, 3].map((i) => ({ text: `Point to the ${['cat', 'dog', 'pen', 'bed'][i]}.`, target_index: i })),
};

describe('YL raw plans are normalized to the shape the activities consume', () => {
  it('starters part 1 keeps pointing cues, options and one image prompt per option', () => {
    const plan = normalizeYlRaw('starters_part1', POINTING_RAW);
    expect(plan.cues).toHaveLength(4);
    expect(plan.image_prompts).toEqual(['a', 'b', 'c', 'd']);
    expect(ylPlanIssues('starters_part1', plan)).toEqual([]);
  });

  it('starters part 2 maps questions to cues and the scene to one image', () => {
    const plan = normalizeYlRaw('starters_part2', { scene_description: 's', image_prompt: 'p', questions: ['What colour?', 'How many?', 'Where?'] });
    expect(plan.cues).toHaveLength(3);
    expect(plan.image_prompts).toEqual(['p']);
  });

  it('movers part 2 maps difference cues and builds a scene prompt', () => {
    const plan = normalizeYlRaw('movers_part2', { scene_description: 'park', scene_a_description: 'a ball', differences: [{ cue: 'c1' }, { cue: 'c2' }] });
    expect(plan.cues).toEqual(['c1', 'c2']);
    expect(plan.image_prompts).toEqual(['park a ball']);
  });

  it('reports a pointing plan whose cues do not cover the four options', () => {
    const plan = normalizeYlRaw('starters_part1', { ...POINTING_RAW, cues: POINTING_RAW.cues.map((c) => ({ ...c, target_index: 0 })) });
    expect(ylPlanIssues('starters_part1', plan).length).toBeGreaterThan(0);
  });

  it('rejects an unknown part', () => {
    expect(() => normalizeYlRaw('starters_part9', {})).toThrow();
  });
});

describe('spoken texts cover what Bob says without waiting for a live TTS call', () => {
  it('includes every pointing cue and the correct and wrong reactions', () => {
    const plan = normalizeYlRaw('starters_part1', POINTING_RAW);
    const texts = spokenTexts('starters_part1', plan);
    expect(texts).toContain('Point to the cat.');
    expect(texts).toContain(pointingCorrectReaction('cat'));
    expect(texts).toContain(pointingWrongReaction('dog', 'cat'));
    expect(texts).toHaveLength(4 + 4 + 12);
  });
});
