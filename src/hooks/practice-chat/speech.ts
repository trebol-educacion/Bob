import { generateSpeechAction } from '@/actions/gemini';
import { pcmToWavBase64 } from '@/lib/audio';
import { playClip } from '@/lib/audio-clip';

function speakWithBrowserTts(text: string): void {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  speechSynthesis.speak(utterance);
}

export async function playSpeech(text: string): Promise<void> {
  try {
    const { data, mimeType } = await generateSpeechAction(text);
    if (!data) {
      speakWithBrowserTts(text);
      return;
    }
    const audioUrl = pcmToWavBase64(data, mimeType);
    const playback = playClip(audioUrl, { onError: () => speakWithBrowserTts(text) });
    void playback.finished;
  } catch {
    speakWithBrowserTts(text);
  }
}
