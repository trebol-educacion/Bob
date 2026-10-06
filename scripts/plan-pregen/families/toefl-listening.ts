import {
  TOEFL_CHOOSE_ITEMS,
  ToeflChooseResponseDraftSchema,
  type ToeflChooseResponseDraft,
} from '../../../src/lib/bank-plans/toefl-choose-response';
import { assetPath, inBatches, speak } from '../assets';
import { stripAllDashes } from '../clean';
import { duplicateIssues, keyDistributionIssues, optionIssues, wordsIn } from '../rules';
import { definePart, type PlanPart } from '../types';

const VOICES = { Woman: 'Kore', Man: 'Orus' } as const;
const BATCH = 3;

const SITUATIONS = [
  'library, study and classes',
  'transport, directions and plans',
  'shopping, orders and customer service',
  'work, schedules and meetings',
  'food, cooking and eating out',
  'health, sport and free time',
];

function chooseRules(plan: ToeflChooseResponseDraft): string[] {
  const issues = plan.items.flatMap((item, index) => {
    const label = `item ${index + 1}`;
    const words = wordsIn(item.utterance);
    return [
      ...(words >= 3 && words <= 16 ? [] : [`${label}: utterance has ${words} words, expected 3-16`]),
      ...optionIssues(item.options.map((option) => option.label), label),
      ...(item.options.map((option) => option.key).join('') === 'ABCD' ? [] : [`${label}: option keys must be A, B, C, D in order`]),
    ];
  });
  return [
    ...issues,
    ...keyDistributionIssues(plan.items.map((item) => item.correct_key), 4, 'items'),
    ...duplicateIssues(plan.items.map((item) => item.utterance), 'utterance'),
  ];
}

const chooseResponse = definePart<ToeflChooseResponseDraft>({
  exam: 'toefl',
  cefr: 'b1',
  skill: 'listening',
  examPart: 'listen_choose_response',
  promptKey: 'toefl_listen_choose_response_b1_generation',
  short: 'lcr-b1',
  schema: ToeflChooseResponseDraftSchema,
  topics: SITUATIONS,
  message: (prompt, ctx) =>
    `${prompt}\n\nSituations to draw from in this set: ${ctx.topic}. Return exactly ${TOEFL_CHOOSE_ITEMS} items.${ctx.existing.length > 0 ? ` Avoid these utterances already used: ${ctx.existing.join(' | ')}.` : ''} Return the JSON only.`,
  normalize: stripAllDashes,
  rules: chooseRules,
  judge: (plan) => ({
    kind: 'comprehension',
    input: {
      text: null,
      items: plan.items.map((item, index) => ({
        number: index + 1,
        question: 'Which option is the only natural and appropriate reply to the utterance in source?',
        options: item.options,
        claimed_key: item.correct_key,
        explanation: item.explanation,
        source: `${item.speaker}: ${item.utterance}`,
      })),
    },
  }),
  produce: async (plan, env) => ({
    items: await inBatches(
      plan.items.map((item, index) => async () => ({
        ...item,
        audio_url: await speak(
          env.ai,
          env.db,
          assetPath(env.examPart, env.variant, `q${index + 1}.mp3`),
          item.utterance,
          [{ name: 'Speaker', voice: VOICES[item.speaker] }],
        ),
      })),
      BATCH,
    ),
  }),
  labelOf: (plan) => plan.items[0]?.utterance ?? '',
});

export const TOEFL_LISTENING_PARTS: PlanPart[] = [chooseResponse];
