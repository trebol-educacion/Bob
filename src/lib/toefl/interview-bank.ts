import type { ToeflInterviewBank } from '@/lib/bank-plans/toefl-interview';
import type { ToeflInterviewPlan } from '@/lib/toefl/interview';

const SUGGESTED_SECONDS = 45;

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

/**
 * @param bank - stored interview set with its audio URLs
 * @param groupId - bank group the set came from
 * @returns plan shaped for the interview UI
 */
export function toInterviewPlan(bank: ToeflInterviewBank, groupId: string): ToeflInterviewPlan {
  return {
    topic_id: slug(bank.topic) || 'interview',
    topic_name: bank.topic,
    topic_context: bank.avatar_intro,
    intro_audio_url: bank.intro_audio_url,
    bank_group_id: groupId,
    questions: bank.questions.map((text, index) => ({
      text,
      difficulty: Math.min(4, index + 1),
      suggested_time: SUGGESTED_SECONDS,
      audio_url: bank.question_audio_urls[index],
    })),
  };
}
