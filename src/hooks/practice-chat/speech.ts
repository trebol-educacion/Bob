import { generateSpeechAction } from '@/actions/gemini';
import { getOrCreateCueAudioAction } from '@/actions/modes/yl/audio';
import { pcmToWavBase64 } from '@/lib/audio';

function speakWithBrowserTts(text: string): void {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  speechSynthesis.speak(utterance);
}

export async function playSpeech(sessionId: string | null, text: string): Promise<void> {
  try {
    const { data, mimeType } = sessionId
      ? await getOrCreateCueAudioAction(sessionId, text)
      : await generateSpeechAction(text);
    if (!data) {
      speakWithBrowserTts(text);
      return;
    }
    const audioUrl = pcmToWavBase64(data, mimeType);
    const audio = new Audio(audioUrl);
    audio.play();
  } catch {
    speakWithBrowserTts(text);
  }
}
