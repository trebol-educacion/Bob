import { createAdminClient, createGemini } from './b2-pregen/env';
import { createGeminiJudge } from './b2-pregen/semantic-judge';
import { loadPromptText } from './plan-pregen/assets';
import { generatePlan } from './plan-pregen/generate';
import { selectParts } from './plan-pregen/registry';
import { createPlanReview } from './plan-pregen/review';
import { nextSlot, persistPlan, planSlots, planVariant } from './plan-pregen/store';
import type { PlanPart } from './plan-pregen/types';

function argOf(name: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
}

function topicOf(part: PlanPart, slot: number): string {
  const topics = part.topics ?? [];
  return topics.length > 0 ? topics[(slot - 1) % topics.length] : '';
}

async function fillPart(part: PlanPart, count: number): Promise<void> {
  const db = createAdminClient();
  const ai = createGemini();
  const judge = createGeminiJudge(ai, db);
  const review = createPlanReview(part, judge);
  const prompt = await loadPromptText(db, part.promptKey);
  const slots = await planSlots(db, part);
  let slot = nextSlot(slots);
  let created = 0;
  while (slots.published.size < count) {
    const current = slot++;
    const variant = planVariant(part, current);
    const ctx = { topic: topicOf(part, current), slot: current, variant, existing: slots.labels, db };
    const generated = await generatePlan(ai, part, prompt, ctx, review);
    const plan = part.produce ? await part.produce(generated, { ai, db, variant, slot: current, examPart: part.examPart }) : generated;
    const label = part.labelOf ? part.labelOf(plan) : ctx.topic;
    await persistPlan(db, part, variant, plan, ctx.topic, label);
    slots.published.add(variant);
    if (label) slots.labels.push(label);
    console.log(`[${part.examPart}] ${variant} stored`);
    created++;
  }
  console.log(`Done ${part.examPart}. Created: ${created} | Published: ${slots.published.size}`);
}

async function main() {
  const family = argOf('family');
  const examPart = argOf('part');
  const count = Number(argOf('count') ?? '3');
  const parts = selectParts(family, examPart);
  if (parts.length === 0 || !Number.isInteger(count) || count < 1) {
    console.error('Usage: bun run scripts/pregenerate-plans.ts --family=<ket|pet|yl|toefl> [--part=<exam_part>] [--count=3]');
    process.exit(1);
  }
  for (const part of parts) {
    try {
      await fillPart(part, count);
    } catch (err) {
      console.error(`[${part.examPart}] FAILED: ${err instanceof Error ? err.message : err}`);
      process.exitCode = 1;
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
