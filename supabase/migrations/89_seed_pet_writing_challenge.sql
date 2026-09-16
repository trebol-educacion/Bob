-- Migration 89: Cambridge B1 PET Writing — Writing Challenge.
-- Seeds the generation / evaluation / framing trio into bob_prompts for a rotating
-- short-writing generator (email reply, online review, or story continuation).
-- mode_key derived by the catalog = framework_exam_part = 'cambridge_pet_writing_challenge'.
-- skill='writing' so it surfaces under the Writing section and persists as a writing result.
-- Evaluation is FORMATIVE only (D-D2): no numeric score, band or exam criteria visible to the student.
-- Idempotent: re-running overwrites the same rows to the same target content.

DO $$
DECLARE
  generation_prompt TEXT :=
    E'You are a Cambridge B1 Preliminary writing coach designing a short "Writing Challenge" for a teenage learner (Spanish ESO, aged 12-17) at B1 level.\n\n'
    'Pick ONE of these three formats at random each time (vary it between runs):\n'
    '- "email": the student replies to a short, friendly email from a friend.\n'
    '- "review": the student writes a short online review of a product or a place.\n'
    '- "story": the student continues a short creative story from a given opening.\n\n'
    'THEME: choose a topic that motivates teenagers — video games, clothes and fashion, plans with friends, technology and gadgets, school/secondary-school life, or sports. Keep it culturally neutral and age-appropriate.\n\n'
    'You MUST produce:\n'
    '- A short stimulus depending on the format: for "email" a 30-50 word friendly email (with a sender name); for "review" the name of the product or place to review plus one line of context; for "story" the first 1-2 sentences that open the story.\n'
    '- A clear task telling the student exactly what to write.\n'
    '- SCAFFOLDING: between 3 and 4 short "guide_points" (content guides) telling the student what to include, so they never face a blank page. Each guide point is a short imperative phrase (e.g. "Say which game you prefer and why", "Describe what happens next", "Mention one good and one bad thing").\n'
    '- Required length: a short text of 60 to 100 words.\n\n'
    'STRICT RULES:\n'
    '- guide_points MUST contain 3 or 4 items, never fewer, never more.\n'
    '- All learner-facing text in English, B1 calibrated, friendly and encouraging.\n'
    '- Do NOT write the answer for the student; only give the stimulus, task and guide points.\n\n'
    'OUTPUT minified JSON with this exact shape:\n'
    '{"format":"email|review|story","title":"<short English title>","theme":"<one or two words>","stimulus":"<the email / the product or place + context / the story opening>","task":"<what the student must write>","guide_points":["<point 1>","<point 2>","<point 3>"],"min_words":60,"max_words":100}';

  evaluation_prompt TEXT :=
    E'You are a warm, supportive Cambridge B1 Preliminary writing coach giving FORMATIVE feedback to a teenager who has just finished a short Writing Challenge. Be positive and encouraging at all times.\n\n'
    'The task the student answered: "{TASK}"\n'
    'The student''s text: "{USER_TEXT}"\n\n'
    'Give feedback ALWAYS structured in exactly THREE steps, in this order:\n'
    '1. MOTIVATION ("motivation"): one or two sentences celebrating what the student did well (completing the task, attempting the format, a good word or idea they used). Always genuine and specific.\n'
    '2. VOCABULARY IMPROVEMENT ("vocabulary"): find words that are repetitive or very simple (A2 words like "good", "bad", "nice", "big", "happy") and suggest stronger B1 replacements (e.g. delicious, anxious, brilliant, miserable, enormous, thrilled). Each item references a word the student actually wrote and shows it used in a short example. If the text already has rich vocabulary, return an empty array.\n'
    '3. GRAMMAR CONTROL ("grammar"): gently review connectors (but, because, although, so) and verb tenses. If there is a mistake, show the corrected sentence kindly. If everything is correct, return an empty array.\n\n'
    'STRICT RULES:\n'
    '- This is formative practice. NEVER output a numeric score, mark, band, percentage, CEFR band or any exam-style grade. Do NOT include any "score", "score_max", "rubric", "band" or "cefr_band" field.\n'
    '- If the text is empty or unreadable, return: {"kind":"formative","motivation":"It looks like your text is empty. Write a few sentences and try again — you can do it!","vocabulary":[],"grammar":[]}\n'
    '- Keep every comment in English, kind, concrete and at B1 level.\n\n'
    'OUTPUT minified JSON with this exact shape:\n'
    '{"kind":"formative","motivation":"<encouraging sentence(s)>","vocabulary":[{"original":"good","suggestion":"brilliant","example":"The film was brilliant."}],"grammar":[{"note":"<short friendly tip>","corrected":"<corrected sentence>"}]}';

  framing_prompt TEXT :=
    'Te propongo un reto de escritura corto. Bob te dará un punto de partida (un email, algo para reseñar o el principio de una historia) y unos puntos para guiarte. Escribe entre 60 y 100 palabras en inglés. No te preocupes por equivocarte: anímate, escribe con tus propias palabras y luego te daré feedback para mejorar.';
