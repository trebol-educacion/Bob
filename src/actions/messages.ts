'use server';

import { createSupabaseServer } from '@/lib/supabase/server';

export type MsgType = 'text' | 'phrase' | 'phrase_plan' | 'image_scene' | 'evaluation' | 'user_audio' | 'yl_cue' | 'yl_tts';

export interface StoredMessage {
  id: string;
  session_id: string;
  user_id: string;
  role: 'bob' | 'user';
  msg_type: MsgType;
  content_text?: string | null;
  content_json?: Record<string, unknown> | null;
  created_at: string;
}

type ActionResult<T> = { data: T | null; error: string | null };

export async function saveMessageAction(input: {
  session_id: string;
  role: 'bob' | 'user';
  msg_type: MsgType;
  content_text?: string;
  content_json?: Record<string, unknown>;
}): Promise<ActionResult<StoredMessage>> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: 'Not authenticated' };
  const { data, error } = await supabase
    .from('messages')
    .insert({ ...input, user_id: user.id })
    .select()
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as StoredMessage, error: null };
}

export async function getMessagesAction(session_id: string): Promise<ActionResult<StoredMessage[]>> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('session_id', session_id)
    .order('created_at', { ascending: true });
  if (error) return { data: null, error: error.message };
  return { data: data as StoredMessage[], error: null };
}
