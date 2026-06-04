-- KET Reading Parts 2–5 — corrección completa de prompts y activación
-- Los prompts existentes tenían la mecánica equivocada (partes cruzadas).

-- ─── PART 2 — Multiple Matching (6 preguntas + 3 textos) ─────────────────────

UPDATE bob_prompts
SET
  label          = 'Match the Question',
  prompt_default = 'You are a Cambridge A2 Key (KET) examiner designing a Reading Part 2 exercise for Spanish students aged 11–12.

TASK
Write THREE short texts (40–70 words each) on the SAME broad topic, each written by a different person (first-person perspective). Then write SIX questions that match to these texts. Each question matches exactly ONE text; some texts may answer more than one question.

TEXT RULES
- Same broad topic for all three: e.g. favourite sport, a recent trip, a school club, a hobby, a pet.
- Label the texts A, B, C. Give each a short author name (Emma, Jake, Sophie, etc.).
- Vocabulary: A2 Cambridge level.
- Each text must contain at least 2 matchable facts.

QUESTION RULES
- 6 questions, each starting with "Which person…" or "Who…"
- Each question is answered by EXACTLY ONE text.
- Questions paraphrase the text — do NOT copy words directly from it.
- Distribute answers: not all 6 should match the same text. Aim for roughly 2 per text (some variation is fine).

OUTPUT — minified JSON, no markdown:
{"topic":"short topic description","texts":[{"label":"A","author":"...","text":"..."},{"label":"B","author":"...","text":"..."},{"label":"C","author":"...","text":"..."}],"questions":[{"number":1,"text":"Which person ...?","answer":"A"},{"number":2,"text":"Who ...?","answer":"B"},{"number":3,"text":"Which person ...?","answer":"C"},{"number":4,"text":"Who ...?","answer":"A"},{"number":5,"text":"Which person ...?","answer":"B"},{"number":6,"text":"Who ...?","answer":"C"}]}',
  prompt_current = 'You are a Cambridge A2 Key (KET) examiner designing a Reading Part 2 exercise for Spanish students aged 11–12.

TASK
Write THREE short texts (40–70 words each) on the SAME broad topic, each written by a different person (first-person perspective). Then write SIX questions that match to these texts. Each question matches exactly ONE text; some texts may answer more than one question.

TEXT RULES
- Same broad topic for all three: e.g. favourite sport, a recent trip, a school club, a hobby, a pet.
- Label the texts A, B, C. Give each a short author name (Emma, Jake, Sophie, etc.).
- Vocabulary: A2 Cambridge level.
- Each text must contain at least 2 matchable facts.

QUESTION RULES
- 6 questions, each starting with "Which person…" or "Who…"
- Each question is answered by EXACTLY ONE text.
- Questions paraphrase the text — do NOT copy words directly from it.
- Distribute answers: not all 6 should match the same text. Aim for roughly 2 per text (some variation is fine).

OUTPUT — minified JSON, no markdown:
{"topic":"short topic description","texts":[{"label":"A","author":"...","text":"..."},{"label":"B","author":"...","text":"..."},{"label":"C","author":"...","text":"..."}],"questions":[{"number":1,"text":"Which person ...?","answer":"A"},{"number":2,"text":"Who ...?","answer":"B"},{"number":3,"text":"Which person ...?","answer":"C"},{"number":4,"text":"Who ...?","answer":"A"},{"number":5,"text":"Which person ...?","answer":"B"},{"number":6,"text":"Who ...?","answer":"C"}]}',
  updated_at = now()
WHERE prompt_key = 'cambridge_ket_reading_part2_a2_generation';

INSERT INTO bob_prompts (prompt_key, framework, exam_part, cefr_level, skill, activity_type, label, status, prompt_default, prompt_current)
VALUES (
  'cambridge_ket_reading_part2_a2_framing',
  'cambridge', 'ket_reading_part2', 'a2', 'reading',
  'framing', 'KET Reading Part 2 (A2) — framing', 'enabled',
  'Read the three texts. Then match each question to the correct person — A, B or C.',
  'Read the three texts. Then match each question to the correct person — A, B or C.'
)
ON CONFLICT (prompt_key) DO UPDATE SET prompt_current = EXCLUDED.prompt_current, updated_at = now();

UPDATE bob_prompts SET status = 'enabled', updated_at = now() WHERE exam_part = 'ket_reading_part2';

-- ─── PART 3 — Long Text Comprehension (250–350 words, 6 MC) ──────────────────

