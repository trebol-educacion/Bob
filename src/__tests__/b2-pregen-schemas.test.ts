import { describe, expect, it } from 'vitest';
import { parsePayload } from '../../scripts/b2-pregen/schemas';
import { audioPath, itemVariantId, variantId } from '../../scripts/b2-pregen/variant';
import { countWords, gapNumbers } from '../../scripts/b2-pregen/text';

const words = (n: number, prefix = 'w') => Array.from({ length: n }, (_, i) => `${prefix}${i}`).join(' ');
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

function gappedText(numbers: number[], total: number): string {
  const markers = numbers.map((n) => `___${n}___`).join(' ');
  return `${markers} ${words(total)}`;
}

function openItems(start: number, count: number, extra: Record<string, unknown> = {}) {
  return range(start, start + count - 1).map((n, i) => ({
    group_order: i + 1,
    question: String(n),
    options: [],
    correct_key: 'which',
    explanation: 'x',
    metadata: { number: n, accepted: ['which', 'that'], ...extra },
  }));
}

const r2 = () => ({
  group: { stimulus_text: gappedText([0, ...range(9, 16)], 160), metadata: { title: 't' } },
  items: openItems(9, 8),
});

describe('variant ids', () => {
  it('is deterministic and zero padded', () => {
    expect(variantId('fce_reading_part2', 3)).toBe('gen-r2-003');
    expect(variantId('fce_reading_part2', 3)).toBe(variantId('fce_reading_part2', 3));
    expect(itemVariantId('gen-r2-003', 4)).toBe('gen-r2-003-q4');
  });
  it('differs across parts and slots', () => {
    expect(variantId('fce_listening_part4', 1)).not.toBe(variantId('fce_listening_part3', 1));
    expect(variantId('fce_reading_part5', 1)).not.toBe(variantId('fce_reading_part5', 2));
  });
  it('rejects unknown parts', () => {
    expect(() => variantId('nope', 1)).toThrow();
  });
  it('builds bucket relative audio paths', () => {
    expect(audioPath('fce_listening_part3', 'gen-l3-001', 's2')).toBe('/fce-listening-part3/gen-l3-001-s2.wav');
  });
});

describe('text helpers', () => {
  it('ignores gap markers when counting words', () => {
    expect(countWords('one ___9___ two')).toBe(2);
    expect(gapNumbers('a ___0___ b ___9___')).toEqual([0, 9]);
  });
});

describe('Reading P2', () => {
  it('accepts a valid payload', () => {
    expect(parsePayload('fce_reading_part2', r2()).ok).toBe(true);
  });
  it('rejects missing accepted[]', () => {
    const p = r2();
    p.items[0].metadata = { number: 9 };
    const r = parsePayload('fce_reading_part2', p);
    expect(r.ok).toBe(false);
  });
  it('rejects accepted without correct_key', () => {
    const p = r2();
    p.items[2].metadata = { number: 11, accepted: ['that'] };
    expect(parsePayload('fce_reading_part2', p).ok).toBe(false);
  });
  it('rejects wrong number of gaps', () => {
    const p = r2();
    p.items.pop();
    expect(parsePayload('fce_reading_part2', p).ok).toBe(false);
  });
  it('rejects text outside the word range', () => {
    const p = r2();
    p.group.stimulus_text = gappedText([0, ...range(9, 16)], 60);
    expect(parsePayload('fce_reading_part2', p).ok).toBe(false);
  });
});

describe('Reading P3', () => {
  it('requires base_word in capitals', () => {
    const items = openItems(17, 8, { base_word: 'happy' });
    const p = { group: { stimulus_text: gappedText([0, ...range(17, 24)], 160), metadata: {} }, items };
    expect(parsePayload('fce_reading_part3', p).ok).toBe(false);
    const ok = { ...p, items: openItems(17, 8, { base_word: 'HAPPY' }) };
    expect(parsePayload('fce_reading_part3', ok).ok).toBe(true);
  });
});

describe('Reading P4', () => {
  const item = (n: number, key: string, accepted: string[]) => ({
    group_order: n - 24,
    question: 'q',
    options: [],
    correct_key: key,
    explanation: 'x',
    metadata: { number: n, keyword: 'BLAME', second_sentence_with_gap: 'He ________ it.', accepted },
  });
  const build = (key: string, accepted: string[]) => ({
    group: { stimulus_text: null, metadata: {} },
    items: range(25, 30).map((n) => item(n, key, accepted)),
  });
  it('accepts 2-5 words including the keyword', () => {
    expect(parsePayload('fce_reading_part4', build('was to blame', ['was to blame'])).ok).toBe(true);
  });
  it('rejects answers without the keyword or too long', () => {
    expect(parsePayload('fce_reading_part4', build('was guilty', ['was guilty'])).ok).toBe(false);
    expect(parsePayload('fce_reading_part4', build('was to blame for it all', ['was to blame for it all'])).ok).toBe(false);
  });
});

describe('Reading P5', () => {
  const opts = ['A', 'B', 'C', 'D'].map((key) => ({ key, label: key }));
  const items = range(31, 36).map((n, i) => ({
    group_order: i + 1,
    question: 'q',
    options: opts,
    correct_key: 'C',
    explanation: 'x',
    metadata: { number: n },
  }));
  it('checks length 550-650', () => {
    expect(parsePayload('fce_reading_part5', { group: { stimulus_text: words(600), metadata: {} }, items }).ok).toBe(true);
    expect(parsePayload('fce_reading_part5', { group: { stimulus_text: words(400), metadata: {} }, items }).ok).toBe(false);
  });
});

