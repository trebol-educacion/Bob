'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, Mic, Volume2 } from 'lucide-react';
import { ImageConfigSelection, SceneConfig, Difficulty } from '@/components/ImageConfigSelection';
import {
  generateTopicPhrasesAction,
  generateImageSceneAction,
  generateImageAction,
  generateSpeechAction,
  evaluatePronunciationAction,
  evaluateImageDescriptionAction,
  EvaluationResult,
  ImageScene,
} from '@/actions/gemini';
import { saveMessageAction, StoredMessage } from '@/actions/messages';
import { blobToBase64, pcmToWavBase64 } from '@/lib/audio';
import { createSupabaseBrowser } from '@/lib/supabase/browser-client';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { getScoreColor } from '@/lib/score';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ChatPhase =
  | 'topic-input'
  | 'image-config'
  | 'generating'
  | 'phrase-ready'
  | 'recording'
  | 'evaluating'
  | 'result'
  | 'finished';

export type ChatMsg = {
  id: string;
  role: 'bob' | 'user';
  content: React.ReactNode;
};

// ─── Shared render helpers ────────────────────────────────────────────────────

export function renderEvaluationContent(
  score: number,
  feedback: string,
  transcribed_text?: string,
  modelAnswer?: string,
): React.ReactNode {
  const roundedScore = Math.round(score);
  const scoreColor = getScoreColor(roundedScore);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className={`text-4xl font-black ${scoreColor}`}>{roundedScore}</span>
        <span className="text-trebol-text/60 text-sm font-medium">/ 100</span>
      </div>
      {transcribed_text && (
        <div className="bg-trebol-bg rounded-lg px-3 py-2 text-sm text-trebol-text/80 italic">
          &quot;{transcribed_text}&quot;
        </div>
      )}
      <p className="text-sm text-trebol-text/80">{feedback}</p>
      {modelAnswer && (
        <div className="bg-trebol-primary/10 border border-trebol-primary/30 rounded-lg px-3 py-2 space-y-1">
          <p className="text-xs font-black uppercase tracking-widest text-trebol-primary">Sample answer</p>
          <p className="text-sm text-trebol-text/80 italic">{modelAnswer}</p>
        </div>
      )}
    </div>
  );
}

export function restoreMessages(stored: StoredMessage[]): ChatMsg[] {
  return stored.map((m) => {
    let content: React.ReactNode;

    if (m.msg_type === 'phrase') {
      const j = m.content_json as { phrase: string; index: number; total: number } | null;
      content = j ? (
        <div className="space-y-3">
          <p className="text-xs font-black uppercase tracking-widest text-trebol-text/50">
            Phrase {j.index + 1} of {j.total}
          </p>
          <div className="bg-trebol-bg border-2 border-trebol-primary/30 rounded-xl p-4">
            <p className="text-xl font-extrabold text-trebol-text leading-relaxed">{j.phrase}</p>
          </div>
          <p className="text-sm text-trebol-text/60">Listen to the phrase, then record yourself saying it.</p>
        </div>
      ) : <span>{m.content_text}</span>;
    } else if (m.msg_type === 'image_scene') {
      const j = m.content_json as { description: string } | null;
      content = (
        <div className="space-y-3">
          <p className="text-sm text-trebol-text/60">
            Describe what you see in this image in English. You have 60 seconds.
          </p>
          {m.content_text ? (
            <img
              src={m.content_text}
              alt="Scene to describe"
              className="w-full rounded-xl border-2 border-trebol-border shadow-md"
            />
          ) : j?.description ? (
            <p className="text-xs text-trebol-text/50 italic">{j.description}</p>
          ) : null}
        </div>
      );
    } else if (m.msg_type === 'evaluation') {
      const j = m.content_json as { score: number; feedback: string; transcribed_text?: string; model_answer?: string } | null;
      content = j
        ? renderEvaluationContent(j.score, j.feedback, j.transcribed_text, j?.model_answer)
        : <span>{m.content_text}</span>;
    } else if (m.msg_type === 'user_audio') {
      content = (
        <span className="flex items-center gap-2 text-sm">
          <Mic size={14} /> Audio recorded
        </span>
      );
    } else {
      content = <span>{m.content_text}</span>;
    }

    return { id: m.id, role: m.role, content };
  });
}

