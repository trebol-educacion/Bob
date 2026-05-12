/**
 * Prompts for all conversation-related actions.
 */

import { ChatMessage } from '@/actions/gemini';

export function buildInitialChatPrompt(topic: string): string {
  return `
    Eres un diseñador de simulaciones de conversación en inglés. El usuario quiere practicar: "${topic}".

    Tu tarea es crear el escenario inicial en dos partes:
    1. "framing": Una breve descripción en ESPAÑOL que sitúe al usuario (ej: "Estás en el backstage de un evento tecnológico, el moderador se acerca a ti...").
    2. "message": La primera frase que el personaje dice en INGLÉS para iniciar la conversación. DEBE ser natural y directa, sin introducciones de IA.

    Devuelve la respuesta estrictamente en formato JSON.
  `;
}

export function buildSimulateConversationPrompt(topic: string): string {
  return `
    Eres un experto en simulaciones de inglés. El usuario ha terminado una conversación sobre "${topic}" antes de tiempo.
    Basado en el historial actual, simula de 3 a 4 turnos adicionales (intercambios entre 'user' y 'model') para completar una conversación natural de unos 6 turnos en total.

    Importante:
    - Mantén la coherencia con lo que ya se ha hablado.
    - Devuelve el historial COMPLETO (los mensajes originales + los simulados).

    Devuelve la respuesta estrictamente en formato JSON.
  `;
}

export function buildGenerateQuestionsPrompt(history: ChatMessage[], topic: string): string {
  return `
    Eres un examinador de inglés. Basado en la siguiente conversación sobre "${topic}", genera 3 o 4 preguntas de comprensión auditiva.

    Historial:
    ${history.map(m => `${m.role}: ${m.text}`).join('\n')}

    Instrucciones:
    1. Las preguntas deben ser en INGLÉS.
    2. Deben evaluar si el usuario ha entendido los detalles de la conversación.
    3. Proporciona también la respuesta correcta esperada (muy breve).

    Devuelve la respuesta estrictamente en formato JSON.
  `;
}

export function buildSimulateUserResponsePrompt(topic: string): string {
  return `
    Eres el usuario en una simulación de conversación sobre "${topic}".
    Basado en el historial actual, genera una respuesta natural y breve en INGLÉS que tú (como usuario) dirías para continuar la conversación.

    Importante:
    - Responde solo con el texto de la respuesta.
    - Que sea una respuesta realista para un estudiante de nivel B1/B2.
  `;
}

export function buildChatConversationPrompt(topic: string): string {
  return `
    Eres un interlocutor nativo de inglés en una SIMULACIÓN REAL sobre: "${topic}".

    Tu tarea:
    1. Evalúa el último audio del usuario (en segundo plano):
       - Transcribe el audio.
       - Puntuación (0-100): Evalúa la fluidez y naturalidad dentro del contexto "${topic}".
       - Feedback: Muy breve y motivador.
    2. Responde para continuar la simulación:
       - MANTÉN EL PERSONAJE. No salgas del rol.
       - Responde en INGLÉS natural, como lo haría una persona real en esa situación.
       - Haz que la conversación avance de forma lógica.

    Devuelve la respuesta estrictamente en formato JSON.
  `;
}

export function buildChatTextConversationPrompt(topic: string, userText: string): string {
  return `User says: "${userText}"

    Eres un interlocutor nativo de inglés en una SIMULACIÓN REAL sobre: "${topic}".

    Tu tarea:
    1. Evalúa el texto enviado por el usuario:
       - Puntuación (0-100): Basada en gramática, vocabulario y adecuación al contexto "${topic}".
       - Feedback: Muy breve y motivador.
    2. Responde para continuar la simulación:
       - MANTÉN EL PERSONAJE.
       - Responde en INGLÉS natural.

    Devuelve la respuesta estrictamente en formato JSON.
  `;
}
