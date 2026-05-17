INSERT INTO bob_prompts (
  prompt_key,
  framework,
  exam_part,
  cefr_level,
  activity_type,
  status,
  label,
  description,
  prompt_default,
  prompt_current,
  variables
) VALUES (
  'cambridge_ket_writing_part6_a2_framing',
  'cambridge',
  'cambridge_ket_writing_part6',
  'a2',
  'framing',
  'enabled',
  'KET Writing Part 6 (A2) — framing',
  'Instrucción inicial al alumno antes del mensaje.',
  'Vas a escribir un mensaje corto a un amigo en inglés. Bob te dirá la situación y 3 cosas que tienes que mencionar. Escribe unas 25 palabras.',
  'Vas a escribir un mensaje corto a un amigo en inglés. Bob te dirá la situación y 3 cosas que tienes que mencionar. Escribe unas 25 palabras.',
  '[]'::jsonb
)
ON CONFLICT (prompt_key) DO NOTHING;
