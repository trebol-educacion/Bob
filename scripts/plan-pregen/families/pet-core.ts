import { PetShortTextsPlanSchema, type PetShortTextsPlan } from '../../../src/lib/bank-plans/pet-reading-part1';
import { PetReadingComprehensionPlanSchema, type PetReadingComprehensionPlan } from '../../../src/lib/bank-plans/pet-reading-comprehension';
import { PetEmailPlanSchema, type PetEmailPlan } from '../../../src/lib/bank-plans/pet-writing-part1';
import { PetChallengePlanSchema, type PetChallengePlan } from '../../../src/lib/bank-plans/pet-writing-challenge';
import { stripAllDashes } from '../clean';
import { definePart, type PlanPart } from '../types';
import { duplicateIssues, keyDistributionIssues, wordRangeIssues } from '../rules';
import { PET_SPEAKING_PARTS } from './pet-core-speaking';

const B1_TOPICS = [
  'a weekend trip with friends',
  'hobbies and sports clubs',
  'a new school year',
  'shopping online and in town',
  'a holiday by the sea',
  'healthy food and cooking at home',
  'technology and social media',
  'a school project about nature',
  'a concert or a film night',
  'moving to a new neighbourhood',
];

const CHALLENGE_TOPICS = [
  'email|a trip to the cinema with a friend',
  'review|a restaurant you visited',
  'story|a surprise at the beach',
  'email|a party you cannot go to',
  'review|a book or a film you enjoyed',
  'story|a lost phone',
];

const shortTexts = definePart<PetShortTextsPlan>({
  exam: 'pet',
  cefr: 'b1',
  skill: 'reading',
  examPart: 'pet_reading_part1',
  promptKey: 'cambridge_pet_reading_part1_b1_generation',
  short: 'pr1',
  schema: PetShortTextsPlanSchema,
  topics: B1_TOPICS,
  normalize: stripAllDashes,
  rules: (plan) => [
    ...keyDistributionIssues(plan.items.map((i) => i.correct_option), 3, 'items'),
    ...duplicateIssues(plan.items.map((i) => i.text_body), 'text'),
    ...plan.items.flatMap((i, index) => [
      ...(i.number === index + 1 ? [] : [`item ${index + 1}: number must be ${index + 1}`]),
      ...duplicateIssues(i.options.map((o) => o.text), `item ${i.number} options`),
      ...wordRangeIssues(i.text_body, 8, 90, `item ${i.number} text`),
    ]),
  ],
  judge: (plan) => ({
    kind: 'comprehension',
    input: {
      text: null,
      items: plan.items.map((i) => ({
        number: i.number,
        question: i.question,
        options: i.options.map((o) => ({ key: o.id, label: o.text })),
        claimed_key: i.correct_option,
        explanation: i.explanation,
        source: i.text_body,
      })),
    },
  }),
  labelOf: (plan) => plan.items.map((i) => i.text_context).join(' / ').slice(0, 200),
});

const comprehension = definePart<PetReadingComprehensionPlan>({
  exam: 'pet',
  cefr: 'b1',
  skill: 'reading',
  examPart: 'pet_reading_comprehension',
  promptKey: 'cambridge_pet_reading_comprehension_b1_generation',
  short: 'prc',
  schema: PetReadingComprehensionPlanSchema,
  topics: B1_TOPICS,
  normalize: stripAllDashes,
  rules: (plan) => {
    const mcq = plan.questions.flatMap((q) => (q.type === 'mcq' ? [q] : []));
    return [
      ...keyDistributionIssues(mcq.map((q) => q.answer), 3, 'mcq questions'),
      ...duplicateIssues(plan.questions.map((q) => q.question), 'question'),
      ...plan.questions.flatMap((q, index) => (q.number === index + 1 ? [] : [`question ${index + 1}: number must be ${index + 1}`])),
      ...wordRangeIssues(plan.text, 120, 400, 'text'),
    ];
  },
  judge: (plan) => ({
    kind: 'comprehension',
    input: {
      text: plan.text,
      items: plan.questions.flatMap((q) =>
        q.type === 'mcq'
          ? [
              {
                number: q.number,
                question: q.question,
                options: (['A', 'B', 'C'] as const).map((k) => ({ key: k, label: q.options[k] })),
                claimed_key: q.answer,
                explanation: q.feedback[q.answer],
              },
            ]
          : [],
      ),
    },
  }),
  labelOf: (plan) => plan.title,
});

const email = definePart<PetEmailPlan>({
  exam: 'pet',
  cefr: 'b1',
  skill: 'writing',
  examPart: 'pet_writing_part1',
  promptKey: 'cambridge_pet_writing_part1_b1_generation',
  short: 'pw1',
  schema: PetEmailPlanSchema,
  topics: B1_TOPICS,
  normalize: stripAllDashes,
  rules: (plan) => [
    ...duplicateIssues(plan.content_points, 'content point'),
    ...wordRangeIssues(plan.email_received.body, 25, 120, 'email body'),
  ],
  labelOf: (plan) => plan.email_received.subject,
});

const challenge = definePart<PetChallengePlan>({
  exam: 'pet',
  cefr: 'b1',
  skill: 'writing',
  examPart: 'pet_writing_challenge',
  promptKey: 'cambridge_pet_writing_challenge_b1_generation',
  short: 'pwc',
  schema: PetChallengePlanSchema,
  topics: CHALLENGE_TOPICS,
  message: (prompt, ctx) => {
    const [format, theme] = ctx.topic.split('|');
    const avoid = ctx.existing.length > 0 ? ` Do not reuse these existing titles: ${ctx.existing.join(' | ')}.` : '';
    return `${prompt}\n\nUse the format "${format}" and the theme "${theme}".${avoid} Return the JSON only.`;
  },
  normalize: stripAllDashes,
  rules: (plan) => [
    ...duplicateIssues(plan.guide_points, 'guide point'),
    ...(plan.min_words < plan.max_words ? [] : ['min_words must be lower than max_words']),
  ],
  labelOf: (plan) => plan.title,
});

export const PET_CORE_PARTS: PlanPart[] = [shortTexts, comprehension, email, challenge, ...PET_SPEAKING_PARTS];
