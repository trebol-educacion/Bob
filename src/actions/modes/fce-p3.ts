'use server';

import type { FormativeFeedback } from '@/lib/types/practice';
import {
  chatCollaborativeAudio,
  chatCollaborativeText,
  evaluateCollaborative,
  generateCollaborativeScenario,
  readCollaborativeMessages,
} from '@/lib/speaking/collaborative';
import { FCE_COLLABORATIVE_CONFIG } from '@/lib/speaking/fce-configs';
import type { Part3ChatMessage, Part3Scenario } from '@/lib/speaking/types';

export async function generateFCECollaborativeScenarioAction(sessionId?: string): Promise<Part3Scenario> {
  return generateCollaborativeScenario(FCE_COLLABORATIVE_CONFIG, sessionId);
}

export async function chatFCECollaborativeAction(
  audioBase64: string,
  mimeType: string,
  history: Part3ChatMessage[],
  scenario: Part3Scenario,
  sessionId?: string,
): Promise<{ transcribed: string; examinerResponse: string }> {
  return chatCollaborativeAudio(FCE_COLLABORATIVE_CONFIG, audioBase64, mimeType, history, scenario, sessionId);
}

export async function chatFCECollaborativeTextAction(
  text: string,
  history: Part3ChatMessage[],
  scenario: Part3Scenario,
  sessionId?: string,
): Promise<{ examinerResponse: string }> {
  return chatCollaborativeText(FCE_COLLABORATIVE_CONFIG, text, history, scenario, sessionId);
}

export async function evaluateFCECollaborativeAction(
  history: Part3ChatMessage[],
  scenario: Part3Scenario,
  sessionId?: string,
): Promise<FormativeFeedback> {
  return evaluateCollaborative(FCE_COLLABORATIVE_CONFIG, history, scenario, sessionId);
}

export async function getFCECollaborativeMessagesAction(
  sessionId: string,
): Promise<{ history: Part3ChatMessage[]; feedback: FormativeFeedback | null }> {
  return readCollaborativeMessages(sessionId);
}
