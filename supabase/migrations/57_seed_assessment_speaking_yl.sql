-- Seeds real content for YL (Cambridge Young Learners) Assessment Speaking prompts.
-- Updates the two placeholder rows from migration 55 and adds A1-level variants.
-- Targets children 6–8 years old (Starters level Pre-A1 and A1).

UPDATE bob_prompts
SET
  label          = 'Assessment Speaking — YL Pre-A1 (Starters) question prompts',
  description    = 'Three ultra-simple questions for Cambridge YL Starters. 3 turns × 10s. Single-word answers accepted.',
  prompt_default = 'Return a JSON object with a "prompts" array of 3 objects. Each object has "turn_number" (integer) and "prompt_text" (string). Use exactly these texts:
1: "Hi! What is your name?"
2: "How old are you? And what is your favourite colour?"
3: "Tell me about your family. How many people are in your family?"
OUTPUT: {"prompts": [{"turn_number": 1, "prompt_text": "Hi! What is your name?"}, {"turn_number": 2, "prompt_text": "How old are you? And what is your favourite colour?"}, {"turn_number": 3, "prompt_text": "Tell me about your family. How many people are in your family?"}]}',
  prompt_current = 'Return a JSON object with a "prompts" array of 3 objects. Each object has "turn_number" (integer) and "prompt_text" (string). Use exactly these texts:
1: "Hi! What is your name?"
2: "How old are you? And what is your favourite colour?"
3: "Tell me about your family. How many people are in your family?"
OUTPUT: {"prompts": [{"turn_number": 1, "prompt_text": "Hi! What is your name?"}, {"turn_number": 2, "prompt_text": "How old are you? And what is your favourite colour?"}, {"turn_number": 3, "prompt_text": "Tell me about your family. How many people are in your family?"}]}',
  status         = 'enabled'
WHERE prompt_key = 'cefr_assessment_speaking_yl_pre_a1_generation';

UPDATE bob_prompts
SET
  label          = 'Assessment Speaking — YL Pre-A1 (Starters) evaluation prompt',
  description    = 'Strict Pre-A1 evaluator for Starters children. Single words and very short phrases are expected and valid.',
  prompt_default = 'ROLE: Calibrated CEFR evaluator for very young English learners (age 6–8, Cambridge YL Starters level).

STUDENT TRANSCRIPTS (from up to 3 short audio turns, 10 seconds each):
{TRANSCRIPTS}

TASK: Assign ONE CEFR band. The expected range for this population is pre_a1 or a1. A2 is only valid if the child produces clear simple sentences without prompting.

CEFR BAND ANCHORS for YL Starters:
- pre_a1: Silence, single isolated words, or unclear sounds only.
- a1: Single words or very short phrases (e.g. "My name is Ana", "I am eight", "red"); answers the question even minimally.
- a2: Simple sentences on familiar topics with minimal errors (unexpectedly advanced for this level — assign only if clearly demonstrated).

ANTI-INFLATION RULES (Prohibido inflar — band anchored to descriptors above):
- Single-word answers to the questions ARE VALID evidence for a1. Do NOT penalise brevity.
- If the child is silent or produces only non-English sounds → cefr_band=pre_a1.
- If the child answers in their native language only → cefr_band=pre_a1, confidence=high.
- Do NOT assign a1 solely because the child tried hard. Only linguistic evidence counts.
- Feedback text MUST be warm and child-appropriate. The BAND may NOT be inflated.

OUTPUT — respond with ONLY the JSON object below. No markdown fences, no preamble:
{"cefr_band":"pre_a1|a1|a2","confidence":"low|medium|high","feedback":{"kind":"assessment_speaking","highlights":["what the child did well, in simple terms"],"suggestions":["one gentle suggestion"],"overall_message":"1-2 warm child-friendly sentences"}}',
  prompt_current = 'ROLE: Calibrated CEFR evaluator for very young English learners (age 6–8, Cambridge YL Starters level).

STUDENT TRANSCRIPTS (from up to 3 short audio turns, 10 seconds each):
{TRANSCRIPTS}

TASK: Assign ONE CEFR band. The expected range for this population is pre_a1 or a1. A2 is only valid if the child produces clear simple sentences without prompting.

CEFR BAND ANCHORS for YL Starters:
- pre_a1: Silence, single isolated words, or unclear sounds only.
- a1: Single words or very short phrases (e.g. "My name is Ana", "I am eight", "red"); answers the question even minimally.
- a2: Simple sentences on familiar topics with minimal errors (unexpectedly advanced for this level — assign only if clearly demonstrated).