// ─── Hook interface ───────────────────────────────────────────────────────────

export interface UsePracticeChatProps {
  mode: 'situation' | 'image';
  onBack: () => void;
  onSessionStart: (title: string) => Promise<string | undefined>;
  sessionId?: string | null;
  initialMessages?: StoredMessage[];
}

export interface UsePracticeChatReturn {
  // State
  phase: ChatPhase;
  messages: ChatMsg[];
  topic: string;
  inputText: string;
  dynamicPhrases: string[];
  currentIndex: number;
  currentScene: (ImageScene & { image_data?: string }) | null;
  currentResult: EvaluationResult | null;
  isRecording: boolean;
  saveError: string | null;
  // Setters needed by sub-components
  setInputText: (v: string) => void;
  // Handlers
  handleTopicSubmit: () => Promise<void>;
  handleNextImage: (config?: SceneConfig) => Promise<void>;
  handleAudioStart: () => Promise<void>;
  stopRecording: () => void;
  handleNext: () => void;
  handleRetry: () => void;
  handleListen: (text: string) => Promise<void>;
  handleImageConfig: (config: SceneConfig) => Promise<void>;
  // Refs needed by JSX
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  // Props passthrough
  mode: 'situation' | 'image';
  onBack: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePracticeChat({
  mode,
  onBack,
  onSessionStart,
  sessionId,
  initialMessages,
}: UsePracticeChatProps): UsePracticeChatReturn {
  const isHistory = !!initialMessages && initialMessages.length > 0;

  const inferPhaseFromHistory = (msgs: StoredMessage[]): ChatPhase => {
    if (!msgs.length) return mode === 'image' ? 'image-config' : 'topic-input';
    const last = msgs[msgs.length - 1];
    if (last.role === 'bob') {
      if (last.msg_type === 'image_scene') return 'phrase-ready';
      if (last.msg_type === 'phrase') return 'phrase-ready';
      if (last.msg_type === 'evaluation') return 'result';
    }
    if (last.role === 'user' && last.msg_type === 'user_audio') return 'phrase-ready';
    return 'finished';
  };

  const [messages, setMessages] = useState<ChatMsg[]>(() =>
    isHistory ? restoreMessages(initialMessages) : []
  );
  const [phase, setPhase] = useState<ChatPhase>(() => {
    if (isHistory) return inferPhaseFromHistory(initialMessages ?? []);
    return mode === 'image' ? 'image-config' : 'topic-input';
  });
  const [topic, setTopic] = useState(() => {
    if (!isHistory || !initialMessages) return '';
    const firstUser = initialMessages.find(m => m.role === 'user' && m.msg_type === 'text');
    return firstUser?.content_text ?? '';
  });
  const [inputText, setInputText] = useState('');
  const [dynamicPhrases, setDynamicPhrases] = useState<string[]>(() => {
    if (!isHistory || !initialMessages) return [];
    const lastPhrase = [...initialMessages].reverse().find(m => m.msg_type === 'phrase');
    if (!lastPhrase) return [];
    const j = lastPhrase.content_json as { phrase: string } | null;
    return j?.phrase ? [j.phrase] : [];
  });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentScene, setCurrentScene] = useState<(ImageScene & { image_data?: string }) | null>(() => {
    if (!isHistory || !initialMessages) return null;
    const lastImg = [...initialMessages].reverse().find(m => m.msg_type === 'image_scene');
    if (!lastImg) return null;
    const j = lastImg.content_json as { description: string } | null;
    return { topic: '', description: j?.description ?? '', image_prompt: '', image_data: lastImg.content_text ?? undefined };
  });
  const [currentSceneConfig, setCurrentSceneConfig] = useState<SceneConfig | null>(() => {
    if (!isHistory || !initialMessages) return null;
    const configMsg = initialMessages.find(m => m.role === 'user' && m.msg_type === 'text');
    if (!configMsg?.content_json) return null;
    const j = configMsg.content_json as { topic?: string; difficulty?: string } | null;
    if (!j?.topic || !j?.difficulty) return null;
    if (!(['basic', 'intermediate', 'advanced'] as string[]).includes(j.difficulty)) return null;
    return { topic: j.topic, difficulty: j.difficulty as Difficulty };
  });
  const [currentResult, setCurrentResult] = useState<EvaluationResult | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const sessionStartedRef = useRef(isHistory);
  const greetingAddedRef = useRef(false);
  const sessionIdRef = useRef<string | null>(sessionId ?? null);

