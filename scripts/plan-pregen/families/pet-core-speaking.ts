import { PETDiscussionPlanSchema, PETInterviewPlanSchema, type PETDiscussionPlan, type PETInterviewPlan } from '../../../src/lib/speaking/pet-content';
import { PetPictureGenerationSchema, type PetPicturePlan } from '../../../src/lib/bank-plans/pet-p2';
import { PetCollaborativePlanSchema, type PetCollaborativePlan } from '../../../src/lib/bank-plans/pet-p3';
import { B1_PICTURE_TOPICS } from '../../../src/actions/modes/pet-p2/shared';
import { assetPath, drawImage, loadPromptText } from '../assets';
import { stripAllDashes } from '../clean';
import { duplicateIssues } from '../rules';
import { definePart, type PlanPart } from '../types';
import type { z } from 'zod';

const P4_TOPICS = [
  'Free time and hobbies',
  'Health and fitness',
  'Travel and holidays',
  'School and learning',
  'Technology and communication',
  'Food and eating out',
  'Entertainment and media',
  'Family and friends',
  'Transport and getting around',
];

const P3_TOPICS = [
  'a class trip',
  'a birthday celebration',
  'improving the school',
  'a weekend with friends',
  'staying healthy',
  'a gift for a friend',
  'a holiday plan',
  'a school club',
  'a charity event',
];

type PictureGeneration = z.infer<typeof PetPictureGenerationSchema>;

const interview = definePart<PETInterviewPlan>({
  exam: 'pet',
  cefr: 'b1',
  skill: 'speaking',
  examPart: 'pet_p1',
  promptKey: 'cambridge_pet_p1_b1_generation',
  short: 'ps1',
  schema: PETInterviewPlanSchema,
  topics: ['Daily Life', 'Places'],
  message: (prompt, ctx) => {
    const avoid = ctx.existing.length > 0 ? ` Do not reuse these existing questions: ${ctx.existing.join(' | ')}.` : '';
    return `${prompt}\n\nUse "${ctx.topic}" as the topicBC label and write questions different from a standard set (set number ${ctx.slot}).${avoid} Return the JSON only.`;
  },
  normalize: stripAllDashes,
  rules: (plan) => [
    ...(plan.phase1_questions.length === 2 ? [] : ['phase1_questions must have exactly 2 questions']),
    ...(plan.topicA_questions.length === 2 ? [] : ['topicA_questions must have exactly 2 questions']),
    ...(plan.topicBC_questions.length === 2 ? [] : ['topicBC_questions must have exactly 2 questions']),
    ...duplicateIssues([...plan.phase1_questions, ...plan.topicA_questions, ...plan.topicBC_questions], 'question'),
  ],
  labelOf: (plan) => plan.topicBC_questions.join(' / '),
});

const picture = definePart<PictureGeneration>({
  exam: 'pet',
  cefr: 'b1',
  skill: 'speaking',
  examPart: 'pet_p2',
  promptKey: 'cambridge_pet_p2_b1_generation',
  short: 'ps2',
  schema: PetPictureGenerationSchema,
  topics: [...B1_PICTURE_TOPICS],
  message: (prompt, ctx) => {
    const avoid = ctx.existing.length > 0 ? ` Do not reuse these scenes: ${ctx.existing.join(' | ')}.` : '';
    return `${prompt.replaceAll('{TOPIC}', ctx.topic)}${avoid}\n\nReturn the JSON only.`;
  },
  normalize: stripAllDashes,
  rules: (plan) => [
    ...Object.entries(plan.reference_vocabulary).flatMap(([dimension, words]) =>
      words.length >= 2 ? [] : [`reference_vocabulary.${dimension} needs at least 2 words`],
    ),
    ...(/\b(people|person|man|woman|girl|boy|friends|family|children|students|couple)\b/i.test(plan.scene_prompt)
      ? []
      : ['scene_prompt must describe at least one visible person']),
  ],
  produce: async (plan, env) => {
    const template = await loadPromptText(env.db, 'cambridge_pet_p2_b1_image_gen');
    const prompt = template.replaceAll('{TOPIC}', plan.topic).replaceAll('{SCENE_PROMPT}', plan.scene_prompt);
    const image_url = await drawImage(env.ai, env.db, assetPath(env.examPart, env.variant, 'scene.jpg'), prompt);
    return { ...plan, image_url } as PetPicturePlan;
  },
  labelOf: (plan) => plan.scene_prompt.slice(0, 120),
});

const collaborative = definePart<PetCollaborativePlan>({
  exam: 'pet',
  cefr: 'b1',
  skill: 'speaking',
  examPart: 'pet_p3',
  promptKey: 'cambridge_pet_p3_b1_generation',
  short: 'ps3',
  schema: PetCollaborativePlanSchema,
  topics: P3_TOPICS,
  message: (prompt, ctx) => {
    const avoid = ctx.existing.length > 0 ? ` Do not reuse these existing scenarios: ${ctx.existing.join(' | ')}.` : '';
    return `${prompt}\n\nScenario theme for this exercise: ${ctx.topic}.${avoid} Return the JSON only.`;
  },
  normalize: stripAllDashes,
  rules: (plan) => duplicateIssues(plan.options, 'option'),
  labelOf: (plan) => plan.topic,
});

const discussion = definePart<PETDiscussionPlan>({
  exam: 'pet',
  cefr: 'b1',
  skill: 'speaking',
  examPart: 'pet_p4',
  promptKey: 'cambridge_pet_p4_b1_generation',
  short: 'ps4',
  schema: PETDiscussionPlanSchema,
  topics: P4_TOPICS,
  message: (prompt, ctx) => {
    const avoid = ctx.existing.length > 0 ? ` Do not reuse these existing topics: ${ctx.existing.join(' | ')}.` : '';
    return `${prompt}\n\nGeneral topic for this discussion: ${ctx.topic}.${avoid} Return the JSON only.`;
  },
  normalize: stripAllDashes,
  rules: (plan) => [
    ...(plan.questions.length === 6 ? [] : ['questions must have exactly 6 questions']),
    ...duplicateIssues(plan.questions, 'question'),
  ],
  labelOf: (plan) => plan.topic,
});

export const PET_SPEAKING_PARTS: PlanPart[] = [interview, picture, collaborative, discussion];