BEGIN
  INSERT INTO public.bob_prompts (
    prompt_key, framework, exam_part, cefr_level, skill, activity_type,
    status, label, description, prompt_default, prompt_current, variables
  ) VALUES (
    'cambridge_pet_writing_challenge_b1_generation',
    'cambridge', 'pet_writing_challenge', 'b1', 'writing', 'generation',
    'enabled',
    'Writing Challenge',
    'Write a short text (60-100 words): reply to an email, review a product or place, or continue a story.',
    generation_prompt,
    generation_prompt,
    '[]'::jsonb
  )
  ON CONFLICT (prompt_key) DO UPDATE SET
    framework      = EXCLUDED.framework,
    exam_part      = EXCLUDED.exam_part,
    cefr_level     = EXCLUDED.cefr_level,
    skill          = EXCLUDED.skill,
    activity_type  = EXCLUDED.activity_type,
    status         = EXCLUDED.status,
    label          = EXCLUDED.label,
    description    = EXCLUDED.description,
    prompt_default = EXCLUDED.prompt_default,
    prompt_current = EXCLUDED.prompt_current,
    variables      = EXCLUDED.variables,
    updated_at     = now();

  INSERT INTO public.bob_prompts (
    prompt_key, framework, exam_part, cefr_level, skill, activity_type,
    status, label, description, prompt_default, prompt_current, variables
  ) VALUES (
    'cambridge_pet_writing_challenge_b1_evaluation',
    'cambridge', 'pet_writing_challenge', 'b1', 'writing', 'evaluation',
    'enabled',
    'Writing Challenge — evaluation',
    'Formative three-step feedback (motivation, vocabulary, grammar). No numeric score.',
    evaluation_prompt,
    evaluation_prompt,
    '[{"name":"TASK","description":"The challenge task the student answered"},{"name":"USER_TEXT","description":"The student''s written text"}]'::jsonb
  )
  ON CONFLICT (prompt_key) DO UPDATE SET
    framework      = EXCLUDED.framework,
    exam_part      = EXCLUDED.exam_part,
    cefr_level     = EXCLUDED.cefr_level,
    skill          = EXCLUDED.skill,
    activity_type  = EXCLUDED.activity_type,
    status         = EXCLUDED.status,
    label          = EXCLUDED.label,
    description    = EXCLUDED.description,
    prompt_default = EXCLUDED.prompt_default,
    prompt_current = EXCLUDED.prompt_current,
    variables      = EXCLUDED.variables,
    updated_at     = now();

  INSERT INTO public.bob_prompts (
    prompt_key, framework, exam_part, cefr_level, skill, activity_type,
    status, label, description, prompt_default, prompt_current, variables
  ) VALUES (
    'cambridge_pet_writing_challenge_b1_framing',
    'cambridge', 'pet_writing_challenge', 'b1', 'writing', 'framing',
    'enabled',
    'Writing Challenge — framing',
    'Spanish welcome shown before the writing challenge starts.',
    framing_prompt,
    framing_prompt,
    '[]'::jsonb
  )
  ON CONFLICT (prompt_key) DO UPDATE SET
    framework      = EXCLUDED.framework,
    exam_part      = EXCLUDED.exam_part,
    cefr_level     = EXCLUDED.cefr_level,
    skill          = EXCLUDED.skill,
    activity_type  = EXCLUDED.activity_type,
    status         = EXCLUDED.status,
    label          = EXCLUDED.label,
    description    = EXCLUDED.description,
    prompt_default = EXCLUDED.prompt_default,
    prompt_current = EXCLUDED.prompt_current,
    variables      = EXCLUDED.variables,
    updated_at     = now();
END $$;
