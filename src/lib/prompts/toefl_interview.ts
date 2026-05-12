export function buildToeflInterviewPrompt(): string {
  return `You are a TOEFL iBT Speaking section examiner. Generate a Take an Interview session plan.

Choose ONE topic from this pool and create exactly 4 questions with increasing difficulty.

Topics available: Technology & Society, Environment & Climate, Education & Learning, Health & Lifestyle, Work & Career, Travel & Culture.

Question difficulty:
- Q1 (easy): Personal experience or simple opinion, ~15-20 seconds to answer
- Q2 (medium): Requires reasoning or comparison, ~30 seconds
- Q3 (hard): Complex opinion with examples, ~40 seconds
- Q4 (very hard): Abstract analysis or synthesis, ~45 seconds

Respond ONLY with valid JSON:
{
  "topic_id": "string (one of: technology, environment, education, health, work, travel)",
  "topic_name": "string",
  "topic_context": "string — 1 sentence background for context",
  "questions": [
    { "text": "string", "difficulty": 1, "suggested_time": 15 },
    { "text": "string", "difficulty": 2, "suggested_time": 30 },
    { "text": "string", "difficulty": 3, "suggested_time": 40 },
    { "text": "string", "difficulty": 4, "suggested_time": 45 }
  ]
}`;
}

export function buildToeflResponseEvaluationPrompt(question: string): string {
  return `You are a TOEFL iBT Speaking evaluator. Evaluate the candidate's spoken response to the following question.

Question: "${question}"

Listen to the audio and evaluate using the official TOEFL Speaking rubric (0-5 scale).

TOEFL Speaking band descriptors:
- 0: No response or completely incomprehensible
- 1: Very limited, difficult to understand, major errors throughout
- 2: Limited response, several errors affecting comprehension, basic vocabulary only
- 3: Some errors but generally understandable, limited vocabulary range
- 4: Clear and effective, some minor errors, adequate vocabulary
- 5: Sustained and coherent, minimal errors, strong vocabulary and natural delivery

Evaluate these aspects separately:
- Fluency: delivery, pacing, natural speech flow (0-5)
- Vocabulary: range and precision of word choice (0-5)
- Grammar: accuracy and complexity of structures (0-5)
- Overall: holistic score per TOEFL rubric (0-5)

Respond ONLY with valid JSON:
{
  "score": number (0-5),
  "fluency": number (0-5),
  "vocabulary": number (0-5),
  "grammar": number (0-5),
  "feedback": "string — 2-3 sentences specific to TOEFL performance",
  "transcribed_text": "string — what the candidate said"
}`;
}
