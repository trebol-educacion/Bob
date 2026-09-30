// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ChatInputBar } from '@/components/chat/ChatInputBar';

afterEach(cleanup);

describe('ChatInputBar text variant', () => {
  it('keeps the textarea editable while only sending is blocked', () => {
    const onSend = vi.fn();
    render(
      <ChatInputBar variant="text" value="short" placeholder="p" sendDisabled onChange={vi.fn()} onSend={onSend} />,
    );
    expect(screen.getByPlaceholderText('p')).toBeEnabled();
    expect(screen.getByLabelText('Send')).toBeDisabled();
  });

  it('disables the textarea and sending when disabled', () => {
    render(<ChatInputBar variant="text" value="x" placeholder="p" disabled onChange={vi.fn()} onSend={vi.fn()} />);
    expect(screen.getByPlaceholderText('p')).toBeDisabled();
    expect(screen.getByLabelText('Send')).toBeDisabled();
  });

  it('sends when enabled and not blocked', () => {
    const onSend = vi.fn();
    render(<ChatInputBar variant="text" value="ok" placeholder="p" onChange={vi.fn()} onSend={onSend} />);
    fireEvent.click(screen.getByLabelText('Send'));
    expect(onSend).toHaveBeenCalled();
  });
});
