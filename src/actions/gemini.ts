'use server';

import { Type, Part } from '@google/genai';

import { MODELS } from '@/lib/models';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { getOrCreateCachedContent } from '@/lib/cache';
import { callGemini, safeParseFallback } from '@/lib/gemini-client';
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
import { pickVocabulary, wordsToPromptVars, type CefrLevel } from '@/lib/vocabulary';

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

/** Generates high-quality speech for a given text using Gemini's native audio output. */
export async function generateSpeechAction(text: string): Promise<{ data: string; mimeType: string }> {
  const fallback = { data: '', mimeType: 'audio/L16;codec=pcm;rate=24000' };

  const cached = await getOrCreateCachedContent<{ data: string; mimeType: string }>(
    { kind: 'tts', promptKey: 'gemini-speech', inputs: { text, voice: 'Sadaltager' } },
    async () => {
      const result = await callGemini(
        { promptKey: 'gemini-speech', model: MODELS.TTS },
        (ai) => ai.models.generateContent({
          model: MODELS.TTS,
          contents: [{ role: 'user', parts: [{ text: `Read this phrase aloud with clear pronunciation: "${text}"` }] }],
          config: {
            responseModalities: ['audio'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Sadaltager' },
              },
            },
          },
        })
      );

      if (!result.ok) {
        console.error(JSON.stringify({ event: 'generateSpeechAction', error: result.error }));
        return fallback;
      }

      const audioPart = result.data.candidates?.[0]?.content?.parts?.find((p: Part) => p.inlineData);

      if (!audioPart?.inlineData?.data) {
        console.error(JSON.stringify({ event: 'generateSpeechAction', error: 'No audio data in response' }));
        return fallback;
      }

      return {
        data: audioPart.inlineData.data,
        mimeType: audioPart.inlineData.mimeType || 'audio/L16;codec=pcm;rate=24000',
      };
    },
    { storeAs: 'json' }
  );

  if ('error' in cached) {
    console.error(JSON.stringify({ event: 'generateSpeechAction_cache', error: cached.error }));
    return fallback;
  }
  return cached;
}

/**
 * Generates 10 progressive phrases based on a user-provided topic and CEFR level.
 * For B1/B2, 10 official Cambridge words are pre-picked from `bob_vocabulary`
 * and injected as `{WORD_1..10}` to kill few-shot anchoring and guarantee
 * variety across sessions (see .sdd/sessions/2026-05-17-starters-pointing-rework.md §3).
 */
export async function generateTopicPhrasesAction(
  topic: string,
  level: CefrLevel = 'a2',
): Promise<string[]> {
  const promptKey = `generic_situation_${level}_generation`;

  const promptVars: Record<string, string> = { TOPIC: topic };
  if (level === 'b1' || level === 'b2') {
    const picked = await pickVocabulary({ cefr_level: level, count: 10 });
    Object.assign(promptVars, wordsToPromptVars(picked.map((p) => p.word)));
  }
  const prompt = await getPrompt(promptKey, promptVars);

  const result = await callGemini(
    { promptKey, model: MODELS.FLASH_LITE_PREVIEW },
    (ai) => ai.models.generateContent({
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
              minItems: 10,
              maxItems: 10,
              description: 'Exactly 10 English phrases ordered easier → harder. Each phrase MUST contain the assigned WORD_N.',
            },
          },
          required: ['phrases'],
        },
      },
    })
  );

  if (!result.ok || !result.data.text) {
    console.error(JSON.stringify({ event: 'generateTopicPhrasesAction', error: result.ok ? 'empty response' : result.error }));
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.data.text);
  } catch {
    console.error(JSON.stringify({ event: 'generateTopicPhrasesAction', error: 'invalid JSON' }));
    return [];
  }
  const outcome = PhraseGenerationSchema.safeParse(parsed);
  if (!outcome.success) {
    console.error(JSON.stringify({ event: 'generateTopicPhrasesAction', error: 'schema validation failed', issues: outcome.error.issues }));
    return [];
  }
  if (outcome.data.phrases.length < 10) {
    console.error(JSON.stringify({ event: 'generateTopicPhrasesAction', error: 'fewer than 10 phrases', count: outcome.data.phrases.length }));
  }
  return outcome.data.phrases.slice(0, 10);
}

/**
 * Generates an image using Gemini Image model.
 */
