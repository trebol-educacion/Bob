/**
 * Prompts for phrase generation (situation mode).
 */

export function buildTopicPhrasesPrompt(topic: string): string {
  return `
    Eres un diseñador de currículos de inglés experto.
    Genera una lista de 10 frases en inglés para practicar, basadas en el siguiente tema: "${topic}".

    Instrucciones:
    1. Las frases deben formar una progresión lógica o una pequeña historia relacionada con el tema.
    2. Deben variar en dificultad, empezando por algo sencillo y aumentando gradualmente.
    3. Asegúrate de que el lenguaje sea natural y útil para el contexto solicitado.

    Devuelve la respuesta estrictamente en formato JSON.
  `;
}
