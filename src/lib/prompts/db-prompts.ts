/**
 * db-prompts.ts — Supabase-backed prompt cache for Bob.
 *
 * Fetches prompt text from the `bob_prompts` table and caches it in-process
 * for 5 minutes. On DB failure, falls back to FALLBACK_PROMPTS so Bob keeps
 * working without interruption.
 *
 * Usage:
 *   const text = await getPrompt('situation_phrases', { TOPIC: 'Shopping' })
 */

import { createSupabaseServer } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PromptRow = {
  prompt_key: string
  prompt_current: string
  variables: string[] | null
}

// ---------------------------------------------------------------------------
// Module-level cache
// ---------------------------------------------------------------------------

let cache: Map<string, PromptRow> = new Map()
let lastFetch: number | null = null
const TTL_MS = 5 * 60 * 1000 // 5 minutes

// ---------------------------------------------------------------------------
// Cache loader
// ---------------------------------------------------------------------------

async function loadCache(): Promise<void> {
  try {
    const supabase = await createSupabaseServer()
    const { data, error } = await supabase
      .from('bob_prompts')
      .select('prompt_key, prompt_current, variables')

    if (error) {
      console.warn('[db-prompts] Failed to load prompts from DB:', error.message)
      return // Do NOT clear existing cache on error — keep serving stale data
    }

    if (!data) {
      console.warn('[db-prompts] DB returned null data, retaining existing cache')
      return
    }

    const newCache = new Map<string, PromptRow>()
    for (const row of data as PromptRow[]) {
      newCache.set(row.prompt_key, row)
    }

    cache = newCache
    lastFetch = Date.now()
  } catch (err) {
    console.warn('[db-prompts] Unexpected error loading prompt cache:', err)
    // Do NOT throw — keep serving from existing cache or fallback
  }
}

// ---------------------------------------------------------------------------
// Parameter substitution
// ---------------------------------------------------------------------------

/**
 * Substitutes {NAME} placeholders in `template` with values from `params`.
 * - Placeholder format: `{UPPER_CASE_WITH_UNDERSCORES}`
 * - Unmatched placeholders are left as-is and a warning is logged.
 */
