import { NextRequest } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';
import { streamGemini } from '@/lib/gemini-client';
import { getPrompt } from '@/lib/prompts/db-prompts';
import { MODELS } from '@/lib/models';
import { MODE_PROMPT_KEY } from '@/lib/practice/mode-prompt-key';
import type { PracticeActivityMode, PracticeSeed } from '@/lib/practice/types';
import type { CefrLevel } from '@/lib/types/practice';

export const runtime = 'nodejs';

interface InitialTurnRequestBody {
  mode: PracticeActivityMode;
  seed: PracticeSeed;
  level: CefrLevel;
}

function isValidBody(body: unknown): body is InitialTurnRequestBody {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  if (typeof b.mode !== 'string' || !(b.mode in MODE_PROMPT_KEY)) return false;
  if (!b.level || typeof b.level !== 'string') return false;
  const seed = b.seed as Record<string, unknown> | undefined;
  if (!seed || typeof seed.topic !== 'string' || typeof seed.character !== 'string') return false;
  return true;
}

/** @param req NextRequest */
export async function POST(req: NextRequest): Promise<Response> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid body', { status: 400 });
  }
  if (!isValidBody(body)) return new Response('Invalid body', { status: 400 });

  const { mode, seed, level } = body;
  const promptKey = MODE_PROMPT_KEY[mode];
  const prompt = await getPrompt(promptKey, {
    TOPIC: seed.topic,
    CEFR_LEVEL: level,
    CHARACTER: seed.character,
  });

  const started = await streamGemini(
    { promptKey, model: MODELS.FLASH_LITE, userId: user.id },
    (ai) => ai.models.generateContentStream({
      model: MODELS.FLASH_LITE,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    })
  );

  if (!started.ok) return new Response('', { status: 200 });

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of started.stream) {
          if (chunk.text) controller.enqueue(encoder.encode(chunk.text));
        }
      } catch (error) {
        console.error(JSON.stringify({ event: 'gemini_stream_error', promptKey, error: String(error) }));
      } finally {
        controller.close();
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
