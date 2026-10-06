import { createAdminClient, type Db } from './b2-pregen/env';
import { wavToMp3 } from './b2-pregen/ffmpeg';

const BUCKET = 'bob-listening';
const TABLES = ['closed_items', 'item_groups'] as const;

interface Row {
  id: string;
  stimulus_audio_url: string;
}

async function convert(db: Db, url: string): Promise<{ url: string; before: number; after: number }> {
  const wavPath = url.replace(/^\//, '');
  const mp3Path = wavPath.replace(/\.wav$/i, '.mp3');
  const { data, error } = await db.storage.from(BUCKET).download(wavPath);
  if (error || !data) throw new Error(`Download ${wavPath} failed: ${error?.message}`);
  const wav = Buffer.from(await data.arrayBuffer());
  const mp3 = await wavToMp3(wav);
  const upload = await db.storage.from(BUCKET).upload(mp3Path, mp3, { contentType: 'audio/mpeg', upsert: true });
  if (upload.error) throw new Error(`Upload ${mp3Path} failed: ${upload.error.message}`);
  return { url: `/${mp3Path}`, before: wav.length, after: mp3.length };
}

async function main() {
  const removeWav = process.argv.includes('--remove-wav');
  const db = createAdminClient();
  const converted = new Map<string, { url: string; before: number; after: number }>();
  for (const table of TABLES) {
    const { data, error } = await db.from(table).select('id, stimulus_audio_url').like('stimulus_audio_url', '%.wav');
    if (error) throw new Error(`Listing ${table} failed: ${error.message}`);
    for (const row of (data ?? []) as Row[]) {
      const result = converted.get(row.stimulus_audio_url) ?? (await convert(db, row.stimulus_audio_url));
      converted.set(row.stimulus_audio_url, result);
      const { error: updateError } = await db.from(table).update({ stimulus_audio_url: result.url }).eq('id', row.id);
      if (updateError) throw new Error(`Updating ${table} ${row.id} failed: ${updateError.message}`);
      console.log(`${table} ${row.id}: ${row.stimulus_audio_url} -> ${result.url} (${(result.before / 1e6).toFixed(1)} MB -> ${(result.after / 1e6).toFixed(2)} MB)`);
    }
  }
  if (removeWav && converted.size > 0) {
    const { error } = await db.storage.from(BUCKET).remove([...converted.keys()].map((u) => u.replace(/^\//, '')));
    if (error) throw new Error(`Removing wav files failed: ${error.message}`);
  }
  const before = [...converted.values()].reduce((sum, c) => sum + c.before, 0);
  const after = [...converted.values()].reduce((sum, c) => sum + c.after, 0);
  console.log(`Converted ${converted.size} files: ${(before / 1e6).toFixed(1)} MB -> ${(after / 1e6).toFixed(1)} MB`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
