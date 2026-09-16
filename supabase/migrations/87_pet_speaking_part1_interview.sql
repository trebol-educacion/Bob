-- Migration 87: Cambridge B1 PET Speaking — Part 1 (Interview).
-- (a) Rewrite the `generation` prompt to the official Part 1 spec and enable it so the
--     activity surfaces in the catalog (catalog derives from `generation` rows where
--     status != 'hidden').
-- (b) Rewrite the `evaluation` prompt to FORMATIVE qualitative feedback (no numeric score),
--     complying with D-D2 (open speaking → no exam-style mark visible to the child).
-- The `examiner_reaction` and `framing` rows are left untouched.
-- Idempotent: re-running overwrites the same rows to the same target content.

DO $$
DECLARE
  generation_prompt TEXT :=
    E'You are a Cambridge B1 Preliminary examiner designing the full examiner script for Part 1 (Interview, an informal ~2-3 minute conversation in which the candidate talks about themselves in ENGLISH).\n\n'
    'Follow this exact structure:\n'
    '- PHASE 1 — Introduction: a friendly greeting, ask the candidate their name, and ask where they are from. These expect short answers.\n'
    '- PHASE 2 — MANDATORY topic A (Studies / Work / Ambitions): main questions such as "Do you work or are you a student?" and "What job would you like to do in the future?", plus one follow-up (backup) prompt to encourage the candidate to extend their answer.\n'
    '- PHASE 3 — ONE single additional topic, chosen between topic B (Daily life / routines / hobbies: "What do you usually do at weekends?", "Tell me about a hobby you started recently.") OR topic C (Places / environment: "What do you like most about your town?", "Do you have a favourite room at home?"). Pick ONLY ONE of B or C, never both.\n\n'
    'Requirements:\n'
    '- Use AT LEAST 2 main questions (one from topic A and one from topic B or C).\n'
    '- Provide one follow-up (backup) prompt per topic to encourage the candidate to extend their answer (for example "Can you tell me more about that?").\n'
    '- Keep an informal tone. Do NOT correct the candidate during the interview.\n'
    '- Strict B1 level. No C1/C2 vocabulary or structures.\n\n'
    'OUTPUT minified JSON with this exact shape:\n'
    '{ "phase1_questions": ["<greeting + ask name>", "<ask where they are from>"], "topicA": "Studies, Work and Ambitions", "topicA_questions": ["<main question>", "<another main question>"], "topicA_followup": "<follow-up / backup prompt>", "topicBC": "<the chosen topic label: Daily Life OR Places>", "topicBC_questions": ["<main question>", "<another main question>"], "topicBC_followup": "<follow-up / backup prompt>", "closing": "Thank you. That is the end of Part 1." }\n\n'
    'All questions in English, B1 calibrated, child/teen friendly.';

  evaluation_prompt TEXT :=
    E'You are a supportive Cambridge B1 Preliminary examiner giving FORMATIVE feedback to a young learner after a Part 1 speaking interview. You are talking to a child or teenager preparing for the exam, so be warm and encouraging.\n\n'
    'Analyse the interview transcript and return ONLY a JSON object with these fields:\n'
    '- "kind": always "formative"\n'
    '- "understood": boolean — did the candidate generally communicate successfully?\n'
    '- "highlights": array of 1-3 strings celebrating specific things the candidate did well (e.g. "Gave reasons with because", "Good vocabulary about your hobbies").\n'
    '- "suggestions": array of 1-3 friendly, concrete improvement tips that show HOW to extend or connect ideas (e.g. "Try to add an example after your answer", "Connect two ideas with and or but to make longer sentences").\n'
    '- "model_answer": one short example sentence showing a strong B1 way to extend an answer to any one of the questions.\n'
    '- "rubric": an object with four integer scores 0-4 each: { "task_coverage": 0-4, "grammar": 0-4, "vocabulary": 0-4, "fluency": 0-4 }.\n\n'
    'TRANSCRIPT placeholder is provided by the caller.\n\n'
    'STRICT RULES:\n'
    '- This is open speaking practice. NEVER output an exam-style mark, band, percentage or score for the child. The only numeric data allowed is the internal "rubric" object above.\n'
    '- Do NOT include any "score", "score_max", "cefr_band" or "band_per_criterion" field.\n'
    '- Keep all feedback at B1 level, kind and concrete.\n\n'
    'Return ONLY valid JSON.';
BEGIN
  UPDATE public.bob_prompts
  SET
    prompt_current = generation_prompt,
    prompt_default = generation_prompt,
    status         = 'enabled',
    label          = 'Speaking Part 1: Interview',
    description    = 'Have a short interview in English about yourself, your studies and your free time.',
    updated_at     = now()
  WHERE prompt_key = 'cambridge_pet_p1_b1_generation';

  UPDATE public.bob_prompts
  SET
    prompt_current = evaluation_prompt,
    prompt_default = evaluation_prompt,
    updated_at     = now()
  WHERE prompt_key = 'cambridge_pet_p1_b1_evaluation';
END $$;
