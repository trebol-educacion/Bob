-- Starters Part 1 (Pointing): image_gen row + generation JSON for 4-option click activity.

INSERT INTO public.bob_prompts
  (prompt_key, label, description, prompt_default, prompt_current, variables, activity_type, cefr_level, framework, exam_part)
VALUES
  (
    'cambridge_starters_part1_a1_image_gen',
    'Cambridge Starters Part 1 (Pre-A1) — imagen opción pointing',
    'Prompt directo para Imagen: una ilustración por opción de vocabulario.',
    E'Flat children''s book illustration for a Cambridge Starters Part 1 pointing activity.\n\nScene to illustrate: {IMAGE_PROMPT}\n\nStyle: bright cheerful colors, simple composition, one main object or small group clearly visible, no text, ages 6-9, Pre-A1 vocabulary.',
    E'Flat children''s book illustration for a Cambridge Starters Part 1 pointing activity.\n\nScene to illustrate: {IMAGE_PROMPT}\n\nStyle: bright cheerful colors, simple composition, one main object or small group clearly visible, no text, ages 6-9, Pre-A1 vocabulary.',
    '["IMAGE_PROMPT"]'::jsonb,
    'image_gen',
    'a1',
    'cambridge',
    'starters_part1'
  )
ON CONFLICT (prompt_key) DO UPDATE SET
  prompt_default = EXCLUDED.prompt_default,
  prompt_current = EXCLUDED.prompt_current,
  variables = EXCLUDED.variables,
  label = EXCLUDED.label,
  description = EXCLUDED.description;

UPDATE public.bob_prompts
SET
  prompt_default = E'You are designing a Cambridge Starters Part 1 POINTING activity (Pre-A1). Children aged 6-9 hear "Point to the X" and click one of 4 pictures.\n\nGenerate exactly 4 vocabulary options (single nouns from the Starters word list: toys, animals, food, clothes, body, house).\nGenerate 4 matching image prompts (one isolated object or simple scene per option).\nGenerate 4 pointing cues: each cue names ONE option; target_index is 0-3.\n\nOUTPUT minified JSON only:\n{\n  "options": ["socks", "apple", "cat", "book"],\n  "option_image_prompts": ["a pair of red socks on white background", "a green apple", "a small orange cat", "an open story book"],\n  "cues": [\n    { "text": "Point to the socks.", "target_index": 0 },\n    { "text": "Point to the apple.", "target_index": 1 },\n    { "text": "Point to the cat.", "target_index": 2 },\n    { "text": "Point to the book.", "target_index": 3 }\n  ]\n}',
  prompt_current = E'You are designing a Cambridge Starters Part 1 POINTING activity (Pre-A1). Children aged 6-9 hear "Point to the X" and click one of 4 pictures.\n\nGenerate exactly 4 vocabulary options (single nouns from the Starters word list: toys, animals, food, clothes, body, house).\nGenerate 4 matching image prompts (one isolated object or simple scene per option).\nGenerate 4 pointing cues: each cue names ONE option; target_index is 0-3.\n\nOUTPUT minified JSON only:\n{\n  "options": ["socks", "apple", "cat", "book"],\n  "option_image_prompts": ["a pair of red socks on white background", "a green apple", "a small orange cat", "an open story book"],\n  "cues": [\n    { "text": "Point to the socks.", "target_index": 0 },\n    { "text": "Point to the apple.", "target_index": 1 },\n    { "text": "Point to the cat.", "target_index": 2 },\n    { "text": "Point to the book.", "target_index": 3 }\n  ]\n}'
WHERE prompt_key = 'cambridge_starters_part1_a1_generation';
