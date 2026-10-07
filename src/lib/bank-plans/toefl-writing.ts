import { z } from 'zod';

export const ToeflEmailPlanSchema = z.object({
  scenario: z.string().min(1),
  recipient: z.string().min(1),
  purpose: z.string().min(1),
});

const PostSchema = z.object({ name: z.string().min(1), text: z.string().min(1) });

export const ToeflAcademicPlanSchema = z.object({
  professor_post: PostSchema,
  peer_posts: z.array(PostSchema).length(2),
  writing_prompt: z.string().min(1),
});

export type ToeflEmailPlan = z.infer<typeof ToeflEmailPlanSchema>;
export type ToeflAcademicPlan = z.infer<typeof ToeflAcademicPlanSchema>;
