import { describe, it, expect } from 'vitest';
import {
  buildExchangeMessages,
  buildOpeningMessages,
  buildPracticeResultEvaluation,
  restorePractice,
  type StoredPracticeMessage,
} from '@/lib/practice/messages';
import { toScore10 } from '@/lib/session/score';
import { parsePracticeSessionMode } from '@/lib/practice/mode-prompt-key';

const SIGNAL = { hasAudio: true, hintUsed: true, modelAnswerUsed: false, turnScore: 72 };

function asStored(messages: ReturnType<typeof buildOpeningMessages>): StoredPracticeMessage[] {
  return messages.map((m) => ({
    role: m.role,
    msg_type: m.msgType,
    content_text: m.contentText ?? null,
    content_json: (m.contentJson as Record<string, unknown>) ?? null,
  }));
}

describe('mensajes de practica libre', () => {
  it('la apertura guarda imagen https y primer mensaje con el encuadre; descarta data uris', () => {
    const withImage = buildOpeningMessages({ framing: 'F', message: 'Hello', imageUrl: 'https://x/y.png', imagePrompt: 'p' });
    expect(withImage.map((m) => m.msgType)).toEqual(['image_scene', 'text']);
    const inline = buildOpeningMessages({ framing: 'F', message: 'Hello', imageUrl: 'data:image/png;base64,AAAA', imagePrompt: 'p' });
    expect(inline.map((m) => m.msgType)).toEqual(['text']);
  });

  it('un intercambio se reconstruye con conversacion, señales de andamiaje y encuadre', () => {
    const stored = asStored([
      ...buildOpeningMessages({ framing: 'Bienvenido', message: 'Hi there', imageUrl: 'https://x/y.png', imagePrompt: null }),
      ...buildExchangeMessages({ text: 'Hello Bob', signal: SIGNAL }, 'Nice to meet you'),
    ]);
    const restored = restorePractice(stored);
    expect(restored.framing).toBe('Bienvenido');
    expect(restored.imageUrl).toBe('https://x/y.png');
    expect(restored.messages).toEqual([
      { role: 'model', text: 'Hi there' },
      { role: 'user', text: 'Hello Bob' },
      { role: 'model', text: 'Nice to meet you' },
    ]);
    expect(restored.turnSignals).toEqual([SIGNAL]);
    expect(restored.result).toBeNull();
  });

  it('la evaluacion final lleva score_10 canonico y se restaura como resultado', () => {
    const detail = { participation: 5, fluency: 6, independence: 7, comprehension: 8 };
    const evaluation = buildPracticeResultEvaluation({ score: 6.4, detail, feedback: 'Well done' });
    expect(toScore10(evaluation)).toBe(6.4);
    const restored = restorePractice([{ role: 'bob', msg_type: 'evaluation', content_json: evaluation }]);
    expect(restored.result).toEqual({ score: 6.4, detail, feedback: 'Well done' });
  });

  it('el modo de sesion practice_* se traduce a la actividad y lo demas se ignora', () => {
    expect(parsePracticeSessionMode('practice_picture')).toBe('picture');
    expect(parsePracticeSessionMode('practice_karaoke')).toBeNull();
    expect(parsePracticeSessionMode('generic_conversation')).toBeNull();
  });
});
