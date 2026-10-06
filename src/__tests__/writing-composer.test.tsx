// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { WritingComposer, type WritingComposerProps } from '@/components/practice/writing/WritingComposer';
import { wordStatus } from '@/lib/writing/word-status';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

function renderComposer(overrides: Partial<WritingComposerProps> = {}) {
  const props: WritingComposerProps = {
    value: 'one two three',
    placeholder: 'Write here',
    wordCount: 3,
    minWords: 5,
    maxWords: 10,
    target: '/ 5-10',
    onChange: vi.fn(),
    onSubmit: vi.fn(),
    ...overrides,
  };
  render(<WritingComposer {...props} />);
  return props;
}

describe('wordStatus', () => {
  it('classifies short, ok and long', () => {
    expect(wordStatus(3, 5, 10)).toBe('short');
    expect(wordStatus(5, 5, 10)).toBe('ok');
    expect(wordStatus(11, 5, 10)).toBe('long');
  });
});

describe('WritingComposer', () => {
  it('Enter adds a line instead of sending the text', () => {
    const props = renderComposer({ wordCount: 6 });
    fireEvent.keyDown(screen.getByLabelText('editorLabel'), { key: 'Enter' });
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  it('cannot send below the minimum and says how many words are missing', () => {
    const props = renderComposer();
    const button = screen.getByRole('button', { name: /submit/ });
    expect(button).toBeDisabled();
    expect(screen.getByText('moreToSend:{"remaining":2}')).toBeInTheDocument();
    fireEvent.click(button);
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  it('sends with the explicit button once the minimum is reached', () => {
    const props = renderComposer({ wordCount: 5 });
    fireEvent.click(screen.getByRole('button', { name: /submit/ }));
    expect(props.onSubmit).toHaveBeenCalledTimes(1);
  });

  it('shows the error instead of the missing words hint', () => {
    renderComposer({ error: 'Could not send' });
    expect(screen.getByRole('alert')).toHaveTextContent('Could not send');
    expect(screen.queryByText(/moreToSend/)).toBeNull();
  });
});
