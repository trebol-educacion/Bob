'use server';

import type { ActionResult } from '@/lib/result';
import type { FormativeFeedback } from '@/lib/types/practice';
import {
  chatCollaborativeAudio,
  chatCollaborativeText,
  evaluateCollaborative,
  generateCollaborativeScenario,
} from '@/lib/speaking/collaborative';
import { FCE_COLLABORATIVE_CONFIG } from '@/lib/speaking/fce-configs';
import type { Part3ChatMessage, Part3Scenario } from '@/lib/speaking/types';

export async function generateFCECollaborativeScenarioAction(): Promise<Part3Scenario> {
  return generateCollaborativeScenario(FCE_COLLABORATIVE_CONFIG);
}

export async function chatFCECollaborativeAction(
  audioBase64: string,
  mimeType: string,
  history: Part3ChatMessage[],
  scenario: Part3Scenario,
  sessionId?: string,
): Promise<ActionResult<{ transcribed: string; examinerResponse: string; sessionId: string }>> {
  return chatCollaborativeAudio(FCE_COLLABORATIVE_CONFIG, audioBase64, mimeType, history, scenario, sessionId);
}

export async function chatFCECollaborativeTextAction(
  text: string,
  history: Part3ChatMessage[],
  scenario: Part3Scenario,
  sessionId?: string,
): Promise<ActionResult<{ examinerResponse: string; sessionId: string }>> {
  return chatCollaborativeText(FCE_COLLABORATIVE_CONFIG, text, history, scenario, sessionId);
}

export async function evaluateFCECollaborativeAction(
  history: Part3ChatMessage[],
  scenario: Part3Scenario,
  sessionId?: string,
): Promise<ActionResult<{ feedback: FormativeFeedback; sessionId?: string }>> {
  return evaluateCollaborative(FCE_COLLABORATIVE_CONFIG, history, scenario, sessionId);
}
