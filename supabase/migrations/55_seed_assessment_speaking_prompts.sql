-- Extends bob_prompts with assessment_speaking activity types and new frameworks.
-- Adds question prompts and Gemini evaluation prompts for Assessment Speaking (A1–A2 and B1–B2 ranges).
-- YL (Pre-A1/A1) rows are placeholder stubs; content seeded in B11 (56_seed_assessment_speaking_yl.sql).

ALTER TABLE bob_prompts
  DROP CONSTRAINT IF EXISTS bob_prompts_check_activity_type,
  ADD CONSTRAINT bob_prompts_check_activity_type CHECK (
    activity_type = ANY (ARRAY[
      'generation', 'evaluation', 'framing', 'partner_turn',
      'partner_turn_audio', 'model_answer', 'examiner_reaction',
      'image_gen', 'transcribe',
      'assessment_speaking', 'assessment_speaking_eval'
    ])
  );

ALTER TABLE bob_prompts
  DROP CONSTRAINT IF EXISTS bob_prompts_check_framework,
  ADD CONSTRAINT bob_prompts_check_framework CHECK (
    framework = ANY (ARRAY[
      'cambridge', 'toefl', 'generic', 'cefr', 'cambridge_yl'
    ])
  );

INSERT INTO bob_prompts (
  prompt_key, activity_type, framework, exam_part, cefr_level,
  label, description, prompt_default, prompt_current, variables, status
) VALUES

(
  'cefr_assessment_speaking_a1_a2_generation',
  'assessment_speaking', 'cefr', 'assessment', 'a1',
  'Assessment Speaking — A1/A2 question prompts',
  'Three semi-guided speaking prompts for CEFR A1–A2 learners. 3 turns x 20s.',
  'Return a JSON object with a "prompts" array of 3 objects. Each object has "turn_number" (integer) and "prompt_text" (string). Use exactly these texts:
1: "Tell me about your school — what do you study and which subject do you like best?"
2: "Describe what you usually do on weekends."
3: "Imagine you are in a park with friends. Tell me what is happening."
OUTPUT: {"prompts": [{"turn_number": 1, "prompt_text": "Tell me about your school — what do you study and which subject do you like best?"}, {"turn_number": 2, "prompt_text": "Describe what you usually do on weekends."}, {"turn_number": 3, "prompt_text": "Imagine you are in a park with friends. Tell me what is happening."}]}',
  'Return a JSON object with a "prompts" array of 3 objects. Each object has "turn_number" (integer) and "prompt_text" (string). Use exactly these texts:
1: "Tell me about your school — what do you study and which subject do you like best?"
2: "Describe what you usually do on weekends."
3: "Imagine you are in a park with friends. Tell me what is happening."
OUTPUT: {"prompts": [{"turn_number": 1, "prompt_text": "Tell me about your school — what do you study and which subject do you like best?"}, {"turn_number": 2, "prompt_text": "Describe what you usually do on weekends."}, {"turn_number": 3, "prompt_text": "Imagine you are in a park with friends. Tell me what is happening."}]}',
  '[]'::jsonb, 'enabled'
),

(
  'cefr_assessment_speaking_b1_b2_generation',
  'assessment_speaking', 'cefr', 'assessment', 'b1',
  'Assessment Speaking — B1/B2 question prompts',
  'Three semi-guided speaking prompts for CEFR B1–B2 learners. 3 turns x 20s.',
  'Return a JSON object with a "prompts" array of 3 objects. Each object has "turn_number" (integer) and "prompt_text" (string). Use exactly these texts:
1: "Tell me about a memorable trip or outing you have taken. Where did you go and what made it special?"
2: "Describe how technology has changed the way young people study or communicate."
3: "A friend is nervous about an important exam and asks for your advice. What would you say to them and why?"
OUTPUT: {"prompts": [{"turn_number": 1, "prompt_text": "Tell me about a memorable trip or outing you have taken. Where did you go and what made it special?"}, {"turn_number": 2, "prompt_text": "Describe how technology has changed the way young people study or communicate."}, {"turn_number": 3, "prompt_text": "A friend is nervous about an important exam and asks for your advice. What would you say to them and why?"}]}',
  'Return a JSON object with a "prompts" array of 3 objects. Each object has "turn_number" (integer) and "prompt_text" (string). Use exactly these texts:
1: "Tell me about a memorable trip or outing you have taken. Where did you go and what made it special?"
2: "Describe how technology has changed the way young people study or communicate."
3: "A friend is nervous about an important exam and asks for your advice. What would you say to them and why?"
OUTPUT: {"prompts": [{"turn_number": 1, "prompt_text": "Tell me about a memorable trip or outing you have taken. Where did you go and what made it special?"}, {"turn_number": 2, "prompt_text": "Describe how technology has changed the way young people study or communicate."}, {"turn_number": 3, "prompt_text": "A friend is nervous about an important exam and asks for your advice. What would you say to them and why?"}]}',
  '[]'::jsonb, 'enabled'
),

