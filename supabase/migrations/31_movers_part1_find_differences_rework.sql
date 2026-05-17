-- Migration 31: Movers Part 1 "Find the Differences" — full rework
-- Rewrites all 5 cambridge_movers_part1_a1_* prompts to follow the
-- validated YL pattern (pre-picked vocabulary, binary eval, warm reactions).
-- Also seeds bob_vocabulary with A1 Movers words (copied from pre_a1 base +
-- Movers-specific additions) so pickVocabularyForActivity works.

-- ============================================================
-- 1. Generation prompt — receives {WORD_1..4}, emits structured
--    JSON with differences array + two image prompts (A and B).
-- ============================================================
UPDATE public.bob_prompts
SET
  prompt_default = 'You are designing a Cambridge YL Movers Speaking Part 1 "Find the Differences" task.\nChildren (ages 8-11) compare two pictures that look the same but have 4 differences.\n\nYou are given exactly 4 words chosen from the official Movers vocabulary:\nWord 1: {WORD_1}\nWord 2: {WORD_2}\nWord 3: {WORD_3}\nWord 4: {WORD_4}\n\nHARD RULES:\n- Do NOT invent vocabulary. Use ONLY the 4 words provided as the objects with differences.\n- Each object must have a concrete, easily describable difference: colour (red/blue), number (one/two), size (big/small), or position (on/under/in/next to).\n- All 4 properties must be different from each other (no two colour differences, etc.).\n- Sentences must be short: 6-10 words max.\n- NO text or labels in the image prompts.\n- The scene must be coherent — all 4 objects appear naturally in the same setting.\n- People constraint: include 1-2 children or adults visible in the scene.\n\nOUTPUT: minified JSON with this EXACT shape:\n{\n  "character_description": "<1 sentence describing the children or people in the scene>",\n  "scene_setting": "<1 sentence setting, e.g. a sunny park with kids>",\n  "differences": [\n    {\n      "id": "d1",\n      "object_word": "{WORD_1}",\n      "property": "color",\n      "value_a": "<value in picture A>",\n      "value_b": "<value in picture B>",\n      "examiner_cue": "In my picture, the {WORD_1} is <value_a>. What about your picture?",\n      "expected_answer": "In my picture, the {WORD_1} is <value_b>."\n    },\n    {\n      "id": "d2",\n      "object_word": "{WORD_2}",\n      "property": "number",\n      "value_a": "<value in picture A>",\n      "value_b": "<value in picture B>",\n      "examiner_cue": "In my picture, there is <value_a> {WORD_2}. What about your picture?",\n      "expected_answer": "In my picture, there are <value_b> {WORD_2}s."\n    },\n    {\n      "id": "d3",\n      "object_word": "{WORD_3}",\n      "property": "size",\n      "value_a": "<big or small>",\n      "value_b": "<the other>",\n      "examiner_cue": "In my picture, the {WORD_3} is <value_a>. What about your picture?",\n      "expected_answer": "In my picture, the {WORD_3} is <value_b>."\n    },\n    {\n      "id": "d4",\n      "object_word": "{WORD_4}",\n      "property": "position",\n      "value_a": "<on/under/in/next to something>",\n      "value_b": "<different position>",\n      "examiner_cue": "In my picture, the {WORD_4} is <value_a> the table. What about your picture?",\n      "expected_answer": "In my picture, the {WORD_4} is <value_b> the table."\n    }\n  ],\n  "image_prompt_a": "<rich scene description for picture A — all 4 objects with their value_a properties, 1-2 visible people, flat illustration style, no text>",\n  "image_prompt_b": "<same scene but each object has value_b instead — only the 4 properties differ>"\n}',
  prompt_current = 'You are designing a Cambridge YL Movers Speaking Part 1 "Find the Differences" task.\nChildren (ages 8-11) compare two pictures that look the same but have 4 differences.\n\nYou are given exactly 4 words chosen from the official Movers vocabulary:\nWord 1: {WORD_1}\nWord 2: {WORD_2}\nWord 3: {WORD_3}\nWord 4: {WORD_4}\n\nHARD RULES:\n- Do NOT invent vocabulary. Use ONLY the 4 words provided as the objects with differences.\n- Each object must have a concrete, easily describable difference: colour (red/blue), number (one/two), size (big/small), or position (on/under/in/next to).\n- All 4 properties must be different from each other (no two colour differences, etc.).\n- Sentences must be short: 6-10 words max.\n- NO text or labels in the image prompts.\n- The scene must be coherent — all 4 objects appear naturally in the same setting.\n- People constraint: include 1-2 children or adults visible in the scene.\n\nOUTPUT: minified JSON with this EXACT shape:\n{\n  "character_description": "<1 sentence describing the children or people in the scene>",\n  "scene_setting": "<1 sentence setting, e.g. a sunny park with kids>",\n  "differences": [\n    {\n      "id": "d1",\n      "object_word": "{WORD_1}",\n      "property": "color",\n      "value_a": "<value in picture A>",\n      "value_b": "<value in picture B>",\n      "examiner_cue": "In my picture, the {WORD_1} is <value_a>. What about your picture?",\n      "expected_answer": "In my picture, the {WORD_1} is <value_b>."\n    },\n    {\n      "id": "d2",\n      "object_word": "{WORD_2}",\n      "property": "number",\n      "value_a": "<value in picture A>",\n      "value_b": "<value in picture B>",\n      "examiner_cue": "In my picture, there is <value_a> {WORD_2}. What about your picture?",\n      "expected_answer": "In my picture, there are <value_b> {WORD_2}s."\n    },\n    {\n      "id": "d3",\n      "object_word": "{WORD_3}",\n      "property": "size",\n      "value_a": "<big or small>",\n      "value_b": "<the other>",\n      "examiner_cue": "In my picture, the {WORD_3} is <value_a>. What about your picture?",\n      "expected_answer": "In my picture, the {WORD_3} is <value_b>."\n    },\n    {\n      "id": "d4",\n      "object_word": "{WORD_4}",\n      "property": "position",\n      "value_a": "<on/under/in/next to something>",\n      "value_b": "<different position>",\n      "examiner_cue": "In my picture, the {WORD_4} is <value_a> the table. What about your picture?",\n      "expected_answer": "In my picture, the {WORD_4} is <value_b> the table."\n    }\n  ],\n  "image_prompt_a": "<rich scene description for picture A — all 4 objects with their value_a properties, 1-2 visible people, flat illustration style, no text>",\n  "image_prompt_b": "<same scene but each object has value_b instead — only the 4 properties differ>"\n}',
  label = 'Find the Differences',
  description = 'Look at two pictures. Spot what is different!',
  status = 'coming_soon'
