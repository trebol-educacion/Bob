// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ActivityHeader } from '@/components/activity/ActivityHeader';
import { partLabel } from '@/lib/activity/part-label';

describe('partLabel', () => {
  it('reads the part number from the exam part key', () => {
    expect(partLabel('fce_reading_part7')).toBe('Part 7');
    expect(partLabel('fce_listening_part2')).toBe('Part 2');
  });

  it('returns null without part number', () => {
    expect(partLabel('conversation')).toBeNull();
  });
});

describe('ActivityHeader', () => {
  it('shows title, subtitle and part badge, and goes back', () => {
    const onBack = vi.fn();
    render(<ActivityHeader title="Multiple Matching" subtitle="Match each statement" badge="Part 7" onBack={onBack} />);
    expect(screen.getByText('Multiple Matching')).toBeInTheDocument();
    expect(screen.getByText('Match each statement')).toBeInTheDocument();
    expect(screen.getByText('Part 7')).toBeInTheDocument();
    expect(screen.queryByText(/FCE/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Go back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('omits the badge when there is none', () => {
    const { container } = render(<ActivityHeader title="Conversation" onBack={vi.fn()} />);
    expect(container.querySelectorAll('span')).toHaveLength(0);
  });
});
