import { NextRequest } from 'next/server';
import { Type } from '@google/genai';
import { createSupabaseServer } from '@/lib/supabase/server';
import { streamGemini } from '@/lib/gemini-client';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { MODELS } from '@/lib/models';
import { MODE_PROMPT_KEY } from '@/lib/practice/mode-prompt-key';
import type { PracticeActivityMode, PracticeSeed } from '@/lib/practice/types';
import type { CefrLevel } from '@/lib/types/practice';

export const maxDuration = 60;

const CEFR_LEVELS: readonly string[] = ['pre_a1', 'a1', 'a2', 'b1', 'b2', 'c1', 'c2'];

interface InitialTurnRequestBody {
  mode: PracticeActivityMode;
  seed: PracticeSeed;
  level: CefrLevel;
}

function isValidBody(body: unknown): body is InitialTurnRequestBody {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  if (typeof b.mode !== 'string' || !(b.mode in MODE_PROMPT_KEY)) return false;
  if (typeof b.level !== 'string' || !CEFR_LEVELS.includes(b.level)) return false;
  const seed = b.seed as Record<string, unknown> | undefined;
  if (!seed || typeof seed.topic !== 'string' || typeof seed.character !== 'string') return false;
  return true;
}

function errorResponse(status: number, code: string, retryable: boolean): Response {
  return Response.json({ code, retryable }, { status, headers: { 'Cache-Control': 'no-store' } });
}

/** @param req NextRequest */
export async function POST(req: NextRequest): Promise<Response> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return errorResponse(401, 'unauthenticated', false);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, 'invalid_body', false);
  }
  if (!isValidBody(body)) return errorResponse(400, 'invalid_body', false);

  const { mode, seed, level } = body;
  const promptKey = MODE_PROMPT_KEY[mode];

  let prompt: string;
  try {
    prompt = await getPrompt(promptKey, {
      TOPIC: seed.topic,
      CEFR_LEVEL: level,
      CHARACTER: seed.character,
    });
  } catch (error) {
    console.error(JSON.stringify({ event: 'initial_turn_prompt_failed', promptKey, error: String(error) }));
    return errorResponse(503, 'prompt_unavailable', true);
  }

  const started = await streamGemini(
    { promptKey, model: MODELS.FLASH_LITE, userId: user.id },
    (ai) => ai.models.generateContentStream({
      model: MODELS.FLASH_LITE,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: { framing: { type: Type.STRING }, message: { type: Type.STRING } },
          required: ['framing', 'message'],
          propertyOrdering: ['framing', 'message'],
        },
      },
    })
  );

  if (!started.ok) return errorResponse(502, started.code, started.retryable);

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of started.stream) {
          if (chunk.text) controller.enqueue(encoder.encode(chunk.text));
        }
        controller.close();
      } catch (error) {
        console.error(JSON.stringify({ event: 'gemini_stream_error', promptKey, error: String(error) }));
        controller.error(error);
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
