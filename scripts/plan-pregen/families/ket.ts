import type { PlanPart } from '../types';
import { KET_CORE_PARTS } from './ket-core';
import { KET_LISTENING_PARTS } from './ket-listening';

export const KET_PARTS: PlanPart[] = [...KET_CORE_PARTS, ...KET_LISTENING_PARTS];
