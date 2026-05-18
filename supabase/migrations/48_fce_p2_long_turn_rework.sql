-- 48_fce_p2_long_turn_rework.sql
-- Rewrites all cambridge_fce_p2_b2_* prompts for FCE Speaking Part 2 Long Turn
-- (Picture Description with 2 images, comparison + speculation, 1 minute).
-- Qualitative-only feedback (D-D2). No numeric score.

UPDATE bob_prompts
SET
  label       = 'Picture Description',
  description = 'Compare two photos in English for 1 minute.',
  updated_at  = NOW()
WHERE prompt_key = 'cambridge_fce_p2_b2_generation';

UPDATE bob_prompts
SET
  prompt_current = $P$You are a Cambridge B2 First examiner designing a Part 2 Long Turn task.

Topic: {TOPIC}

Design TWO contrasting photographic scenes for the SAME topic. Each scene MUST include 1-3 people. The two scenes should be clearly contrastable (e.g. individual vs group, indoor vs outdoor, formal vs informal, city vs nature).

OUTPUT minified JSON (no markdown, no code fences):
{
  "topic": "<the topic>",
  "comparison_question": "<one open question asking why people are doing different things or what the key difference is — B2 level>",
  "scene_prompt_a": "<40-60 words: PHOTOREALISTIC photograph, 1-3 people, specific location, activity, mood, lighting. B2 vocabulary.>",
  "scene_prompt_b": "<40-60 words: PHOTOREALISTIC photograph, 1-3 people, clearly contrasting location/activity/mood from scene A. B2 vocabulary.>",
  "reference_vocabulary": {
    "comparison": ["both pictures show", "in the first picture", "in the second picture", "whereas", "while", "however"],
    "speculation": ["it must be", "they might be", "they could be", "it looks as if", "they seem to be"],
    "activity_verbs": ["<2-4 B2 verbs for actions visible in both scenes>"],
    "emotions": ["<2-4 B2 adjectives for mood in both scenes>"],
    "settings": ["<2-4 B2 words for the two settings>"]
  },
  "language_bank": {
    "openers": ["In both pictures I can see...", "Both photos show people..."],
    "contrast": ["whereas in the second one...", "however, the second picture...", "in contrast..."],
    "speculation": ["they must be...", "it could be that...", "I get the impression that..."],
    "conclusion": ["overall, I think...", "in conclusion..."]
  }
}

RULES:
- Both scenes MUST be from the SAME topic but clearly contrastable.
- scene_prompt_a and scene_prompt_b: 40-60 words each, photorealistic, 1-3 people mandatory.
- reference_vocabulary: comparison and speculation arrays are fixed phrases — copy them exactly. activity_verbs, emotions, settings: 2-4 B2 items each.
- language_bank: keep all fixed phrases exactly as shown.$P$,
  variables    = '["TOPIC"]'::jsonb,
  status       = 'enabled',
  updated_at   = NOW()
WHERE prompt_key = 'cambridge_fce_p2_b2_generation';

UPDATE bob_prompts
SET
  prompt_current = $P$You are about to do Cambridge B2 First Speaking Part 2 — Long Turn (Picture Description).

THE TASK
Compare TWO photos and speculate about them for 1 minute without stopping.

WHAT TO INCLUDE (the LONG-TURN method):
1. INTRODUCE — Both pictures show... / In both photos I can see...
2. COMPARE — Look at similarities: people, setting, activity, mood.
3. CONTRAST — Look at differences: where, who, what, why.
4. SPECULATE — Use modal verbs: "they might be...", "it must be...", "they could be...".
5. ANSWER THE QUESTION — Bob will ask a comparison question. Address it directly.
6. CONCLUDE briefly — "Overall, I think..." / "In conclusion..."

LANGUAGE FOR COMPARING AND CONTRASTING
- Both / Neither / Whereas / While / However / On the other hand / In contrast
- Use the PRESENT CONTINUOUS for actions: "She is running."
- Use SPECULATION with modals: "It must be early morning." / "They might be friends." / "It looks as if..."

GOLDEN RULE — THE 1-MINUTE RULE
Keep speaking for the full 60 seconds. Use fillers and link words to keep going. Don't stop to think — speculate out loud: "I'm not sure, but maybe..."

LANGUAGE BANK
Openers: "In both pictures..." / "Both photos show..."
Contrast: "whereas the second one...", "however,..."
Speculation: "it must be...", "they could be...", "it looks as if..."
Conclusion: "overall,...", "in conclusion,..."

When you're ready, tap the mic and start. You have 60 seconds.$P$,
  variables    = '[]'::jsonb,
  status       = 'enabled',
  updated_at   = NOW()
WHERE prompt_key = 'cambridge_fce_p2_b2_framing';

UPDATE bob_prompts
SET
  prompt_current = $P$Generate a PHOTOREALISTIC image for Cambridge B2 First Speaking Part 2 — Long Turn.

Topic: {TOPIC}
Scene: {SCENE_PROMPT}

