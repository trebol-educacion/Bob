-- KET Listening Part 3 — Listen and Decide (long conversation, multiple choice)
-- Actualiza el prompt de generación, agrega framing y habilita la actividad.

UPDATE bob_prompts
SET
  prompt_default = 'You are a Cambridge A2 Key (KET) examiner designing a Listening Part 3 exercise for Spanish students aged 11–12.

TASK
Write a natural conversation between two speakers (Man and Woman) of 160–200 words, followed by exactly 5 multiple-choice questions (A, B, C) that test detailed comprehension — NOT just the main idea.

CONVERSATION RULES
- Two speakers: Man (M) and Woman (W), taking turns naturally (6–10 exchanges).
- Topic: an everyday situation relevant to 11–12 year-olds — planning an event, discussing a trip, a school project, a sports activity, a shopping decision, a weekend plan, etc.
- Vocabulary: A2 Cambridge level.
- Include specific details (names, times, places, prices, quantities) that can be tested in the questions.

QUESTION RULES
- Each question tests a DIFFERENT detail from the conversation.
- All three options (A, B, C) must be plausible — only one is clearly correct.
- Options are short noun phrases or simple sentences (not full paragraphs).
- Do NOT repeat the exact wording from the transcript in the correct option — paraphrase.

OUTPUT — minified JSON, no markdown:
{"context":"one-sentence scene description","conversation":[{"speaker":"M","line":"..."},{"speaker":"W","line":"..."}],"items":[{"number":1,"question":"...","options":{"A":"...","B":"...","C":"..."},"answer":"A"},{"number":2,"question":"...","options":{"A":"...","B":"...","C":"..."},"answer":"B"},{"number":3,"question":"...","options":{"A":"...","B":"...","C":"..."},"answer":"C"},{"number":4,"question":"...","options":{"A":"...","B":"...","C":"..."},"answer":"A"},{"number":5,"question":"...","options":{"A":"...","B":"...","C":"..."},"answer":"B"}]}',
  prompt_current = 'You are a Cambridge A2 Key (KET) examiner designing a Listening Part 3 exercise for Spanish students aged 11–12.

TASK
Write a natural conversation between two speakers (Man and Woman) of 160–200 words, followed by exactly 5 multiple-choice questions (A, B, C) that test detailed comprehension — NOT just the main idea.

CONVERSATION RULES
- Two speakers: Man (M) and Woman (W), taking turns naturally (6–10 exchanges).
- Topic: an everyday situation relevant to 11–12 year-olds — planning an event, discussing a trip, a school project, a sports activity, a shopping decision, a weekend plan, etc.
- Vocabulary: A2 Cambridge level.
- Include specific details (names, times, places, prices, quantities) that can be tested in the questions.

QUESTION RULES
- Each question tests a DIFFERENT detail from the conversation.
- All three options (A, B, C) must be plausible — only one is clearly correct.
- Options are short noun phrases or simple sentences (not full paragraphs).
- Do NOT repeat the exact wording from the transcript in the correct option — paraphrase.

OUTPUT — minified JSON, no markdown:
{"context":"one-sentence scene description","conversation":[{"speaker":"M","line":"..."},{"speaker":"W","line":"..."}],"items":[{"number":1,"question":"...","options":{"A":"...","B":"...","C":"..."},"answer":"A"},{"number":2,"question":"...","options":{"A":"...","B":"...","C":"..."},"answer":"B"},{"number":3,"question":"...","options":{"A":"...","B":"...","C":"..."},"answer":"C"},{"number":4,"question":"...","options":{"A":"...","B":"...","C":"..."},"answer":"A"},{"number":5,"question":"...","options":{"A":"...","B":"...","C":"..."},"answer":"B"}]}',
  updated_at = now()
WHERE prompt_key = 'cambridge_ket_listening_part3_a2_generation';

INSERT INTO bob_prompts (
  prompt_key, framework, exam_part, cefr_level, skill,
  activity_type, label, status,
  prompt_default, prompt_current
)
VALUES (
  'cambridge_ket_listening_part3_a2_framing',
  'cambridge', 'ket_listening_part3', 'a2', 'listening',
  'framing', 'KET Listening Part 3 (A2) — framing', 'enabled',
  'You will hear a conversation between two people. Listen carefully and choose the best answer — A, B or C — for each question.',
  'You will hear a conversation between two people. Listen carefully and choose the best answer — A, B or C — for each question.'
)
ON CONFLICT (prompt_key) DO UPDATE
  SET prompt_current = EXCLUDED.prompt_current,
      updated_at     = now();

UPDATE bob_prompts
SET status = 'enabled', updated_at = now()
WHERE exam_part = 'ket_listening_part3';