WHERE prompt_key = 'cambridge_movers_part1_a1_generation';

-- ============================================================
-- 2. Image gen prompt — receives {IMAGE_PROMPT}, generates one
--    picture (called twice: once for A, once for B).
-- ============================================================
UPDATE public.bob_prompts
SET
  prompt_default = 'Generate a flat illustration image for a Cambridge Movers Part 1 "Find the Differences" activity.\n\nScene to illustrate:\n{IMAGE_PROMPT}\n\nStyle requirements:\n- Flat illustration, children''s book style\n- Bright but not garish colours; use muted-ish, warm tones\n- Simple composition — 6-8 distinct objects clearly visible\n- Items easily named with A1 Movers vocabulary\n- Include 1-2 friendly child characters (ages 8-11) actively doing something\n- NO text, NO letters, NO labels anywhere in the image\n- 1:1 aspect ratio\n\nPEOPLE CONSTRAINT: at least 1 visible human character must appear in the scene.',
  prompt_current = 'Generate a flat illustration image for a Cambridge Movers Part 1 "Find the Differences" activity.\n\nScene to illustrate:\n{IMAGE_PROMPT}\n\nStyle requirements:\n- Flat illustration, children''s book style\n- Bright but not garish colours; use muted-ish, warm tones\n- Simple composition — 6-8 distinct objects clearly visible\n- Items easily named with A1 Movers vocabulary\n- Include 1-2 friendly child characters (ages 8-11) actively doing something\n- NO text, NO letters, NO labels anywhere in the image\n- 1:1 aspect ratio\n\nPEOPLE CONSTRAINT: at least 1 visible human character must appear in the scene.'
WHERE prompt_key = 'cambridge_movers_part1_a1_image_gen';

