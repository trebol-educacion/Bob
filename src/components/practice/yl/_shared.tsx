'use client';

/**
 * Shared utilities and sub-components for YL practice components.
 * Keeps recurring patterns (audio, TTS, results, turn loop) DRY across Part1–4.
 */

import React from 'react';
import Image from 'next/image';
import { motion } from 'motion/react';
import { ArrowLeft, Mic, MicOff, CheckCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { generateSpeechAction } from '@/actions/gemini';
import { getOrCreateCueAudioAction } from '@/actions/modes/yl';
import { pcmToWavBase64 } from '@/lib/audio';
import type { EvalResponse } from '@/lib/types/practice';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import { setBobSpeaking, useBobSpeaking } from '@/lib/bob-speaking';

export const RECORDING_MAX_SECONDS = 45;
export const REACTION_PAUSE_MS = 1200;

export function BobAvatar() {
  const speaking = useBobSpeaking();
  return (
    <div className="w-8 h-8 rounded-xl overflow-hidden shrink-0 bg-white border border-gray-100 mt-1 relative">
      <Image
        src="/bob_avatar.png"
        alt="Bob"
        fill
        sizes="32px"
        className="object-contain"
      />
      {speaking && (
        <video
          autoPlay
          muted
          playsInline
          loop
          preload="auto"
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src="/bob_speaking.mp4" type="video/mp4" />
        </video>
      )}
    </div>
  );
}

let _currentAudio: HTMLAudioElement | null = null;
let _currentText: string | null = null;
let _cachedUrl: string | null = null;

export function stopCurrentAudio(): void {
  if (_currentAudio) {
    _currentAudio.pause();
    _currentAudio = null;
  }
  _currentText = null;
  _cachedUrl = null;
  setBobSpeaking(false);
}

export function pauseCurrentAudio(): void {
  if (_currentAudio && !_currentAudio.paused) {
    _currentAudio.pause();
    setBobSpeaking(false);
  }
}

export function isAudioPaused(): boolean {
  return !!_currentAudio && _currentAudio.paused;
}

export async function resumeCurrentAudio(): Promise<void> {
  if (_currentAudio && _currentAudio.paused) {
    try {
      await _currentAudio.play();
      setBobSpeaking(true);
    } catch { /* ignore */ }
  }
}

export async function playTTS(text: string): Promise<void> {
  if (_currentText === text && _cachedUrl) {
    if (_currentAudio) _currentAudio.pause();
    const audio = new Audio(_cachedUrl);
    _currentAudio = audio;
    setBobSpeaking(true);
    await new Promise<void>((resolve) => {
      audio.onended = () => { setBobSpeaking(false); resolve(); };
      audio.onerror = () => { setBobSpeaking(false); resolve(); };
      audio.onpause = () => setBobSpeaking(false);
      audio.play().catch(() => { setBobSpeaking(false); resolve(); });
    });
    return;
  }

  stopCurrentAudio();
  try {
    const { data, mimeType } = await generateSpeechAction(text);
    const url = pcmToWavBase64(data, mimeType);
    _currentText = text;
    _cachedUrl = url;
    const audio = new Audio(url);
    _currentAudio = audio;
    setBobSpeaking(true);
    await new Promise<void>((resolve) => {
      audio.onended = () => { setBobSpeaking(false); resolve(); };
      audio.onerror = () => { setBobSpeaking(false); resolve(); };
      audio.onpause = () => setBobSpeaking(false);
      audio.play().catch(() => { setBobSpeaking(false); resolve(); });
    });
  } catch {
    setBobSpeaking(false);
  }
}

/** Loading screen shown during YL activity setup — uses Bob mascot per D-B3. */
export function YLLoadingScreen({ message }: { message: string }) {
  return <BobMascotLoader message={message} />;
}

export function YLErrorScreen({
  error,
  onRetry,
  onBack,
}: {
  error: string;
  onRetry?: () => void;
  onBack: () => void;
}) {
  const t = useTranslations('yl');
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
      <p className="text-red-500 font-semibold text-center">{error}</p>
      <div className="flex gap-3">
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg font-semibold"
          >
            {t('shared.retry')}
          </button>
        )}
        <button
          onClick={onBack}
          className="px-5 py-2 bg-gray-100 text-gray-700 rounded-lg font-semibold"
        >
          {t('shared.goBack')}
        </button>
      </div>
    </div>
  );
}

