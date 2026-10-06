import { inferSkillFromMode } from '@/lib/skill-from-mode';

const SKILL_LABELS: Record<string, string> = {
  reading: 'Reading',
  listening: 'Listening',
  writing: 'Writing',
  speaking: 'Speaking',
};

const PART_LABELS: Record<string, string> = {
  cambridge_fce_reading_part1: 'Multiple-Choice Cloze',
  cambridge_fce_reading_part2: 'Open Cloze',
  cambridge_fce_reading_part3: 'Word Formation',
  cambridge_fce_reading_part4: 'Key Word Transformation',
  cambridge_fce_reading_part5: 'Long Text',
  cambridge_fce_reading_part6: 'Gapped Text',
  cambridge_fce_reading_part7: 'Multiple Matching',
  cambridge_fce_listening_part1: 'Short Extracts',
  cambridge_fce_listening_part2: 'Sentence Completion',
  cambridge_fce_listening_part3: 'Five Speakers',
  cambridge_fce_listening_part4: 'Long Interview',
  cambridge_fce_writing_part1: 'Essay',
  cambridge_fce_writing_part2: 'Choice Task',
  cambridge_fce_p1: 'Interview',
  cambridge_fce_p2: 'Picture Description',
  cambridge_fce_p3: 'Collaborative Task',
  cambridge_fce_p4: 'Discussion',
  cambridge_pet_p1: 'Interview',
  cambridge_pet_p2: 'Picture Description',
  cambridge_pet_p3: 'Collaborative Task',
  cambridge_pet_p4: 'Discussion',
  cambridge_ket_part1: 'Talk About You',
  cambridge_ket_part2: 'Talk About a Hobby',
  cambridge_ket_part3: 'Describe the Picture',
};

const SPEAKING_FALLBACK = /^cambridge_(?:pet_p\d+|ket_part\d+)$/;

const PART_PATTERN = /(?:_part|_p)(\d+)(?:_|$)/;

function titleCase(mode: string): string {
  return mode
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * @param mode - session mode key
 * @returns single student-facing title such as "Reading · Part 2 · Open Cloze"
 */
export function sessionTitle(mode: string): string {
  const skill = inferSkillFromMode(mode) ?? (SPEAKING_FALLBACK.test(mode) ? 'speaking' : null);
  const partMatch = mode.match(PART_PATTERN);
  const label = PART_LABELS[mode];
  if (!skill || !partMatch || !mode.startsWith('cambridge_')) return titleCase(mode);
  const segments = [SKILL_LABELS[skill], `Part ${partMatch[1]}`];
  if (label) segments.push(label);
  return segments.join(' · ');
}
