import { createAdminClient, createGemini } from './b2-pregen/env';
import { generatePayload, loadPrompt } from './b2-pregen/llm';
import { produceAudio } from './b2-pregen/audio';
import { produceSceneImages } from './b2-pregen/images';
import { partSpec, slotTopic } from './b2-pregen/parts';
import { reviewPayload } from './b2-pregen/semantic-checks';
import { normalizeTitle } from './b2-pregen/semantic-rules';
import { createGeminiJudge } from './b2-pregen/semantic-judge';
import { slotState, persist } from './b2-pregen/store';
import { PART_SHORT, slotOf, variantId } from './b2-pregen/variant';

function argOf(name: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
}

async function main() {
  const examPart = argOf('part');
  const count = Number(argOf('count') ?? '0');
  if (!examPart || !(examPart in PART_SHORT) || !Number.isInteger(count) || count < 1) {
    console.error(`Usage: bun run scripts/pregenerate-b2.ts --part=<${Object.keys(PART_SHORT).join('|')}> --count=<published sets wanted>`);
    process.exit(1);
  }
  const db = createAdminClient();
  const ai = createGemini();
  const judge = createGeminiJudge(ai, db);
  const prompt = await loadPrompt(db, examPart);
  const state = await slotState(db, examPart);
  const titles = new Set(state.titles);
  let nextSlot = Math.max(0, ...[...state.all].map(slotOf)) + 1;
  let created = 0;
  while (state.published.size < count) {
    const slot = nextSlot++;
    const variant = variantId(examPart, slot);
    const topic = slotTopic(examPart, slot);
    const payload = await generatePayload(ai, prompt, examPart, topic, (candidate) =>
      reviewPayload(examPart, candidate, { existingTitles: titles }, judge),
    );
    if (examPart === 'fce_speaking_part2' && payload.group) {
      Object.assign(payload.group.metadata, await produceSceneImages(ai, db, variant, payload.group.metadata));
    }
    const audio = await produceAudio(ai, db, examPart, variant, slot, payload);
    const items = await persist(db, examPart, variant, payload, audio);
    state.published.add(variant);
    const title = payload.group?.metadata.title;
    if (typeof title === 'string') titles.add(normalizeTitle(title));
    console.log(`[${examPart}] ${variant}: ${items} items stored`);
    created++;
  }
  console.log(`Done ${examPart}. Created: ${created} | Published: ${state.published.size} | Prompt: ${partSpec(examPart).promptKey}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