export function YLRecordingButton({
  onStop,
  seconds,
  maxSeconds,
}: {
  isRecording: boolean;
  onStop: () => void;
  seconds: number;
  maxSeconds: number;
}) {
  const t = useTranslations('yl');
  return (
    <div className="flex flex-col items-center gap-4">
      <motion.div
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ repeat: Infinity, duration: 1.2 }}
        className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center shadow-lg"
      >
        <Mic size={28} className="text-white" />
      </motion.div>
      <div className="text-center space-y-1">
        <p className="text-sm font-bold text-red-500">{t('shared.recordingLabel')}</p>
        <p className="text-xs text-gray-400">
          {seconds}s / {maxSeconds}s
        </p>
      </div>
      <button
        onClick={onStop}
        className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-200 transition-colors"
      >
        <MicOff size={16} />
        {t('shared.stop')}
      </button>
    </div>
  );
}

/**
 * Compact 2-line result card combining score + feedback. Designed to live
 * inline in the chat without dominating it.
 */
export function YLResultCompact({ evalResult }: { evalResult: EvalResponse }) {
  const t = useTranslations('yl');
  const pct = Math.round((evalResult.score / evalResult.score_max) * 100);
  return (
    <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 space-y-1 max-w-md shadow-sm">
      <div className="flex items-center gap-2 text-sm">
        <CheckCircle className="text-blue-600 shrink-0" size={16} />
        <span className="font-bold text-gray-800">{t('shared.practiceComplete')}</span>
        <span className="text-gray-300">·</span>
        <span className="font-semibold text-gray-800">
          {evalResult.score}<span className="text-gray-400">/{evalResult.score_max}</span>
        </span>
        <span className="px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold">
          {evalResult.cefr_band.toUpperCase()}
        </span>
        <span className="text-xs text-gray-400 ml-auto">{pct}%</span>
      </div>
      <p className="text-xs text-gray-500 leading-relaxed">{evalResult.feedback}</p>
    </div>
  );
}

// Backwards-compat aliases — older code paths still import these
export function YLScoreDisplay({ evalResult }: { evalResult: EvalResponse }) {
  return <YLResultCompact evalResult={evalResult} />;
}

export function YLFeedbackCard({ feedback: _feedback }: { feedback: string }) {
  // Feedback is rendered inside YLResultCompact now; this is a no-op kept for backwards compat.
  void _feedback;
  return null;
}

export function YLResultsHeader(_: { title: string; subtitle: string }) {
  // The compact result card already conveys completion + score; this
  // header used to duplicate that info. Kept as no-op for backwards compat.
  return null;
}

/**
 * @deprecated YLToolbar is superseded by ChatShell with leftSlot/rightSlot.
 * Kept for backward compatibility while YL modes migrate to ChatShell.
 * Do not use in new code.
 */
export function YLToolbar({
  title,
  subtitle,
  onBack,
  progress,
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
  progress: number;
}) {
  return (
    <>
      <div className="flex items-center gap-4 px-4 py-3 border-b border-gray-100 bg-white shrink-0">
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="Back"
        >
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <div className="flex-1">
          <p className="text-sm font-black text-gray-900">{title}</p>
          <p className="text-xs text-gray-400 font-medium">{subtitle}</p>
        </div>
      </div>
      <div className="h-1.5 bg-gray-100 shrink-0">
        <motion.div
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4 }}
          className="h-full bg-blue-600"
        />
      </div>
    </>
  );
}

export function YLExaminerCard({ cue }: { cue: string }) {
  const t = useTranslations('yl');
  return (
    <div className="bg-white rounded-2xl shadow-md p-6 space-y-4 w-full max-w-lg">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
          {t('shared.examiner')}
        </span>
      </div>
      <p className="text-xl font-black text-gray-900 leading-snug">{cue}</p>
    </div>
  );
}

