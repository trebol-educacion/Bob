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
  cambridge_ket_reading_part1: 'Signs and Notices',
  cambridge_ket_reading_part2: 'Match the Question',
  cambridge_ket_reading_part3: 'Read and Decide',
  cambridge_ket_reading_part4: 'Choose the Word',
  cambridge_ket_reading_part5: 'True, False or Doesn\'t Say',
  cambridge_ket_listening_part1: 'Listen and Choose',
  cambridge_ket_listening_part2: 'Listen and Complete',
  cambridge_ket_listening_part3: 'Listen and Decide',
  cambridge_ket_listening_part4: 'Short Talks',
  cambridge_ket_listening_part5: 'True, False or Doesn\'t Say',
  cambridge_ket_writing_part6: 'Short Message',
  cambridge_ket_writing_part7: 'Story',
  cambridge_pet_reading_part1: 'Short Texts',
  cambridge_pet_listening_part1: 'Situations',
  cambridge_pet_listening_part2: 'Multiple Choice',
  cambridge_pet_listening_part3: 'Gap Fill',
  cambridge_pet_listening_part4: 'Attitude and Opinion',
  cambridge_pet_listening_part5: 'True or False and Justify',
  cambridge_pet_writing_part1: 'Email',
  cambridge_starters_part1: 'Point to the Picture',
  cambridge_starters_part2: 'Look and Answer',
  cambridge_starters_part3: 'What\'s This?',
  cambridge_starters_part4: 'Personal Questions',
  cambridge_movers_part1: 'Find the Differences',
  cambridge_movers_part2: 'Information Exchange',
  cambridge_movers_part3: 'Tell the Story',
  cambridge_movers_part4: 'Personal Questions',
  cambridge_movers_part5: 'More About You',
};

const FULL_TITLES: Record<string, string> = {
  cambridge_pet_reading_comprehension: 'Reading · Comprehension',
  cambridge_pet_writing_challenge: 'Writing · Challenge',
  toefl_listen_repeat: 'Speaking · Listen and Repeat',
  toefl_interview: 'Speaking · Interview',
  toefl_listen_choose_response: 'Listening · Choose a Response',
  toefl_writing_build_sentence: 'Writing · Build a Sentence',
  toefl_writing_email: 'Writing · Email',
  toefl_writing_academic_discussion: 'Writing · Academic Discussion',
  generic_conversation: 'Free Conversation',
  generic_situation: 'Situation Practice',
  generic_image: 'Image Practice',
};

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
  const fixed = FULL_TITLES[mode];
  if (fixed) return fixed;
  const skill = inferSkillFromMode(mode);
  const partMatch = mode.match(PART_PATTERN);
  const label = PART_LABELS[mode];
  if (!skill || !partMatch || !mode.startsWith('cambridge_')) return titleCase(mode);
  const segments = [SKILL_LABELS[skill], `Part ${partMatch[1]}`];
  if (label) segments.push(label);
  return segments.join(' · ');
}
