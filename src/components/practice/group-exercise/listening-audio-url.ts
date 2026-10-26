/**
 * @param path bucket path starting with a slash, or an absolute URL
 * @returns playable URL; absolute URLs untouched
 */
export function resolveListeningAudioUrl(path: string): string {
  if (!path.startsWith('/')) return path;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  return `${base}/storage/v1/object/public/bob-listening${path}`;
}
