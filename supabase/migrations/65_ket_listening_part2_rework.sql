-- KET Listening Part 2 — Listen and Complete
-- Actualiza el prompt de generación, agrega framing y habilita la actividad.

UPDATE bob_prompts
SET
  prompt_default = $prompt$You are a Cambridge A2 Key (KET) examiner designing a Listening Part 2 exercise for Spanish students aged 11–12.

TASK
Generate a realistic everyday monologue or short dialogue (160–200 words) and a summary form with exactly 5 numbered gaps. The form is NOT a transcript — it is a note or a registration card where a listener fills in key facts they heard.

STRUCTURE RULES
- Each gap answer must be ONE of: a name, a number, a day of the week, a time (e.g. 3:30), or a simple common noun (one word only).
- Answers must appear clearly in the transcript — no ambiguity.
- Use a realistic everyday context: a phone message, a booking, a schedule, a registration, a school announcement, a sports club, etc.
- Vocabulary: A2 Cambridge level. Topics: school, hobbies, food, transport, sports, family, daily life.
- Speakers: Man (M) and/or Woman (W). A monologue is also valid.

OUTPUT — minified JSON, no markdown:
{"context":"one-sentence scene description","form_title":"Name of the form or card","transcript":"full spoken text, 160-200 words","gaps":[{"number":1,"label":"short field label e.g. Name:","answer":"exact answer as heard"},{"number":2,"label":"...","answer":"..."},{"number":3,"label":"...","answer":"..."},{"number":4,"label":"...","answer":"..."},{"number":5,"label":"...","answer":"..."}]}$prompt$,
  prompt_current = $prompt$You are a Cambridge A2 Key (KET) examiner designing a Listening Part 2 exercise for Spanish students aged 11–12.

TASK
Generate a realistic everyday monologue or short dialogue (160–200 words) and a summary form with exactly 5 numbered gaps. The form is NOT a transcript — it is a note or a registration card where a listener fills in key facts they heard.

STRUCTURE RULES
- Each gap answer must be ONE of: a name, a number, a day of the week, a time (e.g. 3:30), or a simple common noun (one word only).
- Answers must appear clearly in the transcript — no ambiguity.
- Use a realistic everyday context: a phone message, a booking, a schedule, a registration, a school announcement, a sports club, etc.
- Vocabulary: A2 Cambridge level. Topics: school, hobbies, food, transport, sports, family, daily life.
- Speakers: Man (M) and/or Woman (W). A monologue is also valid.

OUTPUT — minified JSON, no markdown:
{"context":"one-sentence scene description","form_title":"Name of the form or card","transcript":"full spoken text, 160-200 words","gaps":[{"number":1,"label":"short field label e.g. Name:","answer":"exact answer as heard"},{"number":2,"label":"...","answer":"..."},{"number":3,"label":"...","answer":"..."},{"number":4,"label":"...","answer":"..."},{"number":5,"label":"...","answer":"..."}]}$prompt$,
  updated_at = now()
WHERE prompt_key = 'cambridge_ket_listening_part2_a2_generation';

INSERT INTO bob_prompts (
  prompt_key, framework, exam_part, cefr_level, skill,
  activity_type, label, status,
  prompt_default, prompt_current
)
VALUES (
  'cambridge_ket_listening_part2_a2_framing',
  'cambridge', 'ket_listening_part2', 'a2', 'listening',
  'framing', 'KET Listening Part 2 (A2) — framing', 'enabled',
  'You will hear someone speaking. Listen and complete the form below. Write ONE word, number, date or time in each gap.',
  'You will hear someone speaking. Listen and complete the form below. Write ONE word, number, date or time in each gap.'
)
ON CONFLICT (prompt_key) DO UPDATE
  SET prompt_current = EXCLUDED.prompt_current,
      updated_at     = now();

UPDATE bob_prompts
SET status = 'enabled', updated_at = now()
WHERE exam_part = 'ket_listening_part2';
