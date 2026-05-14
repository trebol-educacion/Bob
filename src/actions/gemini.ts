'use server';

import { GoogleGenAI, Type, Part } from '@google/genai';
import { MODELS } from '@/lib/models';
import { getPrompt } from '@/lib/prompts/db-prompts';
import {
  PhraseGenerationSchema,
  ImageSceneSchema,
  PronunciationEvaluationSchema,
  ImageDescriptionEvaluationSchema,
  ChatTurnSchema,
  InitialChatResponse,
  SimulatedConversationResponse,
  QuestionsResponse,
} from '@/lib/types/gemini';

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error('GEMINI_API_KEY is not defined in environment variables');
}

const ai = new GoogleGenAI({ apiKey });

export interface EvaluationResult {
  score: number;
  feedback: string;
  transcribed_text: string;
  model_answer?: string;
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
      model: MODELS.TTS,
      contents: [{ role: 'user', parts: [{ text: `Read this phrase aloud with clear pronunciation: "${text}"` }] }],
      config: {
        responseModalities: ['audio'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: 'Sadaltager',
            },
          },
        },
      },
    });

    const audioPart = response.candidates?.[0]?.content?.parts?.find((p: Part) => p.inlineData);

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
  const prompt = await getPrompt('generic_situation_a2_generation', { TOPIC: topic });

  try {
    const response = await ai.models.generateContent({
      model: MODELS.FLASH_LITE_PREVIEW,
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

    const result = PhraseGenerationSchema.parse(JSON.parse(response.text));
    return result.phrases.slice(0, 10);
  } catch (error) {
    console.error('Error generating topic phrases:', error);
    throw error;
  }
}

/**
 * Generates an image using Gemini Image model.
 */
export async function generateImageAction(prompt: string): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: MODELS.IMAGE,
      contents: [{
        role: 'user',
        parts: [{ text: await getPrompt('generic_image_b1_image_gen', { SCENE_DESCRIPTION: prompt }) }]
      }],
      config: {
        responseModalities: ['IMAGE'],
      },
    });

    const candidate = response.candidates?.[0];
    const imagePart = candidate?.content?.parts?.find((p: Part) => p.inlineData);

    if (!imagePart?.inlineData?.data) {
      throw new Error('No image data received from Gemini');
    }

    return `data:${imagePart.inlineData.mimeType || 'image/png'};base64,${imagePart.inlineData.data}`;
  } catch (error) {
    console.error('Error generating image:', error);
    throw error;
  }
}

/**
 * Generates a scene for Speaking description practice.
 * Supports B1 (default) and B2 First difficulty levels.
 */
