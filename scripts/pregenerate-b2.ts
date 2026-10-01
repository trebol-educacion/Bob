import { createAdminClient, createGemini } from './b2-pregen/env';
import { generatePayload, loadPrompt } from './b2-pregen/llm';
import { produceAudio } from './b2-pregen/audio';
import { existingVariants, persist } from './b2-pregen/store';
import { topicFor } from './b2-pregen/topics';
import { PART_SHORT, variantId } from './b2-pregen/variant';

function argOf(name: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
}

async function main() {
  const examPart = argOf('part');
  const count = Number(argOf('count') ?? '0');
  if (!examPart || !(examPart in PART_SHORT) || !Number.isInteger(count) || count < 1) {
    console.error(`Usage: bun run scripts/pregenerate-b2.ts --part=<${Object.keys(PART_SHORT).join('|')}> --count=<n>`);
    process.exit(1);
  }
  const db = createAdminClient();
  const ai = createGemini();
  const prompt = await loadPrompt(db, examPart);
  const partIndex = Object.keys(PART_SHORT).indexOf(examPart);
  const existing = await existingVariants(db, examPart);
  let created = 0;
  let skipped = 0;
  for (let slot = 1; slot <= count; slot++) {
    const variant = variantId(examPart, slot);
    if (existing.has(variant)) {
      skipped++;
      continue;
    }
    const payload = await generatePayload(ai, prompt, examPart, topicFor(partIndex, slot));
    const audio = await produceAudio(ai, db, examPart, variant, slot, payload);
    const items = await persist(db, examPart, variant, payload, audio);
    console.log(`[${examPart}] ${variant}: ${items} items stored`);
    created++;
  }
  console.log(`Done ${examPart}. Created: ${created} | Skipped: ${skipped}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
