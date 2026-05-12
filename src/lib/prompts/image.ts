/**
 * Prompts for image generation and scene creation.
 */

export function buildImageGenerationPrompt(scenePrompt: string): string {
  return `Generate a high-quality, realistic photograph of this scene for an English B1 exam description: ${scenePrompt}. MUST include 1-2 visible people performing a relevant action. NO empty landscapes, no abstract scenes, no images without people.`;
}

export function buildImageScenePrompt(
  topic: string,
  difficulty: string,
  level: 'b1' | 'b2' = 'b1'
): string {
  const base = `
    Eres un examinador de Cambridge B1.
    Describe una escena relacionada con el tema "${topic}" con una dificultad "${difficulty}".

    Instrucciones de Respuesta:
    1. La escena debe ser perfecta para el "Speaking Part 2" (Describing a photo).
    2. Genera un "topic" corto y descriptivo.
    3. Genera una "description" detallada en INGLÉS de lo que ocurre en la imagen.
    4. Genera un "image_prompt" optimizado para un generador de imágenes IA.
       El image_prompt MUST include: "1-2 visible people performing a relevant action".
       NO empty landscapes, no abstract scenes, no images without people.

    Devuelve la respuesta estrictamente en formato JSON.
  `;

  if (level === 'b2') {
    return `${base}
    IMPORTANT — B2 FIRST LEVEL REQUIREMENTS:
    - The scene MUST show a complex situation with multiple subjects (2-4 people) in a meaningful interaction
    - Include visual details that imply an unspoken story or relationship between subjects
    - The setting should provide contextual clues (workplace, public space, special occasion)
    - Avoid simple or static compositions — the image must spark comparison or inference
    `;
  }

  return base;
}

export function buildB2ImageEvaluationContext(): string {
  return `IMPORTANT — Evaluate at B2 First level. Deduct 10 points per significant grammatical error. Award bonus points (up to 5) for B2+ vocabulary (advanced adjectives, complex structures). Require minimum 60 seconds of description (penalize very short answers). B2 candidates should identify relationships between subjects and make inferences.`;
}
