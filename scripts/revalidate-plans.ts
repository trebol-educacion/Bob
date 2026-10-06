import { createAdminClient, createGemini } from './b2-pregen/env';
import { createGeminiJudge } from './b2-pregen/semantic-judge';
import { selectParts } from './plan-pregen/registry';
import { createPlanReview } from './plan-pregen/review';
import { retirePlan } from './plan-pregen/store';

function argOf(name: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
}

async function main() {
  const dry = process.argv.includes('--dry');
  const db = createAdminClient();
  const judge = createGeminiJudge(createGemini(), db);
  let retired = 0;
  let checked = 0;
  for (const part of selectParts(argOf('family'), argOf('part'))) {
    const { data, error } = await db
      .from('item_groups')
      .select('variant_id, metadata')
      .eq('exam', part.exam)
      .eq('exam_part', part.examPart)
      .eq('cefr_level', part.cefr)
      .eq('status', 'published');
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      checked++;
      const parsed = part.schema.safeParse((row.metadata as Record<string, unknown>).plan);
      const errors = parsed.success
        ? (await createPlanReview(part, judge)(parsed.data)).errors
        : parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
      if (errors.length === 0) continue;
      console.log(`[${part.examPart}] ${row.variant_id}: ${errors.slice(0, 4).join('; ')}`);
      if (!dry) await retirePlan(db, part, String(row.variant_id));
      retired++;
    }
  }
  console.log(`Checked ${checked}. ${dry ? 'Would retire' : 'Retired'} ${retired}.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