  // Sync sessionId prop → ref
  useEffect(() => {
    if (sessionId) sessionIdRef.current = sessionId;
  }, [sessionId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Audio recorder ────────────────────────────────────────────────────────

  // Stable ref so useAudioRecorder never captures a stale callback
  const onRecordedRef = useRef<(blob: Blob) => void>(() => {});

  const { isRecording, startRecording: startRecordingHook, stopRecording } = useAudioRecorder({
    onRecorded: useCallback((blob: Blob) => onRecordedRef.current(blob), []),
    onError: useCallback(() => {
      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'bob' as const,
          content: <span className="text-red-500">Could not access microphone. Please check your permissions.</span>,
        },
      ]);
    }, []),
  });

  // ── Message helpers ───────────────────────────────────────────────────────

  const addBobMessage = (content: React.ReactNode) => {
    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bob', content }]);
  };

  const addUserMessage = (content: React.ReactNode) => {
    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'user', content }]);
  };

  const saveMsg = async (input: Omit<Parameters<typeof saveMessageAction>[0], 'session_id'>) => {
    const sid = sessionIdRef.current;
    if (!sid) return;
    const { error } = await saveMessageAction({ ...input, session_id: sid });
    if (error) {
      console.error('[saveMsg] failed:', error, 'msg_type:', input.msg_type);
      setSaveError(`Error saving message (${input.msg_type})`);
      // Auto-clear after 4 seconds
      setTimeout(() => setSaveError(null), 4000);
    }
  };

  // ── Render helpers (phrase / scene / result) ──────────────────────────────

  const renderPhrase = (phrase: string, index: number, total: number) => (
    <div className="space-y-3">
      <p className="text-xs font-black uppercase tracking-widest text-trebol-text/50">
        Phrase {index + 1} of {total}
      </p>
      <div className="bg-trebol-bg border-2 border-trebol-primary/30 rounded-xl p-4">
        <p className="text-xl font-extrabold text-trebol-text leading-relaxed">{phrase}</p>
      </div>
      <p className="text-sm text-trebol-text/60">Listen to the phrase, then record yourself saying it.</p>
      <button
        type="button"
        onClick={() => handleListen(phrase)}
        className="flex items-center gap-2 text-sm font-bold text-trebol-primary hover:opacity-75 transition-opacity"
      >
        <Volume2 size={16} /> Listen to pronunciation
      </button>
    </div>
  );

  const renderScene = (scene: ImageScene & { image_data?: string }) => (
    <div className="space-y-3">
      <p className="text-sm text-trebol-text/60">
        Describe what you see in this image in English. You have 60 seconds.
      </p>
      {scene.image_data && (
        <img
          src={scene.image_data}
          alt="Scene to describe"
          className="w-full rounded-xl border-2 border-trebol-border shadow-md"
        />
      )}
    </div>
  );

  // ── Initial greeting ──────────────────────────────────────────────────────

  useEffect(() => {
    if (isHistory || greetingAddedRef.current) return;
    greetingAddedRef.current = true;
    if (mode === 'situation') {
      addBobMessage(
        <p>
          Hi! I&apos;m <strong>BOB</strong>, your pronunciation coach. What situation would you like to practice today?
          <br />
          <span className="text-trebol-text/60 text-sm">
            E.g. &quot;In a job interview&quot; or &quot;Asking for directions on the street&quot;.
          </span>
        </p>
      );
      saveMsg({
        role: 'bob',
        msg_type: 'text',
        content_text: "Hi! I'm BOB, your pronunciation coach. What situation would you like to practice today?",
      });
    } else {
      addBobMessage(
        <div className="space-y-3">
          <p>Let&apos;s practice image description! Configure your scene:</p>
          <ImageConfigSelection onConfirm={handleImageConfig} />
        </div>
      );
      saveMsg({
        role: 'bob',
        msg_type: 'text',
        content_text: "Let's practice image description! Configure your scene:",
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleListen = async (text: string) => {
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
  };

  const handleTopicSubmit = async () => {
    if (!inputText.trim()) return;
    const t = inputText.trim();
    setTopic(t);
    setInputText('');
    addUserMessage(<span>{t}</span>);
    saveMsg({ role: 'user', msg_type: 'text', content_text: t });
    setPhase('generating');
    addBobMessage(
      <span className="flex items-center gap-2 text-trebol-text/70">
        <Loader2 size={16} className="animate-spin" /> Creating your practice...
      </span>
    );
    if (!sessionStartedRef.current) {
      sessionStartedRef.current = true;
      const id = await onSessionStart(t.slice(0, 60) || 'Phrase practice');
      if (id) sessionIdRef.current = id;
    }
    try {
      const generated = await generateTopicPhrasesAction(t);
      setDynamicPhrases(generated);
      setCurrentIndex(0);
      setMessages(prev => prev.slice(0, -1));
      addBobMessage(renderPhrase(generated[0], 0, generated.length));
      saveMsg({ role: 'bob', msg_type: 'phrase', content_json: { phrase: generated[0], index: 0, total: generated.length } });
      setPhase('phrase-ready');
    } catch {
      setMessages(prev => prev.slice(0, -1));
      addBobMessage(
        <span className="text-red-500">Could not generate phrases. Want to try a different topic?</span>
      );
      setPhase('topic-input');
    }
  };

  const uploadImageToStorage = async (imageDataUrl: string): Promise<string> => {
    const supabase = createSupabaseBrowser();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const res = await fetch(imageDataUrl);
    const blob = await res.blob();
    const ext = blob.type.includes('png') ? 'png' : 'jpg';
    const filename = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('bob-images').upload(filename, blob, { contentType: blob.type });
    if (error) throw error;
    return supabase.storage.from('bob-images').getPublicUrl(filename).data.publicUrl;
  };

  const handleNextImage = async (config?: SceneConfig) => {
    const cfg = config ?? currentSceneConfig;
    if (!cfg) {
      addBobMessage(
        <div className="space-y-3">
          <p>Choose the next scene!</p>
          <ImageConfigSelection onConfirm={handleImageConfig} />
        </div>
      );
      setPhase('image-config');
      return;
    }
    setPhase('generating');
    addBobMessage(
      <span className="flex items-center gap-2 text-trebol-text/70">
        <Loader2 size={16} className="animate-spin" /> Generating new scene...
      </span>
    );
    try {
      const scene = await generateImageSceneAction(cfg.topic, cfg.difficulty);
      const imageData = await generateImageAction(scene.image_prompt);
      const fullScene = { ...scene, image_data: imageData };
      setCurrentScene(fullScene);
      setMessages(prev => prev.slice(0, -1));
      addBobMessage(renderScene(fullScene));
      const imageUrl = await uploadImageToStorage(imageData);
      saveMsg({ role: 'bob', msg_type: 'image_scene', content_text: imageUrl, content_json: { description: scene.description } });
      setPhase('phrase-ready');
    } catch (err) {
      console.error('[handleNextImage]', err);
      setMessages(prev => prev.slice(0, -1));
      addBobMessage(<span className="text-red-500">Error generating image. Please try again.</span>);
      setPhase('result');
    }
  };

  const handleImageConfig = async (config: SceneConfig) => {
    setCurrentSceneConfig(config);
    addUserMessage(<span>{config.topic} · {config.difficulty}</span>);
    saveMsg({ role: 'user', msg_type: 'text', content_text: `${config.topic} · ${config.difficulty}`, content_json: { topic: config.topic, difficulty: config.difficulty } });
    if (!sessionStartedRef.current) {
      sessionStartedRef.current = true;
      const id = await onSessionStart(config.topic.slice(0, 60) || 'Describe the scene');
      if (id) sessionIdRef.current = id;
    }
    await handleNextImage(config);
  };

  const handleAudioRecorded = async (audioBlob: Blob) => {
    if (!audioBlob || audioBlob.size === 0) {
      addBobMessage(<p>No audio detected. Please try again.</p>);
      setPhase(mode === 'image' ? 'phrase-ready' : 'phrase-ready');
      return;
    }
    addUserMessage(
      <span className="flex items-center gap-2 text-sm">
        <Mic size={14} /> Audio recorded
      </span>
    );
    saveMsg({ role: 'user', msg_type: 'user_audio', content_text: 'Audio recorded' });
    setPhase('evaluating');
    addBobMessage(
      <span className="flex items-center gap-2 text-trebol-text/70">
        <Loader2 size={16} className="animate-spin" /> Analyzing your pronunciation...
      </span>
    );
    try {
      const base64Audio = await blobToBase64(audioBlob);
      const mimeType = (audioBlob.type || 'audio/webm').split(';')[0];
      const result =
        mode === 'situation'
          ? await evaluatePronunciationAction(base64Audio, mimeType, dynamicPhrases[currentIndex])
          : await evaluateImageDescriptionAction(
              base64Audio,
              mimeType,
              currentScene?.description || ''
            );
      setCurrentResult(result);
      setMessages(prev => prev.slice(0, -1));
      const modelAnswer = mode === 'image' ? result.model_answer : undefined;
      addBobMessage(renderEvaluationContent(result.score, result.feedback, result.transcribed_text, modelAnswer));
      saveMsg({
        role: 'bob',
        msg_type: 'evaluation',
        content_json: {
          score: result.score,
          feedback: result.feedback,
          transcribed_text: result.transcribed_text ?? null,
          model_answer: result.model_answer ?? null,
        },
      });
      setPhase('result');
    } catch {
      setMessages(prev => prev.slice(0, -1));
      addBobMessage(
        <span className="text-red-500">Evaluation error. Want to try again?</span>
      );
      setPhase('phrase-ready');
    }
  };

  // Keep the ref in sync so the hook always calls the latest version
  onRecordedRef.current = handleAudioRecorded;

  const handleAudioStart = async () => {
    await startRecordingHook();
    setPhase('recording');
  };

  const handleRetry = () => {
    setPhase('phrase-ready');
    setCurrentResult(null);
  };

  const handleNext = () => {
    if (mode === 'situation') {
      if (currentIndex < dynamicPhrases.length - 1) {
        const nextIndex = currentIndex + 1;
        setCurrentIndex(nextIndex);
        addBobMessage(renderPhrase(dynamicPhrases[nextIndex], nextIndex, dynamicPhrases.length));
        saveMsg({
          role: 'bob',
          msg_type: 'phrase',
          content_json: { phrase: dynamicPhrases[nextIndex], index: nextIndex, total: dynamicPhrases.length },
        });
        setPhase('phrase-ready');
      } else {
        const completionText = `Session complete! You practiced ${dynamicPhrases.length} phrases about "${topic}". Keep it up!`;
        addBobMessage(
          <div className="space-y-1">
            <p className="font-black text-trebol-primary">Session complete! 🎉</p>
            <p className="text-sm text-trebol-text/70">
              You practiced {dynamicPhrases.length} phrases about &quot;{topic}&quot;. Keep it up!
            </p>
          </div>
        );
        saveMsg({ role: 'bob', msg_type: 'text', content_text: completionText });
        setPhase('finished');
      }
    } else {
      handleNextImage();
    }
  };

  return {
    phase,
    messages,
    topic,
    inputText,
    dynamicPhrases,
    currentIndex,
    currentScene,
    currentResult,
    isRecording,
    saveError,
    setInputText,
    handleTopicSubmit,
    handleNextImage,
    handleAudioStart,
    stopRecording,
    handleNext,
    handleRetry,
    handleListen,
    handleImageConfig,
    messagesEndRef,
    mode,
    onBack,
  };
}
