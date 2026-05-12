export function buildPart3ScenarioPrompt(): string {
  return `You are a Cambridge B1 Preliminary English Test examiner for Part 3 (Collaborative Task).
Generate a realistic collaborative discussion scenario for two candidates.

Respond with JSON:
{
  "topic": "string — short topic title (e.g. 'Planning a school trip')",
  "situation": "string — 2 sentences setting the scene in English",
  "prompt_question": "string — the main question to discuss (e.g. 'Talk about which activities would be most fun for students')",
  "options": ["string", "string", "string", "string", "string"]
}

Topics must be relatable to teenagers/young adults: school events, hobbies, travel, technology, food, environment.
Options should have clear pros/cons to spark natural discussion.
Respond ONLY with valid JSON.`;
}

export function buildPart3ChatPrompt(
  scenario: { topic: string; situation: string; prompt_question: string; options: string[] },
  history: Array<{ role: 'user' | 'examiner'; text: string }>
): string {
  const historyText = history
    .map((h) => `${h.role === 'examiner' ? 'Examiner' : 'Candidate'}: ${h.text}`)
    .join('\n');

  return `You are a Cambridge B1 examiner conducting Part 3. The scenario is:
Topic: ${scenario.topic}
Situation: ${scenario.situation}
Question: ${scenario.prompt_question}
Options: ${scenario.options.join(', ')}

Conversation so far:
${historyText || '(just starting)'}

Your role: Keep the discussion going naturally. Ask follow-up questions, seek opinions on options, guide towards agreement if 6+ turns have passed. Keep responses under 30 words. Do NOT evaluate pronunciation. Respond ONLY with your next examiner line (no labels, no quotes).`;
}

export function buildPart3EvaluationPrompt(
  scenario: { topic: string; situation: string; prompt_question: string; options: string[] },
  history: Array<{ role: 'user' | 'examiner'; text: string }>
): string {
  const historyText = history
    .map((h) => `${h.role === 'examiner' ? 'Examiner' : 'Candidate'}: ${h.text}`)
    .join('\n');

  return `You are a Cambridge B1 Preliminary examiner evaluating a candidate's Part 3 speaking performance.

Scenario: ${scenario.topic} — ${scenario.prompt_question}

Full conversation transcript:
${historyText}

Evaluate the CANDIDATE turns only (not the Examiner lines). Score strictly — do NOT inflate.

Scoring rubric:
- 0-30: Did not engage, monosyllabic, or mostly silent
- 31-60: Basic contributions, frequent grammar/vocabulary errors, limited interaction
- 61-80: Adequate interaction, some errors, mostly understandable
- 81-95: Good range, clear opinions, natural interaction with minor errors
- 96-100: Near-native, sophisticated interaction, strong task achievement

Respond ONLY with valid JSON:
{
  "score": number (0-100 overall),
  "task_achievement": number (0-100),
  "interaction": number (0-100),
  "grammar": number (0-100),
  "vocabulary": number (0-100),
  "feedback": "string — 2-3 sentences of specific, actionable feedback",
  "strengths": ["string", "string"],
  "areas_for_improvement": ["string", "string"]
}`;
}
