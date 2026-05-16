import { resolveEnabledModes } from '@/lib/modes';
import type { DynamicCard } from '@/lib/types/practice';

const mockCards: DynamicCard[] = [
  { framework: 'cambridge', exam_part: 'starters_p1', cefr_level: 'a1', label: 'Starters P1', description: null, mode_key: 'cambridge_starters_p1' },
  { framework: 'cambridge', exam_part: 'ket_p1', cefr_level: 'b1', label: 'KET P1', description: null, mode_key: 'cambridge_ket_p1' },
  { framework: 'toefl', exam_part: 'listen_repeat', cefr_level: 'b1', label: 'Listen & Repeat', description: null, mode_key: 'toefl_listen_repeat' },
  { framework: 'generic', exam_part: 'conversation', cefr_level: null, label: 'Free Conversation', description: null, mode_key: 'generic_conversation' },
  { framework: 'generic', exam_part: 'vocab', cefr_level: 'b1', label: 'Vocabulary B1', description: null, mode_key: 'generic_vocab_b1' },
];

describe('resolveEnabledModes', () => {
  it('returns empty array when isBobEnabled is false', () => {
    const result = resolveEnabledModes({
      isBobEnabled: false,
      studentActiveCefr: 'b1',
      studentFrameworks: ['cambridge'],
      orgFrameworks: ['cambridge'],
      allDynamicCards: mockCards,
    });
    expect(result).toEqual([]);
  });

  it('returns only cambridge b1 cards when student has cambridge b1', () => {
    const result = resolveEnabledModes({
      isBobEnabled: true,
      studentActiveCefr: 'b1',
      studentFrameworks: ['cambridge'],
      orgFrameworks: ['cambridge'],
      allDynamicCards: mockCards,
    });
    expect(result).toContain('cambridge_ket_p1');
    expect(result).not.toContain('cambridge_starters_p1');
    expect(result).not.toContain('toefl_listen_repeat');
    expect(result).not.toContain('generic_conversation');
  });

  it('excludes framework cards when org and student frameworks do not intersect', () => {
    const result = resolveEnabledModes({
      isBobEnabled: true,
      studentActiveCefr: 'b1',
      studentFrameworks: ['cambridge'],
      orgFrameworks: ['toefl'],
      allDynamicCards: mockCards,
    });
    expect(result).not.toContain('cambridge_ket_p1');
    expect(result).not.toContain('toefl_listen_repeat');
  });

  it('returns universal generic when student has no assigned frameworks', () => {
    const result = resolveEnabledModes({
      isBobEnabled: true,
      studentActiveCefr: null,
      studentFrameworks: [],
      orgFrameworks: [],
      allDynamicCards: mockCards,
    });
    expect(result).toContain('generic_conversation');
    expect(result).not.toContain('generic_vocab_b1');
  });
});
