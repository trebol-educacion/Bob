import type { PlanPart } from '../types';
import { PET_LISTENING_MCQ_PARTS } from './pet-listening-mcq';
import { PET_LISTENING_TALK_PARTS } from './pet-listening-talk';

export const PET_LISTENING_PARTS: PlanPart[] = [...PET_LISTENING_MCQ_PARTS, ...PET_LISTENING_TALK_PARTS];
