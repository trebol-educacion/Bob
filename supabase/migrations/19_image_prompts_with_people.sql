-- Idempotent UPDATEs: append people constraint to Starters/Movers image_gen prompts.
-- The WHERE ... NOT LIKE guard ensures re-runs are safe.

UPDATE bob_prompts
SET prompt_default = prompt_default || E'\n\nIMPORTANT: the image MUST include people (1-3 humans visible) so the candidate can describe activities and emotions. Do not generate landscape-only images.',
    prompt_current = prompt_current || E'\n\nIMPORTANT: the image MUST include people (1-3 humans visible) so the candidate can describe activities and emotions. Do not generate landscape-only images.'
WHERE prompt_key = 'cambridge_starters_part1_a1_image_gen'
  AND prompt_default NOT LIKE '%IMPORTANT: the image MUST include people%';

UPDATE bob_prompts
SET prompt_default = prompt_default || E'\n\nIMPORTANT: the image MUST include people (1-3 humans visible) so the candidate can describe activities and emotions. Do not generate landscape-only images.',
    prompt_current = prompt_current || E'\n\nIMPORTANT: the image MUST include people (1-3 humans visible) so the candidate can describe activities and emotions. Do not generate landscape-only images.'
WHERE prompt_key = 'cambridge_starters_part2_a1_image_gen'
  AND prompt_default NOT LIKE '%IMPORTANT: the image MUST include people%';

UPDATE bob_prompts
SET prompt_default = prompt_default || E'\n\nIMPORTANT: the image MUST include people (1-3 humans visible) so the candidate can describe activities and emotions. Do not generate landscape-only images.',
    prompt_current = prompt_current || E'\n\nIMPORTANT: the image MUST include people (1-3 humans visible) so the candidate can describe activities and emotions. Do not generate landscape-only images.'
WHERE prompt_key = 'cambridge_starters_part3_a1_image_gen'
  AND prompt_default NOT LIKE '%IMPORTANT: the image MUST include people%';

UPDATE bob_prompts
SET prompt_default = prompt_default || E'\n\nIMPORTANT: the image MUST include people (1-3 humans visible) so the candidate can describe activities and emotions. Do not generate landscape-only images.',
    prompt_current = prompt_current || E'\n\nIMPORTANT: the image MUST include people (1-3 humans visible) so the candidate can describe activities and emotions. Do not generate landscape-only images.'
WHERE prompt_key = 'cambridge_movers_part1_a1_image_gen'
  AND prompt_default NOT LIKE '%IMPORTANT: the image MUST include people%';

UPDATE bob_prompts
SET prompt_default = prompt_default || E'\n\nIMPORTANT: the image MUST include people (1-3 humans visible) so the candidate can describe activities and emotions. Do not generate landscape-only images.',
    prompt_current = prompt_current || E'\n\nIMPORTANT: the image MUST include people (1-3 humans visible) so the candidate can describe activities and emotions. Do not generate landscape-only images.'
WHERE prompt_key = 'cambridge_movers_part2_a1_image_gen'
  AND prompt_default NOT LIKE '%IMPORTANT: the image MUST include people%';

UPDATE bob_prompts
SET prompt_default = prompt_default || E'\n\nIMPORTANT: the image MUST include people (1-3 humans visible) so the candidate can describe activities and emotions. Do not generate landscape-only images.',
    prompt_current = prompt_current || E'\n\nIMPORTANT: the image MUST include people (1-3 humans visible) so the candidate can describe activities and emotions. Do not generate landscape-only images.'
WHERE prompt_key = 'cambridge_movers_part3_a1_image_gen'
  AND prompt_default NOT LIKE '%IMPORTANT: the image MUST include people%';

UPDATE bob_prompts
SET prompt_default = prompt_default || E'\n\nIMPORTANT: the image MUST include people (1-3 humans visible) so the candidate can describe activities and emotions. Do not generate landscape-only images.',
    prompt_current = prompt_current || E'\n\nIMPORTANT: the image MUST include people (1-3 humans visible) so the candidate can describe activities and emotions. Do not generate landscape-only images.'
WHERE prompt_key = 'cambridge_movers_part4_a1_image_gen'
  AND prompt_default NOT LIKE '%IMPORTANT: the image MUST include people%';

UPDATE bob_prompts
SET prompt_default = prompt_default || E'\n\nIMPORTANT: the image MUST include people (1-3 humans visible) so the candidate can describe activities and emotions. Do not generate landscape-only images.',
    prompt_current = prompt_current || E'\n\nIMPORTANT: the image MUST include people (1-3 humans visible) so the candidate can describe activities and emotions. Do not generate landscape-only images.'
WHERE prompt_key = 'cambridge_movers_part5_a1_image_gen'
  AND prompt_default NOT LIKE '%IMPORTANT: the image MUST include people%';
