import type { PickedContent } from '@/lib/item-bank/content-source';
import { FCE_DISCUSSION_PART, FCE_INTERVIEW_PART, type FCEDiscussionPlan, type FCEInterviewPlan } from './fce-content';

function questionsOf(picked: PickedContent): { id: string; questions: string[] } | null {
  if (picked.kind !== 'group') return null;
  const raw = picked.group.metadata.questions;
  const questions = Array.isArray(raw) ? raw.filter((q): q is string => typeof q === 'string' && q.trim().length > 0) : [];
  return questions.length > 0 ? { id: picked.group.id, questions } : null;
}

/**
 * @param picked Speaking Part 1 group read from the bank
 * @returns interview plan, or null when the group has no questions
 */
export function toInterviewPlan(picked: PickedContent): FCEInterviewPlan | null {
  const found = questionsOf(picked);
  return found ? { questions: found.questions, exam_part: FCE_INTERVIEW_PART, bank_group_id: found.id } : null;
}

/**
 * @param picked Speaking Part 4 group read from the bank
 * @returns discussion plan, or null when the group has no questions
 */
export function toDiscussionPlan(picked: PickedContent): FCEDiscussionPlan | null {
  const found = questionsOf(picked);
  return found
    ? { discussion_questions: found.questions, exam_part: FCE_DISCUSSION_PART, bank_group_id: found.id }
    : null;
}
