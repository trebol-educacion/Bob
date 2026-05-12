'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Mic,
  MicOff,
  Square,
  Loader2,
  CheckCircle2,
  Circle,
  ChevronRight,
  RotateCcw,
  Shuffle,
  Volume2,
} from 'lucide-react';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { blobToBase64, pcmToWavBase64 } from '@/lib/audio';
import { generateSpeechAction } from '@/actions/gemini';
import { createSessionAction } from '@/actions/sessions';
import {
  generatePart3ScenarioAction,
  chatPart3Action,
  chatPart3TextAction,
  evaluatePart3Action,
  type Part3Scenario,
  type Part3ChatMessage,
} from '@/actions/modes/part3';
import type { CollaborativeEvaluation } from '@/lib/types/practice';

interface B1CollaborativePracticeProps {
  onBack: () => void;
}

type Phase = 'loading' | 'intro' | 'conversation' | 'evaluating' | 'result';

const MAX_TURNS = 8;

const PRESET_SCENARIOS: Part3Scenario[] = [
  {
    topic: 'Planning a Class Trip',
    situation:
      'Your class is planning a one-day trip. You need to decide which activities to include.',
    prompt_question: 'Which activities would be most fun and educational for the class?',
    options: [
      'Visit a museum',
      'Go to a science centre',
      'Explore a nature park',
      'Tour a factory',
      'Watch a live performance',
    ],
  },
  {
    topic: 'Improving the School',
    situation:
      'The school has money to improve one area. Students have been asked for their opinions.',
    prompt_question: 'Which improvement would benefit students most?',
    options: [
      'New sports facilities',
      'Better computer lab',
      'School garden',
      'Improved library',
      'Music practice rooms',
    ],
  },
  {
    topic: 'Weekend Activities',
    situation: 'A group of friends wants to plan a perfect Saturday together.',
    prompt_question: 'Which activity would make the best Saturday for a group of teenagers?',
    options: [
      'Have a picnic in the park',
      'Watch a film at the cinema',
      'Play sports together',
      'Visit a local market',
      'Cook a meal at home',
    ],
  },
];

function ScoreCircle({ score }: { score: number }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const color =
    score >= 80
      ? '#22c55e'
      : score >= 60
      ? '#f59e0b'
      : '#ef4444';

  return (
    <div className="relative w-36 h-36 mx-auto">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-black text-trebol-text">{score}</span>
        <span className="text-xs text-trebol-text/50 font-semibold">/ 100</span>
      </div>
    </div>
  );
}