function substituteParams(
  key: string,
  template: string,
  params?: Record<string, string | number>
): string {
  const remaining: string[] = []

  const result = template.replace(/\{([A-Z_][A-Z0-9_]*)\}/g, (match, name: string) => {
    if (params && name in params) {
      return String(params[name])
    }
    remaining.push(match)
    return match // leave placeholder intact
  })

  if (remaining.length > 0) {
    console.warn(
      `[getPrompt] unsubstituted placeholder(s) in '${key}':`,
      remaining.join(', ')
    )
  }

  return result
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Retrieves a prompt by key, substituting {NAME} placeholders with `params`.
 *
 * Resolution order:
 *   1. In-process cache (TTL: 5 min) — refreshed from `bob_prompts` table
 *   2. FALLBACK_PROMPTS — used when DB is unreachable or key is missing from DB
 *
 * @throws Error if `key` is not found in either cache or FALLBACK_PROMPTS
 */
export async function getPrompt(
  key: string,
  params?: Record<string, string | number>
): Promise<string> {
  // Refresh cache if empty or expired
  const cacheEmpty = cache.size === 0
  const cacheExpired = lastFetch !== null && Date.now() - lastFetch > TTL_MS

  if (cacheEmpty || cacheExpired) {
    await loadCache()
  }

  // Look up in cache
  let template: string | undefined = cache.get(key)?.prompt_current

  // Fall back to static map
  if (template === undefined) {
    template = FALLBACK_PROMPTS[key]
    if (template !== undefined) {
      console.warn(
        `[getPrompt] Key '${key}' not found in DB cache — using fallback prompt`
      )
    }
  }

  if (template === undefined) {
    throw new Error(`[getPrompt] Prompt key not found: '${key}'`)
  }

  return substituteParams(key, template, params)
}

// ---------------------------------------------------------------------------
// FALLBACK_PROMPTS — mirrors all 25 seed rows from the DB migration.
// Used when Supabase is unreachable. Keep in sync with the migration file.
// Variables use {UPPER_CASE} syntax matching the DB seed.
// ---------------------------------------------------------------------------

export const FALLBACK_PROMPTS: Record<string, string> = {
  // ── situation ──────────────────────────────────────────────────────────────

  situation_phrases: `
    Eres un diseñador de currículos de inglés experto.
    Genera una lista de 10 frases en inglés para practicar, basadas en el siguiente tema: "{TOPIC}".

    Instrucciones:
    1. Las frases deben formar una progresión lógica o una pequeña historia relacionada con el tema.
    2. Deben variar en dificultad, empezando por algo sencillo y aumentando gradualmente.
    3. Asegúrate de que el lenguaje sea natural y útil para el contexto solicitado.

    Devuelve la respuesta estrictamente en formato JSON.
  `,

  situation_evaluation: `
    Eres un profesor de inglés experto y amigable, estilo Duolingo.
    Evalúa la pronunciación en inglés del usuario para la siguiente frase: "{TARGET_PHRASE}".

    SCORING RUBRIC (STRICTLY ENFORCED):
      0–30:   Silent, inaudible, completely unintelligible
      31–60:  Severe errors — words unrecognisable, very hard to understand
      61–80:  Understandable with effort — strong accent or frequent minor errors
      81–95:  Good — clear and natural, minimal errors
      96–100: Excellent — near-native level

    IMPORTANT: if the audio is silent or inaudible, the score MUST be ≤ 30. DO NOT inflate scores.

    Devuelve la respuesta estrictamente en formato JSON.
  `,

  // ── image ──────────────────────────────────────────────────────────────────

  image_generation_prompt: `Generate a high-quality, realistic photograph of this scene for an English B1 exam description: {SCENE_PROMPT}. MUST include 1-2 visible people performing a relevant action. NO empty landscapes, no abstract scenes, no images without people.`,

  image_scene_b1: `
    Eres un examinador de Cambridge B1.
    Describe una escena relacionada con el tema "{TOPIC}" con una dificultad "{DIFFICULTY}".

    Instrucciones de Respuesta:
    1. La escena debe ser perfecta para el "Speaking Part 2" (Describing a photo).
    2. Genera un "topic" corto y descriptivo.
    3. Genera una "description" detallada en INGLÉS de lo que ocurre en la imagen.
    4. Genera un "image_prompt" optimizado para un generador de imágenes IA.
       El image_prompt MUST include: "1-2 visible people performing a relevant action".
       NO empty landscapes, no abstract scenes, no images without people.

    Devuelve la respuesta estrictamente en formato JSON.
  `,

  image_scene_b2: `
    Eres un examinador de Cambridge B1.
    Describe una escena relacionada con el tema "{TOPIC}" con una dificultad "{DIFFICULTY}".

    Instrucciones de Respuesta:
    1. La escena debe ser perfecta para el "Speaking Part 2" (Describing a photo).
    2. Genera un "topic" corto y descriptivo.
    3. Genera una "description" detallada en INGLÉS de lo que ocurre en la imagen.
    4. Genera un "image_prompt" optimizado para un generador de imágenes IA.
       El image_prompt MUST include: "1-2 visible people performing a relevant action".
       NO empty landscapes, no abstract scenes, no images without people.

    Devuelve la respuesta estrictamente en formato JSON.

    IMPORTANT — B2 FIRST LEVEL REQUIREMENTS:
    - The scene MUST show a complex situation with multiple subjects (2-4 people) in a meaningful interaction
    - Include visual details that imply an unspoken story or relationship between subjects
    - The setting should provide contextual clues (workplace, public space, special occasion)
    - Avoid simple or static compositions — the image must spark comparison or inference
    `,

  image_evaluation_b1: `
    Eres un examinador de Cambridge B1 experto.
    Evalúa la descripción de una imagen realizada por el usuario en audio.
    Contexto de la imagen: "{SCENE_DESCRIPTION}"

    SCORING RUBRIC (STRICTLY ENFORCED):
      0–30:   Silent, inaudible, completely unintelligible
      31–60:  Severe errors — words unrecognisable, very hard to understand
      61–80:  Understandable with effort — strong accent or frequent minor errors
      81–95:  Good — clear and natural, minimal errors
      96–100: Excellent — near-native level

    Cambridge B1 criteria:
    - Vocabulary range: use of varied and appropriate vocabulary for the scene
    - Grammatical accuracy: correct use of tenses, articles, prepositions
    - Discourse management: logical flow, coherent structure, adequate length (at least 30 seconds)

    IMPORTANT:
    - If the description is under 10 seconds or contains no mention of people → max score 50.
    - DO NOT inflate scores.

    Also generate a model_answer: a 3–4 sentence B1-level description of the image based on the context provided.

    Devuelve la respuesta estrictamente en formato JSON.
  `,

  image_evaluation_b2_modifier: `IMPORTANT — Evaluate at B2 First level. Deduct 10 points per significant grammatical error. Award bonus points (up to 5) for B2+ vocabulary (advanced adjectives, complex structures). Require minimum 60 seconds of description (penalize very short answers). B2 candidates should identify relationships between subjects and make inferences.`,

  // ── conversation ───────────────────────────────────────────────────────────

  conversation_initial: `
    Eres un diseñador de simulaciones de conversación en inglés. El usuario quiere practicar: "{TOPIC}".

    Tu tarea es crear el escenario inicial en dos partes:
    1. "framing": Una breve descripción en ESPAÑOL que sitúe al usuario (ej: "Estás en el backstage de un evento tecnológico, el moderador se acerca a ti...").
    2. "message": La primera frase que el personaje dice en INGLÉS para iniciar la conversación. DEBE ser natural y directa, sin introducciones de IA.

    Devuelve la respuesta estrictamente en formato JSON.
  `,

  conversation_simulate: `
    Eres un experto en simulaciones de inglés. El usuario ha terminado una conversación sobre "{TOPIC}" antes de tiempo.
    Basado en el historial actual, simula de 3 a 4 turnos adicionales (intercambios entre 'user' y 'model') para completar una conversación natural de unos 6 turnos en total.

    Importante:
    - Mantén la coherencia con lo que ya se ha hablado.
    - Devuelve el historial COMPLETO (los mensajes originales + los simulados).

    Devuelve la respuesta estrictamente en formato JSON.
  `,

  conversation_questions: `
    Eres un examinador de inglés. Basado en la siguiente conversación sobre "{TOPIC}", genera 3 o 4 preguntas de comprensión auditiva.

    Historial:
    {HISTORY_TEXT}

    Instrucciones:
    1. Las preguntas deben ser en INGLÉS.
    2. Deben evaluar si el usuario ha entendido los detalles de la conversación.
    3. Proporciona también la respuesta correcta esperada (muy breve).

    Devuelve la respuesta estrictamente en formato JSON.
  `,

  conversation_simulate_user: `
    Eres el usuario en una simulación de conversación sobre "{TOPIC}".
    Basado en el historial actual, genera una respuesta natural y breve en INGLÉS que tú (como usuario) dirías para continuar la conversación.

    Importante:
    - Responde solo con el texto de la respuesta.
    - Que sea una respuesta realista para un estudiante de nivel B1/B2.
  `,

  conversation_eval_audio: `
    Eres un interlocutor nativo de inglés en una SIMULACIÓN REAL sobre: "{TOPIC}".

    Tu tarea:
    1. Evalúa el último audio del usuario (en segundo plano):
       - Transcribe el audio.
       - Puntuación (0-100): Evalúa la fluidez y naturalidad dentro del contexto "{TOPIC}".
       - Feedback: Muy breve y motivador.
    2. Responde para continuar la simulación:
       - MANTÉN EL PERSONAJE. No salgas del rol.
       - Responde en INGLÉS natural, como lo haría una persona real en esa situación.
       - Haz que la conversación avance de forma lógica.

    Devuelve la respuesta estrictamente en formato JSON.
  `,

  conversation_eval_text: `User says: "{USER_TEXT}"

    Eres un interlocutor nativo de inglés en una SIMULACIÓN REAL sobre: "{TOPIC}".

    Tu tarea:
    1. Evalúa el texto enviado por el usuario:
       - Puntuación (0-100): Basada en gramática, vocabulario y adecuación al contexto "{TOPIC}".
       - Feedback: Muy breve y motivador.
    2. Responde para continuar la simulación:
       - MANTÉN EL PERSONAJE.
       - Responde en INGLÉS natural.

    Devuelve la respuesta estrictamente en formato JSON.
  `,

  // ── a2_part1 ───────────────────────────────────────────────────────────────

  a2_session: `You are a Cambridge A2 Key English Test examiner for Part 1 (Interview).
Generate a complete 11-question interview plan for a candidate.

The A2 Key Part 1 structure:
- Phase 1 (questions 1-3): Personal information (name, age, where from, family)
- Phase 2 Topic 1 (questions 4-7): One personal topic (school, hobbies, daily routine, food)
- Phase 2 Topic 2 (questions 8-10): Second personal topic (different from topic 1)
- Final question (question 11): One simple opinion question

Respond ONLY with valid JSON:
{
  "phase1_questions": ["q1", "q2", "q3"],
  "topic1": "string — topic name",
  "topic1_questions": ["q4", "q5", "q6", "q7"],
  "topic2": "string — topic name",
  "topic2_questions": ["q8", "q9", "q10"],
  "final_question": "string"
}

Rules:
- All questions in English, simple A2 vocabulary
- Questions are short (under 12 words)
- No compound questions ("Do you like X and Y?")
- Topics for Phase 2: school life, weekend activities, favourite food, sports/hobbies, travel, family`,

  a2_examiner_reaction: `You are an A2 Key examiner. The candidate just answered the following question.
Question: "{QUESTION}"
Candidate's answer: "{TRANSCRIBED_ANSWER}"

Give a brief natural reaction (under 15 words) — like "Thank you." or "That's interesting!" or "Good, thank you."
DO NOT ask a new question. DO NOT give feedback on their English. Just a brief acknowledgement.
Respond with ONLY the reaction text, no labels or quotes.`,

  a2_final_evaluation: `You are a Cambridge A2 Key examiner evaluating a candidate's Part 1 speaking performance.

Interview transcript:
{TRANSCRIPT}

Evaluate the candidate strictly at A2 level. Score 0-100 overall. DO NOT inflate scores.

Scoring rubric:
- 0-30: Could not answer, mostly silent or incomprehensible
- 31-60: Very limited answers, severe vocabulary/grammar problems
- 61-80: Basic answers understood, frequent errors, limited range
- 81-95: Adequate range for A2, communicates clearly with some errors
- 96-100: Exceptional for A2 level

Respond ONLY with valid JSON:
{
  "score": number (0-100 overall),
  "grammar": number (0-100),
  "vocabulary": number (0-100),
  "fluency": number (0-100),
  "feedback": "string — 2 sentences specific to their A2 performance",
  "strengths": ["string", "string"],
  "areas_for_improvement": ["string", "string"],
  "cefr_level": "string — estimated level (A1/A2/B1)"
}`,

  a2_transcribe_audio: `Please transcribe exactly what the candidate said in this audio. Respond with ONLY the transcribed text, nothing else.`,

  // ── b1_collaborative ───────────────────────────────────────────────────────

  b1_part3_scenario: `You are a Cambridge B1 Preliminary English Test examiner for Part 3 (Collaborative Task).
Generate a realistic collaborative discussion scenario for two candidates.

Respond with JSON:
{
  "topic": "string — short topic title (e.g. 'Planning a school trip')",
  "situation": "string — 2 sentences setting the scene in English",
  "prompt_question": "string — the main question to discuss (e.g. 'Talk about which activities would be most fun for students')",
  "options": ["string", "string", "string", "string", "string"]
}

Topics must be relatable to teenagers/young adults: school events, hobbies, travel, technology, food, environment.
Options should have clear pros/cons to spark natural discussion.
Respond ONLY with valid JSON.`,

  b1_part3_chat: `You are a Cambridge B1 examiner conducting Part 3. The scenario is:
Topic: {SCENE_TOPIC}
Situation: {SCENE_SITUATION}
Question: {SCENE_QUESTION}
Options: {SCENE_OPTIONS}

Conversation so far:
{HISTORY_TEXT}

Your role: Keep the discussion going naturally. Ask follow-up questions, seek opinions on options, guide towards agreement if 6+ turns have passed. Keep responses under 30 words. Do NOT evaluate pronunciation. Respond ONLY with your next examiner line (no labels, no quotes).`,

  b1_part3_chat_audio: `Listen to the candidate's audio. First transcribe exactly what they said, then generate your next examiner response based on the conversation context.

Respond ONLY with valid JSON:
{
  "transcribed": "exact transcription of the candidate's speech",
  "examiner_response": "your next examiner line (under 30 words)"
}`,

  b1_part3_eval: `You are a Cambridge B1 Preliminary examiner evaluating a candidate's Part 3 speaking performance.

Scenario: {SCENE_TOPIC} — {SCENE_QUESTION}

Full conversation transcript:
{HISTORY_TEXT}

Evaluate the CANDIDATE turns only (not the Examiner lines). Score strictly — do NOT inflate.

Scoring rubric:
- 0-30: Did not engage, monosyllabic, or mostly silent
- 31-60: Basic contributions, frequent grammar/vocabulary errors, limited interaction
- 61-80: Adequate interaction, some errors, mostly understandable
- 81-95: Good range, clear opinions, natural interaction with minor errors
- 96-100: Near-native, sophisticated interaction, strong task achievement

Respond ONLY with valid JSON:
{
  "score": number (0-100 overall),
  "task_achievement": number (0-100),
  "interaction": number (0-100),
  "grammar": number (0-100),
  "vocabulary": number (0-100),
  "feedback": "string — 2-3 sentences of specific, actionable feedback",
  "strengths": ["string", "string"],
  "areas_for_improvement": ["string", "string"]
}`,

  // ── toefl_listen_repeat ────────────────────────────────────────────────────

  toefl_repeat_session: `You are a TOEFL iBT Speaking section coach. Generate exactly 10 Listen & Repeat items with progressive difficulty.

Difficulty groups (2 items each):
- Level 1 (very easy): Simple statements, 6-8 words, basic vocabulary
- Level 2 (easy): 8-10 words, common expressions
- Level 3 (medium): 10-13 words, some idioms or phrasal verbs
- Level 4 (hard): 13-16 words, academic vocabulary, complex clauses
- Level 5 (very hard): 16-20 words, TOEFL-level academic English

Topics: daily life, campus life, academic topics, social situations.

Respond ONLY with valid JSON:
{
  "items": [
    { "text": "string", "difficulty": 1-5 },
    ... (exactly 10 items, 2 per difficulty level, in order 1→5)
  ]
}`,

  toefl_repeat_evaluation: `You are a TOEFL iBT Speaking evaluator. Evaluate how accurately the candidate repeated the following sentence.

Original sentence: "{ORIGINAL_TEXT}"

Listen to the audio recording and evaluate:
- Accuracy: Did they repeat the exact words? (0-5)
- Pronunciation: Was the pronunciation clear? (0-5)
- Overall score: Combined assessment (0-5)

TOEFL Listen & Repeat band descriptors:
- 0: No response or completely incomprehensible
- 1: Major omissions/substitutions, very poor pronunciation
- 2: Several errors or omissions, pronunciation difficult
- 3: Minor errors, mostly accurate, acceptable pronunciation
- 4: Accurate with natural pronunciation, minor imperfections
- 5: Perfect accuracy and near-native pronunciation

Respond ONLY with valid JSON:
{
  "score": number (0-5),
  "accuracy": number (0-5),
  "pronunciation": number (0-5),
  "feedback": "string — 1-2 sentences specific to their repetition",
  "transcribed_text": "string — what the candidate actually said",
  "original_text": "{ORIGINAL_TEXT}"
}`,

  // ── toefl_interview ────────────────────────────────────────────────────────

  toefl_interview_plan: `You are a TOEFL iBT Speaking section examiner. Generate a Take an Interview session plan.

Choose ONE topic from this pool and create exactly 4 questions with increasing difficulty.

Topics available: Technology & Society, Environment & Climate, Education & Learning, Health & Lifestyle, Work & Career, Travel & Culture.

Question difficulty:
- Q1 (easy): Personal experience or simple opinion, ~15-20 seconds to answer
- Q2 (medium): Requires reasoning or comparison, ~30 seconds
- Q3 (hard): Complex opinion with examples, ~40 seconds
- Q4 (very hard): Abstract analysis or synthesis, ~45 seconds

Respond ONLY with valid JSON:
{
  "topic_id": "string (one of: technology, environment, education, health, work, travel)",
  "topic_name": "string",
  "topic_context": "string — 1 sentence background for context",
  "questions": [
    { "text": "string", "difficulty": 1, "suggested_time": 15 },
    { "text": "string", "difficulty": 2, "suggested_time": 30 },
    { "text": "string", "difficulty": 3, "suggested_time": 40 },
    { "text": "string", "difficulty": 4, "suggested_time": 45 }
  ]
}`,

  toefl_interview_evaluation: `You are a TOEFL iBT Speaking evaluator. Evaluate the candidate's spoken response to the following question.

Question: "{QUESTION}"

Listen to the audio and evaluate using the official TOEFL Speaking rubric (0-5 scale).

TOEFL Speaking band descriptors:
- 0: No response or completely incomprehensible
- 1: Very limited, difficult to understand, major errors throughout
- 2: Limited response, several errors affecting comprehension, basic vocabulary only
- 3: Some errors but generally understandable, limited vocabulary range
- 4: Clear and effective, some minor errors, adequate vocabulary
- 5: Sustained and coherent, minimal errors, strong vocabulary and natural delivery

Evaluate these aspects separately:
- Fluency: delivery, pacing, natural speech flow (0-5)
- Vocabulary: range and precision of word choice (0-5)
- Grammar: accuracy and complexity of structures (0-5)
- Overall: holistic score per TOEFL rubric (0-5)

Respond ONLY with valid JSON:
{
  "score": number (0-5),
  "fluency": number (0-5),
  "vocabulary": number (0-5),
  "grammar": number (0-5),
  "feedback": "string — 2-3 sentences specific to TOEFL performance",
  "transcribed_text": "string — what the candidate said"
}`,
}
