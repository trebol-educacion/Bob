import 'server-only';

import type { SubmitSpeakingTurn } from '@/actions/assessment/types';
import { createSupabaseAdmin } from '@/lib/supabase/admin';
import { evaluateSpeakingAssessment } from './speaking-evaluation';

type AssessmentSupabase = ReturnType<typeof createSupabaseAdmin>;

export interface RunSpeakingEvaluationInput {
  queueId: string;
  userId: string;
  turns: SubmitSpeakingTurn[];
  currentLevel: string;
  isYl: boolean;
}

/**
 * @param supabase AssessmentSupabase
 * @param queueId string
 * @param error string
 * @returns Promise<void> never throws
 */
async function failAssessment(supabase: AssessmentSupabase, queueId: string, error: string): Promise<void> {
  try {
    await supabase.rpc('fail_assessment', { p_queue_id: queueId, p_error: error });
  } catch (err) {
    console.error(JSON.stringify({ event: 'fail_assessment_error', queueId, error: String(err) }));
  }
}

/**
 * @param input RunSpeakingEvaluationInput
 * @returns Promise<void> evaluates in memory and settles the queue row via RPC; never throws
 */
export async function runSpeakingEvaluation(input: RunSpeakingEvaluationInput): Promise<void> {
  const { queueId, userId, turns, currentLevel, isYl } = input;
  const supabase = createSupabaseAdmin();
  try {
    const outcome = await evaluateSpeakingAssessment({ turns, currentLevel, isYl, userId });
    if (!outcome.ok) {
      await failAssessment(supabase, queueId, outcome.error);
      return;
    }
    const { error } = await supabase.rpc('apply_assessment_result', {
      p_queue_id: queueId,
      p_cefr_band: outcome.evaluation.cefr_band,
      p_confidence: outcome.evaluation.confidence,
      p_feedback: outcome.evaluation.feedback,
    });
    if (error) await failAssessment(supabase, queueId, error.message);
  } catch (err) {
    await failAssessment(supabase, queueId, err instanceof Error ? err.message : String(err));
  }
}
