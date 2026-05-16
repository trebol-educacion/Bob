-- Card-facing label and description rewritten for kids (age 6-9). The official
-- Cambridge YL name and Pre-A1 level are still surfaced separately in the UI
-- (badge + small subtitle) for parents and teachers; the headline talks to
-- the child in the language they will actually use during the activity.

UPDATE public.bob_prompts
SET
  label = 'Listen and Point',
  description = 'Bob says a word. Tap the right picture!'
WHERE prompt_key = 'cambridge_starters_part1_a1_generation';
