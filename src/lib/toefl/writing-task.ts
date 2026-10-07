import type { ToeflAcademicPlan, ToeflEmailPlan } from '@/lib/bank-plans/toefl-writing';

export interface ForumPostData {
  author: string;
  text: string;
}

export interface WritingTask {
  instructions: string;
  task: Record<string, unknown>;
  bankGroupId: string;
}

const EMAIL_BASE = 'Read the situation below and write an email response. Write 80-100 words.';

/**
 * @param plan - stored email scenario
 * @param groupId - bank group the scenario came from
 * @returns task with the instructions the student and the evaluator see
 */
export function toEmailTask(plan: ToeflEmailPlan, groupId: string): WritingTask {
  return {
    instructions: EMAIL_BASE,
    task: { ...plan },
    bankGroupId: groupId,
  };
}

/**
 * @param plan - stored discussion thread
 * @param groupId - bank group the thread came from
 * @returns task whose instructions are the writing prompt and whose task holds the thread
 */
export function toAcademicTask(plan: ToeflAcademicPlan, groupId: string): WritingTask {
  return { instructions: plan.writing_prompt, task: { ...plan }, bankGroupId: groupId };
}

/**
 * @param task - persisted or fresh task payload of an academic discussion
 * @returns forum posts, professor first, or an empty list when the payload has no thread
 */
export function forumPostsOf(task: Record<string, unknown> | null): ForumPostData[] {
  const professor = task?.professor_post as { name?: string; text?: string } | undefined;
  const peers = (task?.peer_posts as { name?: string; text?: string }[] | undefined) ?? [];
  const posts = professor ? [{ author: `${professor.name ?? 'Professor'} (Professor)`, text: professor.text ?? '' }] : [];
  return [...posts, ...peers.map((peer) => ({ author: `${peer.name ?? 'Student'} (classmate)`, text: peer.text ?? '' }))];
}
