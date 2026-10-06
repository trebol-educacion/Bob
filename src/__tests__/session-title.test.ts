import { describe, it, expect } from 'vitest';
import { sessionTitle } from '@/lib/session/title';

describe('sessionTitle', () => {
  it('formatea lectura con etiqueta de parte', () => {
    expect(sessionTitle('cambridge_fce_reading_part2')).toBe('Reading · Part 2 · Open Cloze');
  });

  it('formatea speaking de FCE', () => {
    expect(sessionTitle('cambridge_fce_p3')).toBe('Speaking · Part 3 · Collaborative Task');
    expect(sessionTitle('cambridge_fce_p1')).toBe('Speaking · Part 1 · Interview');
  });

  it('formatea writing y listening', () => {
    expect(sessionTitle('cambridge_fce_writing_part1')).toBe('Writing · Part 1 · Essay');
    expect(sessionTitle('cambridge_fce_listening_part3')).toBe('Listening · Part 3 · Five Speakers');
  });

  it('cubre PET speaking sin palabra skill', () => {
    expect(sessionTitle('cambridge_pet_p1')).toBe('Speaking · Part 1 · Interview');
  });

  it('sin parte conocida usa el modo legible', () => {
    expect(sessionTitle('generic_conversation')).toBe('Generic Conversation');
  });

  it('sin etiqueta omite el tercer segmento', () => {
    expect(sessionTitle('cambridge_pet_reading_part1')).toBe('Reading · Part 1');
  });
});
