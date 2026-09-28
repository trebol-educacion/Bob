// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/actions/gemini', () => ({ generateSpeechAction: vi.fn() }));
vi.mock('@/actions/modes/yl', () => ({ getOrCreateCueAudioAction: vi.fn() }));

import { ConversationMessages } from '@/components/conversation/ConversationMessages';
import type { ChatMessage } from '@/actions/gemini/types';

function baseProps(overrides: Partial<Parameters<typeof ConversationMessages>[0]> = {}) {
  const messages: ChatMessage[] = [{ role: 'model', text: 'Hello there!' }];
  return {
    framing: '',
    messages,
    visibleTexts: {},
    playCounts: {},
    isGeneratingAudio: null,
    onListen: vi.fn(),
    onToggleVisibleText: vi.fn(),
    scenarioTitle: 'Scenario',
    listenAudioLabel: 'Listen to hear the message',
    repeatAudioLabel: 'Listen again',
    playAudioLabel: 'Listen',
    showHintLabel: 'Show hint',
    hideTextLabel: 'Hide text',
    listenFirst: true,
    ...overrides,
  };
}

describe('ConversationMessages', () => {
  it('modo con escucha primero (Conversation): el texto se oculta hasta escuchar', () => {
    render(<ConversationMessages {...baseProps({ listenFirst: true })} />);

    expect(screen.queryByText('Hello there!')).toBeNull();
    expect(screen.getByText('Listen to hear the message')).toBeInTheDocument();
  });

  it('modo sin escucha primero (Situation/Picture): el texto se ve desde el principio', () => {
    render(<ConversationMessages {...baseProps({ listenFirst: false })} />);

    expect(screen.getByText('Hello there!')).toBeInTheDocument();
    expect(screen.queryByText('Listen to hear the message')).toBeNull();
  });

  it('revelado tras escuchar: con listenFirst, visibleTexts marca el turno y el texto aparece', () => {
    render(<ConversationMessages {...baseProps({ listenFirst: true, visibleTexts: { 0: true } })} />);

    expect(screen.getByText('Hello there!')).toBeInTheDocument();
    expect(screen.queryByText('Listen to hear the message')).toBeNull();
  });

  it('pista a la segunda reproduccion: solo aparece con listenFirst y playCounts >= 2', () => {
    const { rerender } = render(
      <ConversationMessages {...baseProps({ listenFirst: true, playCounts: { 0: 1 } })} />
    );
    expect(screen.queryByText('Show hint')).toBeNull();

    rerender(<ConversationMessages {...baseProps({ listenFirst: true, playCounts: { 0: 2 } })} />);
    expect(screen.getByText('Show hint')).toBeInTheDocument();
  });

  it('sin escucha primero nunca se muestra el boton de pista, aunque haya dos reproducciones', () => {
    render(<ConversationMessages {...baseProps({ listenFirst: false, playCounts: { 0: 2 } })} />);
    expect(screen.queryByText('Show hint')).toBeNull();
  });
});
