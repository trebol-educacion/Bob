import type { YLPlan } from '@/lib/types/yl';

/**
 * @param target word the cue asks for
 * @returns reaction after a correct pick
 */
export function pointingCorrectReaction(target: string): string {
  return `Excellent! That's the ${target}. Well done!`;
}

/**
 * @param chosen word the child picked
 * @param target word the cue asks for
 * @returns reaction after a wrong pick
 */
export function pointingWrongReaction(chosen: string, target: string): string {
  return `Not quite. That's the ${chosen}. The ${target} is over there. Try the next one!`;
}

function pointingTexts(plan: YLPlan): string[] {
  const options = plan.options ?? [];
  const texts = (plan.pointing_cues ?? []).map((cue) => cue.text);
  for (const cue of plan.pointing_cues ?? []) {
    const target = options[cue.target_index] ?? '';
    if (!target) continue;
    texts.push(pointingCorrectReaction(target));
    for (const chosen of options) {
      if (chosen && chosen !== target) texts.push(pointingWrongReaction(chosen, target));
    }
  }
  return texts;
}

function whatsThisTexts(plan: YLPlan): string[] {
  const cards = plan.object_cards ?? [];
  return [
    ...cards.flatMap((card) => card.questions.map((q) => q.text)),
    ...cards.flatMap((card) => [
      `That's right! It's a ${card.word}. Well done!`,
      `Good try! It's a ${card.word}.`,
      'Great job! Yes or no, you did it!',
      'Good try! Keep going!',
    ]),
  ];
}

function differencesTexts(plan: YLPlan): string[] {
  const diffs = plan.differences ?? [];
  return [...diffs.map((d) => d.examiner_cue), ...diffs.flatMap((d) => ['Yes! Well spotted!', `Almost, ${d.expected_answer} Good try!`])];
}

function storyTexts(plan: YLPlan): string[] {
  const scenes = plan.scenes ?? [];
  const later = scenes.slice(1);
  return [
    plan.story_setup ?? '',
    scenes[0]?.modeled_description ?? '',
    ...later.map((s) => s.examiner_cue ?? ''),
    ...later.map(() => 'Great storytelling! Keep going!'),
    ...later.map((s) => `Almost, ${s.expected_answer ?? ''}`),
  ];
}

/**
 * @param examPart starters_partN or movers_partN
 * @param plan plan of the part
 * @returns distinct fixed phrases of the activity that Bob speaks, in speaking order
 */
export function spokenTexts(examPart: string, plan: YLPlan): string[] {
  const byPart: Record<string, string[]> = {
    starters_part1: pointingTexts(plan),
    starters_part3: whatsThisTexts(plan),
    movers_part1: differencesTexts(plan),
    movers_part3: storyTexts(plan),
  };
  const texts = byPart[examPart] ?? plan.cues;
  return [...new Set(texts.map((t) => t.trim()).filter(Boolean))];
}