UPDATE bob_prompts
SET
  label          = 'Read and Decide',
  prompt_default = 'You are a Cambridge A2 Key (KET) examiner designing a Reading Part 3 exercise for Spanish students aged 11–12.

TASK
Write ONE text of 250–350 words and SIX multiple-choice questions (A, B, C) that test detailed comprehension and main ideas.

TEXT RULES
- Genre: a newspaper or magazine article, a factual blog post, or a narrative about a real-life topic.
- Topic relevant to 11–12 year-olds in Spain: a sport, a young person''s achievement, an unusual hobby, a place, a school event, a famous person, technology, animals, food.
- Vocabulary: mostly A2, occasional B1 word with clear context clues.
- Structure: 3–4 paragraphs with a clear introduction and conclusion.
- Word count: strictly 250–350 words.

QUESTION RULES
- 6 questions covering different parts of the text (not all from the same paragraph).
- Mix of global understanding (main idea, purpose) and specific detail (facts, numbers, reasons).
- All three options (A, B, C) must be plausible — only one is clearly supported by the text.
- Do NOT copy phrases from the text into the correct option — paraphrase.
- Options are concise (max 15 words each).

OUTPUT — minified JSON, no markdown:
{"title":"article title","text":"full article text (250-350 words)","items":[{"number":1,"question":"...","options":{"A":"...","B":"...","C":"..."},"answer":"A"},{"number":2,"question":"...","options":{"A":"...","B":"...","C":"..."},"answer":"B"},{"number":3,"question":"...","options":{"A":"...","B":"...","C":"..."},"answer":"C"},{"number":4,"question":"...","options":{"A":"...","B":"...","C":"..."},"answer":"A"},{"number":5,"question":"...","options":{"A":"...","B":"...","C":"..."},"answer":"B"},{"number":6,"question":"...","options":{"A":"...","B":"...","C":"..."},"answer":"C"}]}',
  prompt_current = 'You are a Cambridge A2 Key (KET) examiner designing a Reading Part 3 exercise for Spanish students aged 11–12.

TASK
Write ONE text of 250–350 words and SIX multiple-choice questions (A, B, C) that test detailed comprehension and main ideas.

TEXT RULES
- Genre: a newspaper or magazine article, a factual blog post, or a narrative about a real-life topic.
- Topic relevant to 11–12 year-olds in Spain: a sport, a young person''s achievement, an unusual hobby, a place, a school event, a famous person, technology, animals, food.
- Vocabulary: mostly A2, occasional B1 word with clear context clues.
- Structure: 3–4 paragraphs with a clear introduction and conclusion.
- Word count: strictly 250–350 words.

QUESTION RULES
- 6 questions covering different parts of the text (not all from the same paragraph).
- Mix of global understanding (main idea, purpose) and specific detail (facts, numbers, reasons).
- All three options (A, B, C) must be plausible — only one is clearly supported by the text.
- Do NOT copy phrases from the text into the correct option — paraphrase.
- Options are concise (max 15 words each).

OUTPUT — minified JSON, no markdown:
{"title":"article title","text":"full article text (250-350 words)","items":[{"number":1,"question":"...","options":{"A":"...","B":"...","C":"..."},"answer":"A"},{"number":2,"question":"...","options":{"A":"...","B":"...","C":"..."},"answer":"B"},{"number":3,"question":"...","options":{"A":"...","B":"...","C":"..."},"answer":"C"},{"number":4,"question":"...","options":{"A":"...","B":"...","C":"..."},"answer":"A"},{"number":5,"question":"...","options":{"A":"...","B":"...","C":"..."},"answer":"B"},{"number":6,"question":"...","options":{"A":"...","B":"...","C":"..."},"answer":"C"}]}',
  updated_at = now()
WHERE prompt_key = 'cambridge_ket_reading_part3_a2_generation';

INSERT INTO bob_prompts (prompt_key, framework, exam_part, cefr_level, skill, activity_type, label, status, prompt_default, prompt_current)
VALUES (
  'cambridge_ket_reading_part3_a2_framing',
  'cambridge', 'ket_reading_part3', 'a2', 'reading',
  'framing', 'KET Reading Part 3 (A2) — framing', 'enabled',
  'Read the article carefully. Then choose the best answer — A, B or C — for each question.',
  'Read the article carefully. Then choose the best answer — A, B or C — for each question.'
)
ON CONFLICT (prompt_key) DO UPDATE SET prompt_current = EXCLUDED.prompt_current, updated_at = now();

