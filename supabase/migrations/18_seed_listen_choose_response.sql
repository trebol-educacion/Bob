INSERT INTO bob_prompts (
  prompt_key, activity_type, framework, exam_part, cefr_level,
  label, description, prompt_default, prompt_current, variables
) VALUES (
  'toefl_listen_choose_response_b1_generation',
  'generation',
  'toefl',
  'listen_choose_response',
  'b1',
  'TOEFL Listening — Choose a Response',
  'Listen to a short question and choose the best response. 8 items.',
  '(deterministic — uses bob_closed_items, no LLM generation needed)',
  '(deterministic — uses bob_closed_items, no LLM generation needed)',
  '[]'::jsonb
) ON CONFLICT (prompt_key) DO NOTHING;

INSERT INTO bob_closed_items (
  framework, exam_part, cefr_level, variant_id,
  stimulus_audio_url, question, options, correct_key, explanation, source
) VALUES (
  'toefl', 'listen_choose_response', 'b1', 'lcr-q1',
  '/listening/toefl/question-response/Listening1_Question Response_Question1.ogg',
  'Choose the best response.',
  '[
    {"key":"A","label":"As a matter of fact, I was returning a book."},
    {"key":"B","label":"Yes, you can find it in the reference section."},
    {"key":"C","label":"I don''t think I''ll have enough time to do that."},
    {"key":"D","label":"Actually, I think I can get there a little earlier."}
  ]'::jsonb,
  'A',
  NULL,
  'official'
) ON CONFLICT (framework, exam_part, cefr_level, variant_id) DO NOTHING;
