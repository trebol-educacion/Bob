import { z } from 'zod';
import { countWords, gapNumbers } from './text';

const OptionSchema = z.object({ key: z.string().min(1), label: z.string().min(1) });

const ItemSchema = z.object({
  group_order: z.number().int().nullable(),
  question: z.string().min(1),
  options: z.array(OptionSchema),
  correct_key: z.string().min(1),
  explanation: z.string().min(1),
  transcript: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()),
});

const GroupSchema = z.object({
  stimulus_text: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
});

const PayloadSchema = z.object({
  group: GroupSchema.nullable(),
  items: z.array(ItemSchema),
});

export type PayloadItem = z.infer<typeof ItemSchema>;
export type PayloadGroup = z.infer<typeof GroupSchema>;
export type Payload = z.infer<typeof PayloadSchema>;

type Check = (payload: Payload) => string[];

const LETTERS = 'ABCDEFGH';

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function strArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

function numberOf(item: PayloadItem): number {
  return Number(item.metadata.number);
}

function inRange(label: string, words: number, min: number, max: number): string[] {
  return words >= min && words <= max ? [] : [`${label}: ${words} words, expected ${min}-${max}`];
}

function itemCount(payload: Payload, count: number, start: number, gapped: boolean): string[] {
  const issues: string[] = [];
  if (payload.items.length !== count) issues.push(`expected ${count} items, got ${payload.items.length}`);
  payload.items.forEach((item, index) => {
    if (numberOf(item) !== start + index) issues.push(`item ${index + 1}: metadata.number must be ${start + index}`);
    if (gapped && item.group_order !== index + 1) issues.push(`item ${index + 1}: group_order must be ${index + 1}`);
  });
  return issues;
}

function groupOf(payload: Payload): PayloadGroup {
  if (!payload.group) throw new Error('group required');
  return payload.group;
}

function requireGroup(payload: Payload): string[] {
  return payload.group ? [] : ['group is required'];
}

function acceptedCheck(item: PayloadItem, maxWords: number, requiredWord?: string): string[] {
  const issues: string[] = [];
  const accepted = strArray(item.metadata.accepted);
  const label = `item ${numberOf(item)}`;
  const key = item.correct_key.trim();
  if (accepted.length === 0) return [`${label}: accepted[] missing or empty`];
  if (!accepted.includes(key)) issues.push(`${label}: accepted[] must include correct_key`);
  for (const value of [key, ...accepted]) {
    if (value !== value.toLowerCase()) issues.push(`${label}: "${value}" must be lowercase`);
    const words = value.trim().split(/\s+/).length;
    if (words > maxWords) issues.push(`${label}: "${value}" exceeds ${maxWords} words`);
    if (requiredWord && !new RegExp(`\\b${requiredWord}\\b`).test(value)) {
      issues.push(`${label}: "${value}" must contain keyword ${requiredWord}`);
    }
  }
  return issues;
}

function gapMarkers(text: string, expected: number[]): string[] {
  const found = gapNumbers(text);
  return found.join(',') === expected.join(',')
    ? []
    : [`gap markers ${found.join(',') || 'none'}, expected ${expected.join(',')}`];
}