function SubScoreBar({ label, value }: { label: string; value: number }) {
  const color =
    value >= 80
      ? 'bg-green-500'
      : value >= 60
      ? 'bg-amber-500'
      : 'bg-red-500';

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-trebol-text/70 font-medium">{label}</span>
        <span className="font-bold text-trebol-text">{value}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

export function B1CollaborativePractice({ onBack }: B1CollaborativePracticeProps) {
  const [phase, setPhase] = useState<Phase>('intro');
  const [scenario, setScenario] = useState<Part3Scenario | null>(null);
  const [history, setHistory] = useState<Part3ChatMessage[]>([]);
  const [discussedOptions, setDiscussedOptions] = useState<Set<number>>(new Set());
  const [evaluation, setEvaluation] = useState<CollaborativeEvaluation | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingScenario, setLoadingScenario] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [showTextInput, setShowTextInput] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [ttsLoading, setTtsLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sessionCreatedRef = useRef(false);

  const userTurns = history.filter((m) => m.role === 'user').length;

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [history, scrollToBottom]);

  const playExaminerTts = useCallback(async (text: string) => {
    try {
      setTtsLoading(true);
      const { data, mimeType } = await generateSpeechAction(text);
      const src = pcmToWavBase64(data, mimeType);
      const audio = new Audio(src);
      audio.play();
    } catch {
      // TTS is non-critical; silently ignore
    } finally {
      setTtsLoading(false);
    }
  }, []);

  const handleSelectPreset = useCallback((preset: Part3Scenario) => {
    setScenario(preset);
  }, []);

  const handleSurpriseMe = useCallback(async () => {
    setLoadingScenario(true);
    try {
      const generated = await generatePart3ScenarioAction();
      setScenario(generated);
    } catch {
      // Fallback to a random preset if AI fails
      const random = PRESET_SCENARIOS[Math.floor(Math.random() * PRESET_SCENARIOS.length)];
      setScenario(random);
    } finally {
      setLoadingScenario(false);
    }
  }, []);

  const handleStart = useCallback(async () => {
    if (!scenario) return;

    setPhase('conversation');

    // Create session (fire-and-forget)
    if (!sessionCreatedRef.current) {
      sessionCreatedRef.current = true;
      createSessionAction({
        mode: 'b1_collaborative',
        topic: scenario.topic,
        title: `B1 Collaborative: ${scenario.topic}`,
      }).catch(() => {
        // Non-critical
      });
    }

    // First examiner message
    const openingLine = `Let's talk about "${scenario.topic}". ${scenario.situation} ${scenario.prompt_question}`;
    setHistory([{ role: 'examiner', text: openingLine }]);
    await playExaminerTts(openingLine);
  }, [scenario, playExaminerTts]);

  const processAudioBlob = useCallback(
    async (blob: Blob) => {
      if (!scenario) return;

      setIsProcessing(true);
      setAudioError(null);

      try {
        const base64 = await blobToBase64(blob);
        const mimeType = 'audio/webm;codecs=opus';

        const { transcribed, examinerResponse } = await chatPart3Action(
          base64,
          mimeType,
          history,
          scenario
        );

        const userMsg: Part3ChatMessage = { role: 'user', text: transcribed };
        const examinerMsg: Part3ChatMessage = { role: 'examiner', text: examinerResponse };

        setHistory((prev) => [...prev, userMsg, examinerMsg]);

        // Mark options as discussed heuristically
        scenario.options.forEach((option, index) => {
          if (
            transcribed.toLowerCase().includes(option.toLowerCase().split(' ')[0]) ||
            examinerResponse.toLowerCase().includes(option.toLowerCase().split(' ')[0])
          ) {
            setDiscussedOptions((prev) => new Set([...prev, index]));
          }
        });

        await playExaminerTts(examinerResponse);
      } catch {
        setAudioError('Could not process audio. Please try again or use text input.');
      } finally {
        setIsProcessing(false);
      }
    },
    [scenario, history, playExaminerTts]
  );

  const { isRecording, startRecording, stopRecording } = useAudioRecorder({
    onRecorded: processAudioBlob,
    onError: useCallback(() => {
      setAudioError('Microphone access denied. Use text input instead.');
    }, []),
  });

  const handleTextSubmit = useCallback(async () => {
    if (!scenario || !textInput.trim()) return;

    const text = textInput.trim();
    setTextInput('');
    setShowTextInput(false);
    setIsProcessing(true);
    setAudioError(null);

    try {
      const userMsg: Part3ChatMessage = { role: 'user', text };
      const { examinerResponse } = await chatPart3TextAction(text, history, scenario);
      const examinerMsg: Part3ChatMessage = { role: 'examiner', text: examinerResponse };

      setHistory((prev) => [...prev, userMsg, examinerMsg]);
      await playExaminerTts(examinerResponse);
    } catch {
      setAudioError('Could not get examiner response. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [scenario, textInput, history, playExaminerTts]);

  const handleEvaluate = useCallback(async () => {
    if (!scenario) return;

    setPhase('evaluating');

    try {
      const result = await evaluatePart3Action(history, scenario);
      setEvaluation(result);
      setPhase('result');
    } catch {
      setPhase('result');
      setEvaluation({
        score: 0,
        task_achievement: 0,
        interaction: 0,
        grammar: 0,
        vocabulary: 0,
        feedback: 'Could not generate evaluation. Please try again.',
        strengths: [],
        areas_for_improvement: [],
      });
    }
  }, [scenario, history]);

  const handleTryAgain = useCallback(() => {
    setPhase('intro');
    setScenario(null);
    setHistory([]);
    setDiscussedOptions(new Set());
    setEvaluation(null);
    setIsProcessing(false);
    setAudioError(null);
    sessionCreatedRef.current = false;
  }, []);

  // ── INTRO PHASE ──────────────────────────────────────────────────────────
  if (phase === 'intro') {
    return (
      <div className="flex-1 flex flex-col min-h-0 overflow-auto">
        <div className="max-w-3xl mx-auto w-full px-4 py-8 space-y-8">
          {/* Header */}
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 rounded-lg hover:bg-trebol-secondary/20 text-trebol-text/60 hover:text-trebol-text transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-black text-trebol-text">B1 Collaborative Task</h1>
              <p className="text-sm text-trebol-text/60 font-medium">Cambridge B1 Preliminary · Part 3</p>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-trebol-secondary/10 rounded-xl p-5 space-y-2">
            <h2 className="font-bold text-trebol-text">How it works</h2>
            <ul className="space-y-1 text-sm text-trebol-text/70">
              <li className="flex items-start gap-2">
                <ChevronRight size={14} className="mt-0.5 text-trebol-primary shrink-0" />
                You discuss 5 options with an AI examiner (up to {MAX_TURNS} turns)
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight size={14} className="mt-0.5 text-trebol-primary shrink-0" />
                Speak your opinion on each option — give reasons!
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight size={14} className="mt-0.5 text-trebol-primary shrink-0" />
                After finishing, you get detailed feedback on your performance
              </li>
            </ul>
          </div>

          {/* Scenario selection */}
          <div className="space-y-4">
            <h2 className="font-bold text-trebol-text">Choose a scenario</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {PRESET_SCENARIOS.map((preset) => (
                <button
                  key={preset.topic}
                  onClick={() => handleSelectPreset(preset)}
                  className={`text-left p-4 rounded-xl border-2 transition-all ${
                    scenario?.topic === preset.topic
                      ? 'border-trebol-primary bg-trebol-primary/5'
                      : 'border-gray-200 hover:border-trebol-secondary bg-white'
                  }`}
                >
                  <p className="font-bold text-trebol-text text-sm">{preset.topic}</p>
                  <p className="text-xs text-trebol-text/60 mt-1 line-clamp-2">{preset.situation}</p>
                </button>
              ))}
            </div>

            <button
              onClick={handleSurpriseMe}
              disabled={loadingScenario}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-trebol-secondary/50 text-trebol-primary font-semibold hover:bg-trebol-secondary/10 transition-colors disabled:opacity-50"
            >
              {loadingScenario ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Shuffle size={16} />
              )}
              {loadingScenario ? 'Generating scenario…' : 'Surprise me (AI generated)'}
            </button>
          </div>

          {/* Selected scenario preview */}
          <AnimatePresence>
            {scenario && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white rounded-xl border border-trebol-secondary/30 p-5 space-y-3 shadow-sm"
              >
                <h3 className="font-bold text-trebol-text">{scenario.topic}</h3>
                <p className="text-sm text-trebol-text/70">{scenario.situation}</p>
                <p className="text-sm font-semibold text-trebol-primary">{scenario.prompt_question}</p>
                <div className="flex flex-wrap gap-2">
                  {scenario.options.map((opt) => (
                    <span
                      key={opt}
                      className="text-xs bg-trebol-secondary/20 text-trebol-text/80 px-2 py-1 rounded-full font-medium"
                    >
                      {opt}
                    </span>
                  ))}
                </div>

                <button
                  onClick={handleStart}
                  className="w-full mt-2 bg-trebol-primary text-white font-bold py-3 rounded-xl hover:opacity-90 transition-opacity"
                >
                  Start Discussion
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // ── EVALUATING PHASE ─────────────────────────────────────────────────────
  if (phase === 'evaluating') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-trebol-text/60">
        <Loader2 size={40} className="animate-spin text-trebol-primary" />
        <p className="font-semibold text-lg">Evaluating your performance…</p>
        <p className="text-sm">This takes a few seconds</p>
      </div>
    );
  }

  // ── RESULT PHASE ─────────────────────────────────────────────────────────
  if (phase === 'result' && evaluation) {
    return (
      <div className="flex-1 flex flex-col min-h-0 overflow-auto">
        <div className="max-w-2xl mx-auto w-full px-4 py-8 space-y-8">
          {/* Header */}
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 rounded-lg hover:bg-trebol-secondary/20 text-trebol-text/60 hover:text-trebol-text transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-2xl font-black text-trebol-text">Your Results</h1>
          </div>

          {/* Overall score */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col items-center gap-4">
            <p className="text-sm font-bold text-trebol-text/50 uppercase tracking-widest">Overall Score</p>
            <ScoreCircle score={evaluation.score} />
            <p className="text-center text-trebol-text/70 text-sm max-w-sm">{evaluation.feedback}</p>
          </div>

          {/* Sub-scores */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
            <h2 className="font-bold text-trebol-text">Detailed Scores</h2>
            <SubScoreBar label="Task Achievement" value={evaluation.task_achievement} />
            <SubScoreBar label="Interaction" value={evaluation.interaction} />
            <SubScoreBar label="Grammar" value={evaluation.grammar} />
            <SubScoreBar label="Vocabulary" value={evaluation.vocabulary} />
          </div>

          {/* Strengths */}
          {evaluation.strengths.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-5 space-y-3">
              <h2 className="font-bold text-green-800">Strengths</h2>
              <ul className="space-y-2">
                {evaluation.strengths.map((s) => (
                  <li key={s} className="flex items-start gap-2 text-sm text-green-700">
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Areas for improvement */}
          {evaluation.areas_for_improvement.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-3">
              <h2 className="font-bold text-amber-800">Areas for Improvement</h2>
              <ul className="space-y-2">
                {evaluation.areas_for_improvement.map((a) => (
                  <li key={a} className="flex items-start gap-2 text-sm text-amber-700">
                    <ChevronRight size={16} className="mt-0.5 shrink-0" />
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleTryAgain}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-trebol-primary text-trebol-primary font-bold hover:bg-trebol-primary/5 transition-colors"
            >
              <RotateCcw size={16} />
              Try Again
            </button>
            <button
              onClick={onBack}
              className="flex-1 py-3 rounded-xl bg-trebol-primary text-white font-bold hover:opacity-90 transition-opacity"
            >
              Back to Modes
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── CONVERSATION PHASE ───────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white shrink-0">
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-trebol-secondary/20 text-trebol-text/60 hover:text-trebol-text transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-black text-trebol-text truncate">{scenario?.topic ?? 'Collaborative Task'}</h1>
          <p className="text-xs text-trebol-text/50 font-medium">B1 · Part 3</p>
        </div>
        <span className="text-xs font-bold text-trebol-primary bg-trebol-secondary/20 px-3 py-1 rounded-full shrink-0">
          Turn {userTurns} of {MAX_TURNS}
        </span>
      </div>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Options sidebar */}
        <aside className="w-44 shrink-0 border-r border-gray-100 bg-gray-50 overflow-y-auto hidden md:flex flex-col p-3 gap-2">
          <p className="text-xs font-bold text-trebol-text/50 uppercase tracking-widest mb-1">Options</p>
          {scenario?.options.map((option, index) => (
            <div
              key={option}
              className={`flex items-start gap-2 text-xs p-2 rounded-lg transition-colors ${
                discussedOptions.has(index)
                  ? 'bg-green-100 text-green-700'
                  : 'bg-white text-trebol-text/70 border border-gray-200'
              }`}
            >
              {discussedOptions.has(index) ? (
                <CheckCircle2 size={12} className="mt-0.5 shrink-0" />
              ) : (
                <Circle size={12} className="mt-0.5 shrink-0" />
              )}
              <span className="font-medium">{option}</span>
            </div>
          ))}
        </aside>

        {/* Messages area */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {history.map((msg, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm ${
                    msg.role === 'user'
                      ? 'bg-trebol-primary text-white rounded-br-md'
                      : 'bg-gray-100 text-trebol-text rounded-bl-md'
                  }`}
                >
                  {msg.role === 'examiner' && (
                    <p className="text-[10px] font-bold text-trebol-text/50 mb-1 uppercase tracking-wider">
                      Examiner
                    </p>
                  )}
                  <p className="leading-relaxed">{msg.text}</p>
                </div>
              </motion.div>
            ))}

            {isProcessing && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin text-trebol-text/50" />
                  <span className="text-xs text-trebol-text/50">Examiner is responding…</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Error */}
          <AnimatePresence>
            {audioError && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mx-4 mb-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
              >
                {audioError}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Text input (optional) */}
          <AnimatePresence>
            {showTextInput && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="px-4 pb-2 flex gap-2"
              >
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleTextSubmit()}
                  placeholder="Type your response…"
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm text-trebol-text focus:outline-none focus:border-trebol-primary"
                  autoFocus
                />
                <button
                  onClick={handleTextSubmit}
                  disabled={!textInput.trim() || isProcessing}
                  className="bg-trebol-primary text-white px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50 hover:opacity-90 transition-opacity"
                >
                  Send
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Controls */}
          <div className="px-4 py-4 border-t border-gray-100 bg-white flex items-center justify-center gap-3 shrink-0">
            {/* Finish button */}
            {userTurns >= MAX_TURNS && (
              <button
                onClick={handleEvaluate}
                disabled={isProcessing}
                className="flex-1 max-w-xs bg-green-500 text-white font-bold py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={18} />
                Finish & Evaluate
              </button>
            )}

            {userTurns < MAX_TURNS && (
              <>
                {/* Mic button */}
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isProcessing || ttsLoading}
                  className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-md disabled:opacity-50 ${
                    isRecording
                      ? 'bg-red-500 text-white scale-110 animate-pulse'
                      : 'bg-trebol-primary text-white hover:opacity-90'
                  }`}
                >
                  {isRecording ? <MicOff size={24} /> : <Mic size={24} />}
                </button>

                {/* Text toggle */}
                <button
                  onClick={() => setShowTextInput((v) => !v)}
                  disabled={isRecording || isProcessing}
                  className="text-xs text-trebol-text/50 hover:text-trebol-text transition-colors font-medium disabled:opacity-30"
                >
                  {showTextInput ? 'Hide text' : 'Type instead'}
                </button>

                {/* Early finish */}
                {userTurns >= 4 && (
                  <button
                    onClick={handleEvaluate}
                    disabled={isProcessing || isRecording}
                    className="text-xs text-trebol-text/40 hover:text-trebol-primary transition-colors font-medium disabled:opacity-30"
                  >
                    Finish early
                  </button>
                )}
              </>
            )}

            {ttsLoading && (
              <Volume2 size={16} className="text-trebol-text/30 animate-pulse absolute right-6" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
