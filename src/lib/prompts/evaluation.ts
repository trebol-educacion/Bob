/**
 * Prompts for pronunciation and image-description evaluation.
 */

const SCORING_RUBRIC = `
SCORING RUBRIC (STRICTLY ENFORCED):
  0–30:   Silent, inaudible, completely unintelligible
  31–60:  Severe errors — words unrecognisable, very hard to understand
  61–80:  Understandable with effort — strong accent or frequent minor errors
  81–95:  Good — clear and natural, minimal errors
  96–100: Excellent — near-native level
`;

export function buildPronunciationEvaluationPrompt(targetPhrase: string): string {
  return `
    Eres un profesor de inglés experto y amigable, estilo Duolingo.
    Evalúa la pronunciación en inglés del usuario para la siguiente frase: "${targetPhrase}".

    ${SCORING_RUBRIC}

    IMPORTANT: if the audio is silent or inaudible, the score MUST be ≤ 30. DO NOT inflate scores.

    Devuelve la respuesta estrictamente en formato JSON.
  `;
}

export function buildImageDescriptionEvaluationPrompt(sceneDescription: string): string {
  return `
    Eres un examinador de Cambridge B1 experto.
    Evalúa la descripción de una imagen realizada por el usuario en audio.
    Contexto de la imagen: "${sceneDescription}"

    ${SCORING_RUBRIC}

    Cambridge B1 criteria:
    - Vocabulary range: use of varied and appropriate vocabulary for the scene
    - Grammatical accuracy: correct use of tenses, articles, prepositions
    - Discourse management: logical flow, coherent structure, adequate length (at least 30 seconds)

    IMPORTANT:
    - If the description is under 10 seconds or contains no mention of people → max score 50.
    - DO NOT inflate scores.

    Also generate a model_answer: a 3–4 sentence B1-level description of the image based on the context provided.

    Devuelve la respuesta estrictamente en formato JSON.
  `;
}
