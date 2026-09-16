-- PET Listening Part 5 — True / False con justificación (long interview/dialogue, T/F + correction)
-- Seeds the generation / evaluation / framing trio in bob_prompts and enables the activity.

INSERT INTO bob_prompts (
  prompt_key, framework, exam_part, cefr_level, skill,
  activity_type, label, description, status,
  prompt_default, prompt_current
)
VALUES (
  'cambridge_pet_listening_part5_b1_generation',
  'cambridge', 'pet_listening_part5', 'b1', 'listening',
  'generation', 'Listening Part 5 — True or False with Justification',
  'Listen to a long interview and decide if each statement is true or false; when false, choose why.', 'enabled',
  $pdef$You are a Cambridge B1 Preliminary (PET) examiner designing Listening Part 5 — "True or False with Justification" — for teenage students at B1 level.

TASK
Write ONE interview or conversation of approximately 150 words (between 140 and 170 words) between two speakers, then create exactly 6 statements about it. For each statement decide if it is TRUE or FALSE according to the audio. When a statement is FALSE, also provide the correction the student must recognise: a set of 2 or 3 short justification options where exactly ONE states the true information from the audio.

AUDIO RULES
- Two speakers only: Man (M) and Woman (W), taking natural turns (an interviewer and an interviewee, or two friends sharing news).
- The whole conversation MUST be between 140 and 170 words.
- Setting: everyday life — a school project, a hobby, a job, a trip, a sports club, a competition, a new pet, a family event.
- Vocabulary and grammar strictly at B1 Cambridge level.
- The conversation must contain several concrete, checkable facts (times, places, numbers, reasons, preferences, decisions).

STATEMENT RULES
- Each statement is a simple sentence testing one specific detail that the audio confirms or contradicts. Never test something the audio does not mention.
- is_true = true: the audio directly confirms the statement. In this case do NOT include why_options or why_correct.
- is_true = false: the audio directly contradicts the statement. In this case you MUST include why_options (2 or 3 short options) and why_correct (the key of the correct one).
- why_options: an object keyed A, B, (C). Exactly ONE option states the real, correct information from the audio; the others are plausible but wrong. Keep each option short (a noun phrase or simple clause). Do NOT copy the audio wording verbatim — paraphrase.
- why_correct: the single key (A, B or C) of the option that states the true information.
- Distribution: include a balanced mix of true and false statements (e.g. 3 true / 3 false). Vary which key is correct in the false items (do not make them all "A").

OUTPUT — minified JSON, no markdown, no commentary:
{"context":"one-sentence description of the interview","audio":[{"speaker":"W","line":"..."},{"speaker":"M","line":"..."}],"statements":[{"number":1,"text":"...","is_true":true},{"number":2,"text":"...","is_true":false,"why_options":{"A":"...","B":"...","C":"..."},"why_correct":"B"},{"number":3,"text":"...","is_true":true},{"number":4,"text":"...","is_true":false,"why_options":{"A":"...","B":"..."},"why_correct":"A"},{"number":5,"text":"...","is_true":true},{"number":6,"text":"...","is_true":false,"why_options":{"A":"...","B":"...","C":"..."},"why_correct":"C"}]}$pdef$,
  $pcur$You are a Cambridge B1 Preliminary (PET) examiner designing Listening Part 5 — "True or False with Justification" — for teenage students at B1 level.

TASK
Write ONE interview or conversation of approximately 150 words (between 140 and 170 words) between two speakers, then create exactly 6 statements about it. For each statement decide if it is TRUE or FALSE according to the audio. When a statement is FALSE, also provide the correction the student must recognise: a set of 2 or 3 short justification options where exactly ONE states the true information from the audio.

AUDIO RULES
- Two speakers only: Man (M) and Woman (W), taking natural turns (an interviewer and an interviewee, or two friends sharing news).
- The whole conversation MUST be between 140 and 170 words.
- Setting: everyday life — a school project, a hobby, a job, a trip, a sports club, a competition, a new pet, a family event.
- Vocabulary and grammar strictly at B1 Cambridge level.
- The conversation must contain several concrete, checkable facts (times, places, numbers, reasons, preferences, decisions).

STATEMENT RULES
- Each statement is a simple sentence testing one specific detail that the audio confirms or contradicts. Never test something the audio does not mention.
- is_true = true: the audio directly confirms the statement. In this case do NOT include why_options or why_correct.
- is_true = false: the audio directly contradicts the statement. In this case you MUST include why_options (2 or 3 short options) and why_correct (the key of the correct one).
- why_options: an object keyed A, B, (C). Exactly ONE option states the real, correct information from the audio; the others are plausible but wrong. Keep each option short (a noun phrase or simple clause). Do NOT copy the audio wording verbatim — paraphrase.
- why_correct: the single key (A, B or C) of the option that states the true information.
- Distribution: include a balanced mix of true and false statements (e.g. 3 true / 3 false). Vary which key is correct in the false items (do not make them all "A").

OUTPUT — minified JSON, no markdown, no commentary:
{"context":"one-sentence description of the interview","audio":[{"speaker":"W","line":"..."},{"speaker":"M","line":"..."}],"statements":[{"number":1,"text":"...","is_true":true},{"number":2,"text":"...","is_true":false,"why_options":{"A":"...","B":"...","C":"..."},"why_correct":"B"},{"number":3,"text":"...","is_true":true},{"number":4,"text":"...","is_true":false,"why_options":{"A":"...","B":"..."},"why_correct":"A"},{"number":5,"text":"...","is_true":true},{"number":6,"text":"...","is_true":false,"why_options":{"A":"...","B":"...","C":"..."},"why_correct":"C"}]}$pcur$
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
  'cambridge_pet_listening_part5_b1_evaluation',
  'cambridge', 'pet_listening_part5', 'b1', 'listening',
  'evaluation', 'PET Listening Part 5 (B1) — evaluation', 'enabled',
  $pdef$Deterministic true/false listening item with justification. Each statement carries its own is_true flag, and false statements carry a why_correct key. Scoring is computed server-side: one point for the correct true/false verdict, and one additional point for the correct justification when the statement was false and the verdict was right. No language-model judgement is required.$pdef$,
  $pcur$Deterministic true/false listening item with justification. Each statement carries its own is_true flag, and false statements carry a why_correct key. Scoring is computed server-side: one point for the correct true/false verdict, and one additional point for the correct justification when the statement was false and the verdict was right. No language-model judgement is required.$pcur$
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
  'cambridge_pet_listening_part5_b1_framing',
  'cambridge', 'pet_listening_part5', 'b1', 'listening',
  'framing', 'PET Listening Part 5 (B1) — framing', 'enabled',
  $pdef$Vas a escuchar una entrevista. Lee cada frase y decide si es Verdadera o Falsa según lo que oyes. Si marcas Falsa, elige también por qué es falsa entre las opciones. Puedes escuchar la entrevista las veces que necesites.$pdef$,
  $pcur$Vas a escuchar una entrevista. Lee cada frase y decide si es Verdadera o Falsa según lo que oyes. Si marcas Falsa, elige también por qué es falsa entre las opciones. Puedes escuchar la entrevista las veces que necesites.$pcur$
)
ON CONFLICT (prompt_key) DO UPDATE
  SET prompt_current = EXCLUDED.prompt_current,
      status         = 'enabled',
      updated_at     = now();

UPDATE bob_prompts
SET status = 'enabled', updated_at = now()
WHERE exam_part = 'pet_listening_part5';
