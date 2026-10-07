import { z } from 'zod';

export const TOEFL_INTERVIEW_QUESTIONS = 4;

export const ToeflInterviewDraftSchema = z.object({
  topic: z.string().min(1),
  avatar_intro: z.string().min(1),
  questions: z.array(z.string().min(1)).min(3).max(TOEFL_INTERVIEW_QUESTIONS),
  intro_audio_url: z.string().optional(),
  question_audio_urls: z.array(z.string()).optional(),
});

export const ToeflInterviewBankSchema = z.object({
  topic: z.string().min(1),
  avatar_intro: z.string().min(1),
  questions: z.array(z.string().min(1)).length(TOEFL_INTERVIEW_QUESTIONS),
  intro_audio_url: z.string().min(1),
  question_audio_urls: z.array(z.string().min(1)).length(TOEFL_INTERVIEW_QUESTIONS),
});

export type ToeflInterviewDraft = z.infer<typeof ToeflInterviewDraftSchema>;
export type ToeflInterviewBank = z.infer<typeof ToeflInterviewBankSchema>;
