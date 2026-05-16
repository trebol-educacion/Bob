-- Starters Part 1 (Pointing): image_gen row + generation JSON for 4-option click activity.
--
-- Keeps the people-in-image constraint introduced by migration 19. The previous
-- version of this migration accidentally dropped that clause via ON CONFLICT
-- DO UPDATE, producing object-only images that do not match the Cambridge
-- Starters reference style (always shows 1-3 humans interacting with the object).

INSERT INTO public.bob_prompts
  (prompt_key, label, description, prompt_default, prompt_current, variables, activity_type, cefr_level, framework, exam_part)
VALUES
  (
    'cambridge_starters_part1_a1_image_gen',
    'Cambridge Starters Part 1 (Pre-A1) — imagen opción pointing',
    'Prompt directo para Imagen: una ilustración por opción de vocabulario, siempre con gente.',
    E'Flat children''s book illustration for a Cambridge Starters Part 1 pointing activity.\n\nScene to illustrate: {IMAGE_PROMPT}\n\nStyle: bright cheerful colors, simple composition, the target object clearly visible and recognisable at first glance, no text, ages 6-9, Pre-A1 vocabulary.\n\nIMPORTANT: the image MUST include people (1-3 humans visible) interacting with or near the target object, matching the Cambridge Starters reference style. Do not generate object-only or landscape-only images.',
    E'Flat children''s book illustration for a Cambridge Starters Part 1 pointing activity.\n\nScene to illustrate: {IMAGE_PROMPT}\n\nStyle: bright cheerful colors, simple composition, the target object clearly visible and recognisable at first glance, no text, ages 6-9, Pre-A1 vocabulary.\n\nIMPORTANT: the image MUST include people (1-3 humans visible) interacting with or near the target object, matching the Cambridge Starters reference style. Do not generate object-only or landscape-only images.',
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
  prompt_default = E'You are designing a Cambridge Starters Part 1 POINTING activity (Pre-A1). Children aged 6-9 hear "Point to the X" and click one of 4 pictures.\n\nGenerate exactly 4 vocabulary options (single nouns from the Starters word list: toys, animals, food, clothes, body, house).\nGenerate 4 matching image prompts. Each image prompt MUST describe 1-3 people (children or a family) interacting with or near the target object, so the scene always shows humans — never an isolated object. Keep the target object visually dominant and easy to recognise.\nGenerate 4 pointing cues: each cue names ONE option; target_index is 0-3.\n\nOUTPUT minified JSON only:\n{\n  "options": ["socks", "apple", "cat", "book"],\n  "option_image_prompts": [\n    "a small child putting on a pair of red socks, sitting on a bedroom floor",\n    "a happy boy holding a big green apple in a kitchen",\n    "a girl gently petting a small orange cat on a sofa",\n    "two children reading an open story book together at a table"\n  ],\n  "cues": [\n    { "text": "Point to the socks.", "target_index": 0 },\n    { "text": "Point to the apple.", "target_index": 1 },\n    { "text": "Point to the cat.", "target_index": 2 },\n    { "text": "Point to the book.", "target_index": 3 }\n  ]\n}',
  prompt_current = E'You are designing a Cambridge Starters Part 1 POINTING activity (Pre-A1). Children aged 6-9 hear "Point to the X" and click one of 4 pictures.\n\nGenerate exactly 4 vocabulary options (single nouns from the Starters word list: toys, animals, food, clothes, body, house).\nGenerate 4 matching image prompts. Each image prompt MUST describe 1-3 people (children or a family) interacting with or near the target object, so the scene always shows humans — never an isolated object. Keep the target object visually dominant and easy to recognise.\nGenerate 4 pointing cues: each cue names ONE option; target_index is 0-3.\n\nOUTPUT minified JSON only:\n{\n  "options": ["socks", "apple", "cat", "book"],\n  "option_image_prompts": [\n    "a small child putting on a pair of red socks, sitting on a bedroom floor",\n    "a happy boy holding a big green apple in a kitchen",\n    "a girl gently petting a small orange cat on a sofa",\n    "two children reading an open story book together at a table"\n  ],\n  "cues": [\n    { "text": "Point to the socks.", "target_index": 0 },\n    { "text": "Point to the apple.", "target_index": 1 },\n    { "text": "Point to the cat.", "target_index": 2 },\n    { "text": "Point to the book.", "target_index": 3 }\n  ]\n}'
WHERE prompt_key = 'cambridge_starters_part1_a1_generation';
