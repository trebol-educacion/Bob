import { z } from 'zod';

const SceneSchema = z.object({
  number: z.number().int().min(1).max(3),
  description: z.string().min(1),
  image_prompt: z.string().min(1),
  image_url: z.string().optional(),
});

export const KetPictureStoryPlanSchema = z.object({
  story_premise: z.string().min(1),
  scenes: z.array(SceneSchema).length(3),
});

export type KetStoryScene = z.infer<typeof SceneSchema>;
export type KetPictureStoryPlan = z.infer<typeof KetPictureStoryPlanSchema>;
