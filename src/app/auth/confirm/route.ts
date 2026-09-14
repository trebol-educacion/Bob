import { NextRequest, NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createSupabaseServer } from '@/lib/supabase/server';

function sanitizeNext(rawNext: string | null): string {
  if (!rawNext || !rawNext.startsWith('/') || rawNext.startsWith('//')) return '/';
  return rawNext;
}

/**
 * Confirms a Supabase magic-link OTP (`token_hash` + `type`) and redirects
 * the user in. Shared contract with noobe-hub and MIA: `type=email` for
 * links requested from the login form, `type=magiclink` for links
 * noobe-hub generates on welcome.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = sanitizeNext(searchParams.get('next'));
  const email = searchParams.get('email');

  if (!tokenHash || !type) {
    return NextResponse.redirect(
      `${origin}/login?error=enlace${email ? `&email=${encodeURIComponent(email)}` : ''}`
    );
  }

  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=enlace${email ? `&email=${encodeURIComponent(email)}` : ''}`
    );
  }

  return NextResponse.redirect(`${origin}${next}`);
}
