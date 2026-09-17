'use server';

import { Type } from '@google/genai';
import { MODELS } from '@/lib/models';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { callGemini } from '@/lib/gemini-client';
import { ChatTurnSchema, InitialChatResponse, SimulatedConversationResponse, QuestionsResponse } from '@/lib/types/gemini';
import type { ChatMessage, ChatTurnResult, InitialChatResult, Question } from './types';
import { generateSpeechAction } from './speech';

/**
 * Generates a structured initial framing and first message for the simulation.
 * Falls back gracefully — intentional fallback, do NOT convert to throw.
 */
export async function generateInitialChatAction(topic: string): Promise<InitialChatResult> {
  const defaultResult: InitialChatResult = {
    framing: 'La conversación está lista.',
    message: "Hello! I'm ready to start when you are.",
  };

  const prompt = await getPrompt('generic_conversation_shared_initial', { TOPIC: topic, CEFR_LEVEL: 'b1' });

  const result = await callGemini(
    { promptKey: 'generic_conversation_shared_initial', model: MODELS.FLASH_LITE_PREVIEW },
    (ai) => ai.models.generateContent({
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
    })
  );

  if (!result.ok || !result.data.text) return defaultResult;

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.data.text);
  } catch {
    return defaultResult;
  }
  return (parsed as InitialChatResponse) ?? defaultResult;
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

  const result = await callGemini(
    { promptKey: 'generic_conversation_shared_simulate', model: MODELS.FLASH_LITE_PREVIEW },
    (ai) => ai.models.generateContent({
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
    })
  );

  if (!result.ok || !result.data.text) return history;

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.data.text);
  } catch {
    return history;
  }
  return (parsed as SimulatedConversationResponse).full_history ?? history;
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

  const result = await callGemini(
    { promptKey: 'generic_conversation_shared_questions', model: MODELS.FLASH_LITE_PREVIEW },
    (ai) => ai.models.generateContent({
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
    })
  );

  if (!result.ok || !result.data.text) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.data.text);
  } catch {
    return [];
  }
  return (parsed as QuestionsResponse).questions ?? [];
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

  const result = await callGemini(
    { promptKey: 'generic_conversation_shared_simulate_user', model: MODELS.FLASH_LITE_PREVIEW },
    (ai) => ai.models.generateContent({
      model: MODELS.FLASH_LITE_PREVIEW,
      contents: [
        ...history.map(msg => ({
          role: msg.role,
          parts: [{ text: msg.text }]
        })),
        { role: 'user', parts: [{ text: prompt }] }
      ],
    })
  );

  if (!result.ok) return "That's interesting, tell me more.";
  return result.data.text?.trim() || "I'm not sure what to say.";
}

/**
 * Handles a text-based turn in an interactive conversation.
 */
export async function chatTextConversationAction(
  userText: string,
  history: ChatMessage[],
  topic: string
): Promise<ChatTurnResult> {
  const fallback: ChatTurnResult = {
    evaluation: { score: 0, feedback: 'Unable to evaluate. Please try again.', transcribed_text: userText },
    ai_response: "I'm sorry, I couldn't process that. Could you try again?",
  };

  const prompt = await getPrompt('generic_conversation_shared_eval_audio', { TOPIC: topic, CEFR_LEVEL: 'b1' });

  const result = await callGemini(
    { promptKey: 'generic_conversation_shared_eval_audio', model: MODELS.FLASH_LITE_PREVIEW },
    (ai) => ai.models.generateContent({
      model: MODELS.FLASH_LITE_PREVIEW,
      contents: [
        ...history.map(msg => ({
          role: msg.role,
          parts: [{ text: msg.text }]
        })),
        { role: 'user', parts: [{ text: prompt }] }
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
    })
  );

  if (!result.ok || !result.data.text) return fallback;

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.data.text);
  } catch {
    return fallback;
  }

  const validated = ChatTurnSchema.safeParse(parsed);
  if (!validated.success) return fallback;

  const speech = await generateSpeechAction(validated.data.ai_response);

  return {
    evaluation: { ...validated.data.evaluation, transcribed_text: userText },
    ai_response: validated.data.ai_response,
    ai_audio: speech.data ? speech : undefined,
  };
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
  const fallback: ChatTurnResult = {
    evaluation: { score: 0, feedback: 'Unable to evaluate. Please try again.', transcribed_text: '' },
    ai_response: "I'm sorry, I couldn't process that. Could you try again?",
  };

  const prompt = await getPrompt('generic_conversation_shared_eval_audio', { TOPIC: topic, CEFR_LEVEL: 'b1' });

  const result = await callGemini(
    { promptKey: 'generic_conversation_shared_eval_audio', model: MODELS.FLASH_LITE_PREVIEW },
    (ai) => ai.models.generateContent({
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
    })
  );

  if (!result.ok || !result.data.text) return fallback;

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.data.text);
  } catch {
    return fallback;
  }

  const validated = ChatTurnSchema.safeParse(parsed);
  if (!validated.success) return fallback;

  const speech = await generateSpeechAction(validated.data.ai_response);

  return {
    evaluation: validated.data.evaluation,
    ai_response: validated.data.ai_response,
    ai_audio: speech.data ? speech : undefined,
  };
}

