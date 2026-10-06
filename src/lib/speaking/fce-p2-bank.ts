import type { PickedContent } from '@/lib/item-bank/content-source';
import type { FCELongTurnLanguageBank, FCELongTurnReferenceVocabulary, FCELongTurnResult } from '@/actions/modes/fce-p2/contracts';

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function list(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

function section(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

/**
 * @param picked Speaking Part 2 group read from the bank
 * @param framingText instructions from bob.prompts
 * @returns the plan, or null when the group lacks the question or an image
 */
export function toLongTurnPlan(picked: PickedContent, framingText: string): FCELongTurnResult | null {
  if (picked.kind !== 'group') return null;
  const data = picked.group.metadata;
  const imageUrlA = text(data.image_url_a);
  const imageUrlB = text(data.image_url_b);
  const question = text(data.comparison_question);
  if (!imageUrlA || !imageUrlB || !question) return null;
  const vocabulary = section(data.reference_vocabulary);
  const bank = section(data.language_bank);
  const referenceVocabulary: FCELongTurnReferenceVocabulary = {
    comparison: list(vocabulary.comparison),
    speculation: list(vocabulary.speculation),
    activity_verbs: list(vocabulary.activity_verbs),
    emotions: list(vocabulary.emotions),
    settings: list(vocabulary.settings),
  };
  const languageBank: FCELongTurnLanguageBank = {
    openers: list(bank.openers),
    contrast: list(bank.contrast),
    speculation: list(bank.speculation),
    conclusion: list(bank.conclusion),
  };
  return {
    topic: text(data.topic),
    framingText,
    comparisonQuestion: question,
    scenePromptA: text(data.scene_prompt_a),
    scenePromptB: text(data.scene_prompt_b),
    referenceVocabulary,
    languageBank,
    imageUrlA,
    imageUrlB,
    bankGroupId: picked.group.id,
  };
}
