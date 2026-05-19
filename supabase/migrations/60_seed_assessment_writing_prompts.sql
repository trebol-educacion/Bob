ALTER TABLE bob_prompts
  DROP CONSTRAINT IF EXISTS bob_prompts_check_activity_type,
  ADD CONSTRAINT bob_prompts_check_activity_type CHECK (
    activity_type = ANY (ARRAY[
      'generation', 'evaluation', 'framing', 'partner_turn',
      'partner_turn_audio', 'model_answer', 'examiner_reaction',
      'image_gen', 'transcribe',
      'assessment_speaking', 'assessment_speaking_eval',
      'assessment_writing', 'assessment_writing_eval'
    ])
  );

INSERT INTO bob_prompts (
  prompt_key, activity_type, framework, exam_part, cefr_level, skill,
  label, description, prompt_default, prompt_current, variables, status
) VALUES

(
  'cefr_assessment_writing_a1_a2_generation',
  'assessment_writing', 'cefr', 'assessment', 'a1', 'writing',
  'Assessment Writing — A1/A2 task prompt',
  'Short guided writing task for A1–A2 learners. 3 bullet points. Target: 50–80 words.',
  'Write an email to a friend you have not seen in a while.

Include ALL of the following:
• where you live now
• one hobby you enjoy
• your favourite food
• a question to invite your friend to visit

Write about 50–80 words.',
  'Write an email to a friend you have not seen in a while.

Include ALL of the following:
• where you live now
• one hobby you enjoy
• your favourite food
• a question to invite your friend to visit

Write about 50–80 words.',
  '[]'::jsonb, 'enabled'
),

(
  'cefr_assessment_writing_b1_b2_generation',
  'assessment_writing', 'cefr', 'assessment', 'b1', 'writing',
  'Assessment Writing — B1/B2 task prompt',
  'Short guided writing task for B1–B2 learners. 4 bullet points. Target: 80–120 words.',
  'Write a short paragraph about an interesting trip you took.

Include ALL of the following:
• where you went and when
• what you did there
• who you went with
• how you felt about the experience

Write about 80–120 words.',
  'Write a short paragraph about an interesting trip you took.

Include ALL of the following:
• where you went and when
• what you did there
• who you went with
• how you felt about the experience

Write about 80–120 words.',
  '[]'::jsonb, 'enabled'
),

(
  'cefr_assessment_writing_a1_a2_evaluation',
  'assessment_writing_eval', 'cefr', 'assessment', 'a2', 'writing',
  'Assessment Writing — A1/A2 Gemini evaluation prompt',
  'Strict CEFR writing evaluator for A1–A2 range. Returns band, confidence, bullets_covered, formative feedback. Anti-inflation rules included.',
  'ROLE: Strict CEFR evaluator for written English. You are a calibrated assessor, NOT a teacher trying to encourage.

WRITING TASK GIVEN TO STUDENT:
Write an email to a friend. Include: where you live, one hobby, your favourite food, and a question to visit. About 50–80 words.
TOTAL BULLETS: 4

STUDENT RESPONSE:
{WRITTEN_TEXT}

TASK: Assign ONE CEFR band based on the written evidence.

CEFR BAND ANCHORS:
- pre_a1: Cannot produce recognisable English sentences; isolated words or random text.
- a1: Very basic phrases; frequent errors that impede understanding; limited vocabulary.
- a2: Simple sentences on familiar topics; some linking words; errors present but message mostly clear.
- b1: Clear communication; can link ideas; errors do not prevent understanding; adequate vocabulary range.
- b2: Extended writing; varied vocabulary; mostly accurate grammar; minor errors only.

ANTI-INFLATION RULES (these are absolute — do NOT override):
- If written_text is fewer than 20 words → cefr_band=pre_a1, confidence=high.
- If written_text is 20–34 words AND quality is below a2 → cefr_band=a1 at most.
- Count how many of the 4 bullet points are addressed (bullets_covered). If bullets_covered < 2 → confidence=low regardless of language quality.
- Do NOT assign a higher band to reward effort or creativity. Only linguistic evidence and task completion count.
- If the student wrote entirely in a language other than English → cefr_band=pre_a1, confidence=high.
- Feedback text MAY be warm and encouraging. The BAND may NOT be inflated.

OUTPUT — respond with ONLY valid JSON, no markdown fences, no preamble:
{"cefr_band":"pre_a1|a1|a2|b1|b2","confidence":"low|medium|high","bullets_covered":0,"feedback":{"strengths":["strength 1"],"improvements":["improvement 1"],"next_step":"one concrete thing to practise next"}}',
  'ROLE: Strict CEFR evaluator for written English. You are a calibrated assessor, NOT a teacher trying to encourage.

WRITING TASK GIVEN TO STUDENT:
Write an email to a friend. Include: where you live, one hobby, your favourite food, and a question to visit. About 50–80 words.
TOTAL BULLETS: 4

STUDENT RESPONSE:
{WRITTEN_TEXT}

TASK: Assign ONE CEFR band based on the written evidence.

CEFR BAND ANCHORS:
- pre_a1: Cannot produce recognisable English sentences; isolated words or random text.
- a1: Very basic phrases; frequent errors that impede understanding; limited vocabulary.
- a2: Simple sentences on familiar topics; some linking words; errors present but message mostly clear.
- b1: Clear communication; can link ideas; errors do not prevent understanding; adequate vocabulary range.
- b2: Extended writing; varied vocabulary; mostly accurate grammar; minor errors only.

ANTI-INFLATION RULES (these are absolute — do NOT override):
- If written_text is fewer than 20 words → cefr_band=pre_a1, confidence=high.
- If written_text is 20–34 words AND quality is below a2 → cefr_band=a1 at most.
- Count how many of the 4 bullet points are addressed (bullets_covered). If bullets_covered < 2 → confidence=low regardless of language quality.
- Do NOT assign a higher band to reward effort or creativity. Only linguistic evidence and task completion count.
- If the student wrote entirely in a language other than English → cefr_band=pre_a1, confidence=high.
- Feedback text MAY be warm and encouraging. The BAND may NOT be inflated.

OUTPUT — respond with ONLY valid JSON, no markdown fences, no preamble:
{"cefr_band":"pre_a1|a1|a2|b1|b2","confidence":"low|medium|high","bullets_covered":0,"feedback":{"strengths":["strength 1"],"improvements":["improvement 1"],"next_step":"one concrete thing to practise next"}}',
  '["WRITTEN_TEXT"]'::jsonb, 'enabled'
),

