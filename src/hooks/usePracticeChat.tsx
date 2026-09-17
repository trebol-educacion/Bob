'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, Mic } from 'lucide-react';
import { ImageConfigSelection, SceneConfig } from '@/components/ImageConfigSelection';
import {
  generateTopicPhrasesAction,
  generateImageSceneAction,
  generateImageAction,
  evaluatePronunciationAction,
  evaluateImageDescriptionAction,
  EvaluationResult,
  ImageScene,
} from '@/actions/gemini';
import { pregenerateYLCueAudiosAction } from '@/actions/modes/yl';
import { StoredMessage } from '@/actions/messages';
import { blobToBase64 } from '@/lib/audio';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { renderEvaluationContent, renderPhrase, renderScene, restoreMessages } from './practice-chat/render';
import { deriveChatHistory } from './practice-chat/history';
import { uploadImageToStorage } from './practice-chat/storage';
import { playSpeech } from './practice-chat/speech';
import { useChatMessaging } from './practice-chat/useChatMessaging';
import { useInitialGreeting } from './practice-chat/useInitialGreeting';
import type { ChatMsg, ChatPhase } from './practice-chat/types';

export type { ChatMsg, ChatPhase };
export { renderEvaluationContent, restoreMessages };

export interface UsePracticeChatProps {
  mode: 'situation' | 'image';
  onBack: () => void;
  onSessionStart: (title: string) => Promise<string | undefined>;
  sessionId?: string | null;
  initialMessages?: StoredMessage[];
  level?: 'a1' | 'a2' | 'b1' | 'b2';
  onSessionFinished?: () => void;
}

export interface UsePracticeChatReturn {
  phase: ChatPhase;
  messages: ChatMsg[];
  topic: string;
  inputText: string;
  dynamicPhrases: string[];
  currentIndex: number;
  currentScene: (ImageScene & { image_data?: string }) | null;
  currentResult: EvaluationResult | null;
  phraseScores: number[];
  averageScore: number;
  isRecording: boolean;
  saveError: string | null;
  setInputText: (v: string) => void;
  handleTopicSubmit: () => Promise<void>;
  handleNextImage: (config?: SceneConfig) => Promise<void>;
  handleAudioStart: () => Promise<void>;
  stopRecording: () => void;
  handleNext: () => void;
  handleRetry: () => void;
  handleListen: (text: string) => Promise<void>;
  handleImageConfig: (config: SceneConfig) => Promise<void>;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  mode: 'situation' | 'image';
  onBack: () => void;
}

export function usePracticeChat({
  mode,
  onBack,
  onSessionStart,
  sessionId,
  initialMessages,
  level = 'b1',
  onSessionFinished,
}: UsePracticeChatProps): UsePracticeChatReturn {
  const [init] = useState(() => deriveChatHistory(mode, initialMessages));
  const isHistory = init.isHistory;

  const [messages, setMessages] = useState<ChatMsg[]>(init.messages);
  const [phase, setPhase] = useState<ChatPhase>(init.phase);
  const [topic, setTopic] = useState(init.topic);
  const [inputText, setInputText] = useState('');
  const [dynamicPhrases, setDynamicPhrases] = useState<string[]>(init.dynamicPhrases);
  const [currentIndex, setCurrentIndex] = useState<number>(init.currentIndex);
  const [currentScene, setCurrentScene] = useState<(ImageScene & { image_data?: string }) | null>(init.currentScene);
  const [currentSceneConfig, setCurrentSceneConfig] = useState<SceneConfig | null>(init.currentSceneConfig);
  const [currentResult, setCurrentResult] = useState<EvaluationResult | null>(null);
  const [phraseScores, setPhraseScores] = useState<number[]>(init.phraseScores);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const sessionStartedRef = useRef(isHistory);
  const sessionIdRef = useRef<string | null>(sessionId ?? null);

  useEffect(() => {
    if (sessionId) sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  const { saveError, addBobMessage, addUserMessage, saveMsg } = useChatMessaging({ sessionIdRef, setMessages });

  const handleListen = async (text: string) => {
    await playSpeech(text);
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
      const generated = await generateTopicPhrasesAction(t, level);
      setDynamicPhrases(generated);
      setCurrentIndex(0);
      setMessages(prev => prev.slice(0, -1));
      saveMsg({ role: 'bob', msg_type: 'phrase_plan', content_json: { phrases: generated, topic: t } });
      addBobMessage(renderPhrase(generated[0], 0, generated.length, handleListen));
      saveMsg({ role: 'bob', msg_type: 'phrase', content_json: { phrase: generated[0], index: 0, total: generated.length } });
      const sidForPregen = sessionIdRef.current;
      if (sidForPregen && generated.length > 0) {
        void pregenerateYLCueAudiosAction(sidForPregen, generated);
      }
      setPhase('phrase-ready');
    } catch {
      setMessages(prev => prev.slice(0, -1));
      addBobMessage(
        <span className="text-red-500">Could not generate phrases. Want to try a different topic?</span>
      );
      setPhase('topic-input');
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
      const imageLevel: 'b1' | 'b2' = level === 'b2' ? 'b2' : 'b1';
      const scene = await generateImageSceneAction(cfg.topic, cfg.difficulty, imageLevel);
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

  useInitialGreeting({ mode, isHistory, addBobMessage, saveMsg, onImageConfig: handleImageConfig });

  const handleAudioRecorded = async (audioBlob: Blob) => {
    if (!audioBlob || audioBlob.size === 0) {
      addBobMessage(<p>No audio detected. Please try again.</p>);
      setPhase(mode === 'image' ? 'phrase-ready' : 'phrase-ready');
      return;
    }
    setPhase('evaluating');
    try {
      const base64Audio = await blobToBase64(audioBlob);
      const mimeType = (audioBlob.type || 'audio/webm').split(';')[0];
      const result =
        mode === 'situation'
          ? await evaluatePronunciationAction(base64Audio, mimeType, dynamicPhrases[currentIndex], level)
          : await evaluateImageDescriptionAction(
              base64Audio,
              mimeType,
              currentScene?.description || '',
              level === 'b2' ? 'b2' : 'b1',
            );
      setCurrentResult(result);
      if (mode === 'situation') {
        setPhraseScores((prev) => {
          const next = [...prev];
          next[currentIndex] = result.score;
          return next;
        });
      }
      const transcriptText = result.transcribed_text || 'Audio recorded';
      addUserMessage(
        result.transcribed_text ? (
          <span>{result.transcribed_text}</span>
        ) : (
          <span className="flex items-center gap-2 text-sm">
            <Mic size={14} /> Audio recorded
          </span>
        )
      );
      saveMsg({ role: 'user', msg_type: 'user_audio', content_text: transcriptText });
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
      addBobMessage(
        <span className="text-red-500">Evaluation error. Want to try again?</span>
      );
      setPhase('phrase-ready');
    }
  };

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
        addBobMessage(renderPhrase(dynamicPhrases[nextIndex], nextIndex, dynamicPhrases.length, handleListen));
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
        onSessionFinished?.();
      }
    } else {
      handleNextImage();
    }
  };

  const averageScore =
    phraseScores.length > 0
      ? Math.round(phraseScores.reduce((a, b) => a + b, 0) / phraseScores.length)
      : 0;

  return {
    phase,
    messages,
    topic,
    inputText,
    dynamicPhrases,
    currentIndex,
    currentScene,
    currentResult,
    phraseScores,
    averageScore,
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
