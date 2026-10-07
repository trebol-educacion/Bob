// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GapText, SentenceBank, splitGapText } from '@/components/practice/gap-text';

const TEXT = 'Alpha ___1___ beta ___2___ gamma.';

describe('splitGapText', () => {
  it('separa texto y huecos en orden', () => {
    expect(splitGapText(TEXT)).toEqual([
      { kind: 'text', value: 'Alpha ' },
      { kind: 'gap', number: 1 },
      { kind: 'text', value: ' beta ' },
      { kind: 'gap', number: 2 },
      { kind: 'text', value: ' gamma.' },
    ]);
  });
});

describe('GapText modo choice', () => {
  it('muestra un badge numerado por hueco', () => {
    const { container } = render(<GapText text={TEXT} mode="choice" />);
    expect(container.textContent).toBe('Alpha 1 beta 2 gamma.');
  });

  it('revision: correcto en verde, incorrecto tachado con la respuesta esperada', () => {
    render(
      <GapText
        text={TEXT}
        mode="choice"
        review={{
          1: { isCorrect: true, given: 'right', expected: 'right' },
          2: { isCorrect: false, given: 'wrong', expected: 'fix' },
        }}
      />,
    );
    expect(screen.getByText('right')).toHaveClass('bg-green-100');
    expect(screen.getByText('wrong')).toHaveClass('line-through');
    expect(screen.getByText('fix')).toHaveClass('bg-green-100');
  });

  it('revision sin entrada para un hueco conserva el marcador', () => {
    const { container } = render(
      <GapText text={TEXT} mode="choice" review={{ 1: { isCorrect: true, given: 'ok', expected: 'ok' } }} />,
    );
    expect(container.textContent).toContain('___2___');
  });
});

describe('GapText modo input', () => {
  it('renderiza un input por hueco con su valor y notifica cambios', () => {
    const onChange = vi.fn();
    render(<GapText text={TEXT} mode="input" values={{ 1: 'the' }} onChange={onChange} />);
    const first = screen.getByLabelText('Gap 1');
    const second = screen.getByLabelText('Gap 2');
    expect(first).toHaveValue('the');
    expect(second).toHaveValue('');
    fireEvent.change(second, { target: { value: 'of' } });
    expect(onChange).toHaveBeenCalledWith(2, 'of');
  });

  it('muestra la base word en mayusculas junto al hueco', () => {
    render(<GapText text={TEXT} mode="input" baseWords={{ 1: 'HAPPY' }} />);
    expect(screen.getByText('HAPPY')).toBeInTheDocument();
  });

  it('usa la etiqueta accesible inyectada', () => {
    render(<GapText text={TEXT} mode="input" gapLabel={(n) => `Hueco ${n}`} />);
    expect(screen.getByLabelText('Hueco 1')).toBeInTheDocument();
  });

  it('revision: estado correcto e incorrecto', () => {
    render(
      <GapText
        text={TEXT}
        mode="input"
        review={{
          1: { isCorrect: true, given: 'the', expected: 'the' },
          2: { isCorrect: false, given: 'off', expected: 'of' },
        }}
      />,
    );
    expect(screen.getByText('the')).toHaveClass('bg-green-100');
    expect(screen.getByText('off')).toHaveClass('line-through');
    expect(screen.getByText('of')).toHaveClass('bg-green-100');
    expect(screen.queryByRole('textbox')).toBeNull();
  });
});

describe('GapText modo sentence-bank', () => {
  const sentences = ['A', 'B', 'C'].map((id) => ({ id, text: `Sentence ${id}` }));

  it('un selector por hueco con las letras y notifica la eleccion', () => {
    const onChange = vi.fn();
    render(
      <GapText text={TEXT} mode="sentence-bank" sentences={sentences} values={{ 1: 'B' }} onChange={onChange} />,
    );
    const first = screen.getByLabelText('Gap 1') as HTMLSelectElement;
    expect(first.value).toBe('B');
    expect(first.options).toHaveLength(4);
    fireEvent.change(screen.getByLabelText('Gap 2'), { target: { value: 'C' } });
    expect(onChange).toHaveBeenCalledWith(2, 'C');
  });

  it('sin repeticion: la frase usada en un hueco queda desactivada en los demas', () => {
    render(
      <GapText
        text={TEXT}
        mode="sentence-bank"
        sentences={sentences}
        values={{ 1: 'B' }}
        onChange={vi.fn()}
        allowRepeatOptions={false}
      />,
    );
    const first = screen.getByLabelText('Gap 1') as HTMLSelectElement;
    const second = screen.getByLabelText('Gap 2') as HTMLSelectElement;
    const optionB = (select: HTMLSelectElement) => Array.from(select.options).find((option) => option.value === 'B');
    expect(optionB(second)?.disabled).toBe(true);
    expect(optionB(first)?.disabled).toBe(false);
  });

  it('con repeticion permitida ninguna frase se desactiva', () => {
    render(<GapText text={TEXT} mode="sentence-bank" sentences={sentences} values={{ 1: 'B' }} onChange={vi.fn()} />);
    const second = screen.getByLabelText('Gap 2') as HTMLSelectElement;
    expect(Array.from(second.options).some((option) => option.disabled)).toBe(false);
  });

  it('revision: muestra la frase elegida y la esperada', () => {
    render(
      <GapText
        text={TEXT}
        mode="sentence-bank"
        sentences={sentences}
        review={{
          1: { isCorrect: true, given: 'Sentence A', expected: 'Sentence A' },
          2: { isCorrect: false, given: 'Sentence B', expected: 'Sentence C' },
        }}
      />,
    );
    expect(screen.getByText('Sentence B')).toHaveClass('line-through');
    expect(screen.getByText('Sentence C')).toHaveClass('bg-green-100');
  });
});

describe('SentenceBank', () => {
  it('marca las frases ya usadas y deja la sobrante disponible', () => {
    const sentences = ['A', 'B', 'C'].map((id) => ({ id, text: `Sentence ${id}` }));
    const { container } = render(<SentenceBank sentences={sentences} usedIds={['A', 'B']} />);
    const items = container.querySelectorAll('li');
    expect(items[0]).toHaveAttribute('data-used', 'true');
    expect(items[1]).toHaveAttribute('data-used', 'true');
    expect(items[2]).toHaveAttribute('data-used', 'false');
  });
});
