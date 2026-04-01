'use server';

import { GoogleGenAI, Type } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error('GEMINI_API_KEY is not defined in environment variables');
}

const ai = new GoogleGenAI({ apiKey });

export interface EvaluationResult {
  score: number;
  feedback: string;
  transcribed_text: string;
  details?: {
    content_coverage?: string;
    duration_feedback?: string;
    clarity?: string;
    improvement_tips?: string[];
  };
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface ChatTurnResult {
  evaluation: EvaluationResult;
  ai_response: string;
  ai_audio?: { data: string; mimeType: string };
}

export interface ImageScene {
  description: string;
  image_prompt: string;
  topic: string;
  image_data?: string;
}

/**
 * Generates high-quality speech for a given text using Gemini's native audio output.
 */
export async function generateSpeechAction(text: string): Promise<{ data: string; mimeType: string }> {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: [{ role: 'user', parts: [{ text: `Read this phrase aloud with clear pronunciation: "${text}"` }] }],
      config: {
        responseModalities: ['audio'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: 'aoede',
            },
          },
        },
      },
    });

    const audioPart = response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);

    if (!audioPart?.inlineData?.data) {
      throw new Error('No audio data received from Gemini');
    }

    return {
      data: audioPart.inlineData.data,
      mimeType: audioPart.inlineData.mimeType || 'audio/L16;codec=pcm;rate=24000',
    };
  } catch (error) {
    console.error('Error generating speech:', error);
    throw error;
  }
}

/**
 * Generates 10 progressive phrases based on a user-provided topic.
 */
export async function generateTopicPhrasesAction(topic: string): Promise<string[]> {
  const prompt = `
    Eres un diseñador de currículos de inglés experto.
    Genera una lista de 10 frases en inglés para practicar, basadas en el siguiente tema: "${topic}".
    
    Instrucciones:
    1. Las frases deben formar una progresión lógica o una pequeña historia relacionada con el tema.
    2. Deben variar en dificultad, empezando por algo sencillo y aumentando gradualmente.
    3. Asegúrate de que el lenguaje sea natural y útil para el contexto solicitado.
    
    Devuelve la respuesta estrictamente en formato JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            phrases: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Lista de 10 frases en inglés',
            },
          },
          required: ['phrases'],
        },
      },
    });

    if (!response.text) {
      throw new Error('No response from Gemini');
    }

    const result = JSON.parse(response.text) as { phrases: string[] };
    return result.phrases.slice(0, 10);
  } catch (error) {
    console.error('Error generating topic phrases:', error);
    throw error;
  }
}

/**
 * Generates an image using NanoBanana 2 (Gemini 3.1 Flash Image)
 */
export async function generateImageAction(prompt: string): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: [{ 
        role: 'user', 
        parts: [{ text: `Generate a high-quality, realistic photograph of this scene for an English B1 exam description: ${prompt}` }] 
      }],
      config: {
        // @ts-ignore
        responseModalities: ['IMAGE'],
      },
    });

    const candidate = response.candidates?.[0];
    const imagePart = candidate?.content?.parts?.find((p: any) => p.inlineData);

    if (!imagePart?.inlineData?.data) {
      throw new Error('No image data received from Gemini NanoBanana');
    }

    return `data:${imagePart.inlineData.mimeType || 'image/png'};base64,${imagePart.inlineData.data}`;
  } catch (error) {
    console.error('Error generating image with NanoBanana:', error);
    throw error;
  }
}

/**
 * Generates a daily life scene for B1 Speaking description practice.
 */
export async function generateImageSceneAction(
  topic: string = 'Daily Life',
  difficulty: string = 'intermediate'
): Promise<ImageScene> {
  const prompt = `
    Eres un examinador de Cambridge B1.
    Describe una escena relacionada con el tema "${topic}" con una dificultad "${difficulty}".
    
    Instrucciones de Respuesta:
    1. La escena debe ser perfecta para el "Speaking Part 2" (Describing a photo).
    2. Genera un "topic" corto y descriptivo.
    3. Genera una "description" detallada en INGLÉS de lo que ocurre en la imagen.
    4. Genera un "image_prompt" optimizado para un generador de imágenes IA.
    
    Devuelve la respuesta estrictamente en formato JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            topic: { type: Type.STRING },
            description: { type: Type.STRING },
            image_prompt: { type: Type.STRING },
          },
          required: ['topic', 'description', 'image_prompt'],
        },
      },
    });

    if (!response.text) throw new Error('No response from Gemini');
    return JSON.parse(response.text) as ImageScene;
  } catch (error) {
    console.error('Error generating image scene:', error);
    throw error;
  }
}

