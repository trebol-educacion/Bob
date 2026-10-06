import type { PickedContent } from '@/lib/item-bank/content-source';

export interface EssayNote {
  id: number;
  label: string;
  description: string;
}

export interface EssayTask {
  title: string;
  essayQuestion: string;
  context: string;
  notes: [EssayNote, EssayNote, EssayNote];
  wordTargetMin: 140;
  wordTargetMax: 190;
  bankGroupId: string;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function toNote(value: unknown, index: number): EssayNote | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const label = text(raw.label);
  const description = text(raw.description);
  return label && description ? { id: index + 1, label, description } : null;
}

/**
 * @param picked content read from the bank
 * @returns the essay task, or null when the group does not hold a complete one
 */
export function toEssayTask(picked: PickedContent): EssayTask | null {
  if (picked.kind !== 'group') return null;
  const data = picked.group.metadata;
  const notes = Array.isArray(data.notes) ? data.notes.map(toNote) : [];
  const [first, second, third] = notes;
  const title = text(data.title);
  if (!first || !second || !third || notes.length !== 3 || !title) return null;
  return {
    title,
    essayQuestion: text(data.essay_question),
    context: text(data.context),
    notes: [first, second, third],
    wordTargetMin: 140,
    wordTargetMax: 190,
    bankGroupId: picked.group.id,
  };
}
