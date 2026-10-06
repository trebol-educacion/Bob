import { KetShortMessagePlanSchema, type KetShortMessagePlan } from '../../../src/lib/bank-plans/ket-writing-part6';
import { KetPictureStoryPlanSchema, type KetPictureStoryPlan } from '../../../src/lib/bank-plans/ket-writing-part7';
import { A2SessionPlanSchema, a2InterviewQuestions, type A2SessionPlan } from '../../../src/lib/speaking/ket-content';
import { HobbyPlanSchema, PicturePlanSchema, type HobbyPlan, type PicturePlan } from '../../../src/lib/speaking/ket-speaking';
import { assetPath, drawImage, inBatches, soloVoice, speak } from '../assets';
import { stripAllDashes } from '../clean';
import { kidsImagePrompt } from '../kids-image';
import { duplicateIssues, wordsIn } from '../rules';
import { definePart, type PlanPart } from '../types';

const MAX_QUESTION_WORDS = 14;

const ketShortMessage = definePart<KetShortMessagePlan>({
  exam: 'ket',
  cefr: 'a2',
  skill: 'writing',
  examPart: 'ket_writing_part6',
  promptKey: 'cambridge_ket_writing_part6_a2_generation',
  short: 'kw6',
  schema: KetShortMessagePlanSchema,
  topics: ['a birthday', 'a holiday', 'a school event', 'a sports match', 'a weekend visit', 'a new pet'],
  normalize: stripAllDashes,
  rules: (plan) => [
    ...(plan.content_points.length === 3 ? [] : ['content_points must have exactly 3 points']),
    ...duplicateIssues(plan.content_points, 'content point'),
    ...(plan.word_target >= 20 && plan.word_target <= 35 ? [] : ['word_target must be about 25']),
  ],
  labelOf: (plan) => plan.scenario,
});

const ketPictureStory = definePart<KetPictureStoryPlan>({
  exam: 'ket',
  cefr: 'a2',
  skill: 'writing',
  examPart: 'ket_writing_part7',
  promptKey: 'cambridge_ket_writing_part7_a2_generation',
  short: 'kw7',
  schema: KetPictureStoryPlanSchema,
  topics: ['a lost wallet', 'a surprise party', 'a trip to the beach', 'a missed bus', 'a new neighbour', 'a school competition'],
  normalize: stripAllDashes,
  rules: (plan) => [
    ...plan.scenes.flatMap((s, i) => (s.number === i + 1 ? [] : [`scene ${i + 1}: number must be ${i + 1}`])),
    ...duplicateIssues(plan.scenes.map((s) => s.description), 'scene description'),
  ],
  produce: async (plan, env) => {
    const tasks = plan.scenes.map((scene) => async () =>
      drawImage(env.ai, env.db, `${assetPath(env.examPart, env.variant, `scene${scene.number}`)}.jpg`, kidsImagePrompt(scene.image_prompt)),
    );
    const urls = await inBatches(tasks, 3);
    return { ...plan, scenes: plan.scenes.map((scene, index) => ({ ...scene, image_url: urls[index] })) };
  },
  labelOf: (plan) => plan.story_premise,
});

const ketInterview = definePart<A2SessionPlan>({
  exam: 'ket',
  cefr: 'a2',
  skill: 'speaking',
  examPart: 'ket_part1',
  promptKey: 'cambridge_ket_part1_a2_generation',
  short: 'ks1',
  schema: A2SessionPlanSchema,
  normalize: stripAllDashes,
  rules: (plan) => [
    ...duplicateIssues(a2InterviewQuestions(plan), 'question'),
    ...(plan.topic1.trim().toLowerCase() === plan.topic2.trim().toLowerCase() ? ['topic1 and topic2 must differ'] : []),
    ...a2InterviewQuestions(plan).filter((q) => wordsIn(q) > MAX_QUESTION_WORDS).map((q) => `question too long: "${q}"`),
  ],
  labelOf: (plan) => `${plan.topic1} / ${plan.topic2}`,
});

const ketHobbyTalk = definePart<HobbyPlan>({
  exam: 'ket',
  cefr: 'a2',
  skill: 'speaking',
  examPart: 'ket_part2',
  promptKey: 'cambridge_ket_part2_a2_generation',
  short: 'ks2',
  schema: HobbyPlanSchema,
  topics: ['sport', 'music', 'cooking', 'reading', 'drawing', 'video games', 'dancing', 'gardening'],
  message: (prompt, ctx) =>
    `${prompt}\n\nHobby for this exercise: ${ctx.topic}. Do not reuse these existing hobbies: ${ctx.existing.join(' | ') || 'none'}. Return the JSON only.`,
  normalize: stripAllDashes,
  rules: (plan) => (wordsIn(plan.instruction) > 40 ? ['instruction must be one short sentence'] : []),
  produce: async (plan, env) => {
    const [imageUrl, audioUrl] = await Promise.all([
      drawImage(env.ai, env.db, `${assetPath(env.examPart, env.variant, 'scene')}.jpg`, kidsImagePrompt(plan.image_prompt)),
      speak(env.ai, env.db, `${assetPath(env.examPart, env.variant, 'instruction')}.mp3`, plan.instruction, soloVoice(env.slot)),
    ]);
    return { ...plan, image_url: imageUrl, instruction_audio_url: audioUrl };
  },
  labelOf: (plan) => plan.hobby,
});

const ketDescribePicture = definePart<PicturePlan>({
  exam: 'ket',
  cefr: 'a2',
  skill: 'speaking',
  examPart: 'ket_part3',
  promptKey: 'cambridge_ket_part3_a2_generation',
  short: 'ks3',
  schema: PicturePlanSchema,
  topics: ['a school playground', 'a family kitchen', 'a sports field', 'a street market', 'a park in summer', 'a classroom'],
  message: (prompt, ctx) =>
    `${prompt}\n\nScene setting for this exercise: ${ctx.topic}. Do not reuse these existing scenes: ${ctx.existing.join(' | ') || 'none'}. Return the JSON only.`,
  normalize: stripAllDashes,
  produce: async (plan, env) => {
    const [imageUrl, audioUrl] = await Promise.all([
      drawImage(env.ai, env.db, `${assetPath(env.examPart, env.variant, 'scene')}.jpg`, kidsImagePrompt(plan.image_prompt)),
      speak(env.ai, env.db, `${assetPath(env.examPart, env.variant, 'instruction')}.mp3`, plan.instruction, soloVoice(env.slot)),
    ]);
    return { ...plan, image_url: imageUrl, instruction_audio_url: audioUrl };
  },
  labelOf: (plan) => plan.scene_description,
});

export const KET_MEDIA_PARTS: PlanPart[] = [ketShortMessage, ketPictureStory, ketInterview, ketHobbyTalk, ketDescribePicture];