export async function evaluateImageDescriptionAction(
  audioBase64: string,
  mimeType: string,
  sceneDescription: string
): Promise<EvaluationResult> {
  const prompt = `
    Eres un examinador de Cambridge B1 experto.
    Evalúa la descripción de una imagen realizada por el usuario en audio.
    Contexto de la imagen: "${sceneDescription}"
    Devuelve la respuesta estrictamente en formato JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
      contents: {
        parts: [
          { inlineData: { data: audioBase64, mimeType: mimeType } },
          { text: prompt },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER },
            feedback: { type: Type.STRING },
            transcribed_text: { type: Type.STRING },
            details: {
              type: Type.OBJECT,
              properties: {
                content_coverage: { type: Type.STRING },
                duration_feedback: { type: Type.STRING },
                clarity: { type: Type.STRING },
                improvement_tips: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
              required: ['content_coverage', 'duration_feedback', 'clarity', 'improvement_tips'],
            },
          },
          required: ['score', 'feedback', 'transcribed_text', 'details'],
        },
      },
    });

    if (!response.text) throw new Error('No response from Gemini');
    return JSON.parse(response.text) as EvaluationResult;
  } catch (error) {
    console.error('Error evaluating image description:', error);
    throw error;
  }
}

export async function evaluatePronunciationAction(
  audioBase64: string,
  mimeType: string,
  targetPhrase: string
): Promise<EvaluationResult> {
  const prompt = `
    Eres un profesor de inglés experto y amigable, estilo Duolingo.
    Evalúa la pronunciación en inglés del usuario para la siguiente frase: "${targetPhrase}".
    Devuelve la respuesta estrictamente en formato JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
      contents: {
        parts: [
          { inlineData: { data: audioBase64, mimeType: mimeType } },
          { text: prompt },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER },
            feedback: { type: Type.STRING },
            transcribed_text: { type: Type.STRING },
          },
          required: ['score', 'feedback', 'transcribed_text'],
        },
      },
    });

    if (!response.text) throw new Error('No response from Gemini');
    return JSON.parse(response.text) as EvaluationResult;
  } catch (error) {
    console.error('Error evaluating pronunciation:', error);
    throw error;
  }
}

export interface InitialChatResult {
  framing: string;
  message: string;
}

/**
 * Generates a structured initial framing and first message for the simulation.
 */
export async function generateInitialChatAction(topic: string): Promise<InitialChatResult> {
  const prompt = `
    Eres un diseñador de simulaciones de conversación en inglés. El usuario quiere practicar: "${topic}".
    
    Tu tarea es crear el escenario inicial en dos partes:
    1. "framing": Una breve descripción en ESPAÑOL que sitúe al usuario (ej: "Estás en el backstage de un evento tecnológico, el moderador se acerca a ti...").
    2. "message": La primera frase que el personaje dice en INGLÉS para iniciar la conversación. DEBE ser natural y directa, sin introducciones de IA.
    
    Devuelve la respuesta estrictamente en formato JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            framing: { type: Type.STRING },
            message: { type: Type.STRING },
          },
          required: ['framing', 'message'],
        },
      },
    });

    if (!response.text) throw new Error('No response from Gemini');
    return JSON.parse(response.text) as InitialChatResult;
  } catch (error) {
    console.error('Error generating initial chat:', error);
    return {
      framing: "La conversación está lista.",
      message: "Hello! I'm ready to start when you are."
    };
  }
}

export interface Question {
  id: number;
  question: string;
  correct_answer: string;
}

/**
 * Simulates the remaining turns of a conversation if it was finished early.
 */
export async function simulateConversationAction(
  history: ChatMessage[],
  topic: string
): Promise<ChatMessage[]> {
  const prompt = `
    Eres un experto en simulaciones de inglés. El usuario ha terminado una conversación sobre "${topic}" antes de tiempo.
    Basado en el historial actual, simula de 3 a 4 turnos adicionales (intercambios entre 'user' y 'model') para completar una conversación natural de unos 6 turnos en total.
    
    Importante:
    - Mantén la coherencia con lo que ya se ha hablado.
    - Devuelve el historial COMPLETO (los mensajes originales + los simulados).
    
    Devuelve la respuesta estrictamente en formato JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            full_history: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  role: { type: Type.STRING, enum: ['user', 'model'] },
                  text: { type: Type.STRING },
                },
                required: ['role', 'text'],
              },
            },
          },
          required: ['full_history'],
        },
      },
    });

    if (!response.text) throw new Error('No response from Gemini');
    const result = JSON.parse(response.text) as { full_history: ChatMessage[] };
    return result.full_history;
  } catch (error) {
    console.error('Error simulating conversation:', error);
    return history;
  }
}

/**
 * Generates comprehension questions based on the conversation history.
 */
