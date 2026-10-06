import { KetSignsPlanSchema, type KetSignsPlan } from '../../../src/lib/bank-plans/ket-reading-part1';
import { KetLongTextPlanSchema, type KetLongTextPlan } from '../../../src/lib/bank-plans/ket-reading-part3';
import { KetVocabGapPlanSchema, type KetVocabGapPlan } from '../../../src/lib/bank-plans/ket-reading-part4';
import { KetTfdsPlanSchema, type KetTfdsPlan } from '../../../src/lib/bank-plans/ket-reading-part5';
import { drawImage, assetPath, inBatches } from '../assets';
import { stripAllDashes } from '../clean';
import { kidsImagePrompt } from '../kids-image';
import { judgeOptions, letterOptionIssues, numberingIssues, spreadIssues } from '../ket-core-rules';
import { duplicateIssues, wordRangeIssues, wordsIn } from '../rules';
import { definePart, type PlanPart } from '../types';

const IMAGE_BATCH = 3;
const MAX_SIGN_WORDS = 6;

const ketSigns = definePart<KetSignsPlan>({
  exam: 'ket',
  cefr: 'a2',
  skill: 'reading',
  examPart: 'ket_reading_part1',
  promptKey: 'cambridge_ket_reading_part1_a2_generation',
  short: 'kr1',
  schema: KetSignsPlanSchema,
  normalize: stripAllDashes,
  rules: (plan) => [
    ...numberingIssues(plan.items.map((i) => i.number), 6),
    ...spreadIssues(plan.items.map((i) => i.correct_option), 'signs'),
    ...duplicateIssues(plan.items.map((i) => i.sign_text), 'sign text'),
    ...plan.items.flatMap((item) => [
      ...(wordsIn(item.sign_text) > MAX_SIGN_WORDS ? [`item ${item.number}: sign text has more than ${MAX_SIGN_WORDS} words`] : []),
      ...letterOptionIssues(
        { A: item.options[0].text, B: item.options[1].text, C: item.options[2].text },
        `item ${item.number}`,
      ),
      ...(item.options.map((o) => o.id).join('') === 'ABC' ? [] : [`item ${item.number}: options must be A, B, C in order`]),
    ]),
  ],
  judge: (plan) => ({
    kind: 'comprehension',
    input: {
      text: null,
      items: plan.items.map((item) => ({
        number: item.number,
        question: item.question,
        options: item.options.map((o) => ({ key: o.id, label: o.text })),
        claimed_key: item.correct_option,
        explanation: item.explanation,
        source: `Sign: "${item.sign_text}" (${item.sign_context})`,
      })),
    },
  }),
  produce: async (plan, env) => {
    const tasks = plan.items.map((item) => async () =>
      drawImage(
        env.ai,
        env.db,
        `${assetPath(env.examPart, env.variant, `sign${item.number}`)}.jpg`,
        kidsImagePrompt(
          `A bright, friendly flat illustration of a ${item.sign_context} (a place a child might visit). Cheerful, simple, colourful. Absolutely no text, no words, no letters, no signs with writing.`,
        ),
      ),
    );
    const urls = await inBatches(tasks, IMAGE_BATCH);
    return { items: plan.items.map((item, index) => ({ ...item, image_url: urls[index] })) };
  },
  labelOf: (plan) => plan.items.map((i) => i.sign_context).join(', '),
});

const ketLongText = definePart<KetLongTextPlan>({
  exam: 'ket',
  cefr: 'a2',
  skill: 'reading',
  examPart: 'ket_reading_part3',
  promptKey: 'cambridge_ket_reading_part3_a2_generation',
  short: 'kr3',
  schema: KetLongTextPlanSchema,
  topics: [
    'a teenager who started a new sport',
    'a family trip to another city',
    'a school music club',
    'a young person with an unusual pet',
    'a weekend at a summer camp',
    'a boy or girl learning to cook',
  ],
  normalize: stripAllDashes,
  rules: (plan) => [
    ...wordRangeIssues(plan.text, 180, 380, 'text'),
    ...numberingIssues(plan.items.map((i) => i.number), 6),
    ...spreadIssues(plan.items.map((i) => i.answer), 'questions'),
    ...duplicateIssues(plan.items.map((i) => i.question), 'question'),
    ...plan.items.flatMap((item) => letterOptionIssues(item.options, `item ${item.number}`)),
  ],
  judge: (plan) => ({
    kind: 'comprehension',
    input: {
      text: plan.text,
      items: plan.items.map((item) => ({
        number: item.number,
        question: item.question,
        options: judgeOptions(item.options),
        claimed_key: item.answer,
        explanation: 'The answer is stated or clearly implied in the text.',
      })),
    },
  }),
  labelOf: (plan) => plan.title,
});

