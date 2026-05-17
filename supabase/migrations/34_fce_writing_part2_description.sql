-- Migration 34: FCE Writing Part 2 description — add "review" to the option list.

UPDATE public.bob_prompts
SET description = 'Pick one task and write 140 to 190 words as an article, email or letter, report or review.'
WHERE prompt_key = 'cambridge_fce_writing_part2_b2_generation';
