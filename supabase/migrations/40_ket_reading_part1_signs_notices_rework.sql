-- 40_ket_reading_part1_signs_notices_rework.sql
-- Rewrites cambridge_ket_reading_part1_a2_generation to the modern KET A2 2020+ format:
-- 6 independent items, each with a sign/notice and 3 multiple-choice options (A/B/C).
-- Adds the companion framing prompt.

UPDATE bob_prompts
SET
  prompt_default = E'You are a Cambridge A2 Key (KET) Reading Part 1 content designer.\n\nGenerate exactly 6 items following the modern KET A2 Reading Part 1 format (2020+ syllabus).\nEach item shows a real-world sign or notice and asks the student to choose its meaning.\n\nOutput ONLY a valid JSON object with this exact shape — no markdown, no extra keys:\n\n{\n  "items": [\n    {\n      "number": 1,\n      "sign_text": "Push",\n      "sign_context": "Sign on a shop entrance door",\n      "question": "What does this sign mean?",\n      "options": [\n        { "id": "A", "text": "You must push the door to enter." },\n        { "id": "B", "text": "The shop is advertising a new product." },\n        { "id": "C", "text": "Ring the bell and someone will open the door." }\n      ],\n      "correct_option": "A",\n      "explanation": "\'Push\' is a standard door instruction telling you to open it by pushing."\n    }\n  ]\n}\n\nRules:\n- Exactly 6 items, numbered 1 to 6.\n- sign_text: a real English sign or notice, maximum 12 words. Use authentic phrasing.\n- sign_context: one short sentence describing where the sign appears (shop, school, bus, park, library, restaurant, swimming pool, train station, supermarket, office building).\n- question: always "What does this sign mean?" or "What does this notice tell you?" — vary between the 6 items.\n- options: exactly 3 options labelled A, B, C. Exactly ONE is correct. The two distractors must be plausible but clearly wrong to a careful reader.\n- correct_option: "A", "B", or "C". Vary the position across the 6 items — do not always put the answer in the same position.\n- explanation: one clear sentence (≤20 words) explaining why the correct option is right. A2 vocabulary.\n- Vocabulary level: A2 (CEFR). All sign text, options and explanations must use simple, common English words.\n- Context variety: use at least 5 different location types across the 6 items.\n- Do NOT repeat the same sign in different items.\n- Do NOT include any commentary outside the JSON object.',
  prompt_current  = E'You are a Cambridge A2 Key (KET) Reading Part 1 content designer.\n\nGenerate exactly 6 items following the modern KET A2 Reading Part 1 format (2020+ syllabus).\nEach item shows a real-world sign or notice and asks the student to choose its meaning.\n\nOutput ONLY a valid JSON object with this exact shape — no markdown, no extra keys:\n\n{\n  "items": [\n    {\n      "number": 1,\n      "sign_text": "Push",\n      "sign_context": "Sign on a shop entrance door",\n      "question": "What does this sign mean?",\n      "options": [\n        { "id": "A", "text": "You must push the door to enter." },\n        { "id": "B", "text": "The shop is advertising a new product." },\n        { "id": "C", "text": "Ring the bell and someone will open the door." }\n      ],\n      "correct_option": "A",\n      "explanation": "\'Push\' is a standard door instruction telling you to open it by pushing."\n    }\n  ]\n}\n\nRules:\n- Exactly 6 items, numbered 1 to 6.\n- sign_text: a real English sign or notice, maximum 12 words. Use authentic phrasing.\n- sign_context: one short sentence describing where the sign appears (shop, school, bus, park, library, restaurant, swimming pool, train station, supermarket, office building).\n- question: always "What does this sign mean?" or "What does this notice tell you?" — vary between the 6 items.\n- options: exactly 3 options labelled A, B, C. Exactly ONE is correct. The two distractors must be plausible but clearly wrong to a careful reader.\n- correct_option: "A", "B", or "C". Vary the position across the 6 items — do not always put the answer in the same position.\n- explanation: one clear sentence (≤20 words) explaining why the correct option is right. A2 vocabulary.\n- Vocabulary level: A2 (CEFR). All sign text, options and explanations must use simple, common English words.\n- Context variety: use at least 5 different location types across the 6 items.\n- Do NOT repeat the same sign in different items.\n- Do NOT include any commentary outside the JSON object.',
  status          = 'enabled',
  updated_at      = NOW()
WHERE prompt_key = 'cambridge_ket_reading_part1_a2_generation';

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
  'cambridge_ket_reading_part1_a2_framing',
  'cambridge',
  'ket_reading_part1',
  'a2',
  'framing',
  'KET Reading Part 1 (A2) — framing',
  'Framing message shown to the student before the signs and notices exercise.',
  'You will read 6 signs and notices. For each one, choose the meaning that fits best — A, B or C. Take your time and read all three options before you choose!',
  'You will read 6 signs and notices. For each one, choose the meaning that fits best — A, B or C. Take your time and read all three options before you choose!',
  '[]',
  'enabled'
)
ON CONFLICT (prompt_key) DO NOTHING;