export async function generateImageAction(prompt: string): Promise<string> {
  const fullPrompt = await getPrompt('generic_image_b1_image_gen', { SCENE_DESCRIPTION: prompt });

  const result = await callGemini(
    { promptKey: 'generic_image_b1_image_gen', model: MODELS.IMAGE },
    (ai) => ai.models.generateContent({
      model: MODELS.IMAGE,
      contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
      config: { responseModalities: ['IMAGE'] },
    })
  );

  if (!result.ok) {
    console.error(JSON.stringify({ event: 'generateImageAction', error: result.error }));
    return '';
  }

  const candidate = result.data.candidates?.[0];
  const imagePart = candidate?.content?.parts?.find((p: Part) => p.inlineData);

  if (!imagePart?.inlineData?.data) {
    console.error(JSON.stringify({ event: 'generateImageAction', error: 'no image data' }));
    return '';
  }

  return `data:${imagePart.inlineData.mimeType || 'image/png'};base64,${imagePart.inlineData.data}`;
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
  const fallbackScene: ImageScene = {
    topic,
    description: 'A busy street with people going about their day.',
    image_prompt: 'A busy street scene with people walking.',
  };

  const cached = await getOrCreateCachedContent<ImageScene>(
    { kind: 'scene', promptKey: 'generic-image-scene', inputs: { topic, difficulty, level } },
    async () => {
      const prompt = await getPrompt(
        level === 'b2' ? 'generic_image_b2_generation' : 'generic_image_b1_generation',
        { TOPIC: topic, DIFFICULTY: difficulty }
      );

      const result = await callGemini(
        { promptKey: level === 'b2' ? 'generic_image_b2_generation' : 'generic_image_b1_generation', model: MODELS.FLASH_LITE_LATEST },
        (ai) => ai.models.generateContent({
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
        })
      );

      if (!result.ok || !result.data.text) {
        console.error(JSON.stringify({ event: 'generateImageSceneAction', error: result.ok ? 'empty response' : result.error }));
        return fallbackScene;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(result.data.text);
      } catch {
        return fallbackScene;
      }
      return safeParseFallback(ImageSceneSchema, parsed, fallbackScene);
    },
    { storeAs: 'json' }
  );

  if ('error' in cached) {
    console.error(JSON.stringify({ event: 'generateImageSceneAction_cache', error: cached.error }));
    return fallbackScene;
  }
  return cached;
}

export async function evaluateImageDescriptionAction(
  audioBase64: string,
  mimeType: string,
  sceneDescription: string,
  level: 'b1' | 'b2' = 'b1'
): Promise<EvaluationResult> {
  const fallback: EvaluationResult = {
    score: 0,
    feedback: 'Unable to evaluate at this time. Please try again.',
    transcribed_text: '',
  };

  const prompt = await getPrompt(
    level === 'b2' ? 'generic_image_b2_evaluation' : 'generic_image_b1_evaluation',
    { SCENE_DESCRIPTION: sceneDescription, AUDIO_DURATION_SECONDS: 0 }
  );

  const result = await callGemini(
    { promptKey: level === 'b2' ? 'generic_image_b2_evaluation' : 'generic_image_b1_evaluation', model: MODELS.FLASH_LITE_PREVIEW },
    (ai) => ai.models.generateContent({
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
    })
  );

  if (!result.ok || !result.data.text) {
    console.error(JSON.stringify({ event: 'evaluateImageDescriptionAction', error: result.ok ? 'empty response' : result.error }));
    return fallback;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.data.text);
  } catch {
    return fallback;
  }
  return safeParseFallback(ImageDescriptionEvaluationSchema, parsed, fallback);
}

export async function evaluatePronunciationAction(
  audioBase64: string,
  mimeType: string,
  targetPhrase: string,
  level: CefrLevel = 'a2',
): Promise<EvaluationResult> {
  const fallback: EvaluationResult = {
    score: 0,
    feedback: 'Unable to evaluate at this time. Please try again.',
    transcribed_text: '',
  };

  const promptKey = `generic_situation_${level}_evaluation`;
  const prompt = await getPrompt(promptKey, { TARGET_PHRASE: targetPhrase, AUDIO_DURATION_SECONDS: 0 });

  const result = await callGemini(
    { promptKey, model: MODELS.FLASH_LITE_PREVIEW },
    (ai) => ai.models.generateContent({
      model: MODELS.FLASH_LITE_PREVIEW,
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { mimeType, data: audioBase64 } },
          ],
        },
      ],
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
    })
  );

  if (!result.ok || !result.data.text) {
    console.error(JSON.stringify({ event: 'evaluatePronunciationAction', error: result.ok ? 'empty response' : result.error }));
    return fallback;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.data.text);
  } catch {
    return fallback;
  }
  return safeParseFallback(PronunciationEvaluationSchema, parsed, fallback);
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
