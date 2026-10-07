import { PetAttitudeDraftSchema, type PetAttitudeDraft } from '../../../src/lib/bank-plans/pet-listening-part4';
import { PetSituationalDraftSchema, type PetSituationalDraft } from '../../../src/lib/bank-plans/pet-listening-part1';
import { assetPath, dialogueVoices, inBatches, soloVoice, speak } from '../assets';
import { stripAllDashes } from '../clean';
import { definePart, type PlanPart } from '../types';
import { choiceIssues, dialogueText, lengthIssues, PET_LISTENING_TOPICS, themedMessage, turnIssues } from './pet-listening-shared';

const BATCH = 3;

const situational = definePart<PetSituationalDraft>({
  exam: 'pet',
  cefr: 'b1',
  skill: 'listening',
  examPart: 'pet_listening_part1',
  promptKey: 'cambridge_pet_listening_part1_b1_generation',
  short: 'pl1',
  schema: PetSituationalDraftSchema,
  topics: PET_LISTENING_TOPICS,
  message: themedMessage,
  normalize: stripAllDashes,
  rules: (plan) => [
    ...choiceIssues(plan.items, 'item'),
    ...plan.items.flatMap((item) => [
      ...turnIssues(item.conversation, `item ${item.number}`),
      ...lengthIssues(item.conversation.map((turn) => turn.line).join(' '), 25, 95, `item ${item.number} conversation`),
    ]),
  ],
  judge: (plan) => ({
    kind: 'comprehension',
    input: {
      text: null,
      items: plan.items.map((item) => ({
        number: item.number,
        question: item.question,
        options: Object.entries(item.options).map(([key, label]) => ({ key, label })),
        claimed_key: item.answer,
        explanation: 'The conversation states or clearly implies the key.',
        source: dialogueText(item.conversation),
      })),
    },
  }),
  produce: async (plan, env) => {
    const urls = await inBatches(
      plan.items.map((item) => () =>
        speak(env.ai, env.db, `${assetPath(env.examPart, env.variant, `i${item.number}`)}.mp3`, dialogueText(item.conversation), dialogueVoices(env.slot + item.number)),
      ),
      BATCH,
    );
    return { ...plan, items: plan.items.map((item, index) => ({ ...item, audio_url: urls[index] })) };
  },
  labelOf: (plan) => plan.context,
});

const attitude = definePart<PetAttitudeDraft>({
  exam: 'pet',
  cefr: 'b1',
  skill: 'listening',
  examPart: 'pet_listening_part4',
  promptKey: 'cambridge_pet_listening_part4_b1_generation',
  short: 'pl4',
  schema: PetAttitudeDraftSchema,
  topics: PET_LISTENING_TOPICS,
  message: themedMessage,
  normalize: stripAllDashes,
  rules: (plan) => [
    ...choiceIssues(plan.items, 'item'),
    ...plan.items.flatMap((item) => lengthIssues(item.monologue, 30, 62, `item ${item.number} monologue`)),
  ],
  judge: (plan) => ({
    kind: 'comprehension',
    input: {
      text: null,
      items: plan.items.map((item) => ({
        number: item.number,
        question: item.question,
        options: Object.entries(item.options).map(([key, label]) => ({ key, label })),
        claimed_key: item.answer,
        explanation: 'The speaker feeling, opinion or intention is clearly implied by tone and word choice.',
        source: item.monologue,
      })),
    },
  }),
  produce: async (plan, env) => {
    const urls = await inBatches(
      plan.items.map((item) => () =>
        speak(env.ai, env.db, `${assetPath(env.examPart, env.variant, `i${item.number}`)}.mp3`, item.monologue, soloVoice(env.slot + item.number)),
      ),
      BATCH,
    );
    return { ...plan, items: plan.items.map((item, index) => ({ ...item, audio_url: urls[index] })) };
  },
  labelOf: (plan) => plan.context,
});

export const PET_LISTENING_MCQ_PARTS: PlanPart[] = [situational, attitude];
