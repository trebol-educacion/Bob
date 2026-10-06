import { createAdminClient, createGemini, type Db } from './b2-pregen/env';
import { parsePayload, type Payload } from './b2-pregen/schemas';
import { reviewPayload } from './b2-pregen/semantic-checks';
import { createGeminiJudge } from './b2-pregen/semantic-judge';
import { normalizeTitle } from './b2-pregen/semantic-rules';
import { retireVariant } from './b2-pregen/store';
import { PART_SHORT } from './b2-pregen/variant';

interface Row {
  variant_id: string;
  group_order: number | null;
  question: string;
  options: { key: string; label: string }[];
  correct_key: string;
  explanation: string | null;
  transcript: string | null;
  metadata: Record<string, unknown> | null;
}

const EXISTING_PARTS = Object.keys(PART_SHORT).filter((part) => !['fce_reading_part1', 'fce_writing_part1', 'fce_speaking_part1', 'fce_speaking_part2', 'fce_speaking_part4'].includes(part));

function toItem(row: Row, index: number) {
  return {
    group_order: row.group_order ?? index + 1,
    question: row.question,
    options: row.options,
    correct_key: row.correct_key,
    explanation: row.explanation ?? 'n/a',
    transcript: row.transcript ?? undefined,
    metadata: row.metadata ?? {},
  };
}

async function loadSets(db: Db, examPart: string): Promise<{ variant: string; payload: unknown }[]> {
  if (examPart === 'fce_listening_part1') {
    const { data, error } = await db
      .from('closed_items')
      .select('variant_id, group_order, question, options, correct_key, explanation, transcript, metadata')
      .eq('framework', 'cambridge')
      .eq('exam_part', examPart)
      .eq('source', 'generated')
      .eq('status', 'published')
      .order('variant_id');
    if (error) throw new Error(error.message);
    const byVariant = new Map<string, Row[]>();
    for (const row of (data ?? []) as Row[]) {
      const variant = row.variant_id.replace(/-q\d+$/, '');
      byVariant.set(variant, [...(byVariant.get(variant) ?? []), row]);
    }
    return [...byVariant.entries()].map(([variant, rows]) => ({
      variant,
      payload: { group: null, items: rows.map(toItem) },
    }));
  }
  const { data, error } = await db
    .from('item_groups')
    .select('id, variant_id, stimulus_text, metadata')
    .eq('exam', 'fce')
    .eq('exam_part', examPart)
    .eq('status', 'published')
    .order('variant_id');
  if (error) throw new Error(error.message);
  const sets: { variant: string; payload: unknown }[] = [];
  for (const group of data ?? []) {
    const { data: items, error: itemsError } = await db
      .from('closed_items')
      .select('variant_id, group_order, question, options, correct_key, explanation, transcript, metadata')
      .eq('group_id', group.id)
      .eq('status', 'published')
      .order('group_order');
    if (itemsError) throw new Error(itemsError.message);
    sets.push({
      variant: String(group.variant_id),
      payload: {
        group: { stimulus_text: group.stimulus_text, metadata: group.metadata },
        items: ((items ?? []) as Row[]).map(toItem),
      },
    });
  }
  return sets;
}

async function main() {
  const dryRun = process.argv.includes('--dry');
  const db = createAdminClient();
  const judge = createGeminiJudge(createGemini(), db);
  const failures: string[] = [];
  let checked = 0;
  for (const examPart of EXISTING_PARTS) {
    const titles = new Set<string>();
    for (const set of await loadSets(db, examPart)) {
      checked++;
      const parsed = parsePayload(examPart, set.payload);
      const errors = parsed.ok
        ? (await reviewPayload(examPart, parsed.data as Payload, { existingTitles: titles }, judge)).errors
        : parsed.errors;
      if (errors.length === 0) {
        const title = (set.payload as { group: { metadata: Record<string, unknown> } | null }).group?.metadata.title;
        if (typeof title === 'string') titles.add(normalizeTitle(title));
        continue;
      }
      failures.push(`${examPart} ${set.variant}: ${errors.slice(0, 4).join(' | ')}`);
      if (!dryRun) await retireVariant(db, examPart, set.variant);
    }
  }
  console.log(`Checked ${checked} sets. Failed: ${failures.length}${dryRun ? ' (dry run)' : ' (retired)'}`);
  failures.forEach((line) => console.log(`- ${line}`));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
