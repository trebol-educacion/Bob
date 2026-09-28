import { createSupabaseBrowser } from '@/lib/supabase/browser-client';

export async function uploadImageToStorage(imageDataUrl: string): Promise<string> {
  const supabase = createSupabaseBrowser();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const res = await fetch(imageDataUrl);
  const blob = await res.blob();
  const ext = blob.type.includes('png') ? 'png' : 'jpg';
  const filename = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('bob-images').upload(filename, blob, { contentType: blob.type });
  if (error) throw error;
  return supabase.storage.from('bob-images').getPublicUrl(filename).data.publicUrl;
}
