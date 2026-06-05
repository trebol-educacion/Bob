-- KET Speaking — descripciones de catálogo para Part 2 y Part 3
-- Part 3 no tenía descripción; Part 2 tenía un texto genérico impreciso.

UPDATE bob_prompts
SET description = 'Describe one of your favourite hobbies.', updated_at = now()
WHERE prompt_key = 'cambridge_ket_part2_a2_generation';

UPDATE bob_prompts
SET description = 'Look at a picture and describe what you see.', updated_at = now()
WHERE prompt_key = 'cambridge_ket_part3_a2_generation';
