import { KetMatchPlanSchema, type KetMatchPlan } from '../../../src/lib/bank-plans/ket-reading-part2';
import { stripAllDashes } from '../clean';
import { definePart, type PlanPart } from '../types';
import { duplicateIssues, keyDistributionIssues } from '../rules';

const A2_TOPICS = [
  'a school trip and free-time activities',
  'hobbies and weekend plans',
  'shopping and clothes',
  'food and eating out',
  'holidays and travel',
  'sport and keeping fit',
  'family and friends',
  'a new town and local places',
];

const ketMatch = definePart<KetMatchPlan>({
  exam: 'ket',
  cefr: 'a2',
  skill: 'reading',
  examPart: 'ket_reading_part2',
  promptKey: 'cambridge_ket_reading_part2_a2_generation',
  short: 'kr2',
  schema: KetMatchPlanSchema,
  topics: A2_TOPICS,
  normalize: stripAllDashes,
  rules: (plan) => [
    ...keyDistributionIssues(plan.questions.map((q) => q.answer), 3, 'questions'),
    ...[...new Set(plan.questions.map((q) => q.answer))].length < 3 ? ['each text A, B and C must be the answer to at least one question'] : [],
    ...duplicateIssues(plan.questions.map((q) => q.text), 'question'),
    ...plan.questions.flatMap((q, i) => (q.number === i + 1 ? [] : [`question ${i + 1}: number must be ${i + 1}`])),
  ],
  judge: (plan) => ({
    kind: 'comprehension',
    input: {
      text: null,
      items: plan.questions.map((q) => ({
        number: q.number,
        question: q.text,
        options: plan.texts.map((t) => ({ key: t.label, label: `${t.author}: ${t.text}` })),
        claimed_key: q.answer,
        explanation: 'The person whose text matches the question.',
      })),
    },
  }),
  labelOf: (plan) => plan.topic,
});

export const KET_PARTS: PlanPart[] = [ketMatch];
