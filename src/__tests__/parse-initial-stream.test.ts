import { describe, it, expect } from 'vitest';
import { extractPartialStringField, parseInitialTurnStream } from '@/lib/practice/parse-initial-stream';

describe('extractPartialStringField', () => {
  it('devuelve null si la clave no aparece todavia', () => {
    expect(extractPartialStringField('{"fram', 'framing')).toBeNull();
  });

  it('devuelve el valor parcial mientras el buffer sigue creciendo', () => {
    const result = extractPartialStringField('{"message": "Hello, how a', 'message');
    expect(result).toEqual({ value: 'Hello, how a', complete: false });
  });

  it('marca complete cuando encuentra la comilla de cierre', () => {
    const result = extractPartialStringField('{"message": "Hello!", "framing": "x"}', 'message');
    expect(result).toEqual({ value: 'Hello!', complete: true });
  });

  it('procesa secuencias de escape', () => {
    const result = extractPartialStringField('{"message": "Line one\\nLine two \\"quoted\\""}', 'message');
    expect(result).toEqual({ value: 'Line one\nLine two "quoted"', complete: true });
  });

  it('no revienta con un escape cortado a mitad de chunk', () => {
    const result = extractPartialStringField('{"message": "Hello\\', 'message');
    expect(result).toEqual({ value: 'Hello', complete: false });
  });

  it('encuentra el campo sin importar el orden de las claves', () => {
    const result = extractPartialStringField('{"framing": "La escena", "message": "Hi!"}', 'message');
    expect(result).toEqual({ value: 'Hi!', complete: true });
  });
});

describe('parseInitialTurnStream', () => {
  it('devuelve valores vacios cuando el buffer esta vacio', () => {
    expect(parseInitialTurnStream('')).toEqual({ framing: '', message: '', messageComplete: false });
  });

  it('extrae framing y message a la vez conforme llegan', () => {
    expect(parseInitialTurnStream('{"framing": "La conversacion')).toEqual({
      framing: 'La conversacion',
      message: '',
      messageComplete: false,
    });
  });

  it('marca messageComplete al cerrar el campo message', () => {
    const buffer = '{"framing": "Listo", "message": "Hello there!"}';
    expect(parseInitialTurnStream(buffer)).toEqual({
      framing: 'Listo',
      message: 'Hello there!',
      messageComplete: true,
    });
  });
});
