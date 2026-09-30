import * as path from 'path';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set in .env.local`);
  return value;
}

/**
 * @returns Supabase service-role client on schema bob
 */
export function createAdminClient() {
  return createClient(required('NEXT_PUBLIC_SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), {
    db: { schema: 'bob' },
    auth: { persistSession: false },
  });
}

/**
 * @returns Gemini client
 */
export function createGemini(): GoogleGenAI {
  return new GoogleGenAI({ apiKey: required('GEMINI_API_KEY') });
}

export type Db = ReturnType<typeof createAdminClient>;
