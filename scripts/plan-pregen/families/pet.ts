import type { PlanPart } from '../types';
import { PET_CORE_PARTS } from './pet-core';
import { PET_LISTENING_PARTS } from './pet-listening';

export const PET_PARTS: PlanPart[] = [...PET_CORE_PARTS, ...PET_LISTENING_PARTS];
