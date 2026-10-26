// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SpeakingEvolution, type SpeakingEvolutionLabels } from '@/components/SpeakingEvolution';
import { PracticeFinished, type PracticeFinishedLabels } from '@/components/practice/free/PracticeFinished';
import { mapProgressSummary, emptyStudentStats, type SpeakingPoint } from '@/lib/stats/progress-summary';
import { hasCurve, layoutSeries, linePath } from '@/lib/stats/speaking-evolution';

const LABELS: SpeakingEvolutionLabels = {
  title: 'Evolution',
  subtitle: 'sub',
  empty: 'EMPTY',
  needMore: 'NEED3',
  byCriterion: 'By criterion',
  chartLabel: 'chart',
  criteria: { pronunciation: 'Pronunciation', fluency: 'Fluency', grammar: 'Grammar', vocabulary: 'Vocabulary' },
};

function series(scores: number[]): SpeakingPoint[] {
  return scores.map((score10, i) => ({ at: `2026-10-0${i + 1}T10:00:00Z`, score10, source: 'practice' as const }));
}

describe('serie de evolucion', () => {
  it('layoutSeries reparte los puntos y mapea 0-10 al eje vertical', () => {
    const points = layoutSeries(series([0, 10]), { width: 100, height: 100, padding: 10 });
    expect(points[0]).toMatchObject({ x: 10, y: 90 });
    expect(points[1]).toMatchObject({ x: 90, y: 10 });
  });

  it('un solo punto queda centrado y no dibuja linea', () => {
    const points = layoutSeries(series([5]), { width: 100, height: 100, padding: 10 });
    expect(points[0].x).toBe(50);
    expect(linePath(points)).toBe('');
  });

  it('la curva exige al menos tres intentos', () => {
    expect(hasCurve(series([5, 6]))).toBe(false);
    expect(hasCurve(series([5, 6, 7]))).toBe(true);
  });

  it('mapProgressSummary lee serie y medias por criterio y descarta puntos sin nota', () => {
    const result = mapProgressSummary({
      speaking_series: [
        { at: '2026-10-01T10:00:00Z', score10: '6.5', source: 'practice' },
        { at: '2026-10-02T10:00:00Z', score10: null, source: 'exam' },
        { at: '2026-10-03T10:00:00Z', score10: 7, source: 'exam' },
      ],
      speaking_criteria: [{ criterion: 'grammar', avg: '6.1', samples: 4 }],
    });
    expect(result.speaking_series).toEqual([
      { at: '2026-10-01T10:00:00Z', score10: 6.5, source: 'practice' },
      { at: '2026-10-03T10:00:00Z', score10: 7, source: 'exam' },
    ]);
    expect(result.speaking_criteria).toEqual([{ criterion: 'grammar', avg: 6.1, samples: 4 }]);
  });

  it('un payload antiguo sin los campos nuevos da series vacias', () => {
    const result = mapProgressSummary({ total_sessions: 1 });
    expect(result.speaking_series).toEqual([]);
    expect(result.speaking_criteria).toEqual([]);
    expect(emptyStudentStats().speaking_series).toEqual([]);
  });
});

describe('SpeakingEvolution', () => {
  it('estado vacio sin error', () => {
    render(<SpeakingEvolution series={[]} criteria={[]} labels={LABELS} />);
    expect(screen.getByText('EMPTY')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('con menos de tres intentos pinta los puntos y avisa, sin curva', () => {
    const { container } = render(<SpeakingEvolution series={series([5, 6])} criteria={[]} labels={LABELS} />);
    expect(screen.getByText('NEED3')).toBeTruthy();
    expect(container.querySelectorAll('circle')).toHaveLength(2);
    expect(container.querySelector('path')).toBeNull();
  });

  it('con tres intentos o mas dibuja la curva y las medias por criterio', () => {
    const { container } = render(
      <SpeakingEvolution
        series={series([5, 6, 7])}
        criteria={[{ criterion: 'grammar', avg: 6.5, samples: 3 }, { criterion: 'fluency', avg: 7, samples: 3 }]}
        labels={LABELS}
      />
    );
    expect(container.querySelector('path')).not.toBeNull();
    expect(screen.queryByText('NEED3')).toBeNull();
    expect(screen.getByText('Grammar')).toBeTruthy();
    expect(screen.getByText('6.5')).toBeTruthy();
  });
});

const FINISHED_LABELS: PracticeFinishedLabels = {
  title: 'Done',
  scoreLabel: 'practice',
  again: 'Again',
  home: 'Home',
  notRated: 'Not rated',
  criteria: {
    participation: 'Speaking',
    fluency: 'Fluency',
    independence: 'Independence',
    comprehension: 'Depth',
    pronunciation: 'Pronunciation',
    grammar: 'Grammar',
    vocabulary: 'Vocabulary',
  },
};

describe('PracticeFinished', () => {
  const noop = () => {};

  it('formato nuevo: cuatro barras y pronunciacion sin valorar', () => {
    render(
      <PracticeFinished
        score={7}
        detail={{ pronunciation: null, fluency: 6, grammar: 7, vocabulary: 8 }}
        feedback="ok"
        labels={FINISHED_LABELS}
        onRestart={noop}
        onExit={noop}
      />
    );
    expect(screen.getAllByRole('progressbar')).toHaveLength(4);
    expect(screen.getByText('Not rated')).toBeTruthy();
    expect(screen.getByText('Grammar')).toBeTruthy();
  });

  it('formato antiguo: se muestra como antes con sus cuatro casillas', () => {
    render(
      <PracticeFinished
        score={6.4}
        detail={{ participation: 5, fluency: 6, independence: 7, comprehension: 8 }}
        feedback="ok"
        labels={FINISHED_LABELS}
        onRestart={noop}
        onExit={noop}
      />
    );
    expect(screen.queryAllByRole('progressbar')).toHaveLength(0);
    expect(screen.getByText('Independence')).toBeTruthy();
    expect(screen.getByText('8.0')).toBeTruthy();
  });
});
