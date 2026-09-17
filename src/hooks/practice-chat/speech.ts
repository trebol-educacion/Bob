import { generateSpeechAction } from '@/actions/gemini';
import { pcmToWavBase64 } from '@/lib/audio';

export async function playSpeech(text: string): Promise<void> {
  try {
    const { data, mimeType } = await generateSpeechAction(text);
    const audioUrl = pcmToWavBase64(data, mimeType);
    const audio = new Audio(audioUrl);
    audio.play();
  } catch {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    speechSynthesis.speak(utterance);
  }
}
