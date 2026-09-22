import type { CefrLevel, ClosedItem } from '@/lib/types/practice';

export type ItemBankExam =
  | 'ket'
  | 'pet'
  | 'fce'
  | 'toefl'
  | 'yle_starters'
  | 'yle_movers'
  | 'yle_flyers'
  | 'cefr';

export type ItemBankSkill = 'listening' | 'reading' | 'writing' | 'speaking';

export type ItemBankPurpose = 'practice' | 'placement' | 'exam';

export type ItemBankSource = 'official' | 'generated_then_curated' | 'generated';

export type ItemBankStatus = 'draft' | 'published' | 'retired';

export type ItemBankDifficulty = 1 | 2 | 3;

/** Row from bob.item_groups. */
export interface ItemGroup {
  id: string;
  exam: ItemBankExam;
  skill: ItemBankSkill;
  cefr_level: CefrLevel | null;
  difficulty: ItemBankDifficulty | null;
  purpose: ItemBankPurpose;
  module_code: string | null;
  stimulus_text: string | null;
  stimulus_audio_url: string | null;
  stimulus_image_url: string | null;
  source: ItemBankSource;
  source_ref: string | null;
  status: ItemBankStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

/** Row from bob.closed_items, optionally attached to an item_groups group. */
export type BankItem = ClosedItem;

/** {@link BankItem} without answer-key fields — the only shape allowed on the client. */
export type PublicBankItem = Omit<BankItem, 'correct_key' | 'explanation'>;

/** {@link ItemGroup} without reviewer/source fields not needed by the client. */
export type PublicItemGroup = Omit<ItemGroup, 'reviewed_by' | 'reviewed_at' | 'source_ref'>;

/** Row from bob.open_tasks — official Writing/Speaking tasks, replaces hardcoded prompts. */
export interface OpenTask {
  id: string;
  skill: Extract<ItemBankSkill, 'writing' | 'speaking'>;
  exam: ItemBankExam;
  cefr_level: CefrLevel | null;
  difficulty: ItemBankDifficulty | null;
  purpose: ItemBankPurpose;
  instructions: string;
  questions: Record<string, unknown>;
  rubric_prompt_key: string;
  status: ItemBankStatus;
  created_at: string;
}

/** Row from bob.test_configs — thresholds and bands kept out of code. */
export interface TestConfig {
  code: string;
  kind: 'placement' | 'adaptive_exam';
  config: Record<string, unknown>;
  created_at: string;
}
