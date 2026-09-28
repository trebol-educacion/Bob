import { describe, it, expect } from 'vitest';
import { parseSuggestedAnswer } from '@/lib/practice/model-answer';

describe('parseSuggestedAnswer', () => {
  it('JSON limpio: extrae el campo answer', () => {
    expect(parseSuggestedAnswer('{"answer": "Sure, I would love that!"}')).toBe('Sure, I would love that!');
  });

  it('JSON con vallado de markdown: quita el vallado y extrae el campo', () => {
    const raw = '```json\n{"answer": "Great idea, let us go!"}\n```';
    expect(parseSuggestedAnswer(raw)).toBe('Great idea, let us go!');
  });

  it('JSON con vallado sin la palabra json: tambien lo quita', () => {
    const raw = '```\n{"answer": "See you tomorrow!"}\n```';
    expect(parseSuggestedAnswer(raw)).toBe('See you tomorrow!');
  });

  it('JSON roto (falta la llave de cierre): recupera el campo answer por regex', () => {
    const raw = '{"answer": "Okay, I understand now, thank you!"';
    expect(parseSuggestedAnswer(raw)).toBe('Okay, I understand now, thank you!');
  });

  it('JSON roto con otra forma (ej. respuesta de simulacion antigua): nunca deja llaves crudas', () => {
    const raw = '```json { "completion": [ { "role": "user", "text": "Okay, I understand now." } ] } ```';
    const result = parseSuggestedAnswer(raw);
    expect(result).not.toMatch(/[{}[\]]/);
    expect(result.length).toBeGreaterThan(0);
  });

  it('texto plano: lo devuelve tal cual, solo recortado', () => {
    expect(parseSuggestedAnswer('  Sure, sounds good to me!  ')).toBe('Sure, sounds good to me!');
  });
});