export async function generateImageSceneAction(
  topic: string = 'Daily Life',
  difficulty: string = 'intermediate',
  level: 'b1' | 'b2' = 'b1'
): Promise<ImageScene> {
  const prompt = await getPrompt(
    level === 'b2' ? 'generic_image_b2_generation' : 'generic_image_b1_generation',
    { TOPIC: topic, DIFFICULTY: difficulty }
  );

  try {
    const response = await ai.models.generateContent({
      model: MODELS.FLASH_LITE_LATEST,
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
    return ImageSceneSchema.parse(JSON.parse(response.text));
  } catch (error) {
    console.error('Error generating image scene:', error);
    throw error;
  }
}

export async function evaluateImageDescriptionAction(
  audioBase64: string,
  mimeType: string,
  sceneDescription: string,
  level: 'b1' | 'b2' = 'b1'
): Promise<EvaluationResult> {
  const prompt = await getPrompt(
    level === 'b2' ? 'generic_image_b2_evaluation' : 'generic_image_b1_evaluation',
    { SCENE_DESCRIPTION: sceneDescription, AUDIO_DURATION_SECONDS: 0 }
  );

  try {
    const response = await ai.models.generateContent({
      model: MODELS.FLASH_LITE_PREVIEW,
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
            model_answer: { type: Type.STRING },
          },
          required: ['score', 'feedback', 'transcribed_text', 'details'],
        },
      },
    });

    if (!response.text) throw new Error('No response from Gemini');
    return ImageDescriptionEvaluationSchema.parse(JSON.parse(response.text));
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
  const prompt = await getPrompt('generic_situation_a2_evaluation', { TARGET_PHRASE: targetPhrase, AUDIO_DURATION_SECONDS: 0 });

  try {
    const response = await ai.models.generateContent({
      model: MODELS.FLASH_LITE_PREVIEW,
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
    return PronunciationEvaluationSchema.parse(JSON.parse(response.text));
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
 * Falls back gracefully — intentional fallback, do NOT convert to throw.
 */
export async function generateInitialChatAction(topic: string): Promise<InitialChatResult> {
  const prompt = await getPrompt('generic_conversation_shared_initial', { TOPIC: topic, CEFR_LEVEL: 'b1' });

  try {
    const response = await ai.models.generateContent({
      model: MODELS.FLASH_LITE_PREVIEW,
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
    return JSON.parse(response.text) as InitialChatResponse;
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
 * Falls back gracefully — intentional fallback, do NOT convert to throw.
 */
export async function simulateConversationAction(
  history: ChatMessage[],
  topic: string
): Promise<ChatMessage[]> {
  const prompt = await getPrompt('generic_conversation_shared_simulate', { TOPIC: topic, CEFR_LEVEL: 'b1', USER_TURN: '', HISTORY: '' });

  try {
    const response = await ai.models.generateContent({
      model: MODELS.FLASH_LITE_PREVIEW,
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
    const result = JSON.parse(response.text) as SimulatedConversationResponse;
    return result.full_history;
  } catch (error) {
    console.error('Error simulating conversation:', error);
    return history;
  }
}

/**
 * Generates comprehension questions based on the conversation history.
 * Falls back gracefully — intentional fallback, do NOT convert to throw.
 */
export async function generateQuestionsAction(
  history: ChatMessage[],
  topic: string
): Promise<Question[]> {
  const historyText = history.map(m => `${m.role}: ${m.text}`).join('\n');
  const prompt = await getPrompt('generic_conversation_shared_questions', { TRANSCRIPT: historyText, CEFR_LEVEL: 'b1' });

  try {
    const response = await ai.models.generateContent({
      model: MODELS.FLASH_LITE_PREVIEW,
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
    const result = JSON.parse(response.text) as QuestionsResponse;
    return result.questions;
  } catch (error) {
    console.error('Error generating questions:', error);
    return [];
  }
}

/**
 * Simulates a response from the user's perspective to continue the conversation.
 * Falls back gracefully — intentional fallback, do NOT convert to throw.
 */
export async function simulateUserResponseAction(
  history: ChatMessage[],
  topic: string
): Promise<string> {
  const prompt = await getPrompt('generic_conversation_shared_simulate_user', { TOPIC: topic, CEFR_LEVEL: 'b1', LAST_TURN: '' });

  try {
    const response = await ai.models.generateContent({
      model: MODELS.FLASH_LITE_PREVIEW,
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
  const prompt = await getPrompt('generic_conversation_shared_eval_audio', { TOPIC: topic, CEFR_LEVEL: 'b1' });

  try {
    const response = await ai.models.generateContent({
      model: MODELS.FLASH_LITE_PREVIEW,
      contents: [
        ...history.map(msg => ({
          role: msg.role,
          parts: [{ text: msg.text }]
        })),
        {
          role: 'user',
          parts: [{ text: prompt }]
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
    const result = ChatTurnSchema.parse(JSON.parse(response.text));

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
  const prompt = await getPrompt('generic_conversation_shared_eval_audio', { TOPIC: topic, CEFR_LEVEL: 'b1' });

  try {
    // 1. Get Evaluation and Text Response
    const response = await ai.models.generateContent({
      model: MODELS.FLASH_LITE_PREVIEW,
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
    const result = ChatTurnSchema.parse(JSON.parse(response.text));

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
