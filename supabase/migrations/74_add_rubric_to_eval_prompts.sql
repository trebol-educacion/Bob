-- Migration 74: Add rubric output instruction to evaluation prompts for the 8 DB-prompt open modes.
-- The rubric section appended below instructs the LLM to emit four integer scores (0-4) inside a
-- "rubric" JSON key alongside the existing qualitative fields. The existing prompt body is preserved
-- intact; only the output-format contract is extended.
-- Affected prompt_keys (activity_type = 'evaluation'):
--   cambridge_ket_writing_part6_a2_evaluation
--   cambridge_ket_writing_part7_a2_evaluation
--   cambridge_ket_part2_a2_evaluation
--   cambridge_ket_part3_a2_evaluation
--   cambridge_pet_p2_b1_evaluation
--   cambridge_pet_writing_part1_b1_evaluation
--   cambridge_fce_p2_b2_evaluation
--   cambridge_fce_writing_part1_b2_evaluation

DO $$
DECLARE
  rubric_appendix TEXT :=
    E'\n\nAdditionally, include a "rubric" key in your JSON response with four integer scores (0–4 each):\n'
    '- "task_coverage": how fully the student addressed the task prompt (0 = not at all, 4 = fully covered)\n'
    '- "grammar": range and accuracy of grammatical structures (0 = many errors blocking understanding, 4 = accurate and varied)\n'
    '- "vocabulary": richness and appropriateness of vocabulary (0 = very limited, 4 = wide and precise)\n'
    '- "fluency": coherence, length, and use of connectors (0 = very fragmented, 4 = fluent and well-connected)\n'
    'Example: "rubric": { "task_coverage": 3, "grammar": 2, "vocabulary": 3, "fluency": 2 }\n'
    'If you cannot assess one criterion (e.g. no audio or empty text), set it to 0 and note it in suggestions.';

  prompt_keys TEXT[] := ARRAY[
    'cambridge_ket_writing_part6_a2_evaluation',
    'cambridge_ket_writing_part7_a2_evaluation',
    'cambridge_ket_part2_a2_evaluation',
    'cambridge_ket_part3_a2_evaluation',
    'cambridge_pet_p2_b1_evaluation',
    'cambridge_pet_writing_part1_b1_evaluation',
    'cambridge_fce_p2_b2_evaluation',
    'cambridge_fce_writing_part1_b2_evaluation'
  ];

  pk TEXT;
BEGIN
  FOREACH pk IN ARRAY prompt_keys LOOP
    UPDATE public.bob_prompts
    SET
      prompt_current = prompt_current || rubric_appendix,
      prompt_default = prompt_default || rubric_appendix,
      updated_at     = now()
    WHERE prompt_key = pk
      AND activity_type = 'evaluation'
      AND prompt_current NOT LIKE '%"rubric"%';
  END LOOP;
END $$;
