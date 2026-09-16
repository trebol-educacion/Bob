-- PET Listening Part 3 — Interactive Gap-Fill (single monologue, summary with gaps + word bank)
-- Seeds the generation / evaluation / framing trio in bob_prompts and enables the activity.

INSERT INTO bob_prompts (
  prompt_key, framework, exam_part, cefr_level, skill,
  activity_type, label, description, status,
  prompt_default, prompt_current
)
VALUES (
  'cambridge_pet_listening_part3_b1_generation',
  'cambridge', 'pet_listening_part3', 'b1', 'listening',
  'generation', 'Listening Part 3 — Interactive Gap-Fill',
  'Listen to a short talk and complete the summary with the missing words.', 'enabled',
  $pdef$You are a Cambridge B1 Preliminary (PET) examiner designing Listening Part 3 — "Interactive Gap-Fill" — for teenage students at B1 level.

TASK
Generate ONE single-speaker monologue (a podcast clip, a radio announcement, a tour-guide talk, a museum or school announcement) of 100-120 words, and a SUMMARY of that talk written as a short paragraph with exactly 6 numbered gaps.

MONOLOGUE RULES
- ONE speaker only, talking naturally and continuously (no dialogue, no second voice).
- Between 100 and 120 words. Count them; stay inside the range.
- Setting: everyday or informational — an event, a place, a hobby, a school trip, a product, a piece of news.
- Vocabulary and grammar strictly at B1 Cambridge level.
- The talk must contain 6 concrete facts a listener can catch: a name, a time, a day, a place, a number, a price, an object, an activity, etc.

SUMMARY + GAP RULES
- The summary is ONE short paragraph (40-70 words) that retells the talk in different words.
- It contains exactly 6 gaps, written as the literal tokens [1] [2] [3] [4] [5] [6] in reading order.
- Each gap is answered by ONE word (occasionally a number or a short two-word name) the listener hears in the talk.
- Do NOT copy whole sentences from the talk into the summary — paraphrase the surrounding text; only the missing word itself matches what is heard.
- For each gap give the canonical "answer" plus an "accept" list of equally-correct alternative spellings or synonyms (may be empty). Matching is case-insensitive and trimmed; only words in "answer" or "accept" are marked correct.

WORD BANK RULES
- Provide a "word_bank" of exactly 10 single words: the 6 correct answers PLUS 4 plausible B1-level distractors that fit the topic but are NOT correct.
- Shuffle the bank; do not list the 6 answers first.

OUTPUT — minified JSON, no markdown, no commentary:
{"context":"one-sentence description of the talk","summary_title":"short title for the summary, 2-4 words","transcript":"the full 100-120 word monologue as one continuous string","summary":"A short paragraph that retells the talk and contains the gaps [1] ... [2] ... [3] ... [4] ... [5] ... [6] in order.","gaps":[{"number":1,"answer":"...","accept":["..."]},{"number":2,"answer":"...","accept":[]},{"number":3,"answer":"...","accept":[]},{"number":4,"answer":"...","accept":[]},{"number":5,"answer":"...","accept":[]},{"number":6,"answer":"...","accept":[]}],"word_bank":["...","...","...","...","...","...","...","...","...","..."]}$pdef$,
  $pcur$You are a Cambridge B1 Preliminary (PET) examiner designing Listening Part 3 — "Interactive Gap-Fill" — for teenage students at B1 level.

TASK
Generate ONE single-speaker monologue (a podcast clip, a radio announcement, a tour-guide talk, a museum or school announcement) of 100-120 words, and a SUMMARY of that talk written as a short paragraph with exactly 6 numbered gaps.

MONOLOGUE RULES
- ONE speaker only, talking naturally and continuously (no dialogue, no second voice).
- Between 100 and 120 words. Count them; stay inside the range.
- Setting: everyday or informational — an event, a place, a hobby, a school trip, a product, a piece of news.
- Vocabulary and grammar strictly at B1 Cambridge level.
- The talk must contain 6 concrete facts a listener can catch: a name, a time, a day, a place, a number, a price, an object, an activity, etc.

SUMMARY + GAP RULES
- The summary is ONE short paragraph (40-70 words) that retells the talk in different words.
- It contains exactly 6 gaps, written as the literal tokens [1] [2] [3] [4] [5] [6] in reading order.
- Each gap is answered by ONE word (occasionally a number or a short two-word name) the listener hears in the talk.
- Do NOT copy whole sentences from the talk into the summary — paraphrase the surrounding text; only the missing word itself matches what is heard.
- For each gap give the canonical "answer" plus an "accept" list of equally-correct alternative spellings or synonyms (may be empty). Matching is case-insensitive and trimmed; only words in "answer" or "accept" are marked correct.

WORD BANK RULES
- Provide a "word_bank" of exactly 10 single words: the 6 correct answers PLUS 4 plausible B1-level distractors that fit the topic but are NOT correct.
- Shuffle the bank; do not list the 6 answers first.

OUTPUT — minified JSON, no markdown, no commentary:
{"context":"one-sentence description of the talk","summary_title":"short title for the summary, 2-4 words","transcript":"the full 100-120 word monologue as one continuous string","summary":"A short paragraph that retells the talk and contains the gaps [1] ... [2] ... [3] ... [4] ... [5] ... [6] in order.","gaps":[{"number":1,"answer":"...","accept":["..."]},{"number":2,"answer":"...","accept":[]},{"number":3,"answer":"...","accept":[]},{"number":4,"answer":"...","accept":[]},{"number":5,"answer":"...","accept":[]},{"number":6,"answer":"...","accept":[]}],"word_bank":["...","...","...","...","...","...","...","...","...","..."]}$pcur$
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
  'cambridge_pet_listening_part3_b1_evaluation',
  'cambridge', 'pet_listening_part3', 'b1', 'listening',
  'evaluation', 'PET Listening Part 3 (B1) — evaluation', 'enabled',
  $pdef$Deterministic gap-fill listening item. Each gap carries its own answer key (a canonical answer plus accepted alternatives); scoring is computed server-side by a case-insensitive, trimmed comparison of the student's word against the key. No language-model judgement is required.$pdef$,
  $pcur$Deterministic gap-fill listening item. Each gap carries its own answer key (a canonical answer plus accepted alternatives); scoring is computed server-side by a case-insensitive, trimmed comparison of the student's word against the key. No language-model judgement is required.$pcur$
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
  'cambridge_pet_listening_part3_b1_framing',
  'cambridge', 'pet_listening_part3', 'b1', 'listening',
  'framing', 'PET Listening Part 3 (B1) — framing', 'enabled',
  $pdef$Vas a escuchar una charla corta de una sola persona. Después, completa el resumen escribiendo o arrastrando la palabra que falta en cada hueco. Puedes escuchar la charla las veces que necesites.$pdef$,
  $pcur$Vas a escuchar una charla corta de una sola persona. Después, completa el resumen escribiendo o arrastrando la palabra que falta en cada hueco. Puedes escuchar la charla las veces que necesites.$pcur$
)
ON CONFLICT (prompt_key) DO UPDATE
  SET prompt_current = EXCLUDED.prompt_current,
      status         = 'enabled',
      updated_at     = now();

UPDATE bob_prompts
SET status = 'enabled', updated_at = now()
WHERE exam_part = 'pet_listening_part3';