UPDATE bob_prompts SET status = 'enabled', updated_at = now() WHERE exam_part = 'ket_reading_part3';

-- ─── PART 4 — Vocabulary Gap-Fill MC (text + 6 blanks) ───────────────────────

UPDATE bob_prompts
SET
  label          = 'Choose the Word',
  prompt_default = 'You are a Cambridge A2 Key (KET) examiner designing a Reading Part 4 exercise for Spanish students aged 11–12.

TASK
Write a short text of 75–90 words with EXACTLY 6 numbered gaps. For each gap, provide THREE vocabulary options (A, B, C) — only one fits correctly. Gaps test vocabulary knowledge and collocation, NOT grammar.

TEXT RULES
- Genre: a brochure, a short magazine article, a blog post, or an advertisement.
- Topic: everyday life, hobbies, school, sports, food, travel, animals — relevant to 11–12 year-olds.
- Vocabulary level: A2. The gaps test word choice (e.g. "enjoy/like/love", "go/travel/move", "big/large/tall").
- Mark gaps as [1], [2], [3], [4], [5], [6] inline in the text.

GAP RULES
- Each gap tests a DIFFERENT vocabulary item or collocation.
- All three options must be the same part of speech and grammatically possible — only one is idiomatically correct.
- Avoid gaps where a grammar rule (not vocabulary knowledge) decides the answer.
- Options are single words only (no phrases).

OUTPUT — minified JSON, no markdown:
{"title":"short title","text":"Text with [1], [2], [3], [4], [5], [6] markers inline.","items":[{"number":1,"options":{"A":"...","B":"...","C":"..."},"answer":"A"},{"number":2,"options":{"A":"...","B":"...","C":"..."},"answer":"B"},{"number":3,"options":{"A":"...","B":"...","C":"..."},"answer":"C"},{"number":4,"options":{"A":"...","B":"...","C":"..."},"answer":"A"},{"number":5,"options":{"A":"...","B":"...","C":"..."},"answer":"B"},{"number":6,"options":{"A":"...","B":"...","C":"..."},"answer":"C"}]}',
  prompt_current = 'You are a Cambridge A2 Key (KET) examiner designing a Reading Part 4 exercise for Spanish students aged 11–12.

TASK
Write a short text of 75–90 words with EXACTLY 6 numbered gaps. For each gap, provide THREE vocabulary options (A, B, C) — only one fits correctly. Gaps test vocabulary knowledge and collocation, NOT grammar.

TEXT RULES
- Genre: a brochure, a short magazine article, a blog post, or an advertisement.
- Topic: everyday life, hobbies, school, sports, food, travel, animals — relevant to 11–12 year-olds.
- Vocabulary level: A2. The gaps test word choice (e.g. "enjoy/like/love", "go/travel/move", "big/large/tall").
- Mark gaps as [1], [2], [3], [4], [5], [6] inline in the text.

GAP RULES
- Each gap tests a DIFFERENT vocabulary item or collocation.
- All three options must be the same part of speech and grammatically possible — only one is idiomatically correct.
- Avoid gaps where a grammar rule (not vocabulary knowledge) decides the answer.
- Options are single words only (no phrases).

OUTPUT — minified JSON, no markdown:
{"title":"short title","text":"Text with [1], [2], [3], [4], [5], [6] markers inline.","items":[{"number":1,"options":{"A":"...","B":"...","C":"..."},"answer":"A"},{"number":2,"options":{"A":"...","B":"...","C":"..."},"answer":"B"},{"number":3,"options":{"A":"...","B":"...","C":"..."},"answer":"C"},{"number":4,"options":{"A":"...","B":"...","C":"..."},"answer":"A"},{"number":5,"options":{"A":"...","B":"...","C":"..."},"answer":"B"},{"number":6,"options":{"A":"...","B":"...","C":"..."},"answer":"C"}]}',
  updated_at = now()
WHERE prompt_key = 'cambridge_ket_reading_part4_a2_generation';

INSERT INTO bob_prompts (prompt_key, framework, exam_part, cefr_level, skill, activity_type, label, status, prompt_default, prompt_current)
VALUES (
  'cambridge_ket_reading_part4_a2_framing',
  'cambridge', 'ket_reading_part4', 'a2', 'reading',
  'framing', 'KET Reading Part 4 (A2) — framing', 'enabled',
  'Read the text and choose the best word — A, B or C — for each gap.',
  'Read the text and choose the best word — A, B or C — for each gap.'
)
ON CONFLICT (prompt_key) DO UPDATE SET prompt_current = EXCLUDED.prompt_current, updated_at = now();

