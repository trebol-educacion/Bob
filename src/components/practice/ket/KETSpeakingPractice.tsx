'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, ChevronDown, ChevronUp } from 'lucide-react';
import { KETSpeakingIcon } from '@/components/icons/KETIcons';
import { CelebrationCard } from '@/components/practice/yl/CelebrationCard';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import { BobAvatar } from '@/components/practice/yl/_shared';
import { pcmToWavBase64, blobToBase64 } from '@/lib/audio';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';

export type SpeakingFeedback = {
  understood: boolean;
  highlights: string[];
  suggestions: string[];
  model_answer: string | null;
};

export interface KETSpeakingPracticeProps {
  /** Header label shown to student */
  partLabel: string;
  /** Activity title e.g. "Talk About a Hobby" */
  title: string;
  /** Seconds allowed to record */
  recordingSeconds: number;
  /** Bob's spoken instruction (TTS audio) */
  instructionAudioB64: string;
  instructionAudioMime: string;
  /** Written instruction shown on screen */
  instructionText: string;
  /** Optional bullet points to help student */
  bulletPoints?: string[];
  /** Main image for the exercise */
  imageUrl?: string;
  /** True while TTS/image are still loading in the background (two-phase). */
  mediaLoading?: boolean;
  /** True if this activity requires the image before the student can start. */
  imageRequired?: boolean;
  /** Called with { audioBase64, audioMime } when student stops recording */
  onSubmit: (audio: { base64: string; mime: string }) => Promise<SpeakingFeedback | { error: string }>;
  onBack: () => void;
  onOpenDashboard?: () => void;
}

type Phase = 'ready' | 'playing-instruction' | 'countdown' | 'recording' | 'evaluating' | 'finished';

const VERDICT_LABELS: Record<string, string> = { T: 'True', F: 'False', DS: "Doesn't Say" };