function range(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

function sharedOptions(group: PayloadGroup, count: number): string[] {
  const options = Array.isArray(group.metadata.shared_options) ? (group.metadata.shared_options as unknown[]) : [];
  const keys = options.map((o) => str((o as { key?: unknown }).key));
  const expected = LETTERS.slice(0, count).split('');
  const labelled = options.every((o) => str((o as { label?: unknown }).label).length > 0);
  return keys.join('') === expected.join('') && labelled
    ? []
    : [`shared_options must be ${expected.join('')} with labels`];
}

function distinctKeys(payload: Payload, allowed: string, distinct: boolean): string[] {
  const keys = payload.items.map((i) => i.correct_key);
  const issues = keys.filter((k) => !allowed.includes(k)).map((k) => `correct_key "${k}" not in ${allowed}`);
  if (distinct && new Set(keys).size !== keys.length) issues.push('correct_key values must be distinct');
  return issues;
}

function optionsCheck(payload: Payload, letters: string): string[] {
  const expected = letters.split('').join('');
  return payload.items.flatMap((item) => {
    const keys = item.options.map((o) => o.key).join('');
    const issues = keys === expected ? [] : [`item ${numberOf(item)}: options must be ${expected}`];
    if (!letters.includes(item.correct_key)) issues.push(`item ${numberOf(item)}: correct_key not in options`);
    return issues;
  });
}

function gappedText(payload: Payload, start: number, end: number, min: number, max: number, example: boolean): string[] {
  const text = groupOf(payload).stimulus_text ?? '';
  const expected = example ? [0, ...range(start, end)] : range(start, end);
  return [
    ...gapMarkers(text, expected),
    ...inRange('text', countWords(text), min, max),
  ];
}

const readingPart2: Check = (p) => [
  ...requireGroup(p),
  ...gappedText(p, 9, 16, 150, 180, true),
  ...itemCount(p, 8, 9, true),
  ...p.items.flatMap((i) => [
    ...acceptedCheck(i, 1),
    ...(/^[a-z']+$/.test(i.correct_key) ? [] : [`item ${numberOf(i)}: correct_key must be one word`]),
  ]),
];

const readingPart3: Check = (p) => [
  ...requireGroup(p),
  ...gappedText(p, 17, 24, 150, 180, true),
  ...itemCount(p, 8, 17, true),
  ...p.items.flatMap((i) => [
    ...acceptedCheck(i, 1),
    ...(str(i.metadata.base_word) && str(i.metadata.base_word) === str(i.metadata.base_word).toUpperCase()
      ? []
      : [`item ${numberOf(i)}: base_word must be present in CAPITALS`]),
  ]),
];

const readingPart4: Check = (p) => [
  ...requireGroup(p),
  ...itemCount(p, 6, 25, true),
  ...p.items.flatMap((i) => {
    const keyword = str(i.metadata.keyword);
    if (!keyword || keyword !== keyword.toUpperCase()) return [`item ${numberOf(i)}: keyword must be in CAPITALS`];
    const issues = acceptedCheck(i, 5, keyword.toLowerCase());
    if (i.correct_key.trim().split(/\s+/).length < 2) issues.push(`item ${numberOf(i)}: correct_key needs 2-5 words`);
    if (!str(i.metadata.second_sentence_with_gap).includes('____')) {
      issues.push(`item ${numberOf(i)}: second_sentence_with_gap needs a gap`);
    }
    return issues;
  }),
];

const readingPart5: Check = (p) => [
  ...requireGroup(p),
  ...inRange('text', countWords(groupOf(p).stimulus_text ?? ''), 550, 650),
  ...itemCount(p, 6, 31, true),
  ...optionsCheck(p, 'ABCD'),
];

const readingPart6: Check = (p) => {
  const group = groupOf(p);
  const extra = str(group.metadata.extra_key);
  const keys = p.items.map((i) => i.correct_key);
  return [
    ...gappedText(p, 37, 42, 500, 600, false),
    ...itemCount(p, 6, 37, true),
    ...sharedOptions(group, 7),
    ...distinctKeys(p, 'ABCDEFG', true),
    ...(extra && 'ABCDEFG'.includes(extra) && !keys.includes(extra) ? [] : ['extra_key must be a letter no gap uses']),
    ...p.items.flatMap((i) => (i.options.length === 0 ? [] : [`item ${numberOf(i)}: options must be empty`])),
  ];
};

const readingPart7: Check = (p) => {
  const group = groupOf(p);
  const sections = Array.isArray(group.metadata.sections)
    ? (group.metadata.sections as { key?: unknown; text?: unknown }[])
    : [];
  const sectionIssues =
    sections.length === 4 && sections.map((s) => str(s.key)).join('') === 'ABCD'
      ? sections.flatMap((s) => inRange(`section ${str(s.key)}`, countWords(str(s.text)), 120, 150))
      : ['sections must be exactly A-D'];
  return [
    ...sectionIssues,
    ...itemCount(p, 10, 43, true),
    ...sharedOptions(group, 4),
    ...distinctKeys(p, 'ABCD', false),
  ];
};

const listeningPart1: Check = (p) => {
  const issues = [...itemCount(p, 8, 1, false), ...optionsCheck(p, 'ABC')];
  if (p.group !== null) issues.push('group must be null');
  p.items.forEach((i) => {
    issues.push(...inRange(`item ${numberOf(i)} transcript`, countWords(i.transcript ?? ''), 60, 100));
  });
  if (new Set(p.items.map((i) => i.correct_key)).size < 2) issues.push('correct_key must rotate');
  return issues;
};

const listeningPart2: Check = (p) => {
  const transcript = str(groupOf(p).metadata.transcript);
  const lower = transcript.toLowerCase();
  return [
    ...inRange('transcript', countWords(transcript), 380, 520),
    ...itemCount(p, 10, 9, true),
    ...p.items.flatMap((i) => {
      const inScript = strArray(i.metadata.accepted).some((a) => lower.includes(a));
      return [
        ...acceptedCheck(i, 5),
        ...(i.question.includes(`___${numberOf(i)}___`) ? [] : [`item ${numberOf(i)}: question needs ___${numberOf(i)}___`]),
        ...(inScript ? [] : [`item ${numberOf(i)}: answer not found in transcript`]),
      ];
    }),
  ];
};

const listeningPart3: Check = (p) => [
  ...itemCount(p, 5, 19, true),
  ...sharedOptions(groupOf(p), 8),
  ...distinctKeys(p, 'ABCDEFGH', true),
  ...p.items.flatMap((i) => inRange(`speaker ${numberOf(i) - 18} transcript`, countWords(i.transcript ?? ''), 60, 100)),
];

const listeningPart4: Check = (p) => {
  const transcript = str(groupOf(p).metadata.transcript);
  const turns = [/^I:/m.test(transcript), /^E:/m.test(transcript)];
  return [
    ...inRange('transcript', countWords(transcript), 520, 680),
    ...(turns.every(Boolean) ? [] : ['transcript must mark turns with I: and E:']),
    ...itemCount(p, 7, 24, true),
    ...optionsCheck(p, 'ABC'),
  ];
};

const CHECKS: Record<string, Check> = {
  fce_reading_part2: readingPart2,
  fce_reading_part3: readingPart3,
  fce_reading_part4: readingPart4,
  fce_reading_part5: readingPart5,
  fce_reading_part6: readingPart6,
  fce_reading_part7: readingPart7,
  fce_listening_part1: listeningPart1,
  fce_listening_part2: listeningPart2,
  fce_listening_part3: listeningPart3,
  fce_listening_part4: listeningPart4,
};

export const GROUP_PARTS = Object.keys(CHECKS).filter((part) => part !== 'fce_listening_part1');

function normalizeOpenAnswers(payload: Payload): Payload {
  const items = payload.items.map((item) => {
    if (!Array.isArray(item.metadata.accepted)) return item;
    const accepted = strArray(item.metadata.accepted).map((a) => a.trim().toLowerCase());
    return { ...item, correct_key: item.correct_key.trim().toLowerCase(), metadata: { ...item.metadata, accepted } };
  });
  return { ...payload, items };
}

export type ParseResult = { ok: true; data: Payload } | { ok: false; errors: string[] };

/**
 * @param examPart
 * @param raw
 * @returns validated payload or the list of violations
 */
export function parsePayload(examPart: string, raw: unknown): ParseResult {
  const check = CHECKS[examPart];
  if (!check) return { ok: false, errors: [`unsupported exam_part ${examPart}`] };
  const parsed = PayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) };
  }
  const data = normalizeOpenAnswers(parsed.data);
  const errors = check(data);
  return errors.length === 0 ? { ok: true, data } : { ok: false, errors };
}
