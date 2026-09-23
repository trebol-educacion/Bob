import React from 'react';
import { Mic, Square, Send, Sparkles, LogOut, CheckCircle } from 'lucide-react';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import type { PracticeActivityMode } from '@/lib/practice/types';

const MODES: PracticeActivityMode[] = ['conversation', 'situation', 'picture'];

export interface PracticeControlsLabels {
  placeholder: string;
  modelAnswer: string;
  exit: string;
  finish: string;
  modes: Record<PracticeActivityMode, string>;
}

export interface PracticeControlsProps {
  labels: PracticeControlsLabels;
  mode: PracticeActivityMode;
  onSwitchMode: (mode: PracticeActivityMode) => void;
  inputText: string;
  onInputTextChange: (v: string) => void;
  onSendText: () => void;
  onSendAudio: (blob: Blob) => void;
  onRequestModelAnswer: () => void;
  onExit: () => void;
  onFinish: () => void;
  isProcessing: boolean;
  pendingModelAnswer: string | null;
}

export function PracticeControls({
  labels,
  mode,
  onSwitchMode,
  inputText,
  onInputTextChange,
  onSendText,
  onSendAudio,
  onRequestModelAnswer,
  onExit,
  onFinish,
  isProcessing,
  pendingModelAnswer,
}: PracticeControlsProps) {
  const { isRecording, startRecording, stopRecording } = useAudioRecorder({
    onRecorded: onSendAudio,
    onError: (error) => console.error('[PracticeControls] recorder error:', error),
  });

  return (
    <div className="flex-none border-t border-gray-100 bg-white px-4 py-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 bg-gray-50 rounded-full p-1">
          {MODES.map((m) => (
            <button
              key={m}
              onClick={() => onSwitchMode(m)}
              disabled={isProcessing}
              className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide transition-colors disabled:opacity-40 ${
                m === mode ? 'text-white' : 'text-gray-500 hover:text-gray-700'
              }`}
              style={m === mode ? { background: 'var(--color-bob-brand)' } : undefined}
            >
              {labels.modes[m]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onFinish}
            disabled={isProcessing}
            className="flex items-center gap-1 text-xs font-black uppercase tracking-wider text-green-700 hover:underline disabled:opacity-40"
          >
            <CheckCircle size={14} />
            {labels.finish}
          </button>
          <button
            onClick={onExit}
            className="flex items-center gap-1 text-xs font-black uppercase tracking-wider text-gray-400 hover:text-gray-600"
          >
            <LogOut size={14} />
            {labels.exit}
          </button>
        </div>
      </div>

      {pendingModelAnswer && (
        <div className="px-4 py-2 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800 italic">
          &quot;{pendingModelAnswer}&quot;
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            value={inputText}
            onChange={(e) => onInputTextChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSendText()}
            placeholder={labels.placeholder}
            disabled={isProcessing || isRecording}
            className="w-full pl-4 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-full focus:outline-none focus:border-gray-400 font-medium text-sm"
          />
          <button
            onClick={onSendText}
            disabled={!inputText.trim() || isProcessing || isRecording}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-white p-2 rounded-full hover:scale-105 transition-transform disabled:opacity-30"
            style={{ background: 'var(--color-bob-brand)' }}
          >
            <Send size={18} />
          </button>
        </div>

        {!isRecording ? (
          <button
            onClick={startRecording}
            disabled={isProcessing}
            className="text-white p-4 rounded-full shadow-lg hover:scale-110 transition-transform disabled:opacity-50"
            style={{ background: 'var(--color-bob-brand)' }}
          >
            <Mic size={24} />
          </button>
        ) : (
          <button onClick={stopRecording} className="bg-red-500 text-white p-4 rounded-full shadow-lg animate-pulse">
            <Square size={24} fill="currentColor" />
          </button>
        )}

        <button
          onClick={onRequestModelAnswer}
          disabled={isProcessing || isRecording}
          className="flex items-center gap-1 text-gray-400 font-black text-xs uppercase tracking-widest hover:text-gray-600 disabled:opacity-30 shrink-0"
        >
          <Sparkles size={16} />
          <span className="hidden sm:inline">{labels.modelAnswer}</span>
        </button>
      </div>
    </div>
  );
}
