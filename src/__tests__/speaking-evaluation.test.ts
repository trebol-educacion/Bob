import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

const callGemini = vi.fn();
const getPrompt = vi.fn();

vi.mock('@/lib/gemini-client', () => ({ callGemini: (...args: unknown[]) => callGemini(...args) }));
vi.mock('@/lib/prompts/db-prompts', () => ({ getPrompt: (...args: unknown[]) => getPrompt(...args) }));

import {
  buildAudioParts,
  buildSpeakingEvalKey,
  buildTranscripts,
  evaluateSpeakingAssessment,
  parseSpeakingEvaluation,
} from '@/lib/assessment/speaking-evaluation';

const turns = [
  { turn_number: 1, prompt_key: 'turn_1', audio_base64: 'AAA', mime_type: 'audio/webm', duration_ms: 1000, transcript: 'hello' },
  { turn_number: 2, prompt_key: 'turn_2', audio_base64: 'BBB', mime_type: 'audio/webm', duration_ms: 1000 },
];

const validJson = JSON.stringify({
  cefr_band: 'a2',
  confidence: 'high',
  feedback: { kind: 'speaking', highlights: ['x'], suggestions: ['y'], overall_message: 'ok' },
});

describe('buildSpeakingEvalKey', () => {
  it('elige la clave YL según pre_a1 o a1', () => {
    expect(buildSpeakingEvalKey('pre_a1', true)).toBe('cefr_assessment_speaking_yl_pre_a1_evaluation');
    expect(buildSpeakingEvalKey('a1', true)).toBe('cefr_assessment_speaking_yl_a1_evaluation');
  });

  it('elige el rango alto para b1 y b2', () => {
    expect(buildSpeakingEvalKey('b1', false)).toBe('cefr_assessment_speaking_b1_b2_evaluation');
    expect(buildSpeakingEvalKey('b2', false)).toBe('cefr_assessment_speaking_b1_b2_evaluation');
  });

  it('elige el rango bajo para el resto', () => {
    expect(buildSpeakingEvalKey('a2', false)).toBe('cefr_assessment_speaking_a1_a2_evaluation');
    expect(buildSpeakingEvalKey('pre_a1', false)).toBe('cefr_assessment_speaking_a1_a2_evaluation');
  });
});

describe('buildTranscripts y buildAudioParts', () => {
  it('numera los turnos y marca los que no tienen transcripción', () => {
    expect(buildTranscripts(turns)).toBe('Turn 1: hello\nTurn 2: [no transcript]');
  });

  it('solo incluye turnos con audio', () => {
    const parts = buildAudioParts([...turns, { ...turns[0], audio_base64: '' }]);
    expect(parts).toHaveLength(2);
    expect(parts[0]).toEqual({ inlineData: { data: 'AAA', mimeType: 'audio/webm' } });
  });
});

describe('parseSpeakingEvaluation', () => {
  it('acepta un resultado válido', () => {
    const outcome = parseSpeakingEvaluation(validJson);
    expect(outcome.ok).toBe(true);
  });

  it('rechaza vacío, JSON roto y bandas o confianzas inválidas', () => {
    expect(parseSpeakingEvaluation(undefined)).toEqual({ ok: false, error: 'empty_response' });
    expect(parseSpeakingEvaluation('{')).toEqual({ ok: false, error: 'invalid_json' });
    expect(parseSpeakingEvaluation(JSON.stringify({ ...JSON.parse(validJson), cefr_band: 'c2' })).ok).toBe(false);
    expect(parseSpeakingEvaluation(JSON.stringify({ ...JSON.parse(validJson), confidence: 'max' })).ok).toBe(false);
  });
});

describe('evaluateSpeakingAssessment', () => {
  beforeEach(() => {
    callGemini.mockReset();
    getPrompt.mockReset();
  });

  it('falla sin llamar a Gemini si no hay audio', async () => {
    const outcome = await evaluateSpeakingAssessment({
      turns: [{ ...turns[0], audio_base64: '' }], currentLevel: 'a2', isYl: false, userId: 'u1',
    });
    expect(outcome).toEqual({ ok: false, error: 'no_audio' });
    expect(callGemini).not.toHaveBeenCalled();
  });

  it('falla si el prompt no existe', async () => {
    getPrompt.mockRejectedValue(new Error('missing'));
    const outcome = await evaluateSpeakingAssessment({ turns, currentLevel: 'a2', isYl: false, userId: 'u1' });
    expect(outcome.ok).toBe(false);
  });

  it('propaga el error de Gemini', async () => {
    getPrompt.mockResolvedValue('prompt');
    callGemini.mockResolvedValue({ ok: false, code: 'timeout' });
    const outcome = await evaluateSpeakingAssessment({ turns, currentLevel: 'a2', isYl: false, userId: 'u1' });
    expect(outcome).toEqual({ ok: false, error: 'gemini_timeout' });
  });

  it('devuelve la evaluación y pasa TRANSCRIPTS al prompt', async () => {
    getPrompt.mockResolvedValue('prompt');
    callGemini.mockResolvedValue({ ok: true, data: { text: validJson } });
    const outcome = await evaluateSpeakingAssessment({ turns, currentLevel: 'b1', isYl: false, userId: 'u1' });
    expect(outcome.ok).toBe(true);
    expect(getPrompt).toHaveBeenCalledWith('cefr_assessment_speaking_b1_b2_evaluation', {
      TRANSCRIPTS: 'Turn 1: hello\nTurn 2: [no transcript]',
    });
  });
});