function FeedbackPanel({
  feedback,
  animate,
  onOpenDashboard,
}: {
  feedback: SpeakingFeedback;
  animate: boolean;
  onOpenDashboard?: () => void;
}) {
  const [modelOpen, setModelOpen] = useState(false);

  return (
    <motion.div
      initial={animate ? { opacity: 0, y: 12 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-3"
    >
      {feedback.highlights.length > 0 && (
        <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 space-y-1.5">
          <p className="text-xs font-bold text-green-800">What you did well ✓</p>
          {feedback.highlights.map((h, i) => <p key={i} className="text-sm text-green-700 leading-snug">• {h}</p>)}
        </div>
      )}
      {feedback.suggestions.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-1.5">
          <p className="text-xs font-bold text-amber-800">To improve</p>
          {feedback.suggestions.map((s, i) => <p key={i} className="text-sm text-amber-700 leading-snug">• {s}</p>)}
        </div>
      )}
      {feedback.model_answer && (
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          <button type="button" onClick={() => setModelOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
            <span>Model answer</span>
            {modelOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <AnimatePresence>
            {modelOpen && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                <div className="px-4 pb-4 pt-1 border-t border-gray-100">
                  <p className="text-sm text-gray-700 leading-relaxed italic">"{feedback.model_answer}"</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
      <div className="flex justify-center pt-2">
        <CelebrationCard score={feedback.understood ? 1 : 0} scoreMax={1} feedback="Keep practising your speaking!" onAction={onOpenDashboard} actionLabel="See my progress" animate={animate} />
      </div>
    </motion.div>
  );
}

/** Shared speaking practice component for KET Parts 2 and 3. */
export function KETSpeakingPractice({
  partLabel,
  title,
  recordingSeconds,
  instructionAudioB64,
  instructionAudioMime,
  instructionText,
  bulletPoints,
  imageUrl,
  mediaLoading = false,
  imageRequired = false,
  onSubmit,
  onBack,
  onOpenDashboard,
}: KETSpeakingPracticeProps) {
  const [phase, setPhase] = useState<Phase>('ready');
  const [countdown, setCountdown] = useState(recordingSeconds);
  const [feedback, setFeedback] = useState<SpeakingFeedback | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const instructionAudioRef = useRef<HTMLAudioElement | null>(null);

  const handleRecorded = useCallback(async (blob: Blob) => {
    setPhase('evaluating');
    const base64 = await blobToBase64(blob);
    const result = await onSubmit({ base64, mime: blob.type || 'audio/webm;codecs=opus' });
    if ('error' in result) { setErrorMsg(result.error); setPhase('ready'); return; }
    setFeedback(result);
    setPhase('finished');
  }, [onSubmit]);

  const { isRecording, startRecording, stopRecording } = useAudioRecorder({ onRecorded: handleRecorded });

  function stopCountdown() {
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
  }

  useEffect(() => () => { stopCountdown(); }, []);

  function playInstruction() {
    if (!instructionAudioB64) { startCountdown(); return; }
    setPhase('playing-instruction');
    const url = pcmToWavBase64(instructionAudioB64, instructionAudioMime);
    const audio = new Audio(url);
    instructionAudioRef.current = audio;
    audio.onended = () => { instructionAudioRef.current = null; startCountdown(); };
    audio.onerror = () => { instructionAudioRef.current = null; startCountdown(); };
    audio.play().catch(() => startCountdown());
  }

  function startCountdown() {
    setCountdown(recordingSeconds);
    setPhase('countdown');
    let remaining = recordingSeconds;
    countdownRef.current = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) { stopCountdown(); handleStartRecording(); }
    }, 1000);
  }

  async function handleStartRecording() {
    setPhase('recording');
    await startRecording();
  }

  function handleStopRecording() {
    stopCountdown();
    stopRecording();
  }

  function handleStartPress() {
    playInstruction();
  }

  const progressPct = Math.max(0, Math.min(100, (countdown / recordingSeconds) * 100));

  return (
    <div className="flex flex-col h-full relative">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white shrink-0">
        <button type="button" onClick={onBack} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600">←</button>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'color-mix(in oklab, var(--color-bob-brand) 12%, white)' }}>
          <KETSpeakingIcon size={18} className="text-bob-brand" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800 truncate">{title}</p>
          <p className="text-xs text-gray-400">Speaking · {partLabel}</p>
        </div>
        <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest" style={{ background: 'color-mix(in oklab, var(--color-bob-brand) 12%, white)', color: 'var(--color-bob-brand)' }}>A2</span>
      </div>

      {phase === 'evaluating' && <div className="flex-1 flex flex-col min-h-0"><BobMascotLoader message="Listening to your answer…" /></div>}

      {phase !== 'evaluating' && phase !== 'finished' && (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            <div className="flex items-start gap-2">
              <BobAvatar />
              <div className="bg-gray-50 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-700 leading-relaxed max-w-sm">{instructionText}</div>
            </div>

            {imageUrl ? (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm max-w-xl w-full mx-auto">
                <div className="relative w-full bg-gray-50" style={{ paddingBottom: '60%' }}>
                  <Image src={imageUrl} alt="Speaking prompt" fill sizes="(max-width: 640px) 100vw, 576px" className="object-contain" unoptimized={imageUrl.startsWith('data:')} />
                </div>
              </motion.div>
            ) : (imageRequired && mediaLoading) ? (
              <div className="rounded-2xl overflow-hidden border border-gray-100 bg-gray-50">
                <div className="relative w-full flex items-center justify-center" style={{ paddingBottom: '60%' }}>
                  <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8 animate-spin absolute" style={{ color: 'var(--color-bob-brand)' }}>
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
                    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                </div>
              </div>
            ) : null}

            {bulletPoints && bulletPoints.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="rounded-2xl border border-gray-100 bg-white shadow-sm px-4 py-3 space-y-2">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Talk about…</p>
                {bulletPoints.map((bp, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5" style={{ background: 'color-mix(in oklab, var(--color-bob-brand) 14%, white)', color: 'var(--color-bob-brand)' }}>{i + 1}</span>
                    <span className="text-sm text-gray-700">{bp}</span>
                  </div>
                ))}
              </motion.div>
            )}

            {(phase === 'countdown' || phase === 'recording') && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl border border-gray-100 bg-white shadow-sm px-4 py-4 space-y-3">
                {phase === 'countdown' && (
                  <div className="text-center space-y-1">
                    <p className="text-3xl font-black" style={{ color: 'var(--color-bob-brand)' }}>{countdown}</p>
                    <p className="text-xs text-gray-400">Recording starts in…</p>
                  </div>
                )}
                {phase === 'recording' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-xs font-bold text-red-500">Recording</span>
                      </div>
                      <span className="text-sm font-bold text-gray-600">{countdown}s left</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full transition-all duration-1000 rounded-full" style={{ width: `${progressPct}%`, background: 'var(--color-bob-brand)' }} />
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            <div className="h-20" />
          </div>

          <div className="shrink-0 border-t border-gray-100 bg-white px-4 py-4 flex items-center justify-center">
            {phase === 'ready' && (
              <button type="button" onClick={handleStartPress}
                disabled={imageRequired && mediaLoading}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl text-white font-bold shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'var(--color-bob-brand)' }}>
                <Mic size={18} />
                {imageRequired && mediaLoading ? 'Preparing picture…' : 'Start speaking'}
              </button>
            )}
            {phase === 'playing-instruction' && (
              <div className="flex items-center gap-2 px-6 py-3 rounded-2xl text-white font-bold opacity-80" style={{ background: 'var(--color-bob-brand)' }}>
                <span className="animate-pulse">🔊</span>
                Listen…
              </div>
            )}
            {phase === 'countdown' && (
              <div className="flex items-center gap-2 px-6 py-3 rounded-2xl text-white font-bold opacity-80" style={{ background: 'var(--color-bob-brand)' }}>
                <Mic size={18} />
                Get ready…
              </div>
            )}
            {phase === 'recording' && (
              <button type="button" onClick={handleStopRecording}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl text-white font-bold shadow-md bg-red-500 cursor-pointer transition-all">
                <MicOff size={18} />
                Stop recording
              </button>
            )}
          </div>
        </>
      )}

      {phase === 'finished' && feedback && (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {imageUrl && (
            <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm max-w-xl w-full mx-auto">
              <div className="relative w-full bg-gray-50" style={{ paddingBottom: '40%' }}>
                <Image src={imageUrl} alt="Speaking prompt" fill sizes="(max-width: 640px) 100vw, 576px" className="object-contain" unoptimized={imageUrl.startsWith('data:')} />
              </div>
            </div>
          )}
          <FeedbackPanel feedback={feedback} animate={true} onOpenDashboard={onOpenDashboard} />
        </div>
      )}

      {errorMsg && (
        <div className="absolute inset-x-4 bottom-24 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-red-600">{errorMsg}</p>
          <button type="button" onClick={() => setErrorMsg(null)} className="text-red-400 ml-2">✕</button>
        </div>
      )}
    </div>
  );
}
