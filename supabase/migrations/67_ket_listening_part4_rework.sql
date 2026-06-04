-- KET Listening Part 4 — Short Talks (matching: 5 people → 8 characteristics)
-- Corrige el prompt (era Multiple Choice, debe ser Matching) y habilita la actividad.

UPDATE bob_prompts
SET
  label        = 'Short Talks',
  prompt_default = 'You are a Cambridge A2 Key (KET) examiner designing a Listening Part 4 exercise for Spanish students aged 11–12.

TASK
Generate 5 short monologues — one per person — and a set of 8 characteristics. Students listen to each person and match them to the ONE characteristic that best describes what they say.

PEOPLE RULES
- 5 speakers with common English names (mix of male and female names).
- Each monologue is 30–70 words: the person talks about themselves in first person (hobbies, likes, what they did, what they buy, etc.).
- Each person''s monologue clearly supports exactly ONE of the 8 characteristics.
- The correct characteristic must NOT appear word-for-word in the monologue — students must infer, not copy.
- Vocabulary: A2 Cambridge level. Topics: hobbies, daily life, sports, food, music, shopping, travel, school.

CHARACTERISTICS RULES
- Exactly 8 characteristics labeled A through H.
- Only 5 are correct answers (one per person). The other 3 are plausible distractors.
- Each characteristic is a short phrase (4–8 words): "enjoys cooking at home", "plays a team sport", etc.
- No two characteristics should be so similar that both could match the same person.

OUTPUT — minified JSON, no markdown:
{"people":[{"number":1,"name":"...","monologue":"...","correct_key":"A"},{"number":2,"name":"...","monologue":"...","correct_key":"C"},{"number":3,"name":"...","monologue":"...","correct_key":"E"},{"number":4,"name":"...","monologue":"...","correct_key":"F"},{"number":5,"name":"...","monologue":"...","correct_key":"H"}],"characteristics":[{"key":"A","text":"..."},{"key":"B","text":"..."},{"key":"C","text":"..."},{"key":"D","text":"..."},{"key":"E","text":"..."},{"key":"F","text":"..."},{"key":"G","text":"..."},{"key":"H","text":"..."}]}',
  prompt_current = 'You are a Cambridge A2 Key (KET) examiner designing a Listening Part 4 exercise for Spanish students aged 11–12.

TASK
Generate 5 short monologues — one per person — and a set of 8 characteristics. Students listen to each person and match them to the ONE characteristic that best describes what they say.

PEOPLE RULES
- 5 speakers with common English names (mix of male and female names).
- Each monologue is 30–70 words: the person talks about themselves in first person (hobbies, likes, what they did, what they buy, etc.).
- Each person''s monologue clearly supports exactly ONE of the 8 characteristics.
- The correct characteristic must NOT appear word-for-word in the monologue — students must infer, not copy.
- Vocabulary: A2 Cambridge level. Topics: hobbies, daily life, sports, food, music, shopping, travel, school.

CHARACTERISTICS RULES
- Exactly 8 characteristics labeled A through H.
- Only 5 are correct answers (one per person). The other 3 are plausible distractors.
- Each characteristic is a short phrase (4–8 words): "enjoys cooking at home", "plays a team sport", etc.
- No two characteristics should be so similar that both could match the same person.

OUTPUT — minified JSON, no markdown:
{"people":[{"number":1,"name":"...","monologue":"...","correct_key":"A"},{"number":2,"name":"...","monologue":"...","correct_key":"C"},{"number":3,"name":"...","monologue":"...","correct_key":"E"},{"number":4,"name":"...","monologue":"...","correct_key":"F"},{"number":5,"name":"...","monologue":"...","correct_key":"H"}],"characteristics":[{"key":"A","text":"..."},{"key":"B","text":"..."},{"key":"C","text":"..."},{"key":"D","text":"..."},{"key":"E","text":"..."},{"key":"F","text":"..."},{"key":"G","text":"..."},{"key":"H","text":"..."}]}',
  updated_at = now()
WHERE prompt_key = 'cambridge_ket_listening_part4_a2_generation';

INSERT INTO bob_prompts (
  prompt_key, framework, exam_part, cefr_level, skill,
  activity_type, label, status,
  prompt_default, prompt_current
)
VALUES (
  'cambridge_ket_listening_part4_a2_framing',
  'cambridge', 'ket_listening_part4', 'a2', 'listening',
  'framing', 'KET Listening Part 4 (A2) — framing', 'enabled',
  'You will hear five people talking about themselves. Match each person to the correct description — A to H. There are three descriptions you do not need.',
  'You will hear five people talking about themselves. Match each person to the correct description — A to H. There are three descriptions you do not need.'
)
ON CONFLICT (prompt_key) DO UPDATE
  SET prompt_current = EXCLUDED.prompt_current,
      updated_at     = now();

UPDATE bob_prompts
SET status = 'enabled', updated_at = now()
WHERE exam_part = 'ket_listening_part4';