(
  'cefr_assessment_writing_b1_b2_evaluation',
  'assessment_writing_eval', 'cefr', 'assessment', 'b2', 'writing',
  'Assessment Writing — B1/B2 Gemini evaluation prompt',
  'Strict CEFR writing evaluator for B1–B2 range. Returns band, confidence, bullets_covered, formative feedback. Anti-inflation rules included.',
  'ROLE: Strict CEFR evaluator for written English. You are a calibrated assessor, NOT a teacher trying to encourage.

WRITING TASK GIVEN TO STUDENT:
Write a short paragraph about an interesting trip. Include: where you went and when, what you did, who you went with, how you felt. About 80–120 words.
TOTAL BULLETS: 4

STUDENT RESPONSE:
{WRITTEN_TEXT}

TASK: Assign ONE CEFR band based on the written evidence.

CEFR BAND ANCHORS:
- pre_a1: Cannot produce recognisable English sentences; isolated words or random text.
- a1: Very basic phrases; frequent errors that impede understanding; limited vocabulary.
- a2: Simple sentences on familiar topics; some linking words; errors present but message mostly clear.
- b1: Clear communication on familiar topics; can link ideas; errors do not prevent understanding.
- b2: Extended writing; varied vocabulary; mostly accurate grammar; complex structures attempted.

ANTI-INFLATION RULES (these are absolute — do NOT override):
- If written_text is fewer than 30 words → cefr_band=pre_a1, confidence=high.
- Do NOT assign b1 unless the student consistently links ideas and communicates clearly throughout.
- Do NOT assign b2 unless the student demonstrates varied vocabulary and largely accurate grammar.
- Count how many of the 4 bullet points are addressed (bullets_covered). If bullets_covered < 2 → confidence=low regardless of language quality.
- Do NOT reward enthusiasm or creativity in the band assignment. Only linguistic evidence and task completion count.
- If the student wrote entirely in a language other than English → cefr_band=pre_a1, confidence=high.
- Feedback text MAY be warm and encouraging. The BAND may NOT be inflated.

OUTPUT — respond with ONLY valid JSON, no markdown fences, no preamble:
{"cefr_band":"pre_a1|a1|a2|b1|b2","confidence":"low|medium|high","bullets_covered":0,"feedback":{"strengths":["strength 1"],"improvements":["improvement 1"],"next_step":"one concrete thing to practise next"}}',
  'ROLE: Strict CEFR evaluator for written English. You are a calibrated assessor, NOT a teacher trying to encourage.

WRITING TASK GIVEN TO STUDENT:
Write a short paragraph about an interesting trip. Include: where you went and when, what you did, who you went with, how you felt. About 80–120 words.
TOTAL BULLETS: 4

STUDENT RESPONSE:
{WRITTEN_TEXT}

TASK: Assign ONE CEFR band based on the written evidence.

CEFR BAND ANCHORS:
- pre_a1: Cannot produce recognisable English sentences; isolated words or random text.
- a1: Very basic phrases; frequent errors that impede understanding; limited vocabulary.
- a2: Simple sentences on familiar topics; some linking words; errors present but message mostly clear.
- b1: Clear communication on familiar topics; can link ideas; errors do not prevent understanding.
- b2: Extended writing; varied vocabulary; mostly accurate grammar; complex structures attempted.

ANTI-INFLATION RULES (these are absolute — do NOT override):
- If written_text is fewer than 30 words → cefr_band=pre_a1, confidence=high.
- Do NOT assign b1 unless the student consistently links ideas and communicates clearly throughout.
- Do NOT assign b2 unless the student demonstrates varied vocabulary and largely accurate grammar.
- Count how many of the 4 bullet points are addressed (bullets_covered). If bullets_covered < 2 → confidence=low regardless of language quality.
- Do NOT reward enthusiasm or creativity in the band assignment. Only linguistic evidence and task completion count.
- If the student wrote entirely in a language other than English → cefr_band=pre_a1, confidence=high.
- Feedback text MAY be warm and encouraging. The BAND may NOT be inflated.

OUTPUT — respond with ONLY valid JSON, no markdown fences, no preamble:
{"cefr_band":"pre_a1|a1|a2|b1|b2","confidence":"low|medium|high","bullets_covered":0,"feedback":{"strengths":["strength 1"],"improvements":["improvement 1"],"next_step":"one concrete thing to practise next"}}',
  '["WRITTEN_TEXT"]'::jsonb, 'enabled'
)

ON CONFLICT (prompt_key) DO NOTHING;