-- ============================================================
-- 3. Examiner reaction prompt — warm 1-sentence reaction.
--    Corrects explicitly when wrong (D-D2 compliant: no scores).
-- ============================================================
UPDATE public.bob_prompts
SET
  prompt_default = 'You are a warm Cambridge YL examiner reacting to a Movers child''s spoken answer.\n\nExaminer cue: "{EXAMINER_CUE}"\nExpected answer: "{EXPECTED_ANSWER}"\nChild said: "{USER_TRANSCRIPT}"\nCorrect: {CORRECT}\n\nRULES:\n- Output exactly ONE warm sentence in English.\n- If correct=true: celebrate briefly. Example: "Yes! Well spotted — in your picture it''s {value_b}!"\n- If correct=false: correct explicitly with the right answer. Example: "Almost — in your picture, the {object} is {value_b}. Good try!"\n- NEVER mention scores, numbers, or grades.\n- Keep it child-friendly and encouraging.\n\nOUTPUT: minified JSON: {"reaction": "<1 sentence>"}',
  prompt_current = 'You are a warm Cambridge YL examiner reacting to a Movers child''s spoken answer.\n\nExaminer cue: "{EXAMINER_CUE}"\nExpected answer: "{EXPECTED_ANSWER}"\nChild said: "{USER_TRANSCRIPT}"\nCorrect: {CORRECT}\n\nRULES:\n- Output exactly ONE warm sentence in English.\n- If correct=true: celebrate briefly. Example: "Yes! Well spotted — in your picture it''s {value_b}!"\n- If correct=false: correct explicitly with the right answer. Example: "Almost — in your picture, the {object} is {value_b}. Good try!"\n- NEVER mention scores, numbers, or grades.\n- Keep it child-friendly and encouraging.\n\nOUTPUT: minified JSON: {"reaction": "<1 sentence>"}'
WHERE prompt_key = 'cambridge_movers_part1_a1_examiner_reaction';

-- ============================================================
-- 4. Evaluation prompt — binary score 0/1, same schema as
--    WhatsThisEvalResult so evaluateFindDifferencesAnswerAction
--    can reuse WhatsThisEvalResultSchema directly.
-- ============================================================
UPDATE public.bob_prompts
SET
  prompt_default = 'You are evaluating a Cambridge YL Movers child''s spoken answer for the "Find the Differences" activity.\n\nExaminer cue: "{EXAMINER_CUE}"\nExpected answer: "{EXPECTED_ANSWER}"\nChild said: "{USER_TRANSCRIPT}"\nAudio duration: {AUDIO_DURATION_SECONDS} seconds\n\nSCORING — binary, no partial credit:\n- score=1 if the child identified the correct attribute of the correct object. Accept shortened or slightly ungrammatical answers (e.g. "black" or "it black" instead of the full sentence).\n- score=0 if the child named the wrong attribute, the wrong object, or was silent/off-topic.\n\nHARD RULES:\n- NEVER give a numeric score visible to the child.\n- NEVER inflate: when in doubt, score 0.\n- The "reaction" field must be warm and in English. If score=0, it MUST include the correct answer.\n- "feedback" is one short encouraging sentence for the child.\n\nOUTPUT: minified JSON with this EXACT shape:\n{"score": 0, "score_max": 1, "cefr_band": "a1", "correct": false, "reaction": "<1-sentence warm English>", "feedback": "<1-sentence kid-friendly>", "transcript_used": "<what you heard>"}',
  prompt_current = 'You are evaluating a Cambridge YL Movers child''s spoken answer for the "Find the Differences" activity.\n\nExaminer cue: "{EXAMINER_CUE}"\nExpected answer: "{EXPECTED_ANSWER}"\nChild said: "{USER_TRANSCRIPT}"\nAudio duration: {AUDIO_DURATION_SECONDS} seconds\n\nSCORING — binary, no partial credit:\n- score=1 if the child identified the correct attribute of the correct object. Accept shortened or slightly ungrammatical answers (e.g. "black" or "it black" instead of the full sentence).\n- score=0 if the child named the wrong attribute, the wrong object, or was silent/off-topic.\n\nHARD RULES:\n- NEVER give a numeric score visible to the child.\n- NEVER inflate: when in doubt, score 0.\n- The "reaction" field must be warm and in English. If score=0, it MUST include the correct answer.\n- "feedback" is one short encouraging sentence for the child.\n\nOUTPUT: minified JSON with this EXACT shape:\n{"score": 0, "score_max": 1, "cefr_band": "a1", "correct": false, "reaction": "<1-sentence warm English>", "feedback": "<1-sentence kid-friendly>", "transcript_used": "<what you heard>"}'
