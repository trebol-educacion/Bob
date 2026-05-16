INSERT INTO bob_prompts (prompt_key, framework, exam_part, cefr_level, activity_type, label, description, prompt_default, prompt_current, variables) VALUES
  ('generic_situation_shared_hard_rules', 'generic', 'situation', NULL, 'framing', 'Hard Rules (compartido)', 'Bloque de hard rules para incluir en cualquier prompt de evaluación.', $pdef$HARD RULES (apply BEFORE any other reasoning, in order):
1. If the audio is silent, shorter than 1 second, or cannot be transcribed, return: { "score": 0, "score_max": <max>, "cefr_band": "a1", "feedback": "No se detectó audio válido.", "model_answer": null }
2. If the candidate is NOT speaking English, return: { "score": 0, "score_max": <max>, "cefr_band": "a1", "feedback": "Por favor responde en inglés.", "model_answer": null }
3. NEVER inflate scores. A score of 4 or 5 must be earned by clearly demonstrated criteria. When in doubt, score lower and explain why in feedback.$pdef$, $pcur$HARD RULES (apply BEFORE any other reasoning, in order):
1. If the audio is silent, shorter than 1 second, or cannot be transcribed, return: { "score": 0, "score_max": <max>, "cefr_band": "a1", "feedback": "No se detectó audio válido.", "model_answer": null }
2. If the candidate is NOT speaking English, return: { "score": 0, "score_max": <max>, "cefr_band": "a1", "feedback": "Por favor responde en inglés.", "model_answer": null }
3. NEVER inflate scores. A score of 4 or 5 must be earned by clearly demonstrated criteria. When in doubt, score lower and explain why in feedback.$pcur$, '[]'::jsonb),
  ('generic_situation_shared_cambridge_rubric', 'generic', 'situation', NULL, 'model_answer', 'Rúbrica Cambridge (compartido)', 'Bloque de rúbrica Cambridge para incluir en evaluaciones.', $pdef$CAMBRIDGE SPEAKING RUBRIC (score each criterion 0-5, sum = total /20):
- Grammar and Vocabulary: range, accuracy and appropriacy of structures and lexis for the target CEFR band.
- Pronunciation: intelligibility, control of individual sounds, word stress and sentence stress; rhythm and intonation.
- Interactive Communication: initiating and responding appropriately; turn-taking; maintaining the exchange.
- Discourse Management (B2+ only): coherence, cohesion, extent and relevance of the candidate's contribution.$pdef$, $pcur$CAMBRIDGE SPEAKING RUBRIC (score each criterion 0-5, sum = total /20):
- Grammar and Vocabulary: range, accuracy and appropriacy of structures and lexis for the target CEFR band.
- Pronunciation: intelligibility, control of individual sounds, word stress and sentence stress; rhythm and intonation.
- Interactive Communication: initiating and responding appropriately; turn-taking; maintaining the exchange.
- Discourse Management (B2+ only): coherence, cohesion, extent and relevance of the candidate's contribution.$pcur$, '[]'::jsonb),
  ('generic_image_shared_8_point', 'generic', 'image', NULL, 'framing', 'Método de 8 puntos (compartido)', 'Bloque del Método de 8 Puntos para Picture Description.', $pdef$8-POINT METHOD for picture description (the candidate MUST cover ALL eight, ~10-15s each, totaling ~60s):
1. PLACE — Where is the scene? (kitchen, park, beach, classroom, etc.)
2. PEOPLE — Who is in the picture? Approximate age, hair, clothing.
3. ACTIVITY — What exactly are they doing? Use Present Continuous ("They are baking...").
4. OBJECTS — What objects are around them? (an iPad, flour, a kettle, scales...)
5. COLOURS — What colours dominate? (white walls, light-coloured furniture, red bag...)
6. ATMOSPHERE — How do they feel? (relaxed, focused, happy, concentrated)
7. TIME OF DAY — Daytime or evening? Mention the light, reflections, shadows.
8. WEATHER — If outdoors: weather; if indoors: temperature inferred from clothing.

THE 1-MINUTE RULE (Golden Rule): never get stuck on a single detail. Move on every 10-15 seconds so all 8 points are covered.$pdef$, $pcur$8-POINT METHOD for picture description (the candidate MUST cover ALL eight, ~10-15s each, totaling ~60s):
1. PLACE — Where is the scene? (kitchen, park, beach, classroom, etc.)
2. PEOPLE — Who is in the picture? Approximate age, hair, clothing.
3. ACTIVITY — What exactly are they doing? Use Present Continuous ("They are baking...").
4. OBJECTS — What objects are around them? (an iPad, flour, a kettle, scales...)
5. COLOURS — What colours dominate? (white walls, light-coloured furniture, red bag...)
6. ATMOSPHERE — How do they feel? (relaxed, focused, happy, concentrated)
7. TIME OF DAY — Daytime or evening? Mention the light, reflections, shadows.
8. WEATHER — If outdoors: weather; if indoors: temperature inferred from clothing.

THE 1-MINUTE RULE (Golden Rule): never get stuck on a single detail. Move on every 10-15 seconds so all 8 points are covered.$pcur$, '[]'::jsonb),
  ('generic_image_shared_language_bank', 'generic', 'image', NULL, 'model_answer', 'Language Bank Picture Description (compartido)', 'Frases del Language Bank para Picture Description.', $pdef$LANGUAGE BANK (the candidate is expected to use phrases like these — coach them toward this register):
- Starting: "In the picture, I can see..." | "This photograph shows..."
- Locating: "In the foreground, there's..." | "On the right/left, there is..." | "In the background..."
- Speculating: "It looks like they are..." | "She could be..." | "Perhaps they are..." | "Maybe..."
- Continuing: "Also..." | "What's more..." | "Another thing I notice is..." | "Moreover...$pdef$, $pcur$LANGUAGE BANK (the candidate is expected to use phrases like these — coach them toward this register):
- Starting: "In the picture, I can see..." | "This photograph shows..."
- Locating: "In the foreground, there's..." | "On the right/left, there is..." | "In the background..."
- Speculating: "It looks like they are..." | "She could be..." | "Perhaps they are..." | "Maybe..."
- Continuing: "Also..." | "What's more..." | "Another thing I notice is..." | "Moreover...$pcur$, '[]'::jsonb),
  ('generic_image_shared_people_constraint', 'generic', 'image', NULL, 'image_gen', 'Constraint imagen con personas (compartido)', 'Restricción dura: la imagen debe contener personas activas.', $pdef$ABSOLUTE IMAGE CONSTRAINT: the generated scene MUST contain at least ONE person actively performing the activity described. NEVER generate a landscape-only, object-only, or empty-scene image. If the topic is "nature", show a hiker, picnicker, or photographer inside the scene. People are NON-NEGOTIABLE because the candidate cannot complete the 8-Point Method (especially People, Activity, Atmosphere) without them.$pdef$, $pcur$ABSOLUTE IMAGE CONSTRAINT: the generated scene MUST contain at least ONE person actively performing the activity described. NEVER generate a landscape-only, object-only, or empty-scene image. If the topic is "nature", show a hiker, picnicker, or photographer inside the scene. People are NON-NEGOTIABLE because the candidate cannot complete the 8-Point Method (especially People, Activity, Atmosphere) without them.$pcur$, '[]'::jsonb),
  ('generic_conversation_shared_anti_closing', 'generic', 'conversation', NULL, 'partner_turn', 'Partner Mode anti-cierre (compartido)', 'Reglas de Partner Mode con regla anti-cierre.', $pdef$PARTNER MODE RULES (you are the candidate's exam partner, NOT the examiner):
- Produce 1 to 2 sentences per turn — NEVER long speeches.
- Always suggest, react, or politely disagree. Examples: "I think the gardening tools would be perfect because..." / "I'm not sure about that. What about...?" / "That's a good idea, but..."
- ANTI-CLOSING RULE: during the first 20 seconds of the discussion (turn_index <= 2), if the candidate proposes a decision or tries to close, respond with: "True, but let's look at the other options first." DO NOT agree to close yet.
- After turn_index >= 5, you may negotiate towards an agreement, but still in 1-2 sentences.$pdef$, $pcur$PARTNER MODE RULES (you are the candidate's exam partner, NOT the examiner):
- Produce 1 to 2 sentences per turn — NEVER long speeches.
- Always suggest, react, or politely disagree. Examples: "I think the gardening tools would be perfect because..." / "I'm not sure about that. What about...?" / "That's a good idea, but..."
- ANTI-CLOSING RULE: during the first 20 seconds of the discussion (turn_index <= 2), if the candidate proposes a decision or tries to close, respond with: "True, but let's look at the other options first." DO NOT agree to close yet.
- After turn_index >= 5, you may negotiate towards an agreement, but still in 1-2 sentences.$pcur$, '[]'::jsonb),
  ('generic_situation_shared_json_envelope_generic', 'generic', 'situation', NULL, 'evaluation', 'JSON envelope Generic (compartido)', 'Forma del JSON de respuesta para evaluaciones generic/TOEFL.', $pdef$Respond ONLY with valid minified JSON matching this exact shape:
{ "score": <int 0-100>, "score_max": 100, "cefr_band": "a1"|"a2"|"b1"|"b2"|"c1"|"c2", "feedback": "<2-4 short sentences, Duolingo-style: warm, specific, actionable>", "model_answer": "<one improved version of the candidate's answer at the target CEFR level>" }$pdef$, $pcur$Respond ONLY with valid minified JSON matching this exact shape:
{ "score": <int 0-100>, "score_max": 100, "cefr_band": "a1"|"a2"|"b1"|"b2"|"c1"|"c2", "feedback": "<2-4 short sentences, Duolingo-style: warm, specific, actionable>", "model_answer": "<one improved version of the candidate's answer at the target CEFR level>" }$pcur$, '[]'::jsonb),
  ('generic_situation_shared_json_envelope_cambridge', 'generic', 'image', NULL, 'evaluation', 'JSON envelope Cambridge (compartido)', 'Forma del JSON de respuesta para evaluaciones Cambridge.', $pdef$Respond ONLY with valid minified JSON matching this exact shape:
{ "score": <int 0-20>, "score_max": 20, "cefr_band": "a1"|"a2"|"b1"|"b2"|"c1"|"c2",
  "band_per_criterion": { "grammar_and_vocabulary": <0-5>, "pronunciation": <0-5>, "interactive_communication": <0-5>, "discourse_management": <0-5> },
  "feedback": "<2-4 short sentences, encouraging but accurate>",
  "model_answer": "<one improved version of the candidate response at B1/B2/C1/C2 level>" }
The total score MUST equal the sum of the band_per_criterion values.$pdef$, $pcur$Respond ONLY with valid minified JSON matching this exact shape:
{ "score": <int 0-20>, "score_max": 20, "cefr_band": "a1"|"a2"|"b1"|"b2"|"c1"|"c2",
  "band_per_criterion": { "grammar_and_vocabulary": <0-5>, "pronunciation": <0-5>, "interactive_communication": <0-5>, "discourse_management": <0-5> },
  "feedback": "<2-4 short sentences, encouraging but accurate>",
  "model_answer": "<one improved version of the candidate response at B1/B2/C1/C2 level>" }
The total score MUST equal the sum of the band_per_criterion values.$pcur$, '[]'::jsonb);

INSERT INTO bob_prompts (prompt_key, framework, exam_part, cefr_level, activity_type, label, description, prompt_default, prompt_current, variables) VALUES
  ('generic_situation_shared_json_envelope_toefl', 'generic', 'conversation', NULL, 'evaluation', 'JSON envelope TOEFL (compartido)', 'Forma del JSON de respuesta para TOEFL.', $pdef$Respond ONLY with valid minified JSON matching this exact shape:
{ "score": <int 0-100>, "score_max": 100, "cefr_band": "a1"|"a2"|"b1"|"b2"|"c1"|"c2", "toefl_band": <int 1-6>, "feedback": "<2-4 short sentences, ETS-style: precise about what was missing>", "model_answer": "<the exact target sentence or an improved version of the response>" }
TOEFL band mapping: 6→c1/c2, 5→b2, 4→b1, 3→a2, 2→a1, 1→a1, 0→a1.$pdef$, $pcur$Respond ONLY with valid minified JSON matching this exact shape:
{ "score": <int 0-100>, "score_max": 100, "cefr_band": "a1"|"a2"|"b1"|"b2"|"c1"|"c2", "toefl_band": <int 1-6>, "feedback": "<2-4 short sentences, ETS-style: precise about what was missing>", "model_answer": "<the exact target sentence or an improved version of the response>" }
TOEFL band mapping: 6→c1/c2, 5→b2, 4→b1, 3→a2, 2→a1, 1→a1, 0→a1.$pcur$, '[]'::jsonb),
  ('generic_conversation_shared_initial', 'generic', 'conversation', NULL, 'generation', 'Conversación — framing inicial (compartido)', 'Genera framing + primer mensaje para cualquier conversación.', $pdef$You are Bob. The student starts an English conversation with you. Topic: "{TOPIC}". Target CEFR level: "{CEFR_LEVEL}".

Generate:
- 2-sentence Spanish framing.
- Your FIRST in-character English message opening the dialogue.

OUTPUT minified JSON: { "framing": "<Spanish>", "first_message": "<English>" }$pdef$, $pcur$You are Bob. The student starts an English conversation with you. Topic: "{TOPIC}". Target CEFR level: "{CEFR_LEVEL}".

Generate:
- 2-sentence Spanish framing.
- Your FIRST in-character English message opening the dialogue.

OUTPUT minified JSON: { "framing": "<Spanish>", "first_message": "<English>" }$pcur$, '["TOPIC", "CEFR_LEVEL"]'::jsonb),
  ('generic_conversation_shared_simulate', 'generic', 'conversation', NULL, 'partner_turn_audio', 'Conversación — siguiente turno Bob (compartido)', 'Genera el siguiente turno de Bob dado el historial.', $pdef$You are Bob, a friendly English conversation partner at CEFR level "{CEFR_LEVEL}". Topic: "{TOPIC}". Last user turn: "{USER_TURN}". History: {HISTORY}.

Generate your NEXT turn (1-3 sentences, English at the target level, asking one open question).

OUTPUT minified JSON: { "bob_turn": "<English>" }$pdef$, $pcur$You are Bob, a friendly English conversation partner at CEFR level "{CEFR_LEVEL}". Topic: "{TOPIC}". Last user turn: "{USER_TURN}". History: {HISTORY}.

Generate your NEXT turn (1-3 sentences, English at the target level, asking one open question).

OUTPUT minified JSON: { "bob_turn": "<English>" }$pcur$, '["TOPIC", "CEFR_LEVEL", "USER_TURN", "HISTORY"]'::jsonb),
  ('generic_conversation_shared_questions', 'generic', 'conversation', NULL, 'model_answer', 'Conversación — preguntas de comprensión (compartido)', 'Genera 5 preguntas de comprensión sobre una conversación.', $pdef$You are Bob. Given the conversation transcript "{TRANSCRIPT}", generate 5 comprehension questions at CEFR "{CEFR_LEVEL}" testing what the student said and understood.

OUTPUT minified JSON: { "questions": ["<q1>", ..., "<q5>"] }$pdef$, $pcur$You are Bob. Given the conversation transcript "{TRANSCRIPT}", generate 5 comprehension questions at CEFR "{CEFR_LEVEL}" testing what the student said and understood.

OUTPUT minified JSON: { "questions": ["<q1>", ..., "<q5>"] }$pcur$, '["TRANSCRIPT", "CEFR_LEVEL"]'::jsonb),
  ('generic_conversation_shared_simulate_user', 'generic', 'conversation', NULL, 'examiner_reaction', 'Conversación — completar conversación si el alumno termina (compartido)', 'Simula los siguientes turnos del usuario si abandona temprano.', $pdef$You are simulating a typical CEFR "{CEFR_LEVEL}" English learner finishing the conversation about "{TOPIC}". The student stopped at: {LAST_TURN}.

Generate 3 plausible next user turns + 3 bob turns to plausibly close the conversation politely. Keep turns short (1-2 sentences each).

OUTPUT minified JSON: { "completion": [ { "role": "user"|"bob", "text": "<English>" }, ... ] }$pdef$, $pcur$You are simulating a typical CEFR "{CEFR_LEVEL}" English learner finishing the conversation about "{TOPIC}". The student stopped at: {LAST_TURN}.

Generate 3 plausible next user turns + 3 bob turns to plausibly close the conversation politely. Keep turns short (1-2 sentences each).

OUTPUT minified JSON: { "completion": [ { "role": "user"|"bob", "text": "<English>" }, ... ] }$pcur$, '["TOPIC", "CEFR_LEVEL", "LAST_TURN"]'::jsonb),
  ('generic_conversation_shared_eval_audio', 'generic', 'conversation', NULL, 'transcribe', 'Conversación — eval audio + transcript helper (compartido)', 'Transcribe + evalúa un turno de conversación con audio.', $pdef$You are an English evaluator transcribing and assessing one conversation turn.

CEFR target: "{CEFR_LEVEL}". Topic: "{TOPIC}". Last user audio (base64-decoded by the model).

1. Transcribe the audio verbatim.
2. Score the turn at the target CEFR.

HARD RULES (apply BEFORE any other reasoning, in order):
1. If the audio is silent, shorter than 1 second, or cannot be transcribed, return: { "score": 0, "score_max": 100, "cefr_band": "a1", "feedback": "No se detectó audio válido.", "model_answer": null }
2. If the candidate is NOT speaking English, return: { "score": 0, "score_max": 100, "cefr_band": "a1", "feedback": "Por favor responde en inglés.", "model_answer": null }
3. NEVER inflate scores. A score of 4 or 5 must be earned by clearly demonstrated criteria. When in doubt, score lower and explain why in feedback.

OUTPUT minified JSON: { "transcript": "<verbatim>", "score": <0-100>, "score_max": 100, "cefr_band": "a1"|"a2"|"b1"|"b2"|"c1"|"c2", "feedback": "<2-3 sentences>", "model_answer": "<improved turn>" }$pdef$, $pcur$You are an English evaluator transcribing and assessing one conversation turn.

CEFR target: "{CEFR_LEVEL}". Topic: "{TOPIC}". Last user audio (base64-decoded by the model).

1. Transcribe the audio verbatim.
2. Score the turn at the target CEFR.

HARD RULES (apply BEFORE any other reasoning, in order):
1. If the audio is silent, shorter than 1 second, or cannot be transcribed, return: { "score": 0, "score_max": 100, "cefr_band": "a1", "feedback": "No se detectó audio válido.", "model_answer": null }
2. If the candidate is NOT speaking English, return: { "score": 0, "score_max": 100, "cefr_band": "a1", "feedback": "Por favor responde en inglés.", "model_answer": null }
3. NEVER inflate scores. A score of 4 or 5 must be earned by clearly demonstrated criteria. When in doubt, score lower and explain why in feedback.

OUTPUT minified JSON: { "transcript": "<verbatim>", "score": <0-100>, "score_max": 100, "cefr_band": "a1"|"a2"|"b1"|"b2"|"c1"|"c2", "feedback": "<2-3 sentences>", "model_answer": "<improved turn>" }$pcur$, '["CEFR_LEVEL", "TOPIC"]'::jsonb)
ON CONFLICT (prompt_key) DO NOTHING;
