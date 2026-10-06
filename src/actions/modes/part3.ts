'use server';

import type { ActionResult } from '@/lib/result';
import type { FormativeFeedback } from '@/lib/types/practice';
import {
  chatCollaborativeAudio,
  chatCollaborativeText,
  evaluateCollaborative,
  generateCollaborativeScenario,
  type CollaborativeConfig,
} from '@/lib/speaking/collaborative';
import type { Part3ChatMessage, Part3Scenario } from '@/lib/speaking/types';

const PET_P3_CONFIG: CollaborativeConfig = {
  mode: 'cambridge_pet_p3',
  promptPrefix: 'cambridge_pet_p3_b1',
  scenarioCacheKey: 'cambridge-pet-p3-b1-scenario',
  scenarioFallback: {
    topic: 'Organising a school trip',
    situation: 'You and a friend are planning a day trip for your class.',
    prompt_question: 'Which of these places would be best for your class trip?',
    options: ['the beach', 'a museum', 'a theme park', 'the countryside', 'a sports centre'],
  },
  examLabel: 'Cambridge B1 Preliminary',
  logTag: 'B1',
};

export async function generatePart3ScenarioAction(): Promise<Part3Scenario> {
  return generateCollaborativeScenario(PET_P3_CONFIG);
}

export async function chatPart3Action(
  audioBase64: string,
  mimeType: string,
  history: Part3ChatMessage[],
  scenario: Part3Scenario,
  sessionId?: string
): Promise<ActionResult<{ transcribed: string; examinerResponse: string; sessionId: string }>> {
  return chatCollaborativeAudio(PET_P3_CONFIG, audioBase64, mimeType, history, scenario, sessionId);
}

export async function chatPart3TextAction(
  text: string,
  history: Part3ChatMessage[],
  scenario: Part3Scenario,
  sessionId?: string
): Promise<ActionResult<{ examinerResponse: string; sessionId: string }>> {
  return chatCollaborativeText(PET_P3_CONFIG, text, history, scenario, sessionId);
}

export async function evaluatePart3Action(
  history: Part3ChatMessage[],
  scenario: Part3Scenario,
  sessionId?: string
): Promise<ActionResult<{ feedback: FormativeFeedback; sessionId?: string }>> {
  return evaluateCollaborative(PET_P3_CONFIG, history, scenario, sessionId);
}
