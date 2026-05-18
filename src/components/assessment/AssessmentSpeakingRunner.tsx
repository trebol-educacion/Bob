'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, StopCircle, ChevronRight, RotateCcw } from 'lucide-react';
import {
  submitAssessmentSpeakingAction,
  pollAssessmentSpeakingResultAction,
} from '@/actions/assessment';
import type { AssessmentPrompt } from '@/actions/assessment';
import type { AssessmentResultSpeaking } from '@/lib/types/skills';

interface Props {
  assessment_id: string;
  prompts: AssessmentPrompt[];
  is_yl?: boolean;
  onResult: (result: AssessmentResultSpeaking) => void;
  onCancel: () => void;
}

type TurnState = 'idle' | 'recording' | 'done';
type RunnerPhase = 'turns' | 'submitting' | 'evaluating' | 'failed';

interface RecordedTurn {
  audio_base64: string;
  mime_type: string;
  duration_ms: number;
  transcript?: string;
}

const MAX_TURN_MS_DEFAULT = 20_000;
const MAX_TURN_MS_YL = 10_000;
const POLL_INTERVAL_MS = 2_000;
const POLL_TIMEOUT_MS = 90_000;

export function AssessmentSpeakingRunner({ assessment_id, prompts, is_yl = false, onResult, onCancel }: Props) {
  const MAX_TURN_MS = is_yl ? MAX_TURN_MS_YL : MAX_TURN_MS_DEFAULT;
  const [currentTurnIdx, setCurrentTurnIdx] = useState(0);
  const [turnState, setTurnState] = useState<TurnState>('idle');
  const [phase, setPhase] = useState<RunnerPhase>('turns');
  const [recordedTurns, setRecordedTurns] = useState<RecordedTurn[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);
  const [micDenied, setMicDenied] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef<number>(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const clearPollTimer = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearTimer();
      clearPollTimer();
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, [clearTimer, clearPollTimer]);

  const stopRecording = useCallback(() => {
    clearTimer();
    setElapsed(0);
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, [clearTimer]);

  const startRecording = useCallback(async () => {
    chunksRef.current = [];
    setElapsed(0);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setMicDenied(true);
      return;
    }

    const recorder = new MediaRecorder(stream);
    mediaRecorderRef.current = recorder;
    startTimeRef.current = Date.now();

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const durationMs = Date.now() - startTimeRef.current;
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      const arrayBuffer = await blob.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < uint8.byteLength; i++) {
        binary += String.fromCharCode(uint8[i]);
      }
      const base64 = btoa(binary);

      setRecordedTurns((prev) => [
        ...prev,
        { audio_base64: base64, mime_type: 'audio/webm', duration_ms: durationMs },
      ]);
      setTurnState('done');
    };

    recorder.start();
    setTurnState('recording');

    timerRef.current = setInterval(() => {
      const secs = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsed(secs);
      if (Date.now() - startTimeRef.current >= MAX_TURN_MS) {
        stopRecording();
      }
    }, 250);
  }, [stopRecording]);

  const handleNext = useCallback(() => {
    if (currentTurnIdx < prompts.length - 1) {
      setCurrentTurnIdx((i) => i + 1);
      setTurnState('idle');
    } else {
      handleSubmit();
    }
  }, [currentTurnIdx, prompts.length]);

  const handleSubmit = useCallback(async () => {
    setPhase('submitting');

    const turns = recordedTurns.map((rt, idx) => ({
      turn_number: idx + 1,
      prompt_key: idx < prompts.length
        ? `turn_${idx + 1}`
        : 'unknown',
      audio_base64: rt.audio_base64,
      mime_type: rt.mime_type,
      duration_ms: rt.duration_ms,
    }));

    const result = await submitAssessmentSpeakingAction(assessment_id, turns);

    if (result.status === 'error') {
      setPhase('failed');
      setFailureMessage('Could not submit your recording. Please try again.');
      return;
    }

    setPhase('evaluating');
    pollStartRef.current = Date.now();

    pollTimerRef.current = setInterval(async () => {
      if (Date.now() - pollStartRef.current > POLL_TIMEOUT_MS) {
        clearPollTimer();
        setPhase('failed');
        setFailureMessage('Evaluation is taking longer than expected. Your level has not changed. Please try again.');
        return;
      }

      const poll = await pollAssessmentSpeakingResultAction(assessment_id);

      if (poll.status === 'done') {
        clearPollTimer();
        onResult(poll.result);
      } else if (poll.status === 'failed') {
        clearPollTimer();
        setPhase('failed');
        setFailureMessage('We could not evaluate your speaking. Your level has not changed.');
      }
    }, POLL_INTERVAL_MS);
  }, [assessment_id, recordedTurns, prompts.length, clearPollTimer, onResult]);

  const handleRetry = useCallback(() => {
    setPhase('turns');
    setCurrentTurnIdx(0);
    setTurnState('idle');
    setRecordedTurns([]);
    setFailureMessage(null);
    setMicDenied(false);
  }, []);

  if (micDenied) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 p-8 gap-6 text-center">
        <div className="text-4xl">🎙️</div>
        <p className="text-lg font-bold text-gray-800">Microphone access denied</p>
        <p className="text-sm text-gray-500 max-w-xs">
          Bob needs your microphone to assess your speaking. Please allow microphone access in your browser settings and try again.
        </p>
        <button
          onClick={handleRetry}
          className="flex items-center gap-2 px-5 py-2.5 bg-trebol-green text-white rounded-xl font-semibold text-sm hover:opacity-90 transition"
        >
          <RotateCcw size={16} /> Try again
        </button>
        <button onClick={onCancel} className="text-sm text-gray-400 hover:text-gray-600 transition">
          Cancel
        </button>
      </div>
    );
  }

  if (phase === 'evaluating' || phase === 'submitting') {
    return (
      <div className="flex flex-col items-center justify-center flex-1 p-8 gap-6 text-center">
        <div className="text-5xl animate-pulse">🤔</div>
        <p className="text-xl font-black text-gray-800">
          {phase === 'submitting' ? 'Sending your recording…' : 'Bob is evaluating your speaking…'}
        </p>
        <p className="text-sm text-gray-500 max-w-xs">
          This usually takes about 10–20 seconds. Hang tight!
        </p>
      </div>
    );
  }

  if (phase === 'failed') {
    return (
      <div className="flex flex-col items-center justify-center flex-1 p-8 gap-6 text-center">
        <div className="text-4xl">😔</div>
        <p className="text-lg font-bold text-gray-800">Something went wrong</p>
        <p className="text-sm text-gray-500 max-w-xs">{failureMessage}</p>
        <button
          onClick={handleRetry}
          className="flex items-center gap-2 px-5 py-2.5 bg-trebol-green text-white rounded-xl font-semibold text-sm hover:opacity-90 transition"
        >
          <RotateCcw size={16} /> Try the assessment again
        </button>
        <button onClick={onCancel} className="text-sm text-gray-400 hover:text-gray-600 transition">
          Cancel
        </button>
      </div>
    );
  }

  const currentPrompt = prompts[currentTurnIdx];
  const isLastTurn = currentTurnIdx === prompts.length - 1;
  const progressPct = Math.min(100, Math.round((elapsed / (MAX_TURN_MS / 1000)) * 100));

  return (
    <div className="flex flex-col items-center justify-center flex-1 p-6 gap-6 max-w-lg mx-auto w-full">
      <div className="w-full flex items-center gap-2 mb-2">
        {prompts.map((_, i) => (
          <div
            key={i}
            className={`flex-1 h-1.5 rounded-full transition-colors ${
              i < currentTurnIdx
                ? 'bg-trebol-green'
                : i === currentTurnIdx
                ? 'bg-trebol-green/40'
                : 'bg-gray-200'
            }`}
          />
        ))}
      </div>

      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
        Question {currentTurnIdx + 1} of {prompts.length}
      </p>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 w-full text-center">
        <p className="text-lg font-bold text-gray-800 leading-snug">
          {currentPrompt?.prompt_text}
        </p>
      </div>

      {turnState === 'idle' && (
        <button
          onClick={startRecording}
          className="flex items-center gap-2 px-6 py-3 bg-trebol-green text-white rounded-xl font-semibold text-sm hover:opacity-90 transition shadow-sm"
        >
          <Mic size={18} /> Start recording
        </button>
      )}

      {turnState === 'recording' && (
        <div className="flex flex-col items-center gap-4 w-full">
          <div className="flex items-center gap-2 text-red-500 font-semibold text-sm">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            Recording — {elapsed}s / {MAX_TURN_MS / 1000}s
          </div>
          <div className="w-full h-2 rounded-full bg-gray-100">
            <div
              className="h-2 rounded-full bg-red-400 transition-all duration-250"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <button
            onClick={stopRecording}
            className="flex items-center gap-2 px-5 py-2.5 bg-gray-800 text-white rounded-xl font-semibold text-sm hover:opacity-90 transition"
          >
            <StopCircle size={16} /> Stop recording
          </button>
        </div>
      )}

      {turnState === 'done' && (
        <div className="flex flex-col items-center gap-3 w-full">
          <p className="text-sm text-green-600 font-semibold">
            ✓ Recording saved ({Math.round((recordedTurns[recordedTurns.length - 1]?.duration_ms ?? 0) / 1000)}s)
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => { setRecordedTurns((prev) => prev.slice(0, -1)); setTurnState('idle'); }}
              className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition font-medium"
            >
              <RotateCcw size={14} /> Re-record
            </button>
            <button
              onClick={handleNext}
              className="flex items-center gap-1.5 px-5 py-2 bg-trebol-green text-white rounded-xl text-sm font-semibold hover:opacity-90 transition"
            >
              {isLastTurn ? 'Submit' : 'Next question'}
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