WHERE prompt_key = 'cambridge_movers_part1_a1_evaluation';

-- ============================================================
-- 5. Framing prompt — short English welcome, non-blocking.
-- ============================================================
UPDATE public.bob_prompts
SET
  prompt_default = 'You are Bob. A child is about to do Cambridge Movers Speaking Part 1.\n\nGenerate a SHORT English welcome (1-2 sentences, cheerful): introduce the "Find the Differences" activity. Example: "Let''s compare two pictures! I''ll describe mine, then you tell me about yours."\n\nOUTPUT: minified JSON: {"framing": "<message>"}',
  prompt_current = 'You are Bob. A child is about to do Cambridge Movers Speaking Part 1.\n\nGenerate a SHORT English welcome (1-2 sentences, cheerful): introduce the "Find the Differences" activity. Example: "Let''s compare two pictures! I''ll describe mine, then you tell me about yours."\n\nOUTPUT: minified JSON: {"framing": "<message>"}'
WHERE prompt_key = 'cambridge_movers_part1_a1_framing';

-- ============================================================
-- 6. Seed A1 vocabulary for Movers.
--    Copy all pre_a1 words + add Movers-specific words.
--    Uses ON CONFLICT DO NOTHING so re-running is safe.
-- ============================================================
INSERT INTO public.bob_vocabulary (framework, cefr_level, exam_part, category, word, word_type, pointable, notes)
SELECT
  framework,
  'a1' AS cefr_level,
  'movers' AS exam_part,
  category,
  word,
  word_type,
  pointable,
  notes
FROM public.bob_vocabulary
WHERE cefr_level = 'pre_a1' AND pointable = true
ON CONFLICT (framework, cefr_level, word) DO NOTHING;

