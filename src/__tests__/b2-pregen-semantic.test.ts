import { describe, expect, it, vi } from 'vitest';
import type { Payload } from '../../scripts/b2-pregen/schemas';
import { parsePayload } from '../../scripts/b2-pregen/schemas';
import { reviewPayload } from '../../scripts/b2-pregen/semantic-checks';
import { buildJudgeInput, type JudgeFn } from '../../scripts/b2-pregen/semantic-judge';
import {
  distributionIssues,
  gapNeighbourIssues,
  normalizeTitle,
  ruleIssues,
  titleIssues,
  withContractionVariants,
} from '../../scripts/b2-pregen/semantic-rules';
import { slotOf } from '../../scripts/b2-pregen/variant';

const noContext = { existingTitles: new Set<string>() };

function mcItems(keys: string[], optionLetters = 'ABCD') {
  return keys.map((key, i) => ({
    group_order: i + 1,
    question: `Question ${i + 1}`,
    options: optionLetters.split('').map((k) => ({ key: k, label: `option ${k}` })),
    correct_key: key,
    explanation: 'because',
    metadata: { number: i + 1 },
  }));
}

function group(metadata: Record<string, unknown>, text: string | null = 'Body text.'): Payload['group'] {
  return { stimulus_text: text, metadata };
}

describe('titles', () => {
  it('flags the text that starts with its own title (R3 gen-r3-002)', () => {
    const payload: Payload = {
      group: group({ title: 'The Evolving World of Work' }, 'The Evolving World of Work\n\nThe rapid ___0___ of technology'),
      items: [],
    };
    expect(titleIssues(payload, noContext).join(' ')).toMatch(/starts with its own title/);
  });

  it('flags a title already used by another set', () => {
    const payload: Payload = { group: group({ title: 'The Power of Creative Expression!' }, 'Different start'), items: [] };
    const context = { existingTitles: new Set([normalizeTitle('the power of creative expression')]) };
    expect(titleIssues(payload, context).join(' ')).toMatch(/already used/);
  });

  it('does not apply title uniqueness to key word transformation', () => {
    const payload: Payload = { group: group({ title: 'Key word transformation' }, null), items: [] };
    const context = { existingTitles: new Set([normalizeTitle('Key word transformation')]) };
    expect(ruleIssues('fce_reading_part4', payload, context)).toEqual([]);
  });
});

describe('key distribution', () => {
  it('rejects a Listening Part 4 set where every key is B (gen-l4-002)', () => {
    const payload: Payload = { group: group({}, null), items: mcItems(Array(7).fill('B'), 'ABC') };
    expect(distributionIssues(payload).join(' ')).toMatch(/"B" is used 7 of 7/);
  });

  it('accepts the best possible spread for 7 items over 3 options', () => {
    const payload: Payload = { group: group({}, null), items: mcItems(['A', 'B', 'C', 'A', 'B', 'C', 'A'], 'ABC') };
    expect(distributionIssues(payload)).toEqual([]);
  });

  it('rejects more than 40 percent of one letter in an 8 gap cloze', () => {
    const payload: Payload = { group: group({}), items: mcItems(['C', 'C', 'C', 'C', 'A', 'B', 'D', 'A']) };
    expect(distributionIssues(payload)).toHaveLength(1);
  });

  it('accepts two of each letter in an 8 gap cloze', () => {
    const payload: Payload = { group: group({}), items: mcItems(['A', 'B', 'C', 'D', 'D', 'C', 'B', 'A']) };
    expect(distributionIssues(payload)).toEqual([]);
  });
});

describe('gap neighbours (R4 q26 had us repaint)', () => {
  it('flags the verb repeated later in the sentence', () => {
    const issues = gapNeighbourIssues('The community leader ________ the old youth club building repainted.', ['had us repaint']);
    expect(issues.join(' ')).toMatch(/repainted/);
  });

  it('accepts a clean second sentence', () => {
    expect(gapNeighbourIssues('The new smartphone ________ for me to buy.', ['is too expensive'])).toEqual([]);
  });

  it('flags a word duplicated right before the gap', () => {
    expect(gapNeighbourIssues('She is used to ____ up early.', ['to getting']).join(' ')).toMatch(/precedes/);
  });

  it('is part of the rule set of the part', () => {
    const payload: Payload = {
      group: group({}, null),
      items: [
        {
          group_order: 1,
          question: 'The leader asked us to repaint the building.',
          options: [],
          correct_key: 'had us repaint',
          explanation: 'x',
          metadata: {
            number: 26,
            keyword: 'HAD',
            accepted: ['had us repaint'],
            second_sentence_with_gap: 'The community leader ________ the old youth club building repainted.',
          },
        },
      ],
    };
    expect(ruleIssues('fce_reading_part4', payload, noContext).join(' ')).toMatch(/item 26/);
  });
});