export function YLReactionCard({ reaction }: { reaction: string }) {
  return (
    <div className="bg-gray-50 border border-gray-100 rounded-xl px-5 py-4 text-center max-w-sm">
      <p className="text-gray-700 font-semibold italic">"{reaction}"</p>
      <p className="text-xs text-gray-400 mt-1">Examiner</p>
    </div>
  );
}

function VoiceNoteLabel({ playing, hasPlayed }: { playing: boolean; hasPlayed: boolean }) {
  const t = useTranslations('yl');
  if (playing) return <span>{t('shared.playing')}</span>;
  if (hasPlayed) return <span>{t('shared.listenAgain')}</span>;
  return <span>{t('shared.voiceNote')}</span>;
}

export function YLVoiceNote({
  text,
  side = 'bob',
  durationHint,
  sessionId,
  autoPlay,
}: {
  text: string;
  side?: 'bob' | 'user';
  durationHint?: number; // seconds, optional
  /** When provided, audio is cached per (sessionId, text) in the DB. */
  sessionId?: string;
  /** Auto-play once on mount. After playback, the button switches to a replay icon. */
  autoPlay?: boolean;
}) {
  const [playing, setPlaying] = React.useState(false);
  const [hasPlayed, setHasPlayed] = React.useState(false);
  const [duration, setDuration] = React.useState<number | null>(durationHint ?? null);
  const [progress, setProgress] = React.useState(0); // 0..1
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const autoPlayedRef = React.useRef(false);

  const stop = React.useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setPlaying(false);
    setBobSpeaking(false);
  }, []);

  React.useEffect(() => () => stop(), [stop]);

  const handlePlay = React.useCallback(async () => {
    if (playing) {
      stop();
      setProgress(0);
      return;
    }
    try {
      stopCurrentAudio();
      // Prefer the cached-on-DB action when we have a sessionId so we don't
      // hit Gemini twice for the same cue.
      let data: string;
      let mimeType: string;
      if (sessionId) {
        const cached = await getOrCreateCueAudioAction(sessionId, text);
        data = cached.data;
        mimeType = cached.mimeType;
      } else {
        const fresh = await generateSpeechAction(text);
        data = fresh.data;
        mimeType = fresh.mimeType;
      }
      const url = pcmToWavBase64(data, mimeType);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onloadedmetadata = () => {
        if (Number.isFinite(audio.duration)) setDuration(audio.duration);
      };
      audio.onended = () => {
        stop();
        setHasPlayed(true);
        setProgress(1);
        setTimeout(() => setProgress(0), 600);
      };
      audio.onerror = () => stop();
      setPlaying(true);
      if (side === 'bob') setBobSpeaking(true);
      intervalRef.current = setInterval(() => {
        if (audio.duration > 0) setProgress(audio.currentTime / audio.duration);
      }, 100);
      await audio.play();
    } catch {
      stop();
    }
  }, [playing, stop, text, sessionId]);

  React.useEffect(() => {
    if (!autoPlay || autoPlayedRef.current) return;
    autoPlayedRef.current = true;
    void handlePlay();
  }, [autoPlay, handlePlay]);

  const fmt = (s: number | null) => {
    if (s === null || !Number.isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const isBob = side === 'bob';
  const bubbleColor = isBob ? 'bg-white ring-1 ring-violet-100' : 'bg-gradient-to-br from-violet-600 to-violet-700';
  const iconColor = isBob ? 'bg-violet-600 text-white' : 'bg-white/20 text-white';

  return (
    <div className={`flex ${isBob ? 'justify-start' : 'justify-end'} gap-2 font-nunito`}>
      {isBob && (
        <BobAvatar />
      )}
      <div className={`flex items-center gap-3 rounded-2xl px-3 py-2 max-w-sm ${bubbleColor} ${playing ? 'ring-2 ring-violet-400/40 shadow-md' : ''}`}>
        <button
          type="button"
          onClick={handlePlay}
          className={`w-9 h-9 rounded-full ${iconColor} flex items-center justify-center hover:opacity-90 transition-opacity ${playing ? 'animate-pulse' : ''}`}
          aria-label={playing ? 'Pause' : hasPlayed ? 'Replay' : 'Play'}
        >
          {playing ? (
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : hasPlayed ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="M3 12a9 9 0 1 0 3-6.7" />
              <polyline points="3 4 3 10 9 10" />
            </svg>
          ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
        <div className="flex-1 min-w-32">
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full ${isBob ? 'bg-violet-600' : 'bg-white'} transition-all ${playing ? 'animate-pulse' : ''}`}
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          <div className={`flex justify-between text-[10px] mt-1 ${isBob ? 'text-gray-400' : 'text-white/70'}`}>
            <VoiceNoteLabel playing={playing} hasPlayed={hasPlayed} />
            <span>{fmt(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function YLBobTextMessage({ text }: { text: string }) {
  return (
    <div className="flex justify-start gap-2 font-nunito">
      <BobAvatar />
      <div className="rounded-2xl rounded-tl-sm px-4 py-2.5 bg-white ring-1 ring-violet-100 shadow-[0_1px_2px_rgba(0,0,0,0.04)] text-slate-800 text-sm max-w-sm font-bold">
        {text}
      </div>
    </div>
  );
}

export function YLImageMessage({ src }: { src: string }) {
  const t = useTranslations('yl');
  const finalSrc = src.startsWith('data:') ? src : `data:image/png;base64,${src}`;
  return (
    <div className="flex justify-start gap-2">
      <BobAvatar />
      <div className="rounded-2xl overflow-hidden shadow bg-white max-w-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={finalSrc} alt={t('shared.image')} className="w-full h-auto block" />
      </div>
    </div>
  );
}

export function YLUserTextMessage({ text }: { text: string }) {
  const t = useTranslations('yl');
  return (
    <div className="flex justify-end gap-2 font-nunito">
      <div className="rounded-2xl rounded-tr-sm px-4 py-2.5 bg-gradient-to-br from-violet-600 to-violet-700 text-white text-sm max-w-sm font-bold shadow-sm">
        {text || <span className="text-white/60 italic">{t('shared.noAudio')}</span>}
      </div>
    </div>
  );
}

export function YLChatMicBar({
  onStart,
  onStop,
  isRecording,
  seconds,
  maxSeconds,
  disabled,
  helperText,
}: {
  onStart: () => void;
  onStop: () => void;
  isRecording: boolean;
  seconds: number;
  maxSeconds: number;
  disabled?: boolean;
  helperText?: string;
}) {
  const t = useTranslations('yl');
  return (
    <div className="border-t border-gray-100 bg-white/90 backdrop-blur p-3 flex items-center justify-between gap-3">
      <p className="text-xs text-gray-500 font-medium pl-2">
        {isRecording ? (
          <span className="flex items-center gap-2 text-red-500 font-bold">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            {t('shared.recordingProgress', { seconds, maxSeconds })}
          </span>
        ) : (
          helperText ?? ''
        )}
      </p>
      {isRecording ? (
        <button
          type="button"
          onClick={onStop}
          className="w-14 h-14 rounded-full bg-red-500 text-white shadow-lg hover:scale-105 active:scale-95 transition-transform flex items-center justify-center"
          aria-label={t('shared.stop')}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        </button>
      ) : (
        <button
          type="button"
          onClick={onStart}
          disabled={disabled}
          className="w-14 h-14 rounded-full bg-blue-600 text-white shadow-lg hover:scale-105 active:scale-95 transition-transform flex items-center justify-center disabled:opacity-40 disabled:hover:scale-100"
          aria-label={t('shared.startSpeaking')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
            <rect x="9" y="3" width="6" height="12" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0" />
            <line x1="12" y1="18" x2="12" y2="22" />
          </svg>
        </button>
      )}
    </div>
  );
}

interface YLAudioControlsProps {
  isPlaying: boolean;
  isPaused: boolean;
  onPlay: () => void;
  onPause: () => void;
  onReplay: () => void;
  onRecord?: () => void;
  onNext?: () => void;
  showRecord?: boolean;
  showNext?: boolean;
}

export function YLAudioControls({
  isPlaying,
  isPaused,
  onPlay,
  onPause,
  onReplay,
  onRecord,
  onNext,
  showRecord = false,
  showNext = false,
}: YLAudioControlsProps) {
  const t = useTranslations('yl');
  const Btn = ({
    onClick,
    title,
    children,
    primary = false,
    accent = false,
    disabled = false,
  }: {
    onClick: () => void;
    title: string;
    children: React.ReactNode;
    primary?: boolean;
    accent?: boolean;
    disabled?: boolean;
  }) => {
    const base =
      'w-12 h-12 rounded-full flex items-center justify-center shadow-md transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100';
    const color = primary
      ? 'bg-blue-600 text-white'
      : accent
      ? 'bg-red-500 text-white'
      : 'bg-gray-100 text-gray-700 hover:bg-gray-200';
    return (
      <button type="button" onClick={onClick} title={title} disabled={disabled} className={`${base} ${color}`}>
        {children}
      </button>
    );
  };

  return (
    <div className="flex items-center gap-3 justify-center">
      {isPlaying && !isPaused ? (
        <Btn onClick={onPause} title="Pause">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        </Btn>
      ) : (
        <Btn onClick={onPlay} title={t('shared.play')} primary>
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
            <path d="M8 5v14l11-7z" />
          </svg>
        </Btn>
      )}

      <Btn onClick={onReplay} title="Restart">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
          <path d="M3 12a9 9 0 1 0 3-6.7" />
          <polyline points="3 4 3 10 9 10" />
        </svg>
      </Btn>

      {showRecord && onRecord && (
        <Btn onClick={onRecord} title="Start speaking" accent>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <rect x="9" y="3" width="6" height="12" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0" />
            <line x1="12" y1="18" x2="12" y2="22" />
          </svg>
        </Btn>
      )}

      {showNext && onNext && (
        <Btn onClick={onNext} title={t('shared.next')} primary>
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
            <path d="M6 4l12 8-12 8V4z" />
            <rect x="18" y="4" width="2" height="16" />
          </svg>
        </Btn>
      )}
    </div>
  );
}

export function YLReadOnlyMessage({
  role,
  text,
  msgType,
  contentJson,
}: {
  role: string;
  text: string;
  msgType: string;
  contentJson?: Record<string, unknown> | null;
}) {
  const t = useTranslations('yl');
  const isBob = role === 'bob';
  const cue =
    contentJson && typeof contentJson === 'object' && 'cue' in contentJson
      ? (contentJson.cue as string)
      : null;

  if (msgType === 'evaluation') {
    return (
      <div className="flex justify-start gap-2">
        <BobAvatar />
        <div className="max-w-xs rounded-2xl rounded-tl-sm px-4 py-3 text-sm bg-white border border-gray-100 text-gray-400 italic">
          {t('shared.evaluationSaved')}
        </div>
      </div>
    );
  }

  if (msgType === 'image_scene') {
    const src =
      contentJson && typeof contentJson === 'object' && 'image_data_uri' in contentJson
        ? (contentJson.image_data_uri as string)
        : null;
    if (!src) return null;
    return <YLImageMessage src={src} />;
  }

  return (
    <div className={`flex ${isBob ? 'justify-start' : 'justify-end'} gap-2`}>
      {isBob && (
        <BobAvatar />
      )}
      <div className="flex flex-col gap-1 max-w-md">
        {!isBob && cue && (
          <div className="text-xs text-gray-400 italic px-2">
            {t('shared.examinerPrefix')} <span className="text-gray-500">{cue}</span>
          </div>
        )}
        <div
          className={`rounded-2xl px-4 py-3 text-sm ${
            isBob
              ? 'bg-white border border-gray-100 shadow-sm text-gray-800 rounded-tl-sm'
              : 'bg-blue-600 text-white rounded-tr-sm'
          }`}
        >
          {text || (
            <span className={isBob ? 'text-gray-400 italic' : 'text-white/60 italic'}>
              {isBob ? '...' : t('shared.noAudioRecorded')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
