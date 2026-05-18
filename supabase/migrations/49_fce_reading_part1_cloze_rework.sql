-- 49_fce_reading_part1_cloze_rework.sql
-- Enables Cambridge B2 FCE Reading & Use of English Part 1 — Multiple-Choice Cloze.
-- 1 continuous text, 8 gaps, 4 options each. Deterministic evaluation.

UPDATE bob_prompts
SET
  label       = 'Multiple-Choice Cloze',
  description = 'Read a short text and choose the best word for each gap.',
  updated_at  = NOW()
WHERE prompt_key = 'cambridge_fce_reading_part1_b2_generation';

UPDATE bob_prompts
SET
  prompt_default = E'You are a Cambridge B2 First (FCE) examiner designing Reading & Use of English Part 1 (Multiple-Choice Cloze) for teenage/adult learners at B2 level.\n\nTASK: Produce ONE coherent, engaging text (130-170 words) with EXACTLY 8 gaps. Each gap has 4 options (A, B, C, D); only one is correct.\n\nTOPICS (choose ONE): university/student life, work and careers, travel and adventure, technology and daily life, health and wellbeing, food and culinary culture, hobbies and leisure, environmental issues.\n\nHARD RULES:\n1. Vocabulary strictly B2. Avoid C1+ words unless they ARE the focus item being tested.\n2. Gaps: use EXACTLY the syntax ___1___, ___2___, ___3___, ___4___, ___5___, ___6___, ___7___, ___8___ (three underscores, number, three underscores).\n3. EXACTLY 8 gaps — no more, no less.\n4. Gap distribution (total 8 gaps): 3-4 collocations (noun+verb, verb+preposition, adjective+noun), 1-2 phrasal verbs (particle matters), 1-2 fixed expressions or idioms, 1-2 prepositions or grammar patterns.\n5. Each option is 1 word or short phrase (≤4 words).\n6. All 4 options must be grammatically plausible in the sentence but only one is pragmatically/idiomatically correct.\n7. correct_option must rotate across A, B, C, D across the 8 gaps with approximately 2 of each letter — avoid any position bias.\n8. explanation: 1 plain B2 sentence explaining WHY the correct option fits (mention the collocation, phrasal verb, or grammar rule — not just "it is the correct word").\n9. title: 3-6 words, intriguing but neutral.\n10. The text must flow naturally as a piece of prose — it must make sense with the correct options filled in.\n\nOUTPUT minified JSON — no markdown, no extra keys:\n{"title":"<text title>","text_with_gaps":"<full text using ___1___ syntax>","gaps":[{"number":1,"options":[{"id":"A","text":"..."},{"id":"B","text":"..."},{"id":"C","text":"..."},{"id":"D","text":"..."}],"correct_option":"C","explanation":"..."},{"number":2,...},{"number":3,...},{"number":4,...},{"number":5,...},{"number":6,...},{"number":7,...},{"number":8,...}]}',
  prompt_current = E'You are a Cambridge B2 First (FCE) examiner designing Reading & Use of English Part 1 (Multiple-Choice Cloze) for teenage/adult learners at B2 level.\n\nTASK: Produce ONE coherent, engaging text (130-170 words) with EXACTLY 8 gaps. Each gap has 4 options (A, B, C, D); only one is correct.\n\nTOPICS (choose ONE): university/student life, work and careers, travel and adventure, technology and daily life, health and wellbeing, food and culinary culture, hobbies and leisure, environmental issues.\n\nHARD RULES:\n1. Vocabulary strictly B2. Avoid C1+ words unless they ARE the focus item being tested.\n2. Gaps: use EXACTLY the syntax ___1___, ___2___, ___3___, ___4___, ___5___, ___6___, ___7___, ___8___ (three underscores, number, three underscores).\n3. EXACTLY 8 gaps — no more, no less.\n4. Gap distribution (total 8 gaps): 3-4 collocations (noun+verb, verb+preposition, adjective+noun), 1-2 phrasal verbs (particle matters), 1-2 fixed expressions or idioms, 1-2 prepositions or grammar patterns.\n5. Each option is 1 word or short phrase (≤4 words).\n6. All 4 options must be grammatically plausible in the sentence but only one is pragmatically/idiomatically correct.\n7. correct_option must rotate across A, B, C, D across the 8 gaps with approximately 2 of each letter — avoid any position bias.\n8. explanation: 1 plain B2 sentence explaining WHY the correct option fits (mention the collocation, phrasal verb, or grammar rule — not just "it is the correct word").\n9. title: 3-6 words, intriguing but neutral.\n10. The text must flow naturally as a piece of prose — it must make sense with the correct options filled in.\n\nOUTPUT minified JSON — no markdown, no extra keys:\n{"title":"<text title>","text_with_gaps":"<full text using ___1___ syntax>","gaps":[{"number":1,"options":[{"id":"A","text":"..."},{"id":"B","text":"..."},{"id":"C","text":"..."},{"id":"D","text":"..."}],"correct_option":"C","explanation":"..."},{"number":2,...},{"number":3,...},{"number":4,...},{"number":5,...},{"number":6,...},{"number":7,...},{"number":8,...}]}',
  status     = 'enabled',
  updated_at = NOW()
WHERE prompt_key = 'cambridge_fce_reading_part1_b2_generation';

INSERT INTO bob_prompts (
  prompt_key,
  framework,
  exam_part,
  cefr_level,
  activity_type,
  label,
  description,
  prompt_default,
  prompt_current,
  variables,
  status
)
VALUES (
  'cambridge_fce_reading_part1_b2_framing',
  'cambridge',
  'fce_reading_part1',
  'b2',
  'framing',
  'FCE Reading Part 1 (B2) — framing',
  'Framing message shown to the student before the multiple-choice cloze exercise.',
  'You will read a short text with 8 missing words. For each gap, choose the best option from A, B, C, or D. Read the WHOLE sentence — sometimes the answer depends on the words around the gap.',
  'You will read a short text with 8 missing words. For each gap, choose the best option from A, B, C, or D. Read the WHOLE sentence — sometimes the answer depends on the words around the gap.',
  '[]',
  'enabled'
)
ON CONFLICT (prompt_key) DO NOTHING;
