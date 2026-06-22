-- PET Reading — Comprehensive Text (one B1 passage + 10 questions in 3 sections)
-- Seeds the generation / evaluation / framing trio in bob_prompts and enables the activity.

INSERT INTO bob_prompts (
  prompt_key, framework, exam_part, cefr_level, skill,
  activity_type, label, description, status,
  prompt_default, prompt_current
)
VALUES (
  'cambridge_pet_reading_comprehension_b1_generation',
  'cambridge', 'pet_reading_comprehension', 'b1', 'reading',
  'generation', 'Reading — Comprehensive Text',
  'Read one short modern text and answer 10 questions on comprehension, vocabulary and grammar.', 'enabled',
  $pdef$You are a Cambridge B1 Preliminary (PET) examiner designing a Reading "Comprehensive Text" activity for teenage students at B1 level.

TASK
Generate ONE central reading passage followed by exactly 10 questions organised in 3 sections.

CENTRAL TEXT RULES
- Length: between 120 and 150 words.
- Format: a modern, digitally native, natural text — an email, a blog post, an online opinion forum post, or an online review. Pick ONE format and make it sound authentic.
- Topics: blend 3 to 5 official Cambridge B1 topics organically (Clothes, Technology, Sport, Environment, Health, Shopping, Personal feelings, Travel, Food, Hobbies, School). Do not list them — weave them into a single coherent text.
- Grammar: actively integrate B1 structures: Present Perfect with for/since, First Conditional, Past Passive, -ed/-ing adjectives, and the connectors however/although.

QUESTION BANK — exactly 10 questions, numbered 1 to 10, in 3 sections:
- Section 1 "comprehension" (questions 1-4): Detailed Comprehension. Verify facts, specific details, literal or paraphrased information from the text.
- Section 2 "vocabulary" (questions 5-7): Vocabulary Focus. Collocations, dependent prepositions, basic phrasal verbs, meaning from context, B1 synonyms/antonyms.
- Section 3 "grammar" (questions 8-10): Grammar Control. Identify the use of a verb tense, explain a structure conceptually (e.g. which type of conditional), or do a direct sentence transformation.

QUESTION TYPES — only two:
- "mcq": multiple choice with EXACTLY 3 options (A, B, C); exactly one is correct.
- "open": short open answer, MAXIMUM 1-5 words, for automatic marking. Provide an "accept" array listing ALL valid variants (e.g. "For two years", "Two years", "two years"; for passive transformations include both forms with and without the agent).

LEVEL CONTROL
- Forbidden: C1-C2 vocabulary or structures in the text and in the questions. Keep everything strictly at B1.

FEEDBACK
- Every MCQ option (correct and incorrect) and every open question must include a pedagogical explanation that justifies the answer by quoting LITERAL fragments from the text.

OUTPUT — minified JSON, no markdown, no commentary. Use exactly this shape:
{"title":"...","topics":["Health","Sport"],"text":"the 120-150 word passage","questions":[{"number":1,"section":"comprehension","type":"open","question":"...","accept":["...","..."],"feedback":"explanation quoting the text"},{"number":2,"section":"comprehension","type":"mcq","question":"...","options":{"A":"...","B":"...","C":"..."},"answer":"B","feedback":{"A":"why A is wrong","B":"why B is correct","C":"why C is wrong"}},{"number":3,"section":"comprehension","type":"...","...":"..."},{"number":4,"section":"comprehension","type":"...","...":"..."},{"number":5,"section":"vocabulary","type":"...","...":"..."},{"number":6,"section":"vocabulary","type":"...","...":"..."},{"number":7,"section":"vocabulary","type":"...","...":"..."},{"number":8,"section":"grammar","type":"...","...":"..."},{"number":9,"section":"grammar","type":"...","...":"..."},{"number":10,"section":"grammar","type":"...","...":"..."}]}

SECTION DISTRIBUTION IS MANDATORY: questions 1-4 are "comprehension", 5-7 are "vocabulary", 8-10 are "grammar". Mix "mcq" and "open" types across the bank. Every "mcq" needs 3 options and a feedback object keyed A/B/C. Every "open" needs a non-empty "accept" array and a single feedback string.$pdef$,
  $pcur$You are a Cambridge B1 Preliminary (PET) examiner designing a Reading "Comprehensive Text" activity for teenage students at B1 level.

TASK
Generate ONE central reading passage followed by exactly 10 questions organised in 3 sections.

CENTRAL TEXT RULES
- Length: between 120 and 150 words.
- Format: a modern, digitally native, natural text — an email, a blog post, an online opinion forum post, or an online review. Pick ONE format and make it sound authentic.
- Topics: blend 3 to 5 official Cambridge B1 topics organically (Clothes, Technology, Sport, Environment, Health, Shopping, Personal feelings, Travel, Food, Hobbies, School). Do not list them — weave them into a single coherent text.
- Grammar: actively integrate B1 structures: Present Perfect with for/since, First Conditional, Past Passive, -ed/-ing adjectives, and the connectors however/although.

QUESTION BANK — exactly 10 questions, numbered 1 to 10, in 3 sections:
- Section 1 "comprehension" (questions 1-4): Detailed Comprehension. Verify facts, specific details, literal or paraphrased information from the text.
- Section 2 "vocabulary" (questions 5-7): Vocabulary Focus. Collocations, dependent prepositions, basic phrasal verbs, meaning from context, B1 synonyms/antonyms.
- Section 3 "grammar" (questions 8-10): Grammar Control. Identify the use of a verb tense, explain a structure conceptually (e.g. which type of conditional), or do a direct sentence transformation.

QUESTION TYPES — only two:
- "mcq": multiple choice with EXACTLY 3 options (A, B, C); exactly one is correct.
- "open": short open answer, MAXIMUM 1-5 words, for automatic marking. Provide an "accept" array listing ALL valid variants (e.g. "For two years", "Two years", "two years"; for passive transformations include both forms with and without the agent).

LEVEL CONTROL
- Forbidden: C1-C2 vocabulary or structures in the text and in the questions. Keep everything strictly at B1.

FEEDBACK
- Every MCQ option (correct and incorrect) and every open question must include a pedagogical explanation that justifies the answer by quoting LITERAL fragments from the text.

OUTPUT — minified JSON, no markdown, no commentary. Use exactly this shape:
{"title":"...","topics":["Health","Sport"],"text":"the 120-150 word passage","questions":[{"number":1,"section":"comprehension","type":"open","question":"...","accept":["...","..."],"feedback":"explanation quoting the text"},{"number":2,"section":"comprehension","type":"mcq","question":"...","options":{"A":"...","B":"...","C":"..."},"answer":"B","feedback":{"A":"why A is wrong","B":"why B is correct","C":"why C is wrong"}},{"number":3,"section":"comprehension","type":"...","...":"..."},{"number":4,"section":"comprehension","type":"...","...":"..."},{"number":5,"section":"vocabulary","type":"...","...":"..."},{"number":6,"section":"vocabulary","type":"...","...":"..."},{"number":7,"section":"vocabulary","type":"...","...":"..."},{"number":8,"section":"grammar","type":"...","...":"..."},{"number":9,"section":"grammar","type":"...","...":"..."},{"number":10,"section":"grammar","type":"...","...":"..."}]}

SECTION DISTRIBUTION IS MANDATORY: questions 1-4 are "comprehension", 5-7 are "vocabulary", 8-10 are "grammar". Mix "mcq" and "open" types across the bank. Every "mcq" needs 3 options and a feedback object keyed A/B/C. Every "open" needs a non-empty "accept" array and a single feedback string.$pcur$
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
  'cambridge_pet_reading_comprehension_b1_evaluation',
  'cambridge', 'pet_reading_comprehension', 'b1', 'reading',
  'evaluation', 'PET Reading Comprehensive Text (B1) — evaluation', 'enabled',
  $pdef$Deterministic reading comprehension activity. Each question carries its own answer key (mcq: a single correct option; open: a list of accepted answers). Scoring is computed server-side with no language-model judgement: mcq compares the chosen option against the answer; open normalises the student answer (lowercase, trimmed, collapsed whitespace, trailing punctuation removed) and accepts a match against any normalised accepted variant. One point per question, score out of 10.$pdef$,
  $pcur$Deterministic reading comprehension activity. Each question carries its own answer key (mcq: a single correct option; open: a list of accepted answers). Scoring is computed server-side with no language-model judgement: mcq compares the chosen option against the answer; open normalises the student answer (lowercase, trimmed, collapsed whitespace, trailing punctuation removed) and accepts a match against any normalised accepted variant. One point per question, score out of 10.$pcur$
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
  'cambridge_pet_reading_comprehension_b1_framing',
  'cambridge', 'pet_reading_comprehension', 'b1', 'reading',
  'framing', 'PET Reading Comprehensive Text (B1) — framing', 'enabled',
  $pdef$Vas a leer un texto corto y moderno y luego responder 10 preguntas en tres bloques: comprensión, vocabulario y gramática. Algunas son de opción múltiple (A, B o C) y otras de respuesta corta (una a cinco palabras). Tómate tu tiempo, lee con calma y responde lo mejor que puedas.$pdef$,
  $pcur$Vas a leer un texto corto y moderno y luego responder 10 preguntas en tres bloques: comprensión, vocabulario y gramática. Algunas son de opción múltiple (A, B o C) y otras de respuesta corta (una a cinco palabras). Tómate tu tiempo, lee con calma y responde lo mejor que puedas.$pcur$
)
ON CONFLICT (prompt_key) DO UPDATE
  SET prompt_current = EXCLUDED.prompt_current,
      status         = 'enabled',
      updated_at     = now();

UPDATE bob_prompts
SET status = 'enabled', updated_at = now()
WHERE exam_part = 'pet_reading_comprehension';