export async function generateQuestionsAction(
  history: ChatMessage[],
  topic: string
): Promise<Question[]> {
  const prompt = `
    Eres un examinador de inglés. Basado en la siguiente conversación sobre "${topic}", genera 3 o 4 preguntas de comprensión auditiva.
    
    Historial:
    ${history.map(m => `${m.role}: ${m.text}`).join('\n')}
    
    Instrucciones:
    1. Las preguntas deben ser en INGLÉS.
    2. Deben evaluar si el usuario ha entendido los detalles de la conversación.
    3. Proporciona también la respuesta correcta esperada (muy breve).
    
    Devuelve la respuesta estrictamente en formato JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.NUMBER },
                  question: { type: Type.STRING },
                  correct_answer: { type: Type.STRING },
                },
                required: ['id', 'question', 'correct_answer'],
              },
            },
          },
          required: ['questions'],
        },
      },
    });

    if (!response.text) throw new Error('No response from Gemini');
    const result = JSON.parse(response.text) as { questions: Question[] };
    return result.questions;
  } catch (error) {
    console.error('Error generating questions:', error);
    return [];
  }
}

/**
 * Simulates a response from the user's perspective to continue the conversation.
 */
export async function simulateUserResponseAction(
  history: ChatMessage[],
  topic: string
): Promise<string> {
  const prompt = `
    Eres el usuario en una simulación de conversación sobre "${topic}".
    Basado en el historial actual, genera una respuesta natural y breve en INGLÉS que tú (como usuario) dirías para continuar la conversación.
    
    Importante:
    - Responde solo con el texto de la respuesta.
    - Que sea una respuesta realista para un estudiante de nivel B1/B2.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
      contents: [
        ...history.map(msg => ({
          role: msg.role,
          parts: [{ text: msg.text }]
        })),
        { role: 'user', parts: [{ text: prompt }] }
      ],
    });

    return response.text?.trim() || "I'm not sure what to say.";
  } catch (error) {
    console.error('Error simulating user response:', error);
    return "That's interesting, tell me more.";
  }
}

/**
 * Handles a text-based turn in an interactive conversation.
 */
export async function chatTextConversationAction(
  userText: string,
  history: ChatMessage[],
  topic: string
): Promise<ChatTurnResult> {
  const prompt = `
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

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
      contents: [
        ...history.map(msg => ({
          role: msg.role,
          parts: [{ text: msg.text }]
        })),
        {
          role: 'user',
          parts: [{ text: `User says: "${userText}"\n\n${prompt}` }]
        }
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            evaluation: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.NUMBER },
                feedback: { type: Type.STRING },
                transcribed_text: { type: Type.STRING },
              },
              required: ['score', 'feedback', 'transcribed_text'],
            },
            ai_response: { type: Type.STRING },
          },
          required: ['evaluation', 'ai_response'],
        },
      },
    });

    if (!response.text) throw new Error('No response from Gemini');
    const result = JSON.parse(response.text) as { evaluation: EvaluationResult, ai_response: string };

    // Generate AI Speech for the response
    const speech = await generateSpeechAction(result.ai_response);

    return {
      evaluation: {
        ...result.evaluation,
        transcribed_text: userText // Use original text
      },
      ai_response: result.ai_response,
      ai_audio: speech
    };
  } catch (error) {
    console.error('Error in text conversation:', error);
    throw error;
  }
}

/**
 * Handles a turn in an interactive conversation.
 */
export async function chatConversationAction(
  audioBase64: string,
  mimeType: string,
  history: ChatMessage[],
  topic: string
): Promise<ChatTurnResult> {
  const prompt = `
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

  try {
    // 1. Get Evaluation and Text Response
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
      contents: [
        ...history.map(msg => ({
          role: msg.role,
          parts: [{ text: msg.text }]
        })),
        {
          role: 'user',
          parts: [
            { inlineData: { data: audioBase64, mimeType: mimeType } },
            { text: prompt }
          ]
        }
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            evaluation: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.NUMBER },
                feedback: { type: Type.STRING },
                transcribed_text: { type: Type.STRING },
              },
              required: ['score', 'feedback', 'transcribed_text'],
            },
            ai_response: { type: Type.STRING },
          },
          required: ['evaluation', 'ai_response'],
        },
      },
    });

    if (!response.text) throw new Error('No response from Gemini');
    const result = JSON.parse(response.text) as { evaluation: EvaluationResult, ai_response: string };

    // 2. Generate AI Speech for the response
    const speech = await generateSpeechAction(result.ai_response);

    return {
      evaluation: result.evaluation,
      ai_response: result.ai_response,
      ai_audio: speech
    };
  } catch (error) {
    console.error('Error in chat conversation:', error);
    throw error;
  }
}
