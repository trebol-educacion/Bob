import type { GoogleGenAI } from '@google/genai';
import { MODELS } from '../../src/lib/models';

export interface Speaker {
  name: string;
  voice: string;
}

const MAX_ATTEMPTS = 4;

function sampleRate(mimeType?: string): number {
  const match = mimeType?.match(/rate=(\d+)/);
  return match ? Number(match[1]) : 24000;
}

/**
 * @param pcm
 * @param rate
 * @returns 16-bit mono WAV buffer
 */
export function pcmToWav(pcm: Buffer, rate: number): Buffer {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

function speechConfig(speakers: Speaker[]) {
  if (speakers.length === 1) {
    return { voiceConfig: { prebuiltVoiceConfig: { voiceName: speakers[0].voice } } };
  }
  return {
    multiSpeakerVoiceConfig: {
      speakerVoiceConfigs: speakers.map((s) => ({
        speaker: s.name,
        voiceConfig: { prebuiltVoiceConfig: { voiceName: s.voice } },
      })),
    },
  };
}

/**
 * @param ai
 * @param text
 * @param speakers one voice, or two for multi-speaker text labelled "<name>: line"
 * @returns WAV audio
 */
export async function synthesize(ai: GoogleGenAI, text: string, speakers: Speaker[]): Promise<Buffer> {
  let lastError = 'unknown';
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const result = await ai.models.generateContent({
        model: MODELS.TTS,
        contents: [{ role: 'user', parts: [{ text }] }],
        config: { responseModalities: ['audio'], speechConfig: speechConfig(speakers) },
      });
      const part = result.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
      if (part?.inlineData?.data) {
        return pcmToWav(Buffer.from(part.inlineData.data, 'base64'), sampleRate(part.inlineData.mimeType));
      }
      lastError = 'no audio returned';
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 3000));
  }
  throw new Error(`TTS failed: ${lastError}`);
}

/**
 * @param transcript
 * @param labels map of transcript label to speaker
 * @returns text with labels rewritten to speaker names
 */
export function relabel(transcript: string, labels: Record<string, string>): string {
  return Object.entries(labels).reduce(
    (text, [from, to]) => text.replace(new RegExp(`^${from}:`, 'gm'), `${to}:`),
    transcript,
  );
}
