/**
 * Prompts for image generation and scene creation.
 */

export function buildImageGenerationPrompt(scenePrompt: string): string {
  return `Generate a high-quality, realistic photograph of this scene for an English B1 exam description: ${scenePrompt}. MUST include 1-2 visible people performing a relevant action. NO empty landscapes, no abstract scenes, no images without people.`;
}

export function buildImageScenePrompt(topic: string, difficulty: string): string {
  return `
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
}
