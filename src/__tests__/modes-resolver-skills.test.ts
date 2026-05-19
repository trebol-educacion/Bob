import { resolveEnabledModes } from '@/lib/modes';
import type { DynamicCard } from '@/lib/types/practice';
import type { SkillLevelMap } from '@/lib/types/skills';

const mockCards: DynamicCard[] = [
  {
    framework: 'cambridge',
    exam_part: 'ket_p1',
    cefr_level: 'a2',
    label: 'KET Part 1',
    description: null,
    mode_key: 'cambridge_ket_p1',
    status: 'enabled',
  },
  {
    framework: 'cambridge',
    exam_part: 'pet_p1',
    cefr_level: 'b1',
    label: 'PET Part 1',
    description: null,
    mode_key: 'cambridge_pet_p1',
    status: 'enabled',
  },
  {
    framework: 'cambridge',
    exam_part: 'fce_p1',
    cefr_level: 'b2',
    label: 'FCE Part 1',
    description: null,
    mode_key: 'cambridge_fce_p1',
    status: 'coming_soon',
  },
];

const skillLevelsA2: SkillLevelMap = {
  speaking: {
    cefr_level: 'a2',
    origin: 'legacy',
    confidence: null,
    last_assessment_at: null,
    updated_at: '2026-01-01T00:00:00Z',
  },
};

describe('resolveEnabledModes (skill-first)', () => {
  it('returns enabled for cambridge A2 card when student speaking level is A2', () => {
    const results = resolveEnabledModes({
      isBobEnabled: true,
      selectedSkill: 'speaking',
      skillLevels: skillLevelsA2,
      studentFrameworks: ['cambridge'],
      orgFrameworks: ['cambridge'],
      allDynamicCards: mockCards,
    });

    const ket = results.find(r => r.mode_key === 'cambridge_ket_p1');
    expect(ket).toBeDefined();
    expect(ket?.visibility).toBe('enabled');
    expect(ket?.reason).toBe('level_match');
  });

  it('returns disabled-mismatch for cambridge B1 card when student speaking level is A2', () => {
    const results = resolveEnabledModes({
      isBobEnabled: true,
      selectedSkill: 'speaking',
      skillLevels: skillLevelsA2,
      studentFrameworks: ['cambridge'],
      orgFrameworks: ['cambridge'],
      allDynamicCards: mockCards,
    });

    const pet = results.find(r => r.mode_key === 'cambridge_pet_p1');
    expect(pet).toBeDefined();
    expect(pet?.visibility).toBe('disabled-mismatch');
    expect(pet?.reason).toBe('level_mismatch');
  });

  it('returns disabled-not-available for coming_soon card regardless of level match', () => {
    const results = resolveEnabledModes({
      isBobEnabled: true,
      selectedSkill: 'speaking',
      skillLevels: {
        speaking: {
          cefr_level: 'b2',
          origin: 'legacy',
          confidence: null,
          last_assessment_at: null,
          updated_at: '2026-01-01T00:00:00Z',
        },
      },
      studentFrameworks: ['cambridge'],
      orgFrameworks: ['cambridge'],
      allDynamicCards: mockCards,
    });

    const fce = results.find(r => r.mode_key === 'cambridge_fce_p1');
    expect(fce).toBeDefined();
    expect(fce?.visibility).toBe('disabled-not-available');
    expect(fce?.reason).toBe('status_not_available');
  });

  it('returns empty array when isBobEnabled is false', () => {
    const results = resolveEnabledModes({
      isBobEnabled: false,
      selectedSkill: 'speaking',
      skillLevels: skillLevelsA2,
      studentFrameworks: ['cambridge'],
      orgFrameworks: ['cambridge'],
      allDynamicCards: mockCards,
    });

    expect(results).toEqual([]);
  });

  it('returns disabled-not-available for all cards when student has no level for selected skill', () => {
    const results = resolveEnabledModes({
      isBobEnabled: true,
      selectedSkill: 'speaking',
      skillLevels: {},
      studentFrameworks: ['cambridge'],
      orgFrameworks: ['cambridge'],
      allDynamicCards: [mockCards[0]],
    });

    expect(results[0]?.visibility).toBe('disabled-not-available');
  });
});
