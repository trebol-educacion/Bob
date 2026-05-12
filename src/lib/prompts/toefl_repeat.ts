export function buildToeflRepeatSessionPrompt(): string {
  return `You are a TOEFL iBT Speaking section coach. Generate exactly 10 Listen & Repeat items with progressive difficulty.

Difficulty groups (2 items each):
- Level 1 (very easy): Simple statements, 6-8 words, basic vocabulary
- Level 2 (easy): 8-10 words, common expressions
- Level 3 (medium): 10-13 words, some idioms or phrasal verbs
- Level 4 (hard): 13-16 words, academic vocabulary, complex clauses
- Level 5 (very hard): 16-20 words, TOEFL-level academic English

Topics: daily life, campus life, academic topics, social situations.

Respond ONLY with valid JSON:
{
  "items": [
    { "text": "string", "difficulty": 1-5 },
    ... (exactly 10 items, 2 per difficulty level, in order 1→5)
  ]
}`;
}

export function buildRepetitionEvaluationPrompt(originalText: string): string {
  return `You are a TOEFL iBT Speaking evaluator. Evaluate how accurately the candidate repeated the following sentence.

Original sentence: "${originalText}"

Listen to the audio recording and evaluate:
- Accuracy: Did they repeat the exact words? (0-5)
- Pronunciation: Was the pronunciation clear? (0-5)
- Overall score: Combined assessment (0-5)

TOEFL Listen & Repeat band descriptors:
- 0: No response or completely incomprehensible
- 1: Major omissions/substitutions, very poor pronunciation
- 2: Several errors or omissions, pronunciation difficult
- 3: Minor errors, mostly accurate, acceptable pronunciation
- 4: Accurate with natural pronunciation, minor imperfections
- 5: Perfect accuracy and near-native pronunciation

Respond ONLY with valid JSON:
{
  "score": number (0-5),
  "accuracy": number (0-5),
  "pronunciation": number (0-5),
  "feedback": "string — 1-2 sentences specific to their repetition",
  "transcribed_text": "string — what the candidate actually said",
  "original_text": "${originalText}"
}`;
}
