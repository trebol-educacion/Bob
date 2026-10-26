import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { createAdminClient } from './b2-pregen/env';
import { wavToMp3 } from './b2-pregen/ffmpeg';
import { TOEFL_LISTENING_ASSETS, type ListeningAsset } from './plan-pregen/data/toefl-listening-assets';

const BUCKET = 'bob-listening';
const SOURCE_DIR = path.resolve(process.cwd(), 'Referencias/TOELF/Listening');
const DRY_RUN = process.argv.includes('--dry-run');
const INCLUDE_NOT_SERVED = process.argv.includes('--all');
const FORCE = process.argv.includes('--force');

type Db = ReturnType<typeof createAdminClient>;

async function existingKeys(db: Db, assets: ListeningAsset[]): Promise<Set<string>> {
  const folders = [...new Set(assets.map((asset) => path.posix.dirname(asset.key)))];
  const found = new Set<string>();
  for (const folder of folders) {
    const { data, error } = await db.storage.from(BUCKET).list(folder, { limit: 1000 });
    if (error) throw new Error(`Listing ${folder} failed: ${error.message}`);
    for (const file of data ?? []) found.add(`${folder}/${file.name}`);
  }
  return found;
}

async function planDryRun(assets: ListeningAsset[]): Promise<void> {
  for (const asset of assets) {
    const source = await readFile(path.join(SOURCE_DIR, asset.source));
    console.log(`would upload ${asset.key} (${(source.length / 1024).toFixed(0)} KB ogg) served=${asset.served}`);
  }
  console.log(`dry-run: ${assets.length} files, nothing uploaded`);
}

async function upload(assets: ListeningAsset[]): Promise<void> {
  const db = createAdminClient();
  const present = FORCE ? new Set<string>() : await existingKeys(db, assets);
  let uploaded = 0;
  for (const asset of assets) {
    if (present.has(asset.key)) {
      console.log(`skip ${asset.key} (already in bucket)`);
      continue;
    }
    const source = await readFile(path.join(SOURCE_DIR, asset.source));
    const { error } = await db.storage.from(BUCKET).upload(asset.key, await wavToMp3(source), { contentType: 'audio/mpeg', upsert: FORCE });
    if (error) throw new Error(`Upload ${asset.key} failed: ${error.message}`);
    uploaded += 1;
    console.log(`uploaded ${asset.key}`);
  }
  console.log(`done: ${uploaded} uploaded, ${assets.length - uploaded} skipped`);
}

async function main() {
  const assets = TOEFL_LISTENING_ASSETS.filter((asset) => INCLUDE_NOT_SERVED || asset.served);
  if (DRY_RUN) await planDryRun(assets);
  else await upload(assets);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
