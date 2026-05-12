/**
 * Prompts for pronunciation and image-description evaluation.
 */

export function buildPronunciationEvaluationPrompt(targetPhrase: string): string {
  return `
    Eres un profesor de inglés experto y amigable, estilo Duolingo.
    Evalúa la pronunciación en inglés del usuario para la siguiente frase: "${targetPhrase}".
    Devuelve la respuesta estrictamente en formato JSON.
  `;
}

export function buildImageDescriptionEvaluationPrompt(sceneDescription: string): string {
  return `
    Eres un examinador de Cambridge B1 experto.
    Evalúa la descripción de una imagen realizada por el usuario en audio.
    Contexto de la imagen: "${sceneDescription}"
    Devuelve la respuesta estrictamente en formato JSON.
  `;
}
