import { z } from 'zod';
import type { BankItem, ItemGroup } from '@/lib/item-bank/types';
import type {
  FCEGroupedExercise,
  FCEGroupedItem,
  FCEGroupedOption,
  FCEGroupedPart,
} from './fce-grouped-types';

const OptionSchema = z.object({ key: z.string(), label: z.string() });

const GroupMetadataSchema = z.object({
  title: z.string().optional(),
  example: z
    .object({ answer: z.string(), base_word: z.string().optional() })
    .optional(),
  shared_options: z.array(OptionSchema).optional(),
});

const ItemMetadataSchema = z.object({
  number: z.number().int().optional(),
  base_word: z.string().optional(),
  keyword: z.string().optional(),
  second_sentence_with_gap: z.string().optional(),
});

const GAP_BASE_WORD = /(___\d+___)\s*\([A-Z][A-Z' -]*\)/g;
const EXAMPLE_GAP = /___0___/;

/**
 * @param item
 * @returns exercise number of the item
 */
export function itemNumber(item: BankItem): number {
  const parsed = ItemMetadataSchema.safeParse(item.metadata ?? {});
  const fromMetadata = parsed.success ? parsed.data.number : undefined;
  if (fromMetadata !== undefined) return fromMetadata;
  const fromQuestion = parseInt(item.question, 10);
  return Number.isNaN(fromQuestion) ? (item.group_order ?? 0) : fromQuestion;
}

function buildText(
  part: FCEGroupedPart,
  raw: string | null,
  example: z.infer<typeof GroupMetadataSchema>['example']
): string | null {
  if (raw === null) return null;
  const withoutBaseWords = raw.replace(GAP_BASE_WORD, '$1');
  if (!example) return withoutBaseWords;
  const base = part === 'fce_reading_part3' && example.base_word ? ` (${example.base_word})` : '';
  return withoutBaseWords.replace(EXAMPLE_GAP, `(0) ${example.answer}${base}`);
}

function buildItem(part: FCEGroupedPart, item: BankItem): FCEGroupedItem {
  const meta = ItemMetadataSchema.parse(item.metadata ?? {});
  const number = itemNumber(item);
  switch (part) {
    case 'fce_reading_part3':
      return { number, baseWord: meta.base_word };
    case 'fce_reading_part4':
      return {
        number,
        prompt: item.question,
        keyword: meta.keyword,
        sentenceWithGap: meta.second_sentence_with_gap,
      };
    case 'fce_reading_part5':
      return {
        number,
        prompt: item.question,
        options: item.options.map((o) => ({ key: o.key, label: o.label })),
      };
    default:
      return { number };
  }
}

/**
 * @param part
 * @param group
 * @param items
 * @returns client-safe exercise without keys, accepted answers or scripts
 */
export function toPublicExercise(
  part: FCEGroupedPart,
  group: ItemGroup,
  items: BankItem[]
): FCEGroupedExercise {
  const meta = GroupMetadataSchema.parse(group.metadata ?? {});
  const sentences: FCEGroupedOption[] =
    part === 'fce_reading_part6'
      ? (meta.shared_options ?? []).map((o) => ({ key: o.key, label: o.label }))
      : [];
  const ordered = [...items].sort((a, b) => itemNumber(a) - itemNumber(b));
  return {
    groupId: group.id,
    part,
    title: meta.title ?? '',
    text: buildText(part, group.stimulus_text, meta.example),
    items: ordered.map((item) => buildItem(part, item)),
    sentences,
  };
}
