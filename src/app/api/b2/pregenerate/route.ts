import { NextRequest, NextResponse } from 'next/server';
import { isServiceRoleRequest } from '@/lib/api/service-auth';
import { createSupabaseAdmin } from '@/lib/supabase/admin';
import {
  pregenerate,
  selectPregenerateTargets,
  type PregenerateScope,
} from '@/lib/pregenerate/b2-content';

export const maxDuration = 60;

const SCOPES: readonly string[] = ['writing', 'speaking'];

function parseFilter(searchParams: URLSearchParams) {
  const only = searchParams.get('only');
  const variant = searchParams.get('variant');
  const parsedVariant = variant === null ? undefined : Number.parseInt(variant, 10);
  return {
    invalid: (only !== null && !SCOPES.includes(only)) || (parsedVariant !== undefined && Number.isNaN(parsedVariant)),
    filter: {
      only: (only ?? undefined) as PregenerateScope | undefined,
      config: searchParams.get('config') ?? undefined,
      variant: parsedVariant,
    },
  };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isServiceRoleRequest(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { invalid, filter } = parseFilter(new URL(req.url).searchParams);
  if (invalid) return NextResponse.json({ ok: false, error: 'Invalid parameters' }, { status: 400 });

  const targets = selectPregenerateTargets(filter);
  const results = await pregenerate(targets, createSupabaseAdmin());

  return NextResponse.json({
    ok: results.every((result) => result.status !== 'error'),
    total: results.length,
    results,
  });
}
