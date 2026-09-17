import type { CefrLevel, ModeFramework } from '@/lib/types/practice';

export interface AvailableMode {
  framework: ModeFramework;
  exam_part: string;
  cefr_level: CefrLevel | null;
  label: string;
  description: string | null;
}

export type BobAccessDenialReason =
  | 'not_authenticated'
  | 'no_profile'
  | 'not_student'
  | 'no_organization'
  | 'bob_not_enabled'
  | 'no_license';
