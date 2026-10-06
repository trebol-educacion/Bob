import { z } from 'zod';

export const HOBBY_PLAN_KIND = 'hobby_talk_prompt';
export const HOBBY_FEEDBACK_KIND = 'hobby_talk_feedback';
export const PICTURE_PLAN_KIND = 'picture_desc_prompt';
export const PICTURE_FEEDBACK_KIND = 'picture_desc_feedback';

export const KetRubricSchema = z.object({
  task_coverage: z.number().int().min(0).max(4),
  grammar: z.number().int().min(0).max(4),
  vocabulary: z.number().int().min(0).max(4),
  fluency: z.number().int().min(0).max(4),
});

export const KetSpeakingFeedbackSchema = z.object({
  understood: z.boolean(),
  highlights: z.array(z.string()),
  suggestions: z.array(z.string()),
  model_answer: z.string().nullable().optional(),
  rubric: KetRubricSchema.nullable().optional(),
});

export interface KetSpeakingFeedback {
  understood: boolean;
  highlights: string[];
  suggestions: string[];
  model_answer: string | null;
  rubric?: z.infer<typeof KetRubricSchema>;
}

export const HobbyPlanSchema = z.object({
  hobby: z.string(),
  instruction: z.string(),
  bullet_points: z.array(z.string()).min(2).max(4),
  image_prompt: z.string(),
  image_url: z.string().optional(),
  instruction_audio_url: z.string().optional(),
  exam_part: z.string().optional(),
  bank_group_id: z.string().optional(),
});

export type HobbyPlan = z.infer<typeof HobbyPlanSchema>;

export const PicturePlanSchema = z.object({
  scene_description: z.string(),
  instruction: z.string(),
  image_prompt: z.string(),
  image_url: z.string().optional(),
  instruction_audio_url: z.string().optional(),
  exam_part: z.string().optional(),
  bank_group_id: z.string().optional(),
});

export type PicturePlan = z.infer<typeof PicturePlanSchema>;

export interface RestorableKetMessage {
  role: string;
  msg_type: string;
  content_json?: unknown;
}

export interface RestoredKetSpeaking<TPlan> {
  plan: TPlan;
  feedback: KetSpeakingFeedback | null;
}

/**
 * @param feedback parsed schema output
 * @returns feedback with null rubric and model answer normalised away
 */
export function normalizeKetFeedback(feedback: z.infer<typeof KetSpeakingFeedbackSchema>): KetSpeakingFeedback {
  return {
    understood: feedback.understood,
    highlights: feedback.highlights,
    suggestions: feedback.suggestions,
    model_answer: feedback.model_answer ?? null,
    rubric: feedback.rubric ?? undefined,
  };
}

/**
 * @param messages stored messages of a KET speaking session
 * @param planKind content_json kind of the persisted plan message
 * @param planSchema schema of the plan payload
 * @returns plan and final feedback found in the history, or null without a valid plan
 */
export function restoreKetSpeaking<TPlan>(
  messages: RestorableKetMessage[],
  planKind: string,
  planSchema: z.ZodType<TPlan>,
): RestoredKetSpeaking<TPlan> | null {
  let plan: TPlan | null = null;
  let feedback: KetSpeakingFeedback | null = null;
  for (const message of messages) {
    const json = message.content_json as { kind?: string } | null;
    if (message.role !== 'bob' || !json) continue;
    if (plan === null && json.kind === planKind) {
      const parsed = planSchema.safeParse(json);
      if (parsed.success) plan = parsed.data;
    }
    if (message.msg_type === 'evaluation') {
      const parsed = KetSpeakingFeedbackSchema.safeParse(json);
      if (parsed.success) feedback = normalizeKetFeedback(parsed.data);
    }
  }
  return plan ? { plan, feedback } : null;
}
