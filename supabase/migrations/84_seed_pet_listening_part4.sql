-- PET Listening Part 4 — Attitude / Opinion Detection (short monologue, single multiple choice)
-- Seeds the generation / evaluation / framing trio in bob_prompts and enables the activity.

INSERT INTO bob_prompts (
  prompt_key, framework, exam_part, cefr_level, skill,
  activity_type, label, description, status,
  prompt_default, prompt_current
)
VALUES (
  'cambridge_pet_listening_part4_b1_generation',
  'cambridge', 'pet_listening_part4', 'b1', 'listening',
  'generation', 'Listening Part 4 — Attitude & Opinion',
  'Listen to a short monologue and decide how the speaker feels, what they think, or what they want to do.', 'enabled',
  $pdef$You are a Cambridge B1 Preliminary (PET) examiner designing Listening Part 4 — "Attitude & Opinion Detection" — for teenage students at B1 level.

TASK
Generate exactly 6 independent items. Each item is a SHORT monologue spoken by ONE person of 40-50 words, followed by ONE multiple-choice question with exactly 3 options (A, B, C) that tests the speaker's FEELING, ATTITUDE, OPINION, or INTENTION — never a literal factual detail.

MONOLOGUE RULES
- One speaker only, speaking in the first person about a single experience, plan, or topic.
- Each monologue MUST be between 40 and 50 words.
- Setting: everyday life — school, hobbies, family, travel, friends, a recent event, a decision.
- Vocabulary and grammar strictly at B1 Cambridge level.
- The speaker's emotion, opinion or intention must be inferable from tone and word choice, NOT stated with the exact words used in the options.

QUESTION RULES
- ONE question per monologue. It MUST ask about attitude, feeling, opinion or intention, for example: "How does the speaker feel about ...?", "What does the speaker want to do?", "What is the speaker's opinion about ...?".
- Exactly 3 options (A, B, C); all three plausible, only ONE clearly correct.
- Options are short adjectives, noun phrases or simple sentences, never full paragraphs.
- Do NOT copy the exact wording of the answer from the monologue — the student must infer it.
- Vary the correct answer across the 6 items (do not make them all "A").

OUTPUT — minified JSON, no markdown, no commentary:
{"context":"one-sentence description of the whole exercise","items":[{"number":1,"monologue":"...","question":"...","options":{"A":"...","B":"...","C":"..."},"answer":"A"},{"number":2,"monologue":"...","question":"...","options":{"A":"...","B":"...","C":"..."},"answer":"B"},{"number":3,"monologue":"...","question":"...","options":{"A":"...","B":"...","C":"..."},"answer":"C"},{"number":4,"monologue":"...","question":"...","options":{"A":"...","B":"...","C":"..."},"answer":"A"},{"number":5,"monologue":"...","question":"...","options":{"A":"...","B":"...","C":"..."},"answer":"B"},{"number":6,"monologue":"...","question":"...","options":{"A":"...","B":"...","C":"..."},"answer":"C"}]}$pdef$,
  $pcur$You are a Cambridge B1 Preliminary (PET) examiner designing Listening Part 4 — "Attitude & Opinion Detection" — for teenage students at B1 level.

TASK
Generate exactly 6 independent items. Each item is a SHORT monologue spoken by ONE person of 40-50 words, followed by ONE multiple-choice question with exactly 3 options (A, B, C) that tests the speaker's FEELING, ATTITUDE, OPINION, or INTENTION — never a literal factual detail.

MONOLOGUE RULES
- One speaker only, speaking in the first person about a single experience, plan, or topic.
- Each monologue MUST be between 40 and 50 words.
- Setting: everyday life — school, hobbies, family, travel, friends, a recent event, a decision.
- Vocabulary and grammar strictly at B1 Cambridge level.
- The speaker's emotion, opinion or intention must be inferable from tone and word choice, NOT stated with the exact words used in the options.

QUESTION RULES
- ONE question per monologue. It MUST ask about attitude, feeling, opinion or intention, for example: "How does the speaker feel about ...?", "What does the speaker want to do?", "What is the speaker's opinion about ...?".
- Exactly 3 options (A, B, C); all three plausible, only ONE clearly correct.
- Options are short adjectives, noun phrases or simple sentences, never full paragraphs.
- Do NOT copy the exact wording of the answer from the monologue — the student must infer it.
- Vary the correct answer across the 6 items (do not make them all "A").

OUTPUT — minified JSON, no markdown, no commentary:
{"context":"one-sentence description of the whole exercise","items":[{"number":1,"monologue":"...","question":"...","options":{"A":"...","B":"...","C":"..."},"answer":"A"},{"number":2,"monologue":"...","question":"...","options":{"A":"...","B":"...","C":"..."},"answer":"B"},{"number":3,"monologue":"...","question":"...","options":{"A":"...","B":"...","C":"..."},"answer":"C"},{"number":4,"monologue":"...","question":"...","options":{"A":"...","B":"...","C":"..."},"answer":"A"},{"number":5,"monologue":"...","question":"...","options":{"A":"...","B":"...","C":"..."},"answer":"B"},{"number":6,"monologue":"...","question":"...","options":{"A":"...","B":"...","C":"..."},"answer":"C"}]}$pcur$
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
  'cambridge_pet_listening_part4_b1_evaluation',
  'cambridge', 'pet_listening_part4', 'b1', 'listening',
  'evaluation', 'PET Listening Part 4 (B1) — evaluation', 'enabled',
  $pdef$Deterministic multiple-choice listening item testing speaker attitude or intention. Each item carries its own correct option; scoring is computed server-side by comparing the chosen option against the answer key. No language-model judgement is required.$pdef$,
  $pcur$Deterministic multiple-choice listening item testing speaker attitude or intention. Each item carries its own correct option; scoring is computed server-side by comparing the chosen option against the answer key. No language-model judgement is required.$pcur$
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
  'cambridge_pet_listening_part4_b1_framing',
  'cambridge', 'pet_listening_part4', 'b1', 'listening',
  'framing', 'PET Listening Part 4 (B1) — framing', 'enabled',
  $pdef$Vas a escuchar a varias personas hablando solas sobre algo que les ha pasado o que piensan hacer. Después de cada una, decide cómo se siente, qué opina o qué quiere hacer y elige la respuesta correcta — A, B o C. Puedes escuchar cada audio las veces que necesites.$pdef$,
  $pcur$Vas a escuchar a varias personas hablando solas sobre algo que les ha pasado o que piensan hacer. Después de cada una, decide cómo se siente, qué opina o qué quiere hacer y elige la respuesta correcta — A, B o C. Puedes escuchar cada audio las veces que necesites.$pcur$
)
ON CONFLICT (prompt_key) DO UPDATE
  SET prompt_current = EXCLUDED.prompt_current,
      status         = 'enabled',
      updated_at     = now();

UPDATE bob_prompts
SET status = 'enabled', updated_at = now()
WHERE exam_part = 'pet_listening_part4';
