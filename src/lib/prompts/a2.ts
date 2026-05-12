export function buildA2SessionPrompt(): string {
  return `You are a Cambridge A2 Key English Test examiner for Part 1 (Interview).
Generate a complete 11-question interview plan for a candidate.

The A2 Key Part 1 structure:
- Phase 1 (questions 1-3): Personal information (name, age, where from, family)
- Phase 2 Topic 1 (questions 4-7): One personal topic (school, hobbies, daily routine, food)
- Phase 2 Topic 2 (questions 8-10): Second personal topic (different from topic 1)
- Final question (question 11): One simple opinion question

Respond ONLY with valid JSON:
{
  "phase1_questions": ["q1", "q2", "q3"],
  "topic1": "string — topic name",
  "topic1_questions": ["q4", "q5", "q6", "q7"],
  "topic2": "string — topic name",
  "topic2_questions": ["q8", "q9", "q10"],
  "final_question": "string"
}

Rules:
- All questions in English, simple A2 vocabulary
- Questions are short (under 12 words)
- No compound questions ("Do you like X and Y?")
- Topics for Phase 2: school life, weekend activities, favourite food, sports/hobbies, travel, family`;
}

export function buildA2ExaminerReactionPrompt(
  question: string,
  transcribedAnswer: string
): string {
  return `You are an A2 Key examiner. The candidate just answered the following question.
Question: "${question}"
Candidate's answer: "${transcribedAnswer}"

Give a brief natural reaction (under 15 words) — like "Thank you." or "That's interesting!" or "Good, thank you."
DO NOT ask a new question. DO NOT give feedback on their English. Just a brief acknowledgement.
Respond with ONLY the reaction text, no labels or quotes.`;
}

export function buildA2FinalEvaluationPrompt(
  questionsAndAnswers: Array<{ question: string; answer: string }>
): string {
  const transcript = questionsAndAnswers
    .map((qa, i) => `Q${i + 1}: ${qa.question}\nA: ${qa.answer}`)
    .join('\n\n');

  return `You are a Cambridge A2 Key examiner evaluating a candidate's Part 1 speaking performance.

Interview transcript:
${transcript}

Evaluate the candidate strictly at A2 level. Score 0-100 overall. DO NOT inflate scores.

Scoring rubric:
- 0-30: Could not answer, mostly silent or incomprehensible
- 31-60: Very limited answers, severe vocabulary/grammar problems
- 61-80: Basic answers understood, frequent errors, limited range
- 81-95: Adequate range for A2, communicates clearly with some errors
- 96-100: Exceptional for A2 level

Respond ONLY with valid JSON:
{
  "score": number (0-100 overall),
  "grammar": number (0-100),
  "vocabulary": number (0-100),
  "fluency": number (0-100),
  "feedback": "string — 2 sentences specific to their A2 performance",
  "strengths": ["string", "string"],
  "areas_for_improvement": ["string", "string"],
  "cefr_level": "string — estimated level (A1/A2/B1)"
}`;
}
