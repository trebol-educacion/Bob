import { resolveEnabledModes } from '@/lib/modes';
import type { DynamicCard } from '@/lib/types/practice';
import type { SkillLevelMap } from '@/lib/types/skills';

const b1SkillLevels: SkillLevelMap = {
  speaking: { cefr_level: 'b1', origin: 'legacy', confidence: null, last_assessment_at: null, updated_at: '2026-01-01T00:00:00Z' },
};

const mockCards: DynamicCard[] = [
  { framework: 'cambridge', exam_part: 'starters_p1', cefr_level: 'a1', label: 'Starters P1', description: null, mode_key: 'cambridge_starters_p1', status: 'enabled' },
  { framework: 'cambridge', exam_part: 'ket_p1', cefr_level: 'b1', label: 'KET P1', description: null, mode_key: 'cambridge_ket_p1', status: 'enabled' },
  { framework: 'toefl', exam_part: 'listen_repeat', cefr_level: 'b1', label: 'Listen & Repeat', description: null, mode_key: 'toefl_listen_repeat', status: 'enabled' },
  { framework: 'generic', exam_part: 'conversation', cefr_level: null, label: 'Free Conversation', description: null, mode_key: 'generic_conversation', status: 'enabled' },
  { framework: 'generic', exam_part: 'vocab', cefr_level: 'b1', label: 'Vocabulary B1', description: null, mode_key: 'generic_vocab_b1', status: 'enabled' },
];

describe('resolveEnabledModes', () => {
  it('returns empty array when isBobEnabled is false', () => {
    const result = resolveEnabledModes({
      isBobEnabled: false,
      selectedSkill: 'speaking',
      skillLevels: b1SkillLevels,
      studentFrameworks: ['cambridge'],
      orgFrameworks: ['cambridge'],
      allDynamicCards: mockCards,
    });
    expect(result).toEqual([]);
  });

  it('returns cambridge b1 cards as enabled when student has cambridge b1 speaking', () => {
    const result = resolveEnabledModes({
      isBobEnabled: true,
      selectedSkill: 'speaking',
      skillLevels: b1SkillLevels,
      studentFrameworks: ['cambridge'],
      orgFrameworks: ['cambridge'],
      allDynamicCards: mockCards,
    });
    const enabledKeys = result.filter(c => c.visibility === 'enabled').map(c => c.mode_key);
    expect(enabledKeys).toContain('cambridge_ket_p1');
    expect(enabledKeys).not.toContain('cambridge_starters_p1');
    expect(enabledKeys).not.toContain('toefl_listen_repeat');
  });

  it('excludes framework cards when org and student frameworks do not intersect', () => {
    const result = resolveEnabledModes({
      isBobEnabled: true,
      selectedSkill: 'speaking',
      skillLevels: b1SkillLevels,
      studentFrameworks: ['cambridge'],
      orgFrameworks: ['toefl'],
      allDynamicCards: mockCards,
    });
    const keys = result.map(c => c.mode_key);
    expect(keys).not.toContain('cambridge_ket_p1');
    expect(keys).not.toContain('toefl_listen_repeat');
  });

  it('returns universal generic card as enabled when student has no assigned frameworks and no level', () => {
    const result = resolveEnabledModes({
      isBobEnabled: true,
      selectedSkill: 'speaking',
      skillLevels: {},
      studentFrameworks: [],
      orgFrameworks: [],
      allDynamicCards: mockCards,
    });
    const enabledKeys = result.filter(c => c.visibility === 'enabled').map(c => c.mode_key);
    expect(enabledKeys).toContain('generic_conversation');
    expect(enabledKeys).not.toContain('generic_vocab_b1');
  });
});
