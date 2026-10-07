// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { MatchingBoard } from '@/components/practice/matching';

const choices = ['A', 'B', 'C'].map((key) => ({ key, label: key }));
const questions = [1, 2].map((number) => ({ id: `q${number}`, number, text: `Speaker ${number}` }));

describe('MatchingBoard repeat rule', () => {
  it('disables a letter already chosen for another question when repeats are not allowed', () => {
    render(<MatchingBoard choices={choices} questions={questions} answers={{ q1: 'B' }} onAnswer={vi.fn()} allowRepeatOptions={false} />);
    expect(screen.getByLabelText('Question 2: B')).toBeDisabled();
    expect(screen.getByLabelText('Question 1: B')).not.toBeDisabled();
  });

  it('keeps every letter available when repeats are allowed', () => {
    render(<MatchingBoard choices={choices} questions={questions} answers={{ q1: 'B' }} onAnswer={vi.fn()} />);
    expect(screen.getByLabelText('Question 2: B')).not.toBeDisabled();
  });
});