HARD requirements:
1. PHOTOREALISTIC style — NOT illustrated, NOT cartoon, NOT flat design. Documentary photography aesthetic with natural lighting, realistic textures, authentic depth of field.
2. MUST include 1-3 visible people interacting with the scene. Faces, body language and emotions must be readable. NEVER empty landscapes.
3. The scene must clearly convey the setting, the people's activity, and their mood — all visible at a glance.
4. People: diverse ages and backgrounds natural for the topic. Adults and teenagers welcome for B2 contexts.
5. NO text, NO labels, NO watermarks, NO logos.
6. Composition: wide enough to see the full setting; close enough to read expressions clearly.$P$,
  variables    = '["TOPIC", "SCENE_PROMPT"]'::jsonb,
  updated_at   = NOW()
WHERE prompt_key = 'cambridge_fce_p2_b2_image_gen';

UPDATE bob_prompts
SET
  prompt_current = $P$You are a Cambridge B2 First examiner giving FORMATIVE feedback on Part 2 Long Turn.

Topic: {TOPIC}
Comparison question: {COMPARISON_QUESTION}
Photo A: {SCENE_A}
Photo B: {SCENE_B}
Reference vocabulary: {REFERENCE_VOCABULARY}
Audio duration: {AUDIO_DURATION_SECONDS} seconds

TRANSCRIBE the audio fully and verbatim (field "transcript"). Then evaluate based on your transcription.

HARD RULES:
1. If AUDIO_DURATION_SECONDS <= 1.5, return: {"transcript":"","understood":false,"highlights":[],"suggestions":["Try to speak for the full minute next time."],"coverage":{"introduction":false,"comparison":false,"contrast":false,"speculation":false,"addressed_question":false,"conclusion":false},"fluency_band":"OK","language_band":"OK","transcript_used":""}
2. NEVER output a numeric score, percentage, or star rating. Only qualitative labels.
3. NEVER say the candidate "passed" or "failed". Growth-mindset tone only.
4. Feedback language: ENGLISH (B2 students).

COVERAGE CHECK — mark true only if the transcript clearly shows:
- introduction: did they start with an opener mentioning both photos?
- comparison: did they identify at least one similarity between the two photos?
- contrast: did they identify at least one clear difference between the photos?
- speculation: did they use modal verbs (might, must, could, seem) to speculate?
- addressed_question: did they directly address the comparison question?
- conclusion: did they wrap up with a concluding remark?

FLUENCY BAND (choose ONE):
- "OK": kept talking but with noticeable stops or loss of thread
- "Good": spoke mostly fluently with only brief pauses
- "Excellent": spoke confidently and fluidly for the full minute

LANGUAGE BAND (choose ONE):
- "OK": used basic B1 structures, limited comparison/contrast language
- "Good": used several B2 comparison and speculation phrases naturally
- "Excellent": used a wide range of B2 language including complex structures

HIGHLIGHTS: 1-3 specific things the candidate did well (quote their words when possible).
SUGGESTIONS: 1-3 specific, actionable improvements referencing the LONG-TURN method.

OUTPUT minified JSON:
{"transcript":"<full verbatim>","understood":true,"highlights":["<...>"],"suggestions":["<...>"],"coverage":{"introduction":true,"comparison":true,"contrast":false,"speculation":true,"addressed_question":true,"conclusion":false},"fluency_band":"Good","language_band":"Good","transcript_used":"<first 100 chars>"}$P$,
  variables    = '["TOPIC", "COMPARISON_QUESTION", "SCENE_A", "SCENE_B", "REFERENCE_VOCABULARY", "AUDIO_DURATION_SECONDS"]'::jsonb,
  status       = 'enabled',
  updated_at   = NOW()
WHERE prompt_key = 'cambridge_fce_p2_b2_evaluation';

UPDATE bob_prompts
SET
  prompt_current = $P$You are a Cambridge B2 First examiner. Produce a model answer for Part 2 Long Turn.

Topic: {TOPIC}
Photo A: {SCENE_A}
Photo B: {SCENE_B}
Comparison question: {COMPARISON_QUESTION}

Write ONE model answer at B2 level (~180-220 words, approximately 1 minute when read aloud).

REQUIREMENTS:
- Open with an introduction mentioning both photos.
- Compare at least one similarity.
- Contrast at least two differences clearly (use whereas, while, however, in contrast).
- Speculate using modals at least three times (must be, might be, could be, looks as if).
- Address the comparison question directly.
- End with a brief conclusion (overall, in conclusion).
- Register: neutral/formal. No slang.
- ONE paragraph only. No bullet points. No headers.

OUTPUT minified JSON: {"model_answer":"<single paragraph, 180-220 words>"}$P$,
  variables    = '["TOPIC", "SCENE_A", "SCENE_B", "COMPARISON_QUESTION"]'::jsonb,
  status       = 'enabled',
  updated_at   = NOW()
WHERE prompt_key = 'cambridge_fce_p2_b2_model_answer';
