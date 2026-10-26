import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

const afterCallbacks: Array<() => Promise<unknown>> = [];
vi.mock('next/server', () => ({ after: (cb: () => Promise<unknown>) => { afterCallbacks.push(cb); } }));

const evaluate = vi.fn();
vi.mock('@/lib/assessment/speaking-evaluation', () => ({ evaluateSpeakingAssessment: (...a: unknown[]) => evaluate(...a) }));

const queueInsert = vi.fn();
const rpc = vi.fn();
let supabase: unknown;

vi.mock('@/lib/supabase/server', () => ({ createSupabaseServer: async () => supabase }));
vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdmin: () => ({ rpc }) }));
vi.mock('@/lib/organization/org-frameworks', () => ({
  loadOrganizationFrameworks: async () => ({ frameworks: ['cambridge'] }),
  logOrgFrameworksError: () => undefined,
}));

import { submitAssessmentSpeakingAction } from '@/actions/assessment/speaking';

const turns = [{ turn_number: 1, prompt_key: 'turn_1', audio_base64: 'AAA', mime_type: 'audio/webm', duration_ms: 1000, transcript: 'hi' }];

function chain(result: unknown) {
  const q: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'insert']) q[m] = vi.fn().mockReturnValue(q);
  q.single = vi.fn().mockResolvedValue(result);
  q.maybeSingle = vi.fn().mockResolvedValue(result);
  q.then = (resolve: (v: unknown) => unknown) => resolve({ data: null, error: null });
  return q;
}

function buildSupabase() {
  const table = (name: string) => {
    if (name === 'sessions') return chain({ data: { id: 'sess-1' }, error: null });
    if (name === 'profiles') return chain({ data: { organization_id: 'org-1', cefr_active_level: 'a2' } });
    if (name === 'organizations') return chain({ data: { allow_voice_storage: false } });
    if (name === 'skill_levels') return chain({ data: { cefr_level: 'a2' } });
    if (name === 'assessment_queue') {
      const q = chain({ data: { id: 'queue-1' }, error: null });
      q.insert = queueInsert.mockReturnValue(q);
      return q;
    }
    return chain({ data: null, error: null });
  };
  return {
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
    from: (name: string) => table(name),
    schema: () => ({ from: (name: string) => table(name) }),
  };
}

describe('submitAssessmentSpeakingAction', () => {
  beforeEach(() => {
    afterCallbacks.length = 0;
    queueInsert.mockClear();
    rpc.mockReset();
    evaluate.mockReset();
    rpc.mockResolvedValue({ data: null, error: null });
    supabase = buildSupabase();
  });

  it('crea la cola en processing y registra after sin esperar a Gemini', async () => {
    const result = await submitAssessmentSpeakingAction('a1', turns);
    expect(result).toEqual({ status: 'queued', assessment_id: 'a1' });
    expect(queueInsert).toHaveBeenCalledWith(expect.objectContaining({ status: 'processing', skill: 'speaking', started_at: expect.any(String) }));
    expect(afterCallbacks).toHaveLength(1);
    expect(evaluate).not.toHaveBeenCalled();
  });

  it('aplica el resultado con apply_assessment_result', async () => {
    evaluate.mockResolvedValue({
      ok: true,
      evaluation: { cefr_band: 'a2', confidence: 'high', feedback: { kind: 'k', highlights: [], suggestions: [], overall_message: 'm' } },
    });
    await submitAssessmentSpeakingAction('a1', turns);
    await afterCallbacks[0]();
    expect(evaluate).toHaveBeenCalledWith(expect.objectContaining({ turns, currentLevel: 'a2', isYl: false, userId: 'user-1' }));
    expect(rpc).toHaveBeenCalledWith('apply_assessment_result', expect.objectContaining({ p_queue_id: 'queue-1', p_cefr_band: 'a2', p_confidence: 'high' }));
  });

  it('llama a fail_assessment si la evaluación falla', async () => {
    evaluate.mockResolvedValue({ ok: false, error: 'no_audio' });
    await submitAssessmentSpeakingAction('a1', turns);
    await afterCallbacks[0]();
    expect(rpc).toHaveBeenCalledWith('fail_assessment', { p_queue_id: 'queue-1', p_error: 'no_audio' });
  });

  it('llama a fail_assessment si apply_assessment_result devuelve error', async () => {
    evaluate.mockResolvedValue({
      ok: true,
      evaluation: { cefr_band: 'a2', confidence: 'low', feedback: { kind: 'k', highlights: [], suggestions: [], overall_message: 'm' } },
    });
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    await submitAssessmentSpeakingAction('a1', turns);
    await afterCallbacks[0]();
    expect(rpc).toHaveBeenLastCalledWith('fail_assessment', { p_queue_id: 'queue-1', p_error: 'boom' });
  });

  it('llama a fail_assessment si la evaluación lanza una excepción', async () => {
    evaluate.mockRejectedValue(new Error('crash'));
    await submitAssessmentSpeakingAction('a1', turns);
    await afterCallbacks[0]();
    expect(rpc).toHaveBeenCalledWith('fail_assessment', { p_queue_id: 'queue-1', p_error: 'crash' });
  });
});