describe('accepted variants', () => {
  it('adds contractions and full forms within the word limit', () => {
    expect(withContractionVariants(["didn't have to"], 5)).toEqual(expect.arrayContaining(["didn't have to", 'did not have to']));
    expect(withContractionVariants(['will not be', 'is'], 5)).toEqual(expect.arrayContaining(["won't be"]));
  });

  it('does not exceed the word limit', () => {
    expect(withContractionVariants(["wasn't allowed to go out"], 5)).toEqual(["wasn't allowed to go out"]);
  });
});

function openPayload(): Payload {
  return {
    group: group({ title: 't' }, 'Stress and ___0___ ___17___ at work.'),
    items: [
      {
        group_order: 1,
        question: '17',
        options: [],
        correct_key: 'pressures',
        explanation: 'x',
        metadata: { number: 17, base_word: 'PRESS', accepted: ['pressures'] },
      },
    ],
  };
}

describe('semantic review with the judge', () => {
  it('merges the singular variant the judge proposes (R3 pressures/pressure)', async () => {
    const judge: JudgeFn = vi.fn().mockResolvedValue([
      { number: 17, key_correct: true, other_correct: [], issue: '', extra_accepted: ['Pressure'] },
    ]);
    const result = await reviewPayload('fce_reading_part3', openPayload(), noContext, judge);
    expect(result.errors).toEqual([]);
    expect(result.payload.items[0].metadata.accepted).toEqual(['pressures', 'pressure']);
  });

  it('rejects a cloze whose key leaves the sentence ungrammatical (R1 tend face)', async () => {
    const judge: JudgeFn = vi.fn().mockResolvedValue([
      { number: 1, key_correct: false, other_correct: ['B'], issue: '"tend face" is missing "to"', extra_accepted: [] },
    ]);
    const payload: Payload = { group: group({ title: 'Cities' }, 'Many people ___1___ face problems.'), items: mcItems(['A']) };
    const result = await reviewPayload('fce_reading_part1', payload, noContext, judge);
    expect(result.errors.join(' ')).toMatch(/item 1: the answer key is not correct/);
  });

  it('rejects a multiple-choice item with a second correct option', async () => {
    const judge: JudgeFn = vi.fn().mockResolvedValue([
      { number: 1, key_correct: true, other_correct: ['C'], issue: 'C is also supported', extra_accepted: [] },
    ]);
    const payload: Payload = { group: group({ title: 'T' }, 'Text'), items: mcItems(['A']) };
    const result = await reviewPayload('fce_reading_part5', payload, noContext, judge);
    expect(result.errors.join(' ')).toMatch(/ONLY correct answer/);
  });

  it('rejects when the judge skips an item', async () => {
    const judge: JudgeFn = vi.fn().mockResolvedValue([]);
    const result = await reviewPayload('fce_reading_part3', openPayload(), noContext, judge);
    expect(result.errors.join(' ')).toMatch(/did not return a verdict/);
  });

  it('runs only the deterministic rules without a judge', async () => {
    const payload: Payload = { group: group({}, null), items: mcItems(Array(7).fill('B'), 'ABC') };
    const result = await reviewPayload('fce_listening_part4', payload, noContext, null);
    expect(result.errors).toHaveLength(1);
  });

  it('sends the judge only the data it needs', () => {
    const input = buildJudgeInput('fce_reading_part3', openPayload()) as { items: Record<string, unknown>[] };
    expect(input.items[0]).toMatchObject({ number: 17, claimed: 'pressures', base_word: 'PRESS' });
  });
});

describe('new parts', () => {
  const part1 = {
    group: group({ topic: 'x', questions: ['Where are you from?', 'What do you do in your free time?', 'Do you like cooking?'] }, null),
    items: [],
  };

  it('accepts 3 or 4 distinct questions for Speaking Part 1', () => {
    expect(parsePayload('fce_speaking_part1', part1).ok).toBe(true);
  });

  it('rejects statements and duplicates', () => {
    const bad = { group: group({ topic: 'x', questions: ['Tell me about your town.', 'Where are you from?', 'Where are you from?'] }, null), items: [] };
    const parsed = parsePayload('fce_speaking_part1', bad);
    expect(parsed.ok).toBe(false);
  });

  it('requires people in the Speaking Part 2 scenes', () => {
    const scene = 'A quiet mountain landscape at sunrise with fog over the valley and pine trees along the river bank in autumn.';
    const bad = { group: group({ comparison_question: 'Why?', scene_prompt_a: scene, scene_prompt_b: `${scene} again` }, null), items: [] };
    const parsed = parsePayload('fce_speaking_part2', bad);
    expect(parsed.ok).toBe(false);
  });

  it('extracts the slot number from a variant id', () => {
    expect(slotOf('gen-r4-012')).toBe(12);
    expect(slotOf('gen-l1-003-q4')).toBe(3);
  });
});