describe('Reading P6', () => {
  const shared = 'ABCDEFG'.split('').map((key) => ({ key, label: key }));
  const build = (extra: string) => ({
    group: {
      stimulus_text: gappedText(range(37, 42), 540),
      metadata: { extra_key: extra, shared_options: shared },
    },
    items: range(37, 42).map((n, i) => ({
      group_order: i + 1,
      question: String(n),
      options: [],
      correct_key: 'ABCDEF'[i],
      explanation: 'x',
      metadata: { number: n },
    })),
  });
  it('accepts one spare sentence', () => {
    expect(parsePayload('fce_reading_part6', build('G')).ok).toBe(true);
  });
  it('rejects an extra_key that a gap uses', () => {
    expect(parsePayload('fce_reading_part6', build('A')).ok).toBe(false);
  });
});

describe('Reading P7', () => {
  const sections = (n: number) => 'ABCD'.split('').map((key) => ({ key, label: key, text: words(n) }));
  const build = (n: number) => ({
    group: {
      stimulus_text: null,
      metadata: { sections: sections(n), shared_options: 'ABCD'.split('').map((key) => ({ key, label: key })) },
    },
    items: range(43, 52).map((num, i) => ({
      group_order: i + 1,
      question: 's',
      options: [],
      correct_key: 'ABCD'[i % 4],
      explanation: 'x',
      metadata: { number: num },
    })),
  });
  it('checks each section length', () => {
    expect(parsePayload('fce_reading_part7', build(135)).ok).toBe(true);
    expect(parsePayload('fce_reading_part7', build(80)).ok).toBe(false);
  });
});

describe('Listening', () => {
  it('L1 needs a null group, 8 items and clip length', () => {
    const items = range(1, 8).map((n, i) => ({
      group_order: null,
      question: 'q',
      options: 'ABC'.split('').map((key) => ({ key, label: key })),
      correct_key: 'ABC'[i % 3],
      explanation: 'x',
      transcript: words(80),
      metadata: { number: n },
    }));
    expect(parsePayload('fce_listening_part1', { group: null, items }).ok).toBe(true);
    expect(parsePayload('fce_listening_part1', { group: null, items: items.slice(0, 7) }).ok).toBe(false);
  });

  it('L2 requires the answer to appear in the transcript', () => {
    const transcript = `${words(440)} which`;
    const items = range(9, 18).map((n, i) => ({
      group_order: i + 1,
      question: `gap ___${n}___`,
      options: [],
      correct_key: 'which',
      explanation: 'x',
      metadata: { number: n, accepted: ['which'] },
    }));
    const group = (t: string) => ({ stimulus_text: null, metadata: { transcript: t } });
    expect(parsePayload('fce_listening_part2', { group: group(transcript), items }).ok).toBe(true);
    expect(parsePayload('fce_listening_part2', { group: group(words(440)), items }).ok).toBe(false);
  });

  it('L3 needs 8 shared options and 5 distinct keys', () => {
    const shared = 'ABCDEFGH'.split('').map((key) => ({ key, label: key }));
    const items = range(19, 23).map((n, i) => ({
      group_order: i + 1,
      question: `Speaker ${i + 1}`,
      options: [],
      correct_key: 'ABCDE'[i],
      explanation: 'x',
      transcript: words(80),
      metadata: { number: n },
    }));
    const group = { stimulus_text: null, metadata: { shared_options: shared } };
    expect(parsePayload('fce_listening_part3', { group, items }).ok).toBe(true);
    const dup = items.map((i) => ({ ...i, correct_key: 'A' }));
    expect(parsePayload('fce_listening_part3', { group, items: dup }).ok).toBe(false);
  });

  it('L4 needs interviewer and expert turns and 7 items', () => {
    const turns = (n: number) => `I: ${words(n / 2)}\nE: ${words(n / 2)}`;
    const items = range(24, 30).map((n, i) => ({
      group_order: i + 1,
      question: 'q',
      options: 'ABC'.split('').map((key) => ({ key, label: key })),
      correct_key: 'ABC'[i % 3],
      explanation: 'x',
      metadata: { number: n },
    }));
    const group = (t: string) => ({ stimulus_text: null, metadata: { transcript: t } });
    expect(parsePayload('fce_listening_part4', { group: group(turns(600)), items }).ok).toBe(true);
    expect(parsePayload('fce_listening_part4', { group: group(words(600)), items }).ok).toBe(false);
  });
});

describe('structure', () => {
  it('rejects non objects and unknown parts', () => {
    expect(parsePayload('fce_reading_part2', 'x').ok).toBe(false);
    expect(parsePayload('other', {}).ok).toBe(false);
  });
});

describe('ClosedItemSchema', () => {
  it('keeps metadata.accepted and transcript', async () => {
    const { ClosedItemSchema } = await import('@/lib/types/practice');
    const parsed = ClosedItemSchema.parse({
      id: 'i',
      framework: 'cambridge',
      exam_part: 'fce_reading_part2',
      cefr_level: 'b2',
      variant_id: 'v',
      stimulus_audio_url: null,
      stimulus_text: null,
      stimulus_image_url: null,
      question: '9',
      options: [],
      correct_key: 'which',
      explanation: null,
      source: 'generated',
      transcript: 't',
      metadata: { accepted: ['which'], number: 9 },
    });
    expect(parsed.metadata?.accepted).toEqual(['which']);
    expect(parsed.transcript).toBe('t');
  });
});

describe('open answer normalisation', () => {
  it('lowercases correct_key and accepted[] before validating', () => {
    const p = r2();
    p.items[0].correct_key = 'Which';
    p.items[0].metadata = { number: 9, accepted: ['Which', 'THAT'] };
    const r = parsePayload('fce_reading_part2', p);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.items[0].metadata.accepted).toEqual(['which', 'that']);
  });
});