ANTI-INFLATION RULES (Prohibido inflar — band anchored to descriptors above):
- Single-word answers to the questions ARE VALID evidence for a1. Do NOT penalise brevity.
- If the child is silent or produces only non-English sounds → cefr_band=pre_a1.
- If the child answers in their native language only → cefr_band=pre_a1, confidence=high.
- Do NOT assign a1 solely because the child tried hard. Only linguistic evidence counts.
- Feedback text MUST be warm and child-appropriate. The BAND may NOT be inflated.

OUTPUT — respond with ONLY the JSON object below. No markdown fences, no preamble:
{"cefr_band":"pre_a1|a1|a2","confidence":"low|medium|high","feedback":{"kind":"assessment_speaking","highlights":["what the child did well, in simple terms"],"suggestions":["one gentle suggestion"],"overall_message":"1-2 warm child-friendly sentences"}}',
  variables      = '["TRANSCRIPTS"]'::jsonb,
  status         = 'enabled'
WHERE prompt_key = 'cefr_assessment_speaking_yl_pre_a1_evaluation';

INSERT INTO bob_prompts (
  prompt_key, activity_type, framework, exam_part, cefr_level,
  label, description, prompt_default, prompt_current, variables, status
) VALUES

(
  'cefr_assessment_speaking_yl_a1_generation',
  'assessment_speaking', 'cambridge_yl', 'assessment', 'a1',
  'Assessment Speaking — YL A1 (Movers entry) question prompts',
  'Three simple questions for Cambridge YL A1 learners (age 7–9). 3 turns × 10s. Short phrases accepted.',
  'Return a JSON object with a "prompts" array of 3 objects. Each object has "turn_number" (integer) and "prompt_text" (string). Use exactly these texts:
1: "What do you like to do after school?"
2: "Tell me about your favourite animal. What does it look like?"
3: "What is the weather like today? Do you like this kind of weather?"
OUTPUT: {"prompts": [{"turn_number": 1, "prompt_text": "What do you like to do after school?"}, {"turn_number": 2, "prompt_text": "Tell me about your favourite animal. What does it look like?"}, {"turn_number": 3, "prompt_text": "What is the weather like today? Do you like this kind of weather?"}]}',
  'Return a JSON object with a "prompts" array of 3 objects. Each object has "turn_number" (integer) and "prompt_text" (string). Use exactly these texts:
1: "What do you like to do after school?"
2: "Tell me about your favourite animal. What does it look like?"
3: "What is the weather like today? Do you like this kind of weather?"
OUTPUT: {"prompts": [{"turn_number": 1, "prompt_text": "What do you like to do after school?"}, {"turn_number": 2, "prompt_text": "Tell me about your favourite animal. What does it look like?"}, {"turn_number": 3, "prompt_text": "What is the weather like today? Do you like this kind of weather?"}]}',
  '[]'::jsonb, 'enabled'
),

(
  'cefr_assessment_speaking_yl_a1_evaluation',
  'assessment_speaking_eval', 'cambridge_yl', 'assessment', 'a1',
  'Assessment Speaking — YL A1 (Movers entry) evaluation prompt',
  'Strict A1 evaluator for YL children (age 7–9). Short phrases and simple sentences are expected.',
  'ROLE: Calibrated CEFR evaluator for young English learners (age 7–9, Cambridge YL A1 level).

STUDENT TRANSCRIPTS (from up to 3 short audio turns, 10 seconds each):
{TRANSCRIPTS}

TASK: Assign ONE CEFR band. The expected range for this population is a1 or a2. B1 is only valid for exceptionally advanced children.

CEFR BAND ANCHORS for YL A1:
- pre_a1: Only isolated words or silence with no recognisable phrases.
- a1: Short phrases and very simple sentences ("I like cats", "It is raining", "I play football"); may have errors.
- a2: Simple connected sentences on familiar topics, mostly clear ("I have a dog. It is big and black. I walk it every day.").
- b1: Clear multi-sentence responses with linking words — assign only if consistently demonstrated.

ANTI-INFLATION RULES (Prohibido inflar — band anchored to descriptors above):
- Short but correct phrases ARE valid a1 evidence. Brevity alone does not lower the band.
- If the child responds only in their native language → cefr_band=pre_a1, confidence=high.
- Do NOT assign a2 for one good sentence surrounded by silence. Consistency across turns matters.
- Do NOT reward effort or cuteness in the band. Only linguistic evidence counts.
- Feedback text MUST be warm and child-appropriate. The BAND may NOT be inflated.

OUTPUT — respond with ONLY the JSON object below. No markdown fences, no preamble:
{"cefr_band":"pre_a1|a1|a2|b1","confidence":"low|medium|high","feedback":{"kind":"assessment_speaking","highlights":["what the child did well, in simple terms"],"suggestions":["one gentle suggestion"],"overall_message":"1-2 warm child-friendly sentences"}}',
  'ROLE: Calibrated CEFR evaluator for young English learners (age 7–9, Cambridge YL A1 level).

STUDENT TRANSCRIPTS (from up to 3 short audio turns, 10 seconds each):
{TRANSCRIPTS}

TASK: Assign ONE CEFR band. The expected range for this population is a1 or a2. B1 is only valid for exceptionally advanced children.

CEFR BAND ANCHORS for YL A1:
- pre_a1: Only isolated words or silence with no recognisable phrases.
- a1: Short phrases and very simple sentences ("I like cats", "It is raining", "I play football"); may have errors.
- a2: Simple connected sentences on familiar topics, mostly clear ("I have a dog. It is big and black. I walk it every day.").
- b1: Clear multi-sentence responses with linking words — assign only if consistently demonstrated.

ANTI-INFLATION RULES (Prohibido inflar — band anchored to descriptors above):
- Short but correct phrases ARE valid a1 evidence. Brevity alone does not lower the band.
- If the child responds only in their native language → cefr_band=pre_a1, confidence=high.
- Do NOT assign a2 for one good sentence surrounded by silence. Consistency across turns matters.
- Do NOT reward effort or cuteness in the band. Only linguistic evidence counts.
- Feedback text MUST be warm and child-appropriate. The BAND may NOT be inflated.

OUTPUT — respond with ONLY the JSON object below. No markdown fences, no preamble:
{"cefr_band":"pre_a1|a1|a2|b1","confidence":"low|medium|high","feedback":{"kind":"assessment_speaking","highlights":["what the child did well, in simple terms"],"suggestions":["one gentle suggestion"],"overall_message":"1-2 warm child-friendly sentences"}}',
  '["TRANSCRIPTS"]'::jsonb, 'enabled'
),

