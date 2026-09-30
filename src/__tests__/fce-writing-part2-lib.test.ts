import { describe, it, expect } from 'vitest';
import {
  FcePart2GenerationSchema,
  readFcePart2Plan,
  toFcePart2Feedback,
} from '@/lib/writing/fce-part2';
import { restoreFcePart2 } from '@/components/practice/fce/writing2/restore';
import type { StoredMessage } from '@/actions/messages';

const TASKS = [
  { number: 2, task_type: 'article', situation: 'a', register: 'informal' },
  { number: 3, task_type: 'review', situation: 'b', register: 'semi-formal' },
  { number: 4, task_type: 'report', situation: 'c', register: 'formal' },
];
const GENERATION = { title: 't', instructions: 'i', tasks: TASKS };

describe('FcePart2GenerationSchema', () => {
  it('accepts three tasks of different types', () => {
    expect(FcePart2GenerationSchema.safeParse(GENERATION).success).toBe(true);
  });

  it('rejects two tasks of the same type and a wrong count', () => {
    const repeated = { ...GENERATION, tasks: [TASKS[0], { ...TASKS[1], task_type: 'article' }, TASKS[2]] };
    expect(FcePart2GenerationSchema.safeParse(repeated).success).toBe(false);
    expect(FcePart2GenerationSchema.safeParse({ ...GENERATION, tasks: TASKS.slice(0, 2) }).success).toBe(false);
  });

  it('rejects an unknown task type', () => {
    const invalid = { ...GENERATION, tasks: [{ ...TASKS[0], task_type: 'story' }, TASKS[1], TASKS[2]] };
    expect(FcePart2GenerationSchema.safeParse(invalid).success).toBe(false);
  });
});

describe('toFcePart2Feedback', () => {
  it('derives the mark from the rubric and keeps the formative fields', () => {
    const feedback = toFcePart2Feedback(
      {
        understood: true,
        highlights: ['h'],
        suggestions: ['s'],
        model_answer: null,
        fce_rubric: { content: 5, communicative_achievement: 4, organisation: 4, language: 3 },
      },
      150,
    );
    expect(feedback.score_10).toBe(8);
    expect(feedback.model_answer).toBeUndefined();
    expect(feedback.indicators.target_word_count_range).toEqual([140, 190]);
  });
});

function message(role: 'bob' | 'user', msgType: string, contentJson: Record<string, unknown>): StoredMessage {
  return { id: 'x', role, msg_type: msgType, content_json: contentJson } as unknown as StoredMessage;
}

describe('restoreFcePart2', () => {
  const plan = message('bob', 'text', { kind: 'writing_tasks', ...GENERATION, framing_text: 'f' });

  it('restores only the plan when nothing was submitted', () => {
    const restored = restoreFcePart2([plan]);
    expect(restored.plan?.tasks).toHaveLength(3);
    expect(restored.feedback).toBeNull();
  });

  it('restores task, text and final feedback', () => {
    const restored = restoreFcePart2([
      plan,
      message('user', 'text', { kind: 'writing_submission', text: 'my text', task_number: 3 }),
      message('bob', 'evaluation', {
        is_final: true,
        understood: true,
        highlights: ['h'],
        suggestions: [],
        score_10: 6.5,
        fce_rubric: { content: 4, communicative_achievement: 3, organisation: 3, language: 3 },
        indicators: { word_count: 150, target_word_count_range: [140, 190] },
      }),
    ]);
    expect(restored.taskNumber).toBe(3);
    expect(restored.text).toBe('my text');
    expect(restored.feedback?.score_10).toBe(6.5);
  });

  it('ignores a final evaluation without a valid rubric', () => {
    const restored = restoreFcePart2([
      plan,
      message('bob', 'evaluation', { is_final: true, score_10: 5, fce_rubric: { content: 1 } }),
    ]);
    expect(restored.feedback).toBeNull();
  });

  it('reads a plan back from stored json', () => {
    expect(readFcePart2Plan({ kind: 'other' })).toBeNull();
    expect(readFcePart2Plan({ kind: 'writing_tasks', ...GENERATION, framing_text: 'f' })?.framingText).toBe('f');
  });
});
