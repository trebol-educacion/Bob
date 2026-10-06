import type { Payload } from './schemas';
import { countWords, gapNumbers } from './text';

type Check = (payload: Payload) => string[];

const PEOPLE = /\b(person|people|man|men|woman|women|girl|girls|boy|boys|friends?|family|couple|students?|teenagers?|child|children|kids?|group|team|colleagues?|worker|workers|runner|runners|players?|passengers?|tourists?)\b/i;

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

function meta(payload: Payload): Record<string, unknown> {
  return payload.group?.metadata ?? {};
}

function inRange(label: string, value: number, min: number, max: number): string[] {
  return value >= min && value <= max ? [] : [`${label}: ${value}, expected ${min}-${max}`];
}

const readingPart1: Check = (p) => {
  const text = p.group?.stimulus_text ?? '';
  const found = gapNumbers(text).join(',');
  const issues = [
    ...(found === '1,2,3,4,5,6,7,8' ? [] : [`gap markers ${found || 'none'}, expected 1..8 without the example`]),
    ...inRange('text words', countWords(text), 140, 190),
    ...inRange('title words', countWords(str(meta(p).title)), 2, 8),
  ];
  const example = meta(p).example as { sentence?: unknown; options?: unknown[]; answer?: unknown } | undefined;
  if (!example || !str(example.sentence).includes('___0___') || (example.options?.length ?? 0) !== 4) {
    issues.push('example needs a sentence with ___0___ and 4 options');
  }
  if (p.items.length !== 8) issues.push(`expected 8 items, got ${p.items.length}`);
  p.items.forEach((item, index) => {
    const keys = item.options.map((o) => o.key).join('');
    if (keys !== 'ABCD') issues.push(`item ${index + 1}: options must be ABCD`);
    if (!'ABCD'.includes(item.correct_key)) issues.push(`item ${index + 1}: correct_key not in options`);
    if (Number(item.metadata.number) !== index + 1) issues.push(`item ${index + 1}: metadata.number must be ${index + 1}`);
    item.options.forEach((o) => {
      if (countWords(o.label) > 4) issues.push(`item ${index + 1}: option ${o.key} longer than 4 words`);
    });
    if (new Set(item.options.map((o) => o.label.toLowerCase())).size !== 4) issues.push(`item ${index + 1}: duplicated options`);
  });
  return issues;
};

const writingPart1: Check = (p) => {
  const data = meta(p);
  const notes = Array.isArray(data.notes) ? (data.notes as { id?: unknown; label?: unknown; description?: unknown }[]) : [];
  const issues = [...inRange('title words', countWords(str(data.title)), 6, 45)];
  if (!/[?.]$/.test(str(data.title).trim())) issues.push('title must end with ? or .');
  if (!/english class/i.test(str(data.context))) issues.push('context must set up the English class');
  if (!str(data.essay_question).trim()) issues.push('essay_question required');
  if (notes.length !== 3) return [...issues, `expected 3 notes, got ${notes.length}`];
  notes.forEach((note, index) => {
    if (Number(note.id) !== index + 1) issues.push(`note ${index + 1}: id must be ${index + 1}`);
    if (!str(note.description).trim()) issues.push(`note ${index + 1}: description required`);
  });
  [0, 1].forEach((index) => issues.push(...inRange(`note ${index + 1} label words`, countWords(str(notes[index].label)), 1, 4)));
  if (str(notes[2].label).trim().toLowerCase() !== 'your own idea') issues.push('note 3 label must be "your own idea"');
  if (Number(data.word_target_min ?? 140) !== 140 || Number(data.word_target_max ?? 190) !== 190) {
    issues.push('word targets must be 140-190');
  }
  return issues;
};

function questionList(label: string, value: unknown, min: number, max: number): string[] {
  const questions = strings(value);
  const issues = [...inRange(`${label} count`, questions.length, min, max)];
  questions.forEach((q, index) => {
    if (!q.trim().endsWith('?')) issues.push(`${label} ${index + 1}: must be a question`);
    issues.push(...inRange(`${label} ${index + 1} words`, countWords(q), 4, 35));
  });
  if (new Set(questions.map((q) => q.trim().toLowerCase())).size !== questions.length) issues.push(`${label}s must be distinct`);
  return issues;
}

const speakingPart1: Check = (p) => questionList('question', meta(p).questions, 3, 4);

const speakingPart4: Check = (p) => questionList('question', meta(p).questions, 3, 4);

const speakingPart2: Check = (p) => {
  const data = meta(p);
  const issues: string[] = [];
  for (const side of ['a', 'b'] as const) {
    const scene = str(data[`scene_prompt_${side}`]);
    issues.push(...inRange(`scene ${side} words`, countWords(scene), 25, 80));
    if (!PEOPLE.test(scene)) issues.push(`scene ${side} must show people`);
  }
  if (!str(data.comparison_question).trim().endsWith('?')) issues.push('comparison_question must be a question');
  if (str(data.scene_prompt_a).trim() === str(data.scene_prompt_b).trim()) issues.push('scenes must differ');
  return issues;
};

export const OPEN_CHECKS: Record<string, Check> = {
  fce_reading_part1: readingPart1,
  fce_writing_part1: writingPart1,
  fce_speaking_part1: speakingPart1,
  fce_speaking_part2: speakingPart2,
  fce_speaking_part4: speakingPart4,
};