-- Movers-specific additions not in Starters list
INSERT INTO public.bob_vocabulary (framework, cefr_level, exam_part, category, word, word_type, pointable)
VALUES
  ('cambridge', 'a1', 'movers', 'home',         'bath',         'noun', true),
  ('cambridge', 'a1', 'movers', 'home',          'bookcase',     'noun', true),
  ('cambridge', 'a1', 'movers', 'home',          'cupboard',     'noun', true),
  ('cambridge', 'a1', 'movers', 'home',          'mirror',       'noun', true),
  ('cambridge', 'a1', 'movers', 'home',          'lamp',         'noun', true),
  ('cambridge', 'a1', 'movers', 'home',          'shelf',        'noun', true),
  ('cambridge', 'a1', 'movers', 'home',          'sofa',         'noun', true),
  ('cambridge', 'a1', 'movers', 'home',          'towel',        'noun', true),
  ('cambridge', 'a1', 'movers', 'food_drink',    'biscuit',      'noun', true),
  ('cambridge', 'a1', 'movers', 'food_drink',    'bowl',         'noun', true),
  ('cambridge', 'a1', 'movers', 'food_drink',    'glass',        'noun', true),
  ('cambridge', 'a1', 'movers', 'food_drink',    'lemon',        'noun', true),
  ('cambridge', 'a1', 'movers', 'food_drink',    'mango',        'noun', true),
  ('cambridge', 'a1', 'movers', 'food_drink',    'melon',        'noun', true),
  ('cambridge', 'a1', 'movers', 'food_drink',    'pear',         'noun', true),
  ('cambridge', 'a1', 'movers', 'food_drink',    'pineapple',    'noun', true),
  ('cambridge', 'a1', 'movers', 'food_drink',    'potato',       'noun', true),
  ('cambridge', 'a1', 'movers', 'food_drink',    'strawberry',   'noun', true),
  ('cambridge', 'a1', 'movers', 'food_drink',    'tomato',       'noun', true),
  ('cambridge', 'a1', 'movers', 'animals',       'bat',          'noun', true),
  ('cambridge', 'a1', 'movers', 'animals',       'butterfly',    'noun', true),
  ('cambridge', 'a1', 'movers', 'animals',       'camel',        'noun', true),
  ('cambridge', 'a1', 'movers', 'animals',       'crab',         'noun', true),
  ('cambridge', 'a1', 'movers', 'animals',       'kangaroo',     'noun', true),
  ('cambridge', 'a1', 'movers', 'animals',       'parrot',       'noun', true),
  ('cambridge', 'a1', 'movers', 'animals',       'penguin',      'noun', true),
  ('cambridge', 'a1', 'movers', 'animals',       'rabbit',       'noun', true),
  ('cambridge', 'a1', 'movers', 'animals',       'shark',        'noun', true),
  ('cambridge', 'a1', 'movers', 'animals',       'whale',        'noun', true),
  ('cambridge', 'a1', 'movers', 'transport',     'bus',          'noun', true),
  ('cambridge', 'a1', 'movers', 'transport',     'helicopter',   'noun', true),
  ('cambridge', 'a1', 'movers', 'transport',     'lorry',        'noun', true),
  ('cambridge', 'a1', 'movers', 'transport',     'motorbike',    'noun', true),
  ('cambridge', 'a1', 'movers', 'transport',     'ship',         'noun', true),
  ('cambridge', 'a1', 'movers', 'transport',     'tractor',      'noun', true),
  ('cambridge', 'a1', 'movers', 'school',        'calculator',   'noun', true),
  ('cambridge', 'a1', 'movers', 'school',        'dictionary',   'noun', true),
  ('cambridge', 'a1', 'movers', 'school',        'glue',         'noun', true),
  ('cambridge', 'a1', 'movers', 'school',        'map',          'noun', true),
  ('cambridge', 'a1', 'movers', 'school',        'notebook',     'noun', true),
  ('cambridge', 'a1', 'movers', 'school',        'paint',        'noun', true),
  ('cambridge', 'a1', 'movers', 'school',        'scissors',     'noun', true),
  ('cambridge', 'a1', 'movers', 'nature',        'cloud',        'noun', true),
  ('cambridge', 'a1', 'movers', 'nature',        'field',        'noun', true),
  ('cambridge', 'a1', 'movers', 'nature',        'forest',       'noun', true),
  ('cambridge', 'a1', 'movers', 'nature',        'lake',         'noun', true),
  ('cambridge', 'a1', 'movers', 'nature',        'moon',         'noun', true),
  ('cambridge', 'a1', 'movers', 'nature',        'river',        'noun', true),
  ('cambridge', 'a1', 'movers', 'nature',        'rock',         'noun', true),
  ('cambridge', 'a1', 'movers', 'nature',        'sand',         'noun', true),
  ('cambridge', 'a1', 'movers', 'sports_music',  'bat',          'noun', true),
  ('cambridge', 'a1', 'movers', 'sports_music',  'goal',         'noun', true),
  ('cambridge', 'a1', 'movers', 'sports_music',  'guitar',       'noun', true),
  ('cambridge', 'a1', 'movers', 'sports_music',  'helmet',       'noun', true),
  ('cambridge', 'a1', 'movers', 'sports_music',  'piano',        'noun', true),
  ('cambridge', 'a1', 'movers', 'sports_music',  'racket',       'noun', true),
  ('cambridge', 'a1', 'movers', 'sports_music',  'skate',        'noun', true),
  ('cambridge', 'a1', 'movers', 'sports_music',  'ski',          'noun', true),
  ('cambridge', 'a1', 'movers', 'toys',          'robot',        'noun', true),
  ('cambridge', 'a1', 'movers', 'toys',          'skateboard',   'noun', true),
  ('cambridge', 'a1', 'movers', 'clothes',       'belt',         'noun', true),
  ('cambridge', 'a1', 'movers', 'clothes',       'blanket',      'noun', true),
  ('cambridge', 'a1', 'movers', 'clothes',       'glove',        'noun', true),
  ('cambridge', 'a1', 'movers', 'clothes',       'scarf',        'noun', true),
  ('cambridge', 'a1', 'movers', 'clothes',       'sweater',      'noun', true),
  ('cambridge', 'a1', 'movers', 'clothes',       'swimsuit',     'noun', true),
  ('cambridge', 'a1', 'movers', 'clothes',       'umbrella',     'noun', true)
ON CONFLICT (framework, cefr_level, word) DO NOTHING;
