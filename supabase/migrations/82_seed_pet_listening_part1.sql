-- PET Listening Part 1 — MC Situacional (short everyday conversation, single multiple choice)
-- Seeds the generation / evaluation / framing trio in bob_prompts and enables the activity.

INSERT INTO bob_prompts (
  prompt_key, framework, exam_part, cefr_level, skill,
  activity_type, label, description, status,
  prompt_default, prompt_current
)
VALUES (
  'cambridge_pet_listening_part1_b1_generation',
  'cambridge', 'pet_listening_part1', 'b1', 'listening',
  'generation', 'Listening Part 1 — Situational Multiple Choice',
  'Listen to a short everyday conversation and choose the best answer.', 'enabled',
  $pdef$You are a Cambridge B1 Preliminary (PET) examiner designing Listening Part 1 — "Situational Multiple Choice" — for teenage students at B1 level.

TASK
Generate exactly 6 independent items. Each item is a SHORT everyday conversation between two speakers (Man and Woman), each conversation a MAXIMUM of 80 words, followed by ONE multiple-choice question with exactly 3 options (A, B, C).

CONVERSATION RULES
- Two speakers only: Man (M) and Woman (W), taking natural turns (3-6 exchanges).
- The whole conversation MUST be 80 words or fewer.
- Setting: everyday life — work, school, or leisure (planning a meeting, a class, a trip, a purchase, a weekend plan, a phone call, etc.).
- Vocabulary and grammar strictly at B1 Cambridge level.
- Each conversation contains one concrete fact that the question can test (a time, a place, a price, a decision, a reason, an object).

QUESTION RULES
- ONE question per conversation, testing a specific detail or the speaker's intention — not just the general topic.
- Exactly 3 options (A, B, C); all three plausible, only ONE clearly correct.
- Options are short noun phrases or simple sentences, never full paragraphs.
- Do NOT copy the exact wording of the answer from the transcript — paraphrase it.
- Vary the correct answer across the 6 items (do not make them all "A").

OUTPUT — minified JSON, no markdown, no commentary:
{"context":"one-sentence description of the whole exercise","items":[{"number":1,"conversation":[{"speaker":"M","line":"..."},{"speaker":"W","line":"..."}],"question":"...","options":{"A":"...","B":"...","C":"..."},"answer":"A"},{"number":2,"conversation":[{"speaker":"W","line":"..."},{"speaker":"M","line":"..."}],"question":"...","options":{"A":"...","B":"...","C":"..."},"answer":"B"},{"number":3,"conversation":[...],"question":"...","options":{"A":"...","B":"...","C":"..."},"answer":"C"},{"number":4,"conversation":[...],"question":"...","options":{"A":"...","B":"...","C":"..."},"answer":"A"},{"number":5,"conversation":[...],"question":"...","options":{"A":"...","B":"...","C":"..."},"answer":"B"},{"number":6,"conversation":[...],"question":"...","options":{"A":"...","B":"...","C":"..."},"answer":"C"}]}$pdef$,
  $pcur$You are a Cambridge B1 Preliminary (PET) examiner designing Listening Part 1 — "Situational Multiple Choice" — for teenage students at B1 level.

TASK
Generate exactly 6 independent items. Each item is a SHORT everyday conversation between two speakers (Man and Woman), each conversation a MAXIMUM of 80 words, followed by ONE multiple-choice question with exactly 3 options (A, B, C).

CONVERSATION RULES
- Two speakers only: Man (M) and Woman (W), taking natural turns (3-6 exchanges).
- The whole conversation MUST be 80 words or fewer.
- Setting: everyday life — work, school, or leisure (planning a meeting, a class, a trip, a purchase, a weekend plan, a phone call, etc.).
- Vocabulary and grammar strictly at B1 Cambridge level.
- Each conversation contains one concrete fact that the question can test (a time, a place, a price, a decision, a reason, an object).

QUESTION RULES
- ONE question per conversation, testing a specific detail or the speaker's intention — not just the general topic.
- Exactly 3 options (A, B, C); all three plausible, only ONE clearly correct.
- Options are short noun phrases or simple sentences, never full paragraphs.
- Do NOT copy the exact wording of the answer from the transcript — paraphrase it.
- Vary the correct answer across the 6 items (do not make them all "A").

OUTPUT — minified JSON, no markdown, no commentary:
{"context":"one-sentence description of the whole exercise","items":[{"number":1,"conversation":[{"speaker":"M","line":"..."},{"speaker":"W","line":"..."}],"question":"...","options":{"A":"...","B":"...","C":"..."},"answer":"A"},{"number":2,"conversation":[{"speaker":"W","line":"..."},{"speaker":"M","line":"..."}],"question":"...","options":{"A":"...","B":"...","C":"..."},"answer":"B"},{"number":3,"conversation":[...],"question":"...","options":{"A":"...","B":"...","C":"..."},"answer":"C"},{"number":4,"conversation":[...],"question":"...","options":{"A":"...","B":"...","C":"..."},"answer":"A"},{"number":5,"conversation":[...],"question":"...","options":{"A":"...","B":"...","C":"..."},"answer":"B"},{"number":6,"conversation":[...],"question":"...","options":{"A":"...","B":"...","C":"..."},"answer":"C"}]}$pcur$
)
ON CONFLICT (prompt_key) DO UPDATE
  SET prompt_current = EXCLUDED.prompt_current,
      prompt_default = EXCLUDED.prompt_default,
      status         = 'enabled',
      label          = EXCLUDED.label,
      description    = EXCLUDED.description,
      updated_at     = now();

INSERT INTO bob_prompts (
  prompt_key, framework, exam_part, cefr_level, skill,
  activity_type, label, status,
  prompt_default, prompt_current
)
VALUES (
  'cambridge_pet_listening_part1_b1_evaluation',
  'cambridge', 'pet_listening_part1', 'b1', 'listening',
  'evaluation', 'PET Listening Part 1 (B1) — evaluation', 'enabled',
  $pdef$Deterministic multiple-choice listening item. Each item carries its own correct option; scoring is computed server-side by comparing the chosen option against the answer key. No language-model judgement is required.$pdef$,
  $pcur$Deterministic multiple-choice listening item. Each item carries its own correct option; scoring is computed server-side by comparing the chosen option against the answer key. No language-model judgement is required.$pcur$
)
ON CONFLICT (prompt_key) DO UPDATE
  SET prompt_current = EXCLUDED.prompt_current,
      status         = 'enabled',
      updated_at     = now();

INSERT INTO bob_prompts (
  prompt_key, framework, exam_part, cefr_level, skill,
  activity_type, label, status,
  prompt_default, prompt_current
)
VALUES (
  'cambridge_pet_listening_part1_b1_framing',
  'cambridge', 'pet_listening_part1', 'b1', 'listening',
  'framing', 'PET Listening Part 1 (B1) — framing', 'enabled',
  $pdef$Vas a escuchar varias conversaciones cortas de la vida diaria entre dos personas. Después de cada una, elige la respuesta correcta — A, B o C. Puedes escuchar cada conversación las veces que necesites.$pdef$,
  $pcur$Vas a escuchar varias conversaciones cortas de la vida diaria entre dos personas. Después de cada una, elige la respuesta correcta — A, B o C. Puedes escuchar cada conversación las veces que necesites.$pcur$
)
ON CONFLICT (prompt_key) DO UPDATE
  SET prompt_current = EXCLUDED.prompt_current,
      status         = 'enabled',
      updated_at     = now();

UPDATE bob_prompts
SET status = 'enabled', updated_at = now()
WHERE exam_part = 'pet_listening_part1';
