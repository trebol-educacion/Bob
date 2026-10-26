// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('next-intl', async () => (await import('./stubs/intl')).intlMock());
vi.mock('motion/react', async () => {
  const React = await import('react');
  const motion = new Proxy({}, {
    get: (_t, tag: string) =>
      ({ children, className, onClick }: Record<string, unknown>) =>
        React.createElement(tag, { className, onClick } as never, children as never),
  });
  return { motion };
});

import { PracticeTopicSelectView } from '@/components/practice/free/PracticeTopicSelectView';

const AREAS = [
  {
    areaSlug: 'personal_life' as const,
    topics: [
      { slug: 'food_health', areaSlug: 'personal_life' as const, areaOrder: 1, sortOrder: 3, minCefrLevel: 'pre_a1' as const, promptDescription: 'food' },
    ],
  },
];

function setup(topics: Parameters<typeof PracticeTopicSelectView>[0]['topics']) {
  const handlers = { onSelectTopic: vi.fn(), onSurprise: vi.fn(), onReload: vi.fn(), onBack: vi.fn() };
  render(<PracticeTopicSelectView topics={topics} {...handlers} />);
  return handlers;
}

describe('PracticeTopicSelectView', () => {
  it('muestra el area y el topic con su etiqueta y emite el slug al elegirlo', () => {
    const h = setup({ status: 'ready', areas: AREAS });
    expect(screen.getByText('Personal life and lifestyle')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Food and health' }));
    expect(h.onSelectTopic).toHaveBeenCalledWith('food_health');
  });

  it('Surprise me conserva el comportamiento aleatorio', () => {
    const h = setup({ status: 'ready', areas: AREAS });
    fireEvent.click(screen.getByRole('button', { name: /Surprise me/ }));
    expect(h.onSurprise).toHaveBeenCalledTimes(1);
    expect(h.onSelectTopic).not.toHaveBeenCalled();
  });

  it('si los topics fallan sigue ofreciendo Surprise me y un reintento', () => {
    const h = setup({ status: 'error' });
    expect(screen.getByRole('button', { name: /Surprise me/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(h.onReload).toHaveBeenCalledTimes(1);
  });

  it('Back vuelve a la seleccion de modo', () => {
    const h = setup({ status: 'loading' });
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(h.onBack).toHaveBeenCalledTimes(1);
  });
});
