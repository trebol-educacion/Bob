import { describe, it, expect } from 'vitest';
import { restoreQuestionRound, SPEAKING_ANSWER_KIND } from '@/lib/speaking/question-round-restore';
import { restoreCollaborative } from '@/lib/speaking/collaborative-restore';
import { InterviewPlanSchema } from '@/lib/speaking/fce-content';

const plan = { questions: ['Q1', 'Q2', 'Q3', 'Q4'] };
const feedback = { kind: 'formative', understood: true, highlights: ['h'], suggestions: ['s'], score10: 7, score: 14, score_max: 20 };

describe('restoreQuestionRound', () => {
  it('reconstruye plan, respuestas y nota final', () => {
    const restored = restoreQuestionRound(
      [
        { role: 'bob', msg_type: 'phrase', content_json: plan },
        { role: 'user', msg_type: 'text', content_text: 'a1', content_json: { kind: SPEAKING_ANSWER_KIND, question: 'Q1' } },
        { role: 'user', msg_type: 'user_audio', content_text: 'legacy', content_json: { question: 'Q2' } },
        { role: 'bob', msg_type: 'evaluation', content_json: { ...feedback, is_final: true } },
      ],
      InterviewPlanSchema,
    );
    expect(restored?.plan).toEqual(plan);
    expect(restored?.qas).toEqual([{ question: 'Q1', answer: 'a1' }, { question: 'Q2', answer: 'legacy' }]);
    expect(restored?.feedback?.score10).toBe(7);
  });

  it('sin plan devuelve null y una sesión abierta no tiene nota', () => {
    expect(restoreQuestionRound([{ role: 'user', msg_type: 'text' }], InterviewPlanSchema)).toBeNull();
    const open = restoreQuestionRound([{ role: 'bob', msg_type: 'phrase', content_json: plan }], InterviewPlanSchema);
    expect(open?.feedback).toBeNull();
    expect(open?.qas).toEqual([]);
  });
});

describe('restoreCollaborative', () => {
  const scenario = { topic: 'T', situation: 'S', prompt_question: 'P', options: ['a', 'b', 'c', 'd', 'e'] };

  it('reconstruye escenario, conversación y nota', () => {
    const restored = restoreCollaborative([
      { role: 'bob', msg_type: 'phrase', content_json: scenario },
      { role: 'bob', msg_type: 'text', content_text: 'Opening' },
      { role: 'user', msg_type: 'text', content_text: 'Hi' },
      { role: 'bob', msg_type: 'evaluation', content_json: { ...feedback, is_final: true } },
    ]);
    expect(restored.scenario).toEqual(scenario);
    expect(restored.history).toEqual([{ role: 'examiner', text: 'Opening' }, { role: 'user', text: 'Hi' }]);
    expect(restored.feedback?.score10).toBe(7);
  });

  it('ignora escenarios inválidos', () => {
    expect(restoreCollaborative([{ role: 'bob', msg_type: 'phrase', content_json: { topic: 1 } }]).scenario).toBeNull();
  });
});
