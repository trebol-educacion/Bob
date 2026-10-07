import { generateSpeechAction } from '@/actions/gemini';
import { pcmToWavBase64 } from '@/lib/audio';
import type { YLPlan } from '@/lib/types/yl';

const bankAudio = new Map<string, string>();

/**
 * @param plan plan whose pregenerated audio is registered for playback
 * @returns the same plan
 */
export function withBankAudio(plan: YLPlan): YLPlan {
  for (const [text, url] of Object.entries(plan.audio_urls ?? {})) bankAudio.set(text, url);
  return plan;
}

/**
 * @param text phrase Bob speaks
 * @returns pregenerated MP3 URL, or a live TTS URL for phrases outside the bank
 */
export async function resolveCueAudioUrl(text: string): Promise<string> {
  const banked = bankAudio.get(text.trim());
  if (banked) return banked;
  const { data, mimeType } = await generateSpeechAction(text);
  return pcmToWavBase64(data, mimeType);
}