(
  'cefr_assessment_speaking_yl_pre_a1_generation_v2',
  'assessment_speaking', 'cambridge_yl', 'assessment_alt', 'pre_a1',
  'Assessment Speaking — YL Pre-A1 alternate question set',
  'Alternate three ultra-simple questions for Cambridge YL Starters. Used for re-assessment variety.',
  'Return a JSON object with a "prompts" array of 3 objects. Each object has "turn_number" (integer) and "prompt_text" (string). Use exactly these texts:
1: "Hello! What is your favourite food?"
2: "What colour is your school bag?"
3: "Do you have any pets? What are they?"
OUTPUT: {"prompts": [{"turn_number": 1, "prompt_text": "Hello! What is your favourite food?"}, {"turn_number": 2, "prompt_text": "What colour is your school bag?"}, {"turn_number": 3, "prompt_text": "Do you have any pets? What are they?"}]}',
  'Return a JSON object with a "prompts" array of 3 objects. Each object has "turn_number" (integer) and "prompt_text" (string). Use exactly these texts:
1: "Hello! What is your favourite food?"
2: "What colour is your school bag?"
3: "Do you have any pets? What are they?"
OUTPUT: {"prompts": [{"turn_number": 1, "prompt_text": "Hello! What is your favourite food?"}, {"turn_number": 2, "prompt_text": "What colour is your school bag?"}, {"turn_number": 3, "prompt_text": "Do you have any pets? What are they?"}]}',
  '[]'::jsonb, 'enabled'
),

(
  'cefr_assessment_speaking_yl_a1_generation_v2',
  'assessment_speaking', 'cambridge_yl', 'assessment_alt', 'a1',
  'Assessment Speaking — YL A1 alternate question set',
  'Alternate three simple questions for Cambridge YL A1 learners. Used for re-assessment variety.',
  'Return a JSON object with a "prompts" array of 3 objects. Each object has "turn_number" (integer) and "prompt_text" (string). Use exactly these texts:
1: "What do you do at the weekend with your family?"
2: "Tell me about your classroom. What can you see?"
3: "What sport or game do you like? Tell me about it."
OUTPUT: {"prompts": [{"turn_number": 1, "prompt_text": "What do you do at the weekend with your family?"}, {"turn_number": 2, "prompt_text": "Tell me about your classroom. What can you see?"}, {"turn_number": 3, "prompt_text": "What sport or game do you like? Tell me about it."}]}',
  'Return a JSON object with a "prompts" array of 3 objects. Each object has "turn_number" (integer) and "prompt_text" (string). Use exactly these texts:
1: "What do you do at the weekend with your family?"
2: "Tell me about your classroom. What can you see?"
3: "What sport or game do you like? Tell me about it."
OUTPUT: {"prompts": [{"turn_number": 1, "prompt_text": "What do you do at the weekend with your family?"}, {"turn_number": 2, "prompt_text": "Tell me about your classroom. What can you see?"}, {"turn_number": 3, "prompt_text": "What sport or game do you like? Tell me about it."}]}',
  '[]'::jsonb, 'enabled'
)

ON CONFLICT (prompt_key) DO NOTHING;
