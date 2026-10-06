// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { usePlacementRunner } from '@/hooks/usePlacementRunner';

vi.mock('@/actions/placement/start', () => ({
  startPlacementAction: vi.fn(),
  cancelPlacementAction: vi.fn(),
}));

vi.mock('@/actions/placement/answer', () => ({
  answerPlacementStepAction: vi.fn(),
}));

import { startPlacementAction, cancelPlacementAction } from '@/actions/placement/start';
import { answerPlacementStepAction } from '@/actions/placement/answer';

const CURATED_GROUP = {
  id: 'group-1',
  exam: 'cefr' as const,
  skill: 'reading' as const,
  cefr_level: 'a2' as const,
  difficulty: 1 as const,
  purpose: 'placement' as const,
  module_code: null,
  stimulus_text: 'A short text',
  stimulus_audio_url: null,
  stimulus_image_url: null,
  source: 'official' as const,
  status: 'published' as const,
  created_at: '2026-01-01T00:00:00.000Z',
};

const CURATED_ITEM = {
  id: 'item-1',
  framework: 'cefr',
  exam_part: 'placement',
  cefr_level: 'a2' as const,
  variant_id: 'v1',
  stimulus_audio_url: null,
  stimulus_text: null,
  stimulus_image_url: null,
  question: 'What is true?',
  options: [{ key: 'A', label: 'Option A' }],
  source: 'curated' as const,
};

describe('usePlacementRunner — se activa solo con contenido curado', () => {
  beforeEach(() => {
    vi.mocked(startPlacementAction).mockReset();
    vi.mocked(cancelPlacementAction).mockReset();
    vi.mocked(answerPlacementStepAction).mockReset();
  });

  it('con status "ok" (contenido curado) entra en modo curated con el paso recibido', async () => {
    vi.mocked(startPlacementAction).mockResolvedValue({
      status: 'ok',
      attempt_id: 'attempt-1',
      level: 'a2',
      group: CURATED_GROUP,
      items: [CURATED_ITEM],
    });

    const { result } = renderHook(() => usePlacementRunner());

    await act(async () => {
      const outcome = await result.current.begin('reading');
      expect(outcome).toBe('curated');
    });

    await waitFor(() => {
      expect(result.current.status).toBe('curated');
    });
    expect(result.current.step?.group.id).toBe('group-1');
  });

  it('con error no_content no entra en curated y expone el fallo para mostrarlo', async () => {
    vi.mocked(startPlacementAction).mockResolvedValue({ status: 'error', code: 'no_content', retryable: false });

    const { result } = renderHook(() => usePlacementRunner());

    await act(async () => {
      const outcome = await result.current.begin('listening');
      expect(outcome).toBe('unavailable');
    });

    await waitFor(() => {
      expect(result.current.status).toBe('unavailable');
    });
    expect(result.current.step).toBeNull();
    expect(result.current.startFailure).toEqual({ code: 'no_content', retryable: false });
  });

  it('con status "pending" tampoco entra en curated', async () => {
    vi.mocked(startPlacementAction).mockResolvedValue({ status: 'pending' });

    const { result } = renderHook(() => usePlacementRunner());

    await act(async () => {
      const outcome = await result.current.begin('reading');
      expect(outcome).toBe('pending');
    });
    expect(result.current.step).toBeNull();
  });

  it('submitStep con done:false avanza al siguiente grupo curado', async () => {
    vi.mocked(startPlacementAction).mockResolvedValue({
      status: 'ok',
      attempt_id: 'attempt-1',
      level: 'a2',
      group: CURATED_GROUP,
      items: [CURATED_ITEM],
    });
    vi.mocked(answerPlacementStepAction).mockResolvedValue({
      status: 'ok',
      done: false,
      attempt_id: 'attempt-1',
      level: 'a2',
      group: { ...CURATED_GROUP, id: 'group-2' },
      items: [CURATED_ITEM],
    });

    const { result } = renderHook(() => usePlacementRunner());
    await act(async () => {
      await result.current.begin('reading');
    });

    await act(async () => {
      await result.current.submitStep([{ item_id: 'item-1', selected_key: 'A' }]);
    });

    expect(result.current.status).toBe('curated');
    expect(result.current.step?.group.id).toBe('group-2');
    expect(result.current.stepsCompleted).toBe(1);
  });

  it('submitStep con done:true termina y guarda el nivel resultante', async () => {
    vi.mocked(startPlacementAction).mockResolvedValue({
      status: 'ok',
      attempt_id: 'attempt-1',
      level: 'a2',
      group: CURATED_GROUP,
      items: [CURATED_ITEM],
    });
    vi.mocked(answerPlacementStepAction).mockResolvedValue({
      status: 'ok',
      done: true,
      attempt_id: 'attempt-1',
      result_level: 'a2',
    });

    const { result } = renderHook(() => usePlacementRunner());
    await act(async () => {
      await result.current.begin('reading');
    });

    await act(async () => {
      await result.current.submitStep([{ item_id: 'item-1', selected_key: 'A' }]);
    });

    expect(result.current.status).toBe('done');
    expect(result.current.step).toBeNull();
    expect(result.current.resultLevel).toBe('a2');
  });

  it('cancel llama a cancelPlacementAction y resetea el estado', async () => {
    vi.mocked(startPlacementAction).mockResolvedValue({
      status: 'ok',
      attempt_id: 'attempt-1',
      level: 'a2',
      group: CURATED_GROUP,
      items: [CURATED_ITEM],
    });
    vi.mocked(cancelPlacementAction).mockResolvedValue({ ok: true });

    const { result } = renderHook(() => usePlacementRunner());
    await act(async () => {
      await result.current.begin('reading');
    });

    await act(async () => {
      await result.current.cancel();
    });

    expect(cancelPlacementAction).toHaveBeenCalledWith('attempt-1');
    expect(result.current.status).toBe('idle');
    expect(result.current.step).toBeNull();
  });
});
