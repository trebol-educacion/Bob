-- KET Listening Part 5 — True / False / Doesn't Say
-- Corrige el prompt (era Gap-Fill) y habilita la actividad.

UPDATE bob_prompts
SET
  label        = 'True, False or Doesn''t Say',
  prompt_default = 'You are a Cambridge A2 Key (KET) examiner designing a Listening Part 5 exercise for Spanish students aged 11–12.

TASK
Write a monologue or dialogue of 160–200 words, then create exactly 5 statements about it. For each statement, assign one of three verdicts: T (True), F (False), or DS (Doesn''t Say).

AUDIO RULES
- A monologue (one speaker) or a short dialogue (two speakers: M/W) on an everyday topic.
- Topic: a school event, a club announcement, a personal story, a trip, a hobby, a sports activity.
- Vocabulary: A2 Cambridge level.
- Include some facts that are clearly stated, some that are clearly contradicted, and some topics that are simply never mentioned.

STATEMENT RULES
- Each statement is a simple sentence testing a specific detail.
- Verdict T: the audio directly confirms this. The student can verify it from what they hear.
- Verdict F: the audio directly contradicts this. The correct information IS in the audio.
- Verdict DS: this topic is never mentioned in the audio — not confirmed, not contradicted.
- Distribution: include at least one of each verdict. A balanced mix (e.g. 2T / 2F / 1DS or 2T / 1F / 2DS) is ideal.
- CRITICAL for DS: do NOT mention the topic at all in the monologue — not even indirectly. If the statement says "The club meets on Mondays" and DS is the verdict, the word "Monday" or any day must not appear in the audio.

OUTPUT — minified JSON, no markdown:
{"context":"one-sentence scene description","audio":[{"speaker":"M","line":"..."}],"statements":[{"number":1,"text":"...","verdict":"T"},{"number":2,"text":"...","verdict":"F"},{"number":3,"text":"...","verdict":"DS"},{"number":4,"text":"...","verdict":"T"},{"number":5,"text":"...","verdict":"F"}]}

For a monologue use a single object in the audio array with speaker "M" or "W".',
  prompt_current = 'You are a Cambridge A2 Key (KET) examiner designing a Listening Part 5 exercise for Spanish students aged 11–12.

TASK
Write a monologue or dialogue of 160–200 words, then create exactly 5 statements about it. For each statement, assign one of three verdicts: T (True), F (False), or DS (Doesn''t Say).

AUDIO RULES
- A monologue (one speaker) or a short dialogue (two speakers: M/W) on an everyday topic.
- Topic: a school event, a club announcement, a personal story, a trip, a hobby, a sports activity.
- Vocabulary: A2 Cambridge level.
- Include some facts that are clearly stated, some that are clearly contradicted, and some topics that are simply never mentioned.

STATEMENT RULES
- Each statement is a simple sentence testing a specific detail.
- Verdict T: the audio directly confirms this. The student can verify it from what they hear.
- Verdict F: the audio directly contradicts this. The correct information IS in the audio.
- Verdict DS: this topic is never mentioned in the audio — not confirmed, not contradicted.
- Distribution: include at least one of each verdict. A balanced mix (e.g. 2T / 2F / 1DS or 2T / 1F / 2DS) is ideal.
- CRITICAL for DS: do NOT mention the topic at all in the monologue — not even indirectly. If the statement says "The club meets on Mondays" and DS is the verdict, the word "Monday" or any day must not appear in the audio.

OUTPUT — minified JSON, no markdown:
{"context":"one-sentence scene description","audio":[{"speaker":"M","line":"..."}],"statements":[{"number":1,"text":"...","verdict":"T"},{"number":2,"text":"...","verdict":"F"},{"number":3,"text":"...","verdict":"DS"},{"number":4,"text":"...","verdict":"T"},{"number":5,"text":"...","verdict":"F"}]}

For a monologue use a single object in the audio array with speaker "M" or "W".',
  updated_at = now()
WHERE prompt_key = 'cambridge_ket_listening_part5_a2_generation';

INSERT INTO bob_prompts (
  prompt_key, framework, exam_part, cefr_level, skill,
  activity_type, label, status,
  prompt_default, prompt_current
)
VALUES (
  'cambridge_ket_listening_part5_a2_framing',
  'cambridge', 'ket_listening_part5', 'a2', 'listening',
  'framing', 'KET Listening Part 5 (A2) — framing', 'enabled',
  'You will hear someone speaking. Read the statements and decide: is each one True, False, or does the speaker not say? Choose T, F or DS for each one.',
  'You will hear someone speaking. Read the statements and decide: is each one True, False, or does the speaker not say? Choose T, F or DS for each one.'
)
ON CONFLICT (prompt_key) DO UPDATE
  SET prompt_current = EXCLUDED.prompt_current,
      updated_at     = now();

UPDATE bob_prompts
SET status = 'enabled', updated_at = now()
WHERE exam_part = 'ket_listening_part5';
