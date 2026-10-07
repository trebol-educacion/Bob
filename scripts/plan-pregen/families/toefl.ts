import type { PlanPart } from '../types';
import { TOEFL_LISTENING_PARTS } from './toefl-listening';
import { TOEFL_SPEAKING_PARTS } from './toefl-speaking';
import { TOEFL_WRITING_PARTS } from './toefl-writing';

export const TOEFL_PARTS: PlanPart[] = [...TOEFL_SPEAKING_PARTS, ...TOEFL_WRITING_PARTS, ...TOEFL_LISTENING_PARTS];
