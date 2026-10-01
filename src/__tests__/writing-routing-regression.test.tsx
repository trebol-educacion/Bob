// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

vi.mock('server-only', () => ({}));
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));
vi.mock('@/components/chat/BobMascotLoader', () => ({
  BobMascotLoader: ({ message }: { message: string }) => <div>{message}</div>,
}));
vi.mock('@/components/chat/ChatInputBar', () => ({
  ChatInputBar: ({ value, disabled, onChange, onSend }: {
    value: string; disabled: boolean; onChange: (v: string) => void; onSend: () => void;
  }) => (
    <div>
      <textarea aria-label="text" value={value} onChange={(e) => onChange(e.target.value)} />
      <button type="button" disabled={disabled} onClick={onSend}>send</button>
    </div>
  ),
}));
vi.mock('@/components/chat', () => ({
  InfoCard: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section><h4>{title}</h4>{children}</section>
  ),
}));
vi.mock('@/lib/persist-activity', () => ({ persistMessage: vi.fn(() => Promise.resolve({ id: 'x' })) }));

const evaluateAcademicMock = vi.fn();
vi.mock('@/actions/modes/writing-academic', () => ({
  evaluateAcademicAction: (...a: unknown[]) => evaluateAcademicMock(...a),
}));
vi.mock('@/actions/sessions', () => ({
  createSessionAction: vi.fn(async () => ({ data: { id: 's1', user_id: 'u1' } })),
}));

import { AcademicWritingPractice } from '@/components/practice/AcademicWritingPractice';
import { EXAM_PART_COMPONENT_MAP } from '@/lib/routing';
import { FCEEssayWritingPractice, FCEWritingPart2Practice } from '@/components/practice/fce';

function words(n: number): string {
  return Array.from({ length: n }, (_, i) => `w${i}`).join(' ');
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe('Academic Discussion and Writing routing', () => {
  it('routes FCE Writing P1 and P2 to their own components and TOEFL to Academic', () => {
    const exam = { onBack: vi.fn() };
    const p1 = EXAM_PART_COMPONENT_MAP.cambridge_fce_writing_part1.render(exam);
    const p2 = EXAM_PART_COMPONENT_MAP.cambridge_fce_writing_part2.render(exam);
    const toefl = EXAM_PART_COMPONENT_MAP.toefl_writing_academic_discussion.render(exam);
    expect(p1.type).toBe(FCEEssayWritingPractice);
    expect(p2.type).toBe(FCEWritingPart2Practice);
    expect(toefl.type).toBe(AcademicWritingPractice);
  });

  it('keeps the TOEFL Academic Discussion flow: forum, 100-200 range and formative feedback without mark', async () => {
    evaluateAcademicMock.mockResolvedValue({
      kind: 'writing_formative',
      understood: true,
      highlights: ['Clear opinion'],
      suggestions: ['Add an example'],
      indicators: { word_count: 100, target_word_count_range: [100, 200] },
    });
    render(<AcademicWritingPractice mode="toefl_writing_academic_discussion" onBack={vi.fn()} />);
    await screen.findByText(/study abroad/);
    expect(screen.getByText(/100-200/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('text'), { target: { value: words(100) } });
    fireEvent.click(screen.getByText('send'));
    await waitFor(() => expect(screen.getByText('Clear opinion')).toBeInTheDocument());
    expect(evaluateAcademicMock).toHaveBeenCalledWith(
      expect.objectContaining({ framework: 'toefl', exam_part: 'toefl_writing_academic_discussion', targetWordCount: [100, 200] }),
    );
    expect(screen.queryByTestId('fce-score-card')).not.toBeInTheDocument();
  });
});
