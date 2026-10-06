import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';
import { inferSkillFromMode, inferModeMetadata } from '@/lib/skill-from-mode';
import { MAX_SECONDS_PER_TICK, clampSeconds } from '@/lib/usage/heartbeat';

export const runtime = 'nodejs';

interface UsagePayload {
  mode: string;
  seconds: number;
}

/**
 * @param value unknown
 * @returns UsagePayload | null
 */
function parsePayload(value: unknown): UsagePayload | null {
  if (typeof value !== 'object' || value === null) return null;
  const { mode, seconds } = value as Record<string, unknown>;
  if (typeof mode !== 'string' || mode.length === 0 || mode.length > 120) return null;
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return null;
  return { mode, seconds: clampSeconds(Math.min(seconds, MAX_SECONDS_PER_TICK)) };
}

/**
 * @param request Request
 * @returns Promise<NextResponse>
 */
export async function POST(request: Request): Promise<NextResponse> {
  const payload = parsePayload(await request.json().catch(() => null));
  if (!payload) return NextResponse.json({ ok: false }, { status: 400 });
  if (payload.seconds === 0) return new NextResponse(null, { status: 204 });

  const supabase = await createSupabaseServer();
  const { error } = await supabase.rpc('track_usage', {
    p_mode: payload.mode,
    p_skill: inferSkillFromMode(payload.mode),
    p_cefr_level: inferModeMetadata(payload.mode).cefr_level,
    p_seconds: payload.seconds,
  });

  if (error) {
    const unauthenticated = error.message.includes('not authenticated');
    return NextResponse.json({ ok: false }, { status: unauthenticated ? 401 : 500 });
  }
  return new NextResponse(null, { status: 204 });
}
