// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlacementRequired } from '@/components/placement/PlacementRequired';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));

const begin = vi.fn().mockResolvedValue('unavailable');
const reset = vi.fn();

vi.mock('@/hooks/usePlacementRunner', () => ({
  usePlacementRunner: () => ({
    begin,
    reset,
    cancel: vi.fn(),
    submitStep: vi.fn(),
    status: 'unavailable',
    step: null,
    stepsCompleted: 0,
    resultLevel: null,
    startFailure: { code: 'no_content', retryable: false },
  }),
}));

describe('PlacementRequired sin contenido', () => {
  it('muestra un estado visible y permite continuar en lugar de saltar en silencio', () => {
    const setAppState = vi.fn();
    render(
      <PlacementRequired setAppState={setAppState} refreshSkillLevels={vi.fn()} refreshPendingAssessments={vi.fn()} />
    );
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('unavailableNoContent')).toBeTruthy();
    expect(setAppState).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('unavailableContinue'));
    expect(setAppState).toHaveBeenCalledWith('skill-selection');
  });
});
