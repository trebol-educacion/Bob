/**
 * Extracted inline prompt: Part 3 chat audio transcription + examiner response instruction.
 * Source: src/actions/modes/part3.ts (was inline at lines 77-83).
 *
 * Seed key: b1_part3_chat_audio
 * No dynamic params — plain static string.
 */

export const PART3_CHAT_AUDIO_PROMPT = `Listen to the candidate's audio. First transcribe exactly what they said, then generate your next examiner response based on the conversation context.

Respond ONLY with valid JSON:
{
  "transcribed": "exact transcription of the candidate's speech",
  "examiner_response": "your next examiner line (under 30 words)"
}`;
