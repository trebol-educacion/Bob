// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PlacementResult } from '@/components/placement/PlacementResult';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

describe('PlacementResult', () => {
  it('shows the level obtained for the skill and continues on demand', () => {
    const onContinue = vi.fn();
    render(<PlacementResult skill="reading" level="a2" onContinue={onContinue} />);
    expect(screen.getByTestId('placement-result-level')).toHaveTextContent('A2');
    expect(screen.getByText('levelLabel:{"skill":"reading"}')).toBeInTheDocument();
    expect(onContinue).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'continue' }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
