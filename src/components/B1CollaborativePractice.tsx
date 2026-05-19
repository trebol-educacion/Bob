'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Mic,
  MicOff,
  Loader2,
  CheckCircle2,
  Circle,
  ChevronRight,
  RotateCcw,
  Shuffle,
  Volume2,
  MessageSquare,
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
  getB1SessionMessagesAction,
  type Part3Scenario,
  type Part3ChatMessage,
} from '@/actions/modes/part3';
import type { FormativeFeedback } from '@/lib/types/practice';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import { ChatShell } from '@/components/ChatShell';
import { MessageBubble, InfoCard } from '@/components/chat';
import { ACTIVE_MODEL_LABEL } from '@/lib/models';
import { useTranslations } from 'next-intl';

interface B1CollaborativePracticeProps {
  onBack: () => void;
  sessionId?: string;
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

function FormativeFeedbackPanel({ feedback }: { feedback: FormativeFeedback }) {
  return (
    <div className="space-y-4">
      <div className={`text-center py-3 px-4 rounded-xl font-bold text-sm ${feedback.understood ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
        {feedback.understood ? 'Great discussion — your ideas came through clearly!' : 'Good effort — keep practising!'}
      </div>
      {feedback.highlights.length > 0 && (
        <InfoCard title="What went well" icon={CheckCircle2}>
          <ul className="space-y-2">
            {feedback.highlights.map((h, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-green-600" />
                {h}
              </li>
            ))}
          </ul>
        </InfoCard>
      )}
      {feedback.suggestions.length > 0 && (
        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-center gap-2 mb-3">
            <ChevronRight size={14} className="text-amber-600 shrink-0" />
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Tips to improve</span>
          </div>
          <ul className="space-y-2 text-sm text-amber-800/80">
            {feedback.suggestions.map((s, i) => (
              <li key={i} className="flex items-start gap-2">
                <ChevronRight size={14} className="mt-0.5 shrink-0" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}
      {feedback.model_answer && (
        <div
          className="rounded-2xl p-4 space-y-1"
          style={{
            background: 'color-mix(in oklab, var(--color-bob-brand) 8%, white)',
            border: '1px solid color-mix(in oklab, var(--color-bob-brand) 15%, white)',
          }}
        >
          <p className="text-xs font-bold text-bob-brand uppercase tracking-widest">Example phrase</p>
          <p className="text-sm text-gray-800 italic">"{feedback.model_answer}"</p>
        </div>
      )}
    </div>
  );
}

/** B1 Collaborative Task — Cambridge B1 Preliminary Part 3. */
export function B1CollaborativePractice({ onBack, sessionId: initialSessionId }: B1CollaborativePracticeProps) {
  const t = useTranslations('cambridge');
  const [phase, setPhase] = useState<Phase>('intro');
  const [scenario, setScenario] = useState<Part3Scenario | null>(null);
  const [history, setHistory] = useState<Part3ChatMessage[]>([]);
  const [discussedOptions, setDiscussedOptions] = useState<Set<number>>(new Set());
  const [evaluation, setEvaluation] = useState<FormativeFeedback | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingScenario, setLoadingScenario] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [showTextInput, setShowTextInput] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [ttsLoading, setTtsLoading] = useState(false);

  const sessionCreatedRef = useRef(false);
  const sessionIdRef = useRef<string | null>(initialSessionId ?? null);

  useEffect(() => {
    if (!initialSessionId) return;
    sessionIdRef.current = initialSessionId;
    sessionCreatedRef.current = true;
    getB1SessionMessagesAction(initialSessionId).then(({ history: h, feedback: fb }) => {
      if (h.length > 0) {
        setHistory(h);
        setPhase('conversation');
      }
      if (fb) {
        setEvaluation(fb);
        setPhase('result');
      }
    }).catch(() => {});
  }, [initialSessionId]);

  const userTurns = history.filter((m) => m.role === 'user').length;

  const playExaminerTts = useCallback(async (text: string) => {
    try {
      setTtsLoading(true);
      const { data, mimeType } = await generateSpeechAction(text);
      const src = pcmToWavBase64(data, mimeType);
      const audio = new Audio(src);
      audio.play();
    } catch {
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
      const random = PRESET_SCENARIOS[Math.floor(Math.random() * PRESET_SCENARIOS.length)];
      setScenario(random);
    } finally {
      setLoadingScenario(false);
    }
  }, []);

  const handleStart = useCallback(async () => {
    if (!scenario) return;

    setPhase('conversation');

    if (!sessionCreatedRef.current) {
      sessionCreatedRef.current = true;
      createSessionAction({
        mode: 'cambridge_pet_p3',
        topic: scenario.topic,
        title: `B1 Collaborative: ${scenario.topic}`,
      }).then((result) => {
        if (result.data) sessionIdRef.current = result.data.id;
      }).catch(() => {});
    }

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
          scenario,
          sessionIdRef.current ?? undefined
        );

        const userMsg: Part3ChatMessage = { role: 'user', text: transcribed };
        const examinerMsg: Part3ChatMessage = { role: 'examiner', text: examinerResponse };

        setHistory((prev) => [...prev, userMsg, examinerMsg]);

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
      const { examinerResponse } = await chatPart3TextAction(text, history, scenario, sessionIdRef.current ?? undefined);
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
      const result = await evaluatePart3Action(history, scenario, sessionIdRef.current ?? undefined);
      setEvaluation(result);
      setPhase('result');
    } catch {
      setPhase('result');
      setEvaluation({
        kind: 'formative',
        understood: false,
        highlights: [],
        suggestions: ['Could not generate feedback. Please try again.'],
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
    sessionIdRef.current = null;
  }, []);

  if (phase === 'intro') {
    const introInputSlot = (
      <div className="flex-none border-t border-gray-100 bg-white px-4 py-4 space-y-4">
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
          <span className="flex items-center justify-center w-4 h-4">
            {loadingScenario ? <Loader2 size={16} className="animate-spin" /> : <Shuffle size={16} />}
          </span>
          {loadingScenario ? t('b1.collaborative.generatingScenario') : t('b1.collaborative.surpriseMe')}
        </button>

        <AnimatePresence>
          {scenario && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-3"
            >
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
                className="w-full bg-trebol-primary text-white font-bold py-3 rounded-xl hover:opacity-90 transition-opacity"
              >
                {t('b1.collaborative.startDiscussion')}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );

    const introBody = (
      <div className="space-y-4">
        <MessageBubble variant="assistant" icon={MessageSquare} accentColor="blue" noAnimate>
          <p className="font-semibold">{t('b1.collaborative.howItWorks')}</p>
          <ul className="mt-2 space-y-1 text-sm">
            <li className="flex items-start gap-2">
              <ChevronRight size={14} className="mt-0.5 shrink-0" />
              {t('b1.collaborative.howItWorksLine1', { maxTurns: MAX_TURNS })}
            </li>
            <li className="flex items-start gap-2">
              <ChevronRight size={14} className="mt-0.5 shrink-0" />
              {t('b1.collaborative.howItWorksLine2')}
            </li>
            <li className="flex items-start gap-2">
              <ChevronRight size={14} className="mt-0.5 shrink-0" />
              {t('b1.collaborative.howItWorksLine3')}
            </li>
          </ul>
        </MessageBubble>

        {scenario && (
          <InfoCard title={scenario.topic} icon={MessageSquare}>
            <p>{scenario.situation}</p>
            <p className="mt-1 font-semibold text-amber-900">{scenario.prompt_question}</p>
          </InfoCard>
        )}
      </div>
    );

    return (
      <ChatShell
        headerConfig={{
          icon: MessageSquare,
          title: t('b1.collaborative.headerTitle'),
          subtitle: t('b1.collaborative.headerSubtitle'),
          accentColor: 'blue',
          online: true,
          leftSlot: (
            <button
              onClick={onBack}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
          ),
        }}
        footerConfig={{ modeLabel: t('b1.collaborative.footerModeLabel'), modelName: ACTIVE_MODEL_LABEL }}
        inputSlot={introInputSlot}
        animationKey="b1-intro"
      >
        {introBody}
      </ChatShell>
    );
  }

  if (phase === 'evaluating') {
    return <BobMascotLoader message={t('b1.collaborative.evaluatingPerformance')} />;
  }

  if (phase === 'result' && evaluation) {
    const resultInputSlot = (
      <div className="flex-none border-t border-gray-100 bg-white px-4 py-4 flex gap-3">
        <button
          onClick={handleTryAgain}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-trebol-primary text-trebol-primary font-bold hover:bg-trebol-primary/5 transition-colors"
        >
          <RotateCcw size={16} />
          {t('common.tryAgain')}
        </button>
        <button
          onClick={onBack}
          className="flex-1 py-3 rounded-xl bg-trebol-primary text-white font-bold hover:opacity-90 transition-opacity"
        >
          {t('common.backToModes')}
        </button>
      </div>
    );

    return (
      <ChatShell
        headerConfig={{
          icon: MessageSquare,
          title: t('b1.collaborative.feedbackTitle'),
          subtitle: t('b1.collaborative.headerSubtitle'),
          accentColor: 'blue',
          online: false,
          leftSlot: (
            <button
              onClick={onBack}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
          ),
        }}
        footerConfig={{ modeLabel: t('b1.collaborative.footerFeedbackLabel'), modelName: ACTIVE_MODEL_LABEL }}
        inputSlot={resultInputSlot}
        animationKey="b1-result"
      >
        <FormativeFeedbackPanel feedback={evaluation} />
      </ChatShell>
    );
  }

  const optionsSidebar = (
    <div className="hidden md:flex flex-col gap-2 w-44 shrink-0 border-r border-gray-100 bg-gray-50 overflow-y-auto p-3">
      <p className="text-xs font-bold text-trebol-text/50 uppercase tracking-widest mb-1">{t('b1.collaborative.optionsSidebarLabel')}</p>
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
    </div>
  );

  const conversationInputSlot = (
    <div className="flex-none border-t border-gray-100 bg-white">
      <AnimatePresence>
        {audioError && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mx-4 mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
          >
            {audioError}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showTextInput && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="px-4 pt-2 flex gap-2"
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
              {t('common.send')}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="px-4 py-4 flex items-center justify-center gap-3 relative">
        {userTurns >= MAX_TURNS && (
          <button
            onClick={handleEvaluate}
            disabled={isProcessing}
            className="flex-1 max-w-xs bg-green-500 text-white font-bold py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <CheckCircle2 size={18} />
            {t('b1.collaborative.finishEvaluate')}
          </button>
        )}

        {userTurns < MAX_TURNS && (
          <>
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

            <button
              onClick={() => setShowTextInput((v) => !v)}
              disabled={isRecording || isProcessing}
              className="text-xs text-trebol-text/50 hover:text-trebol-text transition-colors font-medium disabled:opacity-30"
            >
              {showTextInput ? t('b1.collaborative.hideText') : t('b1.collaborative.typeInstead')}
            </button>

            {userTurns >= 4 && (
              <button
                onClick={handleEvaluate}
                disabled={isProcessing || isRecording}
                className="text-xs text-trebol-text/40 hover:text-trebol-primary transition-colors font-medium disabled:opacity-30"
              >
                {t('b1.collaborative.finishEarly')}
              </button>
            )}
          </>
        )}

        {ttsLoading && (
          <Volume2 size={16} className="text-trebol-text/30 animate-pulse absolute right-6" />
        )}
      </div>
    </div>
  );

  const conversationBody = (
    <div className="flex min-h-0 gap-0">
      {optionsSidebar}
      <div className="flex-1 space-y-3 min-w-0">
        {history.map((msg, index) => (
          <MessageBubble
            key={index}
            variant={msg.role === 'user' ? 'user' : 'assistant'}
            icon={MessageSquare}
            accentColor="blue"
            noAnimate
          >
            {msg.role === 'examiner' && (
              <p className="text-[10px] font-bold opacity-50 mb-1 uppercase tracking-wider">{t('b1.collaborative.examiner')}</p>
            )}
            <p className="leading-relaxed">{msg.text}</p>
          </MessageBubble>
        ))}

        {isProcessing && (
          <MessageBubble variant="assistant" icon={MessageSquare} accentColor="blue">
            <div className="flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              <span className="text-xs opacity-60">{t('b1.collaborative.examinerResponding')}</span>
            </div>
          </MessageBubble>
        )}
      </div>
    </div>
  );

  return (
    <ChatShell
      headerConfig={{
        icon: MessageSquare,
        title: scenario?.topic ?? 'Collaborative Task',
        subtitle: t('b1.collaborative.conversationSubtitle'),
        accentColor: 'blue',
        online: true,
        leftSlot: (
          <button
            onClick={onBack}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
        ),
        rightSlot: (
          <span className="text-xs font-bold text-trebol-primary bg-trebol-secondary/20 px-3 py-1 rounded-full">
            {t('b1.collaborative.turnOf', { current: userTurns, max: MAX_TURNS })}
          </span>
        ),
      }}
      footerConfig={{ modeLabel: t('b1.collaborative.footerCollaborativeLabel'), modelName: ACTIVE_MODEL_LABEL }}
      inputSlot={conversationInputSlot}
      animationKey="b1-conversation"
    >
      {conversationBody}
    </ChatShell>
  );
}
