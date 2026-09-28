import type { ImageScene } from '@/actions/gemini';
import type { StoredMessage } from '@/actions/messages';
import type { SceneConfig, Difficulty } from '@/components/ImageConfigSelection';
import { restoreMessages } from './render';
import type { ChatMsg, ChatPhase } from './types';

export interface DerivedChatHistory {
  isHistory: boolean;
  messages: ChatMsg[];
  phase: ChatPhase;
  topic: string;
  dynamicPhrases: string[];
  currentIndex: number;
  currentScene: (ImageScene & { image_data?: string }) | null;
  currentSceneConfig: SceneConfig | null;
  phraseScores: number[];
}

function inferPhaseFromHistory(mode: 'situation' | 'image', msgs: StoredMessage[]): ChatPhase {
  if (!msgs.length) return mode === 'image' ? 'image-config' : 'topic-input';
  if (mode === 'situation') {
    const plan = msgs.find(m => m.msg_type === 'phrase_plan');
    const planLen = (plan?.content_json as { phrases?: string[] } | null)?.phrases?.length ?? 0;
    const evals = msgs.filter(m => m.role === 'bob' && m.msg_type === 'evaluation').length;
    const total = planLen > 0 ? planLen : 10;
    if (evals >= total) return 'finished';
    const last = msgs[msgs.length - 1];
    if (last.role === 'bob' && last.msg_type === 'evaluation') return 'result';
    return 'phrase-ready';
  }
  const last = msgs[msgs.length - 1];
  if (last.role === 'bob') {
    if (last.msg_type === 'image_scene') return 'phrase-ready';
    if (last.msg_type === 'phrase') return 'phrase-ready';
    if (last.msg_type === 'evaluation') return 'result';
  }
  if (last.role === 'user' && last.msg_type === 'user_audio') return 'phrase-ready';
  return 'finished';
}

export function deriveChatHistory(
  mode: 'situation' | 'image',
  initialMessages?: StoredMessage[],
): DerivedChatHistory {
  const isHistory = !!initialMessages && initialMessages.length > 0;
  const hasHistory = isHistory && !!initialMessages;

  const messages = isHistory ? restoreMessages(initialMessages ?? []) : [];

  const phase = hasHistory
    ? inferPhaseFromHistory(mode, initialMessages ?? [])
    : mode === 'image' ? 'image-config' : 'topic-input';

  const topic = (() => {
    if (!hasHistory) return '';
    const firstUser = initialMessages!.find(m => m.role === 'user' && m.msg_type === 'text');
    return firstUser?.content_text ?? '';
  })();

  const dynamicPhrases = (() => {
    if (!hasHistory) return [];
    const plan = initialMessages!.find(m => m.msg_type === 'phrase_plan');
    if (plan) {
      const j = plan.content_json as { phrases?: string[] } | null;
      if (j?.phrases && j.phrases.length > 0) return j.phrases;
    }
    return initialMessages!
      .filter(m => m.msg_type === 'phrase')
      .map(m => m.content_json as { phrase: string; index: number } | null)
      .filter((j): j is { phrase: string; index: number } => !!j?.phrase)
      .sort((a, b) => a.index - b.index)
      .map(j => j.phrase);
  })();

  const currentIndex = (() => {
    if (!hasHistory) return 0;
    const evals = initialMessages!.filter(m => m.role === 'bob' && m.msg_type === 'evaluation').length;
    return Math.max(0, evals - 1);
  })();

  const currentScene = (() => {
    if (!hasHistory) return null;
    const lastImg = [...initialMessages!].reverse().find(m => m.msg_type === 'image_scene');
    if (!lastImg) return null;
    const j = lastImg.content_json as { description: string } | null;
    return { topic: '', description: j?.description ?? '', image_prompt: '', image_data: lastImg.content_text ?? undefined };
  })();

  const currentSceneConfig = (() => {
    if (!hasHistory) return null;
    const configMsg = initialMessages!.find(m => m.role === 'user' && m.msg_type === 'text');
    if (!configMsg?.content_json) return null;
    const j = configMsg.content_json as { topic?: string; difficulty?: string } | null;
    if (!j?.topic || !j?.difficulty) return null;
    if (!(['basic', 'intermediate', 'advanced'] as string[]).includes(j.difficulty)) return null;
    return { topic: j.topic, difficulty: j.difficulty as Difficulty };
  })();

  const phraseScores = (() => {
    if (!hasHistory) return [];
    return initialMessages!
      .filter((m) => m.role === 'bob' && m.msg_type === 'evaluation')
      .map((m) => {
        const j = m.content_json as { score?: number } | null;
        return typeof j?.score === 'number' ? j.score : 0;
      });
  })();

  return {
    isHistory,
    messages,
    phase,
    topic,
    dynamicPhrases,
    currentIndex,
    currentScene,
    currentSceneConfig,
    phraseScores,
  };
}
