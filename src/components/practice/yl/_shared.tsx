'use client';

/**
 * Shared utilities and sub-components for YL practice components.
 * Keeps recurring patterns (audio, TTS, results, turn loop) DRY across Part1–4.
 */

import React from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Mic, MicOff, CheckCircle } from 'lucide-react';
import { generateSpeechAction } from '@/actions/gemini';
import { pcmToWavBase64 } from '@/lib/audio';
import type { EvalResponse } from '@/lib/types/practice';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const RECORDING_MAX_SECONDS = 45;
export const REACTION_PAUSE_MS = 1200;

// ---------------------------------------------------------------------------
// TTS helper (module-level singleton so unmount cleans it up)
// ---------------------------------------------------------------------------

let _currentAudio: HTMLAudioElement | null = null;

export function stopCurrentAudio(): void {
  if (_currentAudio) {
    _currentAudio.pause();
    _currentAudio = null;
  }
}

export async function playTTS(text: string): Promise<void> {
  stopCurrentAudio();
  try {
    const { data, mimeType } = await generateSpeechAction(text);
    const url = pcmToWavBase64(data, mimeType);
    const audio = new Audio(url);
    _currentAudio = audio;
    await new Promise<void>((resolve) => {
      audio.onended = () => resolve();
      audio.onerror = () => resolve();
      audio.play().catch(() => resolve());
    });
    _currentAudio = null;
  } catch {
    // Non-fatal — continue even if TTS fails
  }
}

// ---------------------------------------------------------------------------
// Shared UI sub-components
// ---------------------------------------------------------------------------

export function YLLoadingScreen({ message }: { message: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4">
      <div className="w-12 h-12 border-4 border-trebol-primary border-t-transparent rounded-full animate-spin" />
      <p className="text-trebol-text/60 font-semibold">{message}</p>
    </div>
  );
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
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
      <p className="text-red-500 font-semibold text-center">{error}</p>
      <div className="flex gap-3">
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-5 py-2 bg-trebol-primary text-white rounded-lg font-semibold"
          >
            Reintentar
          </button>
        )}
        <button
          onClick={onBack}
          className="px-5 py-2 bg-trebol-border text-trebol-text rounded-lg font-semibold"
        >
          Volver
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
        <p className="text-sm font-bold text-red-500">Grabando...</p>
        <p className="text-xs text-trebol-text/40">
          {seconds}s / {maxSeconds}s
        </p>
      </div>
      <button
        onClick={onStop}
        className="flex items-center gap-2 px-4 py-2 bg-trebol-border rounded-lg text-sm font-semibold text-trebol-text hover:bg-trebol-secondary/30 transition-colors"
      >
        <MicOff size={16} />
        Terminar respuesta
      </button>
    </div>
  );
}

export function YLScoreDisplay({ evalResult }: { evalResult: EvalResponse }) {
  const pct = Math.round((evalResult.score / evalResult.score_max) * 100);
  return (
    <div className="bg-trebol-primary rounded-2xl p-6 text-center text-white space-y-1">
      <p className="text-sm font-bold uppercase tracking-widest opacity-80">Puntuación</p>
      <p className="text-7xl font-black">{evalResult.score}</p>
      <p className="text-sm opacity-80">
        de {evalResult.score_max} pts ({pct}%)
      </p>
      <span className="inline-block mt-2 px-3 py-1 rounded-full bg-white/20 text-sm font-bold">
        {evalResult.cefr_band.toUpperCase()}
      </span>
    </div>
  );
}

export function YLFeedbackCard({ feedback }: { feedback: string }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm space-y-2">
      <h3 className="font-black text-trebol-text">Comentarios del examinador</h3>
      <p className="text-trebol-text/80 text-sm leading-relaxed">{feedback}</p>
    </div>
  );
}

export function YLResultsHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="text-center space-y-2">
      <CheckCircle className="mx-auto text-trebol-primary" size={48} />
      <h2 className="text-2xl font-black text-trebol-text">{title}</h2>
      <p className="text-trebol-text/60 font-medium">{subtitle}</p>
    </div>
  );
}

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
      <div className="flex items-center gap-4 px-4 py-3 border-b border-trebol-border bg-white shrink-0">
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg hover:bg-trebol-secondary/20 transition-colors"
          aria-label="Volver"
        >
          <ArrowLeft size={20} className="text-trebol-text" />
        </button>
        <div className="flex-1">
          <p className="text-sm font-black text-trebol-text">{title}</p>
          <p className="text-xs text-trebol-text/50 font-medium">{subtitle}</p>
        </div>
      </div>
      <div className="h-1.5 bg-trebol-border shrink-0">
        <motion.div
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4 }}
          className="h-full bg-trebol-primary"
        />
      </div>
    </>
  );
}

export function YLExaminerCard({ cue }: { cue: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-md p-6 space-y-4 w-full max-w-lg">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-trebol-primary bg-trebol-secondary/20 px-2 py-0.5 rounded-full">
          Examinador
        </span>
      </div>
      <p className="text-xl font-black text-trebol-text leading-snug">{cue}</p>
    </div>
  );
}

export function YLReactionCard({ reaction }: { reaction: string }) {
  return (
    <div className="bg-trebol-secondary/10 rounded-xl px-5 py-4 text-center max-w-sm">
      <p className="text-trebol-text font-semibold italic">"{reaction}"</p>
      <p className="text-xs text-trebol-text/40 mt-1">Examinador</p>
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
  const isBob = role === 'bob';
  const cue =
    contentJson && typeof contentJson === 'object' && 'cue' in contentJson
      ? (contentJson.cue as string)
      : null;

  if (msgType === 'evaluation') {
    return (
      <div className="flex justify-start gap-2">
        <div className="w-8 h-8 rounded-full bg-trebol-primary/10 flex items-center justify-center shrink-0 text-xs font-bold text-trebol-primary mt-1">B</div>
        <div className="max-w-xs rounded-2xl px-4 py-3 text-sm bg-white border border-trebol-border text-trebol-text/60 italic">
          📊 Evaluación guardada
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isBob ? 'justify-start' : 'justify-end'} gap-2`}>
      {isBob && (
        <div className="w-8 h-8 rounded-full bg-trebol-primary/10 flex items-center justify-center shrink-0 text-xs font-bold text-trebol-primary mt-1">
          B
        </div>
      )}
      <div className="flex flex-col gap-1 max-w-md">
        {!isBob && cue && (
          <div className="text-xs text-trebol-text/50 italic px-2">
            Examinador: <span className="text-trebol-text/70">{cue}</span>
          </div>
        )}
        <div
          className={`rounded-2xl px-4 py-3 text-sm ${
            isBob
              ? 'bg-white border border-trebol-border text-trebol-text'
              : 'bg-trebol-primary/10 text-trebol-text'
          }`}
        >
          {text || (
            <span className="text-trebol-text/40 italic">
              {isBob ? '...' : '(sin audio capturado)'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
