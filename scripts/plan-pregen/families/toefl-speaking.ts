import {
  TOEFL_REPEAT_DURATIONS,
  ToeflRepeatDraftSchema,
  type ToeflRepeatDraft,
} from '../../../src/lib/bank-plans/toefl-repeat';
import {
  TOEFL_INTERVIEW_QUESTIONS,
  ToeflInterviewDraftSchema,
  type ToeflInterviewDraft,
} from '../../../src/lib/bank-plans/toefl-interview';
import { assetPath, inBatches, speak } from '../assets';
import { stripAllDashes } from '../clean';
import { duplicateIssues, wordsIn } from '../rules';
import { definePart, type PlanPart } from '../types';

const REPEAT_VOICE = [{ name: 'Speaker', voice: 'Sadaltager' }];
const EXAMINER_VOICE = [{ name: 'Speaker', voice: 'Kore' }];
const REPEAT_DIFFICULTY = [1, 2, 2, 3, 3, 4, 5];
const BATCH = 3;

const INTERVIEW_TOPICS = [
  'technology and daily life',
  'education and learning habits',
  'health and lifestyle',
  'travel and cultures',
  'work and careers',
  'the environment and cities',
  'friendship and communication',
  'free time, music and the arts',
];

function repeatRules(plan: ToeflRepeatDraft): string[] {
  const issues = plan.items.flatMap((item, index) => {
    const expected = TOEFL_REPEAT_DURATIONS[index];
    const words = wordsIn(item.text);
    const found: string[] = [];
    if (item.target_duration_seconds !== expected) found.push(`sentence ${index + 1}: target_duration_seconds must be ${expected}`);
    if (words < Math.ceil(expected * 1.5) || words > expected * 3 + 2) {
      found.push(`sentence ${index + 1}: ${words} words does not fit ${expected} seconds`);
    }
    if (!/[.!?]$/.test(item.text.trim())) found.push(`sentence ${index + 1}: must end with punctuation`);
    return found;
  });
  return [...issues, ...duplicateIssues(plan.items.map((item) => item.text), 'sentence')];
}

function repeatPart(cefr: string) {
  return definePart<ToeflRepeatDraft>({
    exam: 'toefl',
    cefr,
    skill: 'speaking',
    examPart: 'toefl_listen_repeat',
    promptKey: `toefl_listen_repeat_${cefr}_generation`,
    short: `tr-${cefr}`,
    schema: ToeflRepeatDraftSchema,
    normalize: (plan) => stripAllDashes({
      items: plan.items.map((item, index) => ({ ...item, difficulty: REPEAT_DIFFICULTY[index] ?? 5 })),
    }),
    rules: repeatRules,
    produce: async (plan, env) => ({
      items: await inBatches(
        plan.items.map((item, index) => async () => ({
          ...item,
          audio_url: await speak(env.ai, env.db, assetPath(env.examPart, env.variant, `s${index + 1}.mp3`), item.text, REPEAT_VOICE),
        })),
        BATCH,
      ),
    }),
    labelOf: (plan) => plan.items[plan.items.length - 1]?.text ?? '',
  });
}

function interviewRules(plan: ToeflInterviewDraft): string[] {
  const issues = plan.questions.flatMap((question, index) => {
    const words = wordsIn(question);
    return [
      ...(question.trim().endsWith('?') ? [] : [`question ${index + 1}: must end with a question mark`]),
      ...(words >= 5 && words <= 35 ? [] : [`question ${index + 1}: ${words} words, expected 5-35`]),
    ];
  });
  if (plan.questions.length !== TOEFL_INTERVIEW_QUESTIONS) issues.push(`exactly ${TOEFL_INTERVIEW_QUESTIONS} questions are required`);
  return [...issues, ...duplicateIssues(plan.questions, 'question')];
}

function interviewPart(cefr: string) {
  return definePart<ToeflInterviewDraft>({
    exam: 'toefl',
    cefr,
    skill: 'speaking',
    examPart: 'toefl_interview',
    promptKey: `toefl_interview_${cefr}_generation`,
    short: `ti-${cefr}`,
    schema: ToeflInterviewDraftSchema,
    topics: INTERVIEW_TOPICS,
    message: (prompt, ctx) =>
      `${prompt}\n\nTopic area for this interview: ${ctx.topic}. Return EXACTLY ${TOEFL_INTERVIEW_QUESTIONS} questions.${ctx.existing.length > 0 ? ` Do not reuse these topics: ${ctx.existing.join(' | ')}.` : ''} Return the JSON only.`,
    normalize: stripAllDashes,
    rules: interviewRules,
    produce: async (plan, env) => {
      const path = (name: string) => assetPath(env.examPart, env.variant, `${name}.mp3`);
      const intro = await speak(env.ai, env.db, path('intro'), plan.avatar_intro, EXAMINER_VOICE);
      const urls = await inBatches(
        plan.questions.map((question, index) => () => speak(env.ai, env.db, path(`q${index + 1}`), question, EXAMINER_VOICE)),
        BATCH,
      );
      return { ...plan, intro_audio_url: intro, question_audio_urls: urls };
    },
    labelOf: (plan) => plan.topic,
  });
}

export const TOEFL_SPEAKING_PARTS: PlanPart[] = [
  ...['a2', 'b1', 'b2'].map(repeatPart),
  ...['b1', 'b2', 'c1'].map(interviewPart),
];
