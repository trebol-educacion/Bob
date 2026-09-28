// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/hooks/useAudioRecorder', () => ({
  useAudioRecorder: vi.fn(),
}));

import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { PracticeControls } from '@/components/practice/free/PracticeControls';

function baseProps(overrides: Partial<Parameters<typeof PracticeControls>[0]> = {}) {
  return {
    labels: {
      placeholder: 'Type your answer...',
      modelAnswer: 'Show me an answer',
      exit: 'Exit',
      finish: 'Finish',
      recording: 'Recording',
    },
    inputText: '',
    onInputTextChange: vi.fn(),
    onSendText: vi.fn(),
    onSendAudio: vi.fn(),
    onRequestModelAnswer: vi.fn(),
    onExit: vi.fn(),
    onFinish: vi.fn(),
    isProcessing: false,
    pendingModelAnswer: null,
    ...overrides,
  };
}

describe('PracticeControls', () => {
  it('estado grabando: muestra el tiempo transcurrido y el boton de parar', () => {
    vi.mocked(useAudioRecorder).mockReturnValue({
      isRecording: true,
      elapsedSeconds: 7,
      startRecording: vi.fn(),
      stopRecording: vi.fn(),
    });

    render(<PracticeControls {...baseProps()} />);

    expect(screen.getByText('Recording')).toBeInTheDocument();
    expect(screen.getByText('0:07')).toBeInTheDocument();
  });

  it('microfono bloqueado mientras hay un turno en curso (isProcessing)', () => {
    vi.mocked(useAudioRecorder).mockReturnValue({
      isRecording: false,
      elapsedSeconds: 0,
      startRecording: vi.fn(),
      stopRecording: vi.fn(),
    });

    render(<PracticeControls {...baseProps({ isProcessing: true })} />);

    const buttons = screen.getAllByRole('button');
    const micButton = buttons.find((button) => button.querySelector('svg.lucide-mic'));
    expect(micButton).toBeDefined();
    expect(micButton).toBeDisabled();
  });

  it('microfono disponible cuando no hay turno en curso', () => {
    vi.mocked(useAudioRecorder).mockReturnValue({
      isRecording: false,
      elapsedSeconds: 0,
      startRecording: vi.fn(),
      stopRecording: vi.fn(),
    });

    render(<PracticeControls {...baseProps({ isProcessing: false })} />);

    const buttons = screen.getAllByRole('button');
    const micButton = buttons.find((button) => button.querySelector('svg.lucide-mic'));
    expect(micButton).toBeDefined();
    expect(micButton).not.toBeDisabled();
  });
});