(
  'cefr_assessment_speaking_a1_a2_evaluation',
  'assessment_speaking_eval', 'cefr', 'assessment', 'a2',
  'Assessment Speaking — A1/A2 Gemini evaluation prompt',
  'Strict CEFR evaluator prompt for A1–A2 range. Includes anti-inflation rules (Prohibido inflar).',
  'ROLE: Strict CEFR evaluator for spoken English. You are NOT a teacher trying to encourage; you are a calibrated assessor.

STUDENT TRANSCRIPTS (from up to 3 audio turns):
{TRANSCRIPTS}

TASK: Assign ONE overall CEFR band based on the spoken evidence across all turns.

CEFR BAND ANCHORS (these are the only valid values — do NOT invent intermediate bands):
- pre_a1: Cannot produce recognisable English sentences; mostly isolated words or silence.
- a1: Very basic phrases; limited vocabulary; frequent errors that impede understanding.
- a2: Simple sentences on familiar topics; some linking words; errors present but message usually clear.
- b1: Clear communication on familiar topics; can link ideas; errors do not prevent understanding.
- b2: Extended speech; varied vocabulary; mostly accurate; minor errors only.

ANTI-INFLATION RULES (Prohibido inflar — band anchored to descriptors above):
- If total spoken audio is under 15 seconds OR student clearly did not understand the questions → confidence=low AND cefr_band=pre_a1 unless there is clear positive linguistic evidence.
- If student produced only isolated words or silence → cefr_band=pre_a1, NOT a1.
- If sentences are mostly broken or incomprehensible → cefr_band=a1, NOT a2.
- Do NOT assign a higher band to reward effort or willingness. Only linguistic evidence counts.
- If the student responded entirely in a language other than English → cefr_band=pre_a1, confidence=high, explain in feedback.
- Feedback text MAY be warm and encouraging. The BAND may NOT be inflated to be encouraging.

OUTPUT — respond with ONLY the JSON object below. No markdown fences, no preamble:
{"cefr_band":"pre_a1|a1|a2|b1|b2","confidence":"low|medium|high","feedback":{"kind":"assessment_speaking","highlights":["strength 1","strength 2"],"suggestions":["improvement 1","improvement 2"],"overall_message":"1-2 warm sentences summarising the student spoken English"}}',
  'ROLE: Strict CEFR evaluator for spoken English. You are NOT a teacher trying to encourage; you are a calibrated assessor.

STUDENT TRANSCRIPTS (from up to 3 audio turns):
{TRANSCRIPTS}

TASK: Assign ONE overall CEFR band based on the spoken evidence across all turns.

CEFR BAND ANCHORS (these are the only valid values — do NOT invent intermediate bands):
- pre_a1: Cannot produce recognisable English sentences; mostly isolated words or silence.
- a1: Very basic phrases; limited vocabulary; frequent errors that impede understanding.
- a2: Simple sentences on familiar topics; some linking words; errors present but message usually clear.
- b1: Clear communication on familiar topics; can link ideas; errors do not prevent understanding.
- b2: Extended speech; varied vocabulary; mostly accurate; minor errors only.

ANTI-INFLATION RULES (Prohibido inflar — band anchored to descriptors above):
- If total spoken audio is under 15 seconds OR student clearly did not understand the questions → confidence=low AND cefr_band=pre_a1 unless there is clear positive linguistic evidence.
- If student produced only isolated words or silence → cefr_band=pre_a1, NOT a1.
- If sentences are mostly broken or incomprehensible → cefr_band=a1, NOT a2.
- Do NOT assign a higher band to reward effort or willingness. Only linguistic evidence counts.
- If the student responded entirely in a language other than English → cefr_band=pre_a1, confidence=high, explain in feedback.
- Feedback text MAY be warm and encouraging. The BAND may NOT be inflated to be encouraging.

OUTPUT — respond with ONLY the JSON object below. No markdown fences, no preamble:
{"cefr_band":"pre_a1|a1|a2|b1|b2","confidence":"low|medium|high","feedback":{"kind":"assessment_speaking","highlights":["strength 1","strength 2"],"suggestions":["improvement 1","improvement 2"],"overall_message":"1-2 warm sentences summarising the student spoken English"}}',
  '["TRANSCRIPTS"]'::jsonb, 'enabled'
),

