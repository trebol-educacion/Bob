import { toPublicGroup, toPublicItem } from './public';
import type { BankItem, ItemGroup } from './types';
import type { GroupChoice, GroupExercisePayload, GroupQuestion } from './group-types';

interface RawChoice {
  key?: unknown;
  label?: unknown;
  text?: unknown;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function parseChoices(raw: unknown, sections: unknown): GroupChoice[] {
  const textByKey = new Map<string, string>();
  if (Array.isArray(sections)) {
    for (const section of sections as RawChoice[]) {
      const key = asString(section.key);
      const text = asString(section.text);
      if (key && text) textByKey.set(key, text);
    }
  }
  if (!Array.isArray(raw)) return [];
  const choices: GroupChoice[] = [];
  for (const entry of raw as RawChoice[]) {
    const key = asString(entry.key);
    if (!key) continue;
    choices.push({ key, label: asString(entry.label) ?? key, text: textByKey.get(key) ?? null });
  }
  return choices;
}

function firstQuestionNumber(range: unknown): number {
  return Array.isArray(range) && typeof range[0] === 'number' ? range[0] : 1;
}

function toQuestion(item: BankItem, index: number, firstNumber: number): GroupQuestion {
  const publicItem = toPublicItem(item);
  return {
    id: publicItem.id,
    number: firstNumber + (item.group_order ?? index + 1) - 1,
    text: publicItem.question,
    options: publicItem.options.map((option) => ({ key: option.key, label: option.label, text: null })),
    audioUrl: publicItem.stimulus_audio_url,
  };
}

export function toGroupPayload(group: ItemGroup, items: BankItem[]): GroupExercisePayload {
  const publicGroup = toPublicGroup(group);
  const metadata = publicGroup.metadata;
  const firstNumber = firstQuestionNumber(metadata.question_range);
  const ordered = [...items].sort((a, b) => (a.group_order ?? 0) - (b.group_order ?? 0));

  return {
    groupId: publicGroup.id,
    variantId: publicGroup.variant_id ?? publicGroup.id,
    title: asString(metadata.title) ?? '',
    intro: asString(metadata.intro) ?? asString(metadata.theme),
    audioUrl: publicGroup.stimulus_audio_url,
    choices: parseChoices(metadata.shared_options, metadata.sections),
    questions: ordered.map((item, index) => toQuestion(item, index, firstNumber)),
  };
}
