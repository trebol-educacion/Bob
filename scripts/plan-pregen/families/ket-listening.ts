import { KetListenChooseGenSchema, type KetListenChooseGen } from '../../../src/lib/bank-plans/ket-listening-part1';
import { KetListenCompleteGenSchema, type KetListenCompleteGen } from '../../../src/lib/bank-plans/ket-listening-part2';
import { KetListenDecideGenSchema, type KetListenDecideGen } from '../../../src/lib/bank-plans/ket-listening-part3';
import { KetShortConversationsGenSchema, type KetShortConversationsGen } from '../../../src/lib/bank-plans/ket-listening-part4';
import { KetListenMatchGenSchema, type KetListenMatchGen } from '../../../src/lib/bank-plans/ket-listening-part5';
import { assetPath, drawImage, inBatches, speak } from '../assets';
import { stripAllDashes } from '../clean';
import { kidsImagePrompt } from '../kids-image';
import { spokenTranscript, spokenTurns } from '../ket-listening-media';
import {
  chooseJudge,
  chooseRules,
  completeJudge,
  completeRules,
  decideJudge,
  decideRules,
  matchJudge,
  matchRules,
  shortJudge,
  shortRules,
} from '../ket-listening-rules';
import { definePart, type PlanPart } from '../types';

const BASE = { exam: 'ket', cefr: 'a2', skill: 'listening' } as const;
const IMAGE_BATCH = 5;

const TOPICS = [
  'school and homework',
  'sports and free time',
  'shopping and prices',
  'a trip or a holiday',
  'food and restaurants',
  'family and friends',
  'a club or a hobby',
  'a birthday or a party',
];

const choose = definePart<KetListenChooseGen>({
  ...BASE,
  examPart: 'ket_listening_part1',
  promptKey: 'cambridge_ket_listening_part1_a2_generation',
  short: 'kl1',
  schema: KetListenChooseGenSchema,
  topics: TOPICS,
  normalize: stripAllDashes,
  rules: chooseRules,
  judge: chooseJudge,
  labelOf: (plan) => plan.items.map((i) => i.context).join(' | '),
  produce: async (plan, env) => {
    const audio = await inBatches(
      plan.items.map((item) => async () => {
        const spoken = spokenTurns(item.dialogue, env.slot + item.number);
        return speak(env.ai, env.db, assetPath(env.examPart, env.variant, `q${item.number}.mp3`), spoken.text, spoken.speakers);
      }),
      2,
    );
    const jobs = plan.items.flatMap((item) =>
      item.options.map((option) => async () =>
        drawImage(env.ai, env.db, assetPath(env.examPart, env.variant, `q${item.number}-${option.id}.jpg`), kidsImagePrompt(option.image_prompt)),
      ),
    );
    const urls = await inBatches(jobs, IMAGE_BATCH);
    return {
      items: plan.items.map((item, index) => ({
        ...item,
        audio_url: audio[index],
        options: item.options.map((option, optionIndex) => ({ ...option, image_url: urls[index * 3 + optionIndex] })),
      })),
    };
  },
});

const complete = definePart<KetListenCompleteGen>({
  ...BASE,
  examPart: 'ket_listening_part2',
  promptKey: 'cambridge_ket_listening_part2_a2_generation',
  short: 'kl2',
  schema: KetListenCompleteGenSchema,
  topics: ['a phone booking', 'a club registration', 'a school announcement', 'a sports schedule', 'a message about a party', 'a shop or cafe order'],
  normalize: stripAllDashes,
  rules: completeRules,
  judge: completeJudge,
  labelOf: (plan) => plan.form_title,
  produce: async (plan, env) => {
    const spoken = spokenTranscript(plan.transcript, env.slot);
    const audio_url = await speak(env.ai, env.db, assetPath(env.examPart, env.variant, 'audio.mp3'), spoken.text, spoken.speakers);
    return { ...plan, audio_url };
  },
});

const decide = definePart<KetListenDecideGen>({
  ...BASE,
  examPart: 'ket_listening_part3',
  promptKey: 'cambridge_ket_listening_part3_a2_generation',
  short: 'kl3',
  schema: KetListenDecideGenSchema,
  topics: TOPICS,
  normalize: stripAllDashes,
  rules: decideRules,
  judge: decideJudge,
  labelOf: (plan) => plan.context,
  produce: async (plan, env) => {
    const spoken = spokenTurns(plan.conversation, env.slot);
    const audio_url = await speak(env.ai, env.db, assetPath(env.examPart, env.variant, 'audio.mp3'), spoken.text, spoken.speakers);
    return { ...plan, audio_url };
  },
});

const shortConversations = definePart<KetShortConversationsGen>({
  ...BASE,
  examPart: 'ket_listening_part4',
  promptKey: 'cambridge_ket_listening_part4_a2_generation',
  short: 'kl4c',
  schema: KetShortConversationsGenSchema,
  topics: TOPICS,
  normalize: stripAllDashes,
  rules: shortRules,
  judge: shortJudge,
  labelOf: (plan) => plan.items.map((i) => i.context).join(' | '),
  produce: async (plan, env) => {
    const audio = await inBatches(
      plan.items.map((item) => async () => {
        const spoken = spokenTurns(item.dialogue, env.slot + item.number);
        return speak(env.ai, env.db, assetPath(env.examPart, env.variant, `q${item.number}.mp3`), spoken.text, spoken.speakers);
      }),
      2,
    );
    return { items: plan.items.map((item, index) => ({ ...item, audio_url: audio[index] })) };
  },
});

const listenMatch = definePart<KetListenMatchGen>({
  ...BASE,
  examPart: 'ket_listening_part5',
  promptKey: 'cambridge_ket_listening_part5_a2_generation',
  short: 'kl5m',
  schema: KetListenMatchGenSchema,
  topics: ['presents for a family', 'jobs in a family', 'what friends do at the weekend', 'favourite school subjects', 'things to take on a trip', 'food for a party'],
  normalize: stripAllDashes,
  rules: matchRules,
  judge: matchJudge,
  labelOf: (plan) => plan.instruction,
  produce: async (plan, env) => {
    const spoken = spokenTurns(plan.conversation, env.slot);
    const audio_url = await speak(env.ai, env.db, assetPath(env.examPart, env.variant, 'audio.mp3'), spoken.text, spoken.speakers);
    return { ...plan, audio_url };
  },
});

export const KET_LISTENING_PARTS: PlanPart[] = [choose, complete, decide, shortConversations, listenMatch];