(
  'cefr_assessment_speaking_b1_b2_evaluation',
  'assessment_speaking_eval', 'cefr', 'assessment', 'b2',
  'Assessment Speaking — B1/B2 Gemini evaluation prompt',
  'Strict CEFR evaluator prompt for B1–B2 range. Includes anti-inflation rules (Prohibido inflar).',
  'ROLE: Strict CEFR evaluator for spoken English. You are NOT a teacher trying to encourage; you are a calibrated assessor.

STUDENT TRANSCRIPTS (from up to 3 audio turns):
{TRANSCRIPTS}

TASK: Assign ONE overall CEFR band based on the spoken evidence across all turns.

CEFR BAND ANCHORS (these are the only valid values — do NOT invent intermediate bands):
- pre_a1: Cannot produce recognisable English sentences; mostly isolated words or silence.
- a1: Very basic phrases; limited vocabulary; frequent errors that impede understanding.
- a2: Simple sentences on familiar topics; some linking words; errors present but message usually clear.
- b1: Clear communication on familiar topics; can link ideas; errors do not prevent understanding.
- b2: Extended speech; varied vocabulary; mostly accurate; minor errors only.

ANTI-INFLATION RULES (Prohibido inflar — band anchored to descriptors above):
- Do NOT assign b1 unless the student consistently links ideas and communicates clearly across turns.
- Do NOT assign b2 unless the student demonstrates varied vocabulary and largely accurate grammar across turns.
- If total spoken audio is under 20 seconds → confidence=low.
- If the band evidence is contradictory across turns → confidence=low.
- Do NOT reward enthusiasm or effort in the band assignment. Only linguistic evidence counts.
- If the student responded entirely in a language other than English → cefr_band=pre_a1, confidence=high, explain in feedback.
- Feedback text MAY be warm and encouraging. The BAND may NOT be inflated to be encouraging.

OUTPUT — respond with ONLY the JSON object below. No markdown fences, no preamble:
{"cefr_band":"pre_a1|a1|a2|b1|b2","confidence":"low|medium|high","feedback":{"kind":"assessment_speaking","highlights":["strength 1","strength 2"],"suggestions":["improvement 1","improvement 2"],"overall_message":"1-2 warm sentences summarising the student spoken English"}}',
  'ROLE: Strict CEFR evaluator for spoken English. You are NOT a teacher trying to encourage; you are a calibrated assessor.

STUDENT TRANSCRIPTS (from up to 3 audio turns):
{TRANSCRIPTS}

TASK: Assign ONE overall CEFR band based on the spoken evidence across all turns.

CEFR BAND ANCHORS (these are the only valid values — do NOT invent intermediate bands):
- pre_a1: Cannot produce recognisable English sentences; mostly isolated words or silence.
- a1: Very basic phrases; limited vocabulary; frequent errors that impede understanding.
- a2: Simple sentences on familiar topics; some linking words; errors present but message usually clear.
- b1: Clear communication on familiar topics; can link ideas; errors do not prevent understanding.
- b2: Extended speech; varied vocabulary; mostly accurate; minor errors only.

ANTI-INFLATION RULES (Prohibido inflar — band anchored to descriptors above):
- Do NOT assign b1 unless the student consistently links ideas and communicates clearly across turns.
- Do NOT assign b2 unless the student demonstrates varied vocabulary and largely accurate grammar across turns.
- If total spoken audio is under 20 seconds → confidence=low.
- If the band evidence is contradictory across turns → confidence=low.
- Do NOT reward enthusiasm or effort in the band assignment. Only linguistic evidence counts.
- If the student responded entirely in a language other than English → cefr_band=pre_a1, confidence=high, explain in feedback.
- Feedback text MAY be warm and encouraging. The BAND may NOT be inflated to be encouraging.

OUTPUT — respond with ONLY the JSON object below. No markdown fences, no preamble:
{"cefr_band":"pre_a1|a1|a2|b1|b2","confidence":"low|medium|high","feedback":{"kind":"assessment_speaking","highlights":["strength 1","strength 2"],"suggestions":["improvement 1","improvement 2"],"overall_message":"1-2 warm sentences summarising the student spoken English"}}',
  '["TRANSCRIPTS"]'::jsonb, 'enabled'
),

(
  'cefr_assessment_speaking_yl_pre_a1_generation',
  'assessment_speaking', 'cambridge_yl', 'assessment', 'pre_a1',
  'Assessment Speaking — YL Pre-A1 question prompts (placeholder)',
  'Placeholder for Starters-level assessment question prompts. Content seeded in B11.',
  'PLACEHOLDER — will be seeded in 56_seed_assessment_speaking_yl.sql',
  'PLACEHOLDER — will be seeded in 56_seed_assessment_speaking_yl.sql',
  '[]'::jsonb, 'hidden'
),

(
  'cefr_assessment_speaking_yl_pre_a1_evaluation',
  'assessment_speaking_eval', 'cambridge_yl', 'assessment', 'pre_a1',
  'Assessment Speaking — YL Pre-A1 evaluation prompt (placeholder)',
  'Placeholder for Starters-level Gemini evaluation prompt. Content seeded in B11.',
  'PLACEHOLDER — will be seeded in 56_seed_assessment_speaking_yl.sql',
  'PLACEHOLDER — will be seeded in 56_seed_assessment_speaking_yl.sql',
  '["TRANSCRIPTS"]'::jsonb, 'hidden'
)
ON CONFLICT (prompt_key) DO NOTHING;