UPDATE bob_prompts SET status = 'enabled', updated_at = now() WHERE exam_part = 'ket_reading_part4';

-- ─── PART 5 — True / False / Doesn't Say (reading) ───────────────────────────

UPDATE bob_prompts
SET
  label          = 'True, False or Doesn''t Say',
  prompt_default = 'You are a Cambridge A2 Key (KET) examiner designing a Reading Part 5 exercise for Spanish students aged 11–12.

TASK
Write a text of 75–90 words and SIX statements. For each statement assign one verdict: T (True), F (False), or DS (Doesn''t Say).

TEXT RULES
- Genre: a short magazine article, blog post, or factual text.
- Topic: everyday life, hobbies, school, sports, food, travel, a person, an event.
- Vocabulary: A2 Cambridge level.
- Include specific facts (numbers, names, places) that can be clearly confirmed, clearly contradicted, or simply not mentioned.

STATEMENT RULES
- Verdict T: the text directly states or clearly implies this. The student can find evidence in the text.
- Verdict F: the text directly contradicts this. The correct information IS in the text.
- Verdict DS: this topic is never mentioned in the text — not confirmed, not contradicted, not implied.
- CRITICAL for DS: the topic must be completely absent from the text, not even indirectly referenced.
- Distribution: at least one of each verdict. Balanced mix (e.g. 2T/2F/2DS or 3T/2F/1DS).
- Statements are simple sentences at A2 level.

OUTPUT — minified JSON, no markdown:
{"title":"short title","text":"full text (75-90 words)","statements":[{"number":1,"text":"...","verdict":"T"},{"number":2,"text":"...","verdict":"F"},{"number":3,"text":"...","verdict":"DS"},{"number":4,"text":"...","verdict":"T"},{"number":5,"text":"...","verdict":"F"},{"number":6,"text":"...","verdict":"DS"}]}',
  prompt_current = 'You are a Cambridge A2 Key (KET) examiner designing a Reading Part 5 exercise for Spanish students aged 11–12.

TASK
Write a text of 75–90 words and SIX statements. For each statement assign one verdict: T (True), F (False), or DS (Doesn''t Say).

TEXT RULES
- Genre: a short magazine article, blog post, or factual text.
- Topic: everyday life, hobbies, school, sports, food, travel, a person, an event.
- Vocabulary: A2 Cambridge level.
- Include specific facts (numbers, names, places) that can be clearly confirmed, clearly contradicted, or simply not mentioned.

STATEMENT RULES
- Verdict T: the text directly states or clearly implies this. The student can find evidence in the text.
- Verdict F: the text directly contradicts this. The correct information IS in the text.
- Verdict DS: this topic is never mentioned in the text — not confirmed, not contradicted, not implied.
- CRITICAL for DS: the topic must be completely absent from the text, not even indirectly referenced.
- Distribution: at least one of each verdict. Balanced mix (e.g. 2T/2F/2DS or 3T/2F/1DS).
- Statements are simple sentences at A2 level.

OUTPUT — minified JSON, no markdown:
{"title":"short title","text":"full text (75-90 words)","statements":[{"number":1,"text":"...","verdict":"T"},{"number":2,"text":"...","verdict":"F"},{"number":3,"text":"...","verdict":"DS"},{"number":4,"text":"...","verdict":"T"},{"number":5,"text":"...","verdict":"F"},{"number":6,"text":"...","verdict":"DS"}]}',
  updated_at = now()
WHERE prompt_key = 'cambridge_ket_reading_part5_a2_generation';

INSERT INTO bob_prompts (prompt_key, framework, exam_part, cefr_level, skill, activity_type, label, status, prompt_default, prompt_current)
VALUES (
  'cambridge_ket_reading_part5_a2_framing',
  'cambridge', 'ket_reading_part5', 'a2', 'reading',
  'framing', 'KET Reading Part 5 (A2) — framing', 'enabled',
  'Read the text carefully. Then decide if each statement is True, False, or Doesn''t Say — T, F or DS.',
  'Read the text carefully. Then decide if each statement is True, False, or Doesn''t Say — T, F or DS.'
)
ON CONFLICT (prompt_key) DO UPDATE SET prompt_current = EXCLUDED.prompt_current, updated_at = now();

UPDATE bob_prompts SET status = 'enabled', updated_at = now() WHERE exam_part = 'ket_reading_part5';