const MARKERS = [1, 2, 3, 4, 5, 6];

const ketVocabGap = definePart<KetVocabGapPlan>({
  exam: 'ket',
  cefr: 'a2',
  skill: 'reading',
  examPart: 'ket_reading_part4',
  promptKey: 'cambridge_ket_reading_part4_a2_generation',
  short: 'kr4',
  schema: KetVocabGapPlanSchema,
  topics: [
    'a day at the beach',
    'a visit to a market',
    'a school lunch break',
    'a birthday party',
    'a bike ride in the park',
    'a rainy weekend at home',
  ],
  normalize: stripAllDashes,
  rules: (plan) => [
    ...numberingIssues(plan.items.map((i) => i.number), 6),
    ...spreadIssues(plan.items.map((i) => i.answer), 'gaps'),
    ...MARKERS.filter((n) => !plan.text.includes(`[${n}]`)).map((n) => `text: marker [${n}] is missing`),
    ...plan.items.flatMap((item) => [
      ...letterOptionIssues(item.options, `item ${item.number}`),
      ...[item.options.A, item.options.B, item.options.C].filter((o) => wordsIn(o) > 1).map((o) => `item ${item.number}: option "${o}" must be one word`),
    ]),
  ],
  judge: (plan) => ({
    kind: 'cloze',
    input: {
      text: plan.text,
      items: plan.items.map((item) => ({
        number: item.number,
        options: judgeOptions(item.options),
        claimed_key: item.answer,
        explanation: 'The key is the only word that fits the gap in the text.',
      })),
    },
  }),
  labelOf: (plan) => plan.title,
});

const ketTfds = definePart<KetTfdsPlan>({
  exam: 'ket',
  cefr: 'a2',
  skill: 'reading',
  examPart: 'ket_reading_part5',
  promptKey: 'cambridge_ket_reading_part5_a2_generation',
  short: 'kr5',
  schema: KetTfdsPlanSchema,
  topics: [
    'a local sports centre',
    'a small bookshop',
    'a school trip leaflet',
    'a new cafe in town',
    'a summer language course',
    'a community garden',
  ],
  normalize: stripAllDashes,
  rules: (plan) => {
    const verdicts = plan.statements.map((s) => s.verdict);
    return [
      ...wordRangeIssues(plan.text, 55, 120, 'text'),
      ...numberingIssues(plan.statements.map((s) => s.number), 6),
      ...(['T', 'F', 'DS'] as const).filter((v) => !verdicts.includes(v)).map((v) => `statements: at least one must be ${v}`),
      ...duplicateIssues(plan.statements.map((s) => s.text), 'statement'),
    ];
  },
  judge: (plan) => ({
    kind: 'comprehension',
    input: {
      text: plan.text,
      items: plan.statements.map((s) => ({
        number: s.number,
        question: `Is this statement True (T), False (F) or Doesn't Say (DS)? "${s.text}"`,
        options: [
          { key: 'T', label: 'True: the text says so' },
          { key: 'F', label: 'False: the text says the opposite' },
          { key: 'DS', label: "Doesn't Say: the topic is not mentioned in the text" },
        ],
        claimed_key: s.verdict,
        explanation: 'Verdict in relation to the text.',
      })),
    },
  }),
  labelOf: (plan) => plan.title,
});

export const KET_READING_PARTS: PlanPart[] = [ketSigns, ketLongText, ketVocabGap, ketTfds];
