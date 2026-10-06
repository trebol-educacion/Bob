import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { createAdminClient } from './b2-pregen/env';
import { wavToMp3 } from './b2-pregen/ffmpeg';
import { OFFICIAL_CHOOSE_RESPONSE } from './plan-pregen/data/toefl-official-choose-response';

const BUCKET = 'bob-listening';
const SOURCE_DIR = path.resolve(process.cwd(), 'Referencias/TOELF/Listening/Question Response');
const LETTERS = ['A', 'B', 'C', 'D'] as const;

async function main() {
  const db = createAdminClient();
  for (const exam of OFFICIAL_CHOOSE_RESPONSE) {
    const items = [];
    for (const [index, entry] of exam.items.entries()) {
      const number = index + 1;
      const source = await readFile(path.join(SOURCE_DIR, `Listening${exam.module}_Question Response_Question${number}.ogg`));
      const key = `toefl/choose-response/official-m${exam.module}-q${number}.mp3`;
      const upload = await db.storage.from(BUCKET).upload(key, await wavToMp3(source), { contentType: 'audio/mpeg', upsert: true });
      if (upload.error) throw new Error(`Upload ${key} failed: ${upload.error.message}`);
      items.push({
        speaker: entry.speaker,
        utterance: entry.utterance,
        options: entry.options.map((label, i) => ({ key: LETTERS[i], label })),
        correct_key: entry.key,
        explanation: `Official TOEFL iBT Practice Test 1, Listening Module ${exam.module}, question ${number}; key verified against the official answer key.`,
        audio_url: db.storage.from(BUCKET).getPublicUrl(key).data.publicUrl,
      });
    }
    const { error } = await db.from('item_groups').upsert(
      {
        exam: 'toefl',
        skill: 'listening',
        cefr_level: 'b1',
        purpose: 'practice',
        exam_part: 'listen_choose_response',
        variant_id: `official-m${exam.module}`,
        metadata: { plan: { items }, topic: 'official practice test 1', label: `official module ${exam.module}` },
        source: 'official',
        source_ref: 'Referencias/TOELF/toefl-full-length-practice-test1.pdf',
        status: 'published',
      },
      { onConflict: 'exam,exam_part,cefr_level,variant_id' },
    );
    if (error) throw new Error(`Group official-m${exam.module} failed: ${error.message}`);
    console.log(`official-m${exam.module}: ${items.length} items stored`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
