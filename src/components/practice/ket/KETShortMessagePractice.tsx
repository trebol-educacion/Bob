'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { KETWritingIcon } from '@/components/icons/KETIcons';
import { CelebrationCard } from '@/components/practice/yl/CelebrationCard';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import { ChatInputBar } from '@/components/chat/ChatInputBar';
import { BobAvatar } from '@/components/practice/yl/_shared';
import {
  generateKETShortMessageAction,
  evaluateKETShortMessageAction,
  type KETShortMessagePrompt,
  type KETShortMessageFeedback,
} from '@/actions/modes/ket-writing-part6';
import type { StoredMessage } from '@/actions/messages';
import { useTranslations } from 'next-intl';

export interface KETShortMessagePracticeProps {
  onBack: () => void;
  sessionId?: string;
  initialMessages?: StoredMessage[];
  onSessionCreated?: (sessionId: string) => void;
  onSessionFinished?: () => void;
  onOpenDashboard?: () => void;
}

type Phase = 'loading' | 'ready' | 'evaluating' | 'finished';

function countWords(text: string): number {
  return text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
}

function ScenarioCard({ scenario, recipient, contentPoints }: { scenario: string; recipient: string; contentPoints: string[] }) {
  const t = useTranslations('cambridge');
  return (
    <div
      className="rounded-2xl px-4 py-3 space-y-2"
      style={{
        background: 'color-mix(in oklab, var(--color-bob-brand) 6%, white)',
        border: '1px solid color-mix(in oklab, var(--color-bob-brand) 15%, white)',
      }}
    >
      <p className="text-xs font-bold uppercase tracking-widest text-bob-brand">{t('ket.shortMessage.situation')}</p>
      <p className="text-sm text-gray-800 leading-relaxed">
        Write a message to <strong>{recipient}</strong>. {scenario}
      </p>
      <div className="space-y-1 pt-1">
        {contentPoints.map((point, i) => (
          <div key={i} className="flex items-start gap-2 text-sm text-gray-700">
            <span
              className="mt-0.5 shrink-0 w-5 h-5 rounded-full text-bob-brand text-xs font-bold flex items-center justify-center"
              style={{ background: 'color-mix(in oklab, var(--color-bob-brand) 14%, white)' }}
            >
              {i + 1}
            </span>
            <span>{point}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-400 pt-1">{t('ket.shortMessage.wordGoal')}</p>
    </div>
  );
}

function FeedbackPanel({ feedback, userText, onOpenDashboard, animate }: {
  feedback: KETShortMessageFeedback;
  userText: string;
  onOpenDashboard?: () => void;
  animate: boolean;
}) {
  const t = useTranslations('cambridge');
  const [modelOpen, setModelOpen] = useState(false);
  const score = feedback.understood ? 1 : 0;

  return (
    <motion.div
      initial={animate ? { opacity: 0, y: 12 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col gap-4"
    >
      <div className="rounded-2xl bg-gray-50 border border-gray-100 px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">{t('ket.shortMessage.yourMessage')}</p>
        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{userText}</p>
      </div>

      <div className="rounded-2xl bg-white border border-gray-100 shadow-sm px-4 py-3 space-y-3">
        <div className="flex items-center gap-2">
          {feedback.understood
            ? <CheckCircle size={18} className="text-green-500 shrink-0" />
            : <XCircle size={18} className="text-amber-500 shrink-0" />}
          <span className="text-sm font-semibold text-gray-700">
            {feedback.understood ? t('ket.shortMessage.youDidIt') : t('ket.shortMessage.reviewYourMessage')}
          </span>
        </div>

        {feedback.highlights.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-green-600 mb-1">{t('ket.shortMessage.whatYouDidWell')}</p>
            <ul className="space-y-1">
              {feedback.highlights.map((h, i) => (
                <li key={i} className="flex items-start gap-1.5 text-sm text-gray-700">
                  <span className="text-green-500 mt-0.5">✓</span>
                  {h}
                </li>
              ))}
            </ul>
          </div>
        )}

        {feedback.suggestions.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-amber-600 mb-1">{t('ket.shortMessage.toImprove')}</p>
            <ul className="space-y-1">
              {feedback.suggestions.map((s, i) => (
                <li key={i} className="flex items-start gap-1.5 text-sm text-gray-700">
                  <span className="text-amber-500 mt-0.5">→</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {feedback.modelAnswer && (
          <div>
            <button
              type="button"
              onClick={() => setModelOpen((v) => !v)}
              className="flex items-center gap-1 text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors"
            >
              {modelOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {t('ket.shortMessage.viewModelAnswer')}
            </button>
            <AnimatePresence>
              {modelOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="overflow-hidden"
                >
                  <p className="mt-2 text-sm text-gray-600 bg-gray-50 rounded-xl px-3 py-2 leading-relaxed italic">
                    {feedback.modelAnswer}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      <CelebrationCard
        score={score}
        scoreMax={1}
        hideGrade
        feedback={feedback.understood
          ? '¡Escribiste tu mensaje! Sigue practicando para que te salga cada vez mejor.'
          : 'Vuelve a intentarlo — cada intento te hace más fuerte.'}
        onAction={onOpenDashboard}
        actionLabel="Ver mis actividades"
        animate={animate}
      />
    </motion.div>
  );
}

function tryRestoreFromMessages(messages: StoredMessage[]): {
  prompt: KETShortMessagePrompt | null;
  userText: string | null;
  feedback: KETShortMessageFeedback | null;
} {
  let prompt: KETShortMessagePrompt | null = null;
  let userText: string | null = null;
  let feedback: KETShortMessageFeedback | null = null;

  for (const msg of messages) {
    const cj = msg.content_json as Record<string, unknown> | null;
    if (!cj) continue;

    if (msg.role === 'bob' && cj.kind === 'writing_prompt') {
      prompt = {
        sessionId: msg.session_id ?? '',
        userId: msg.user_id ?? '',
        scenario: String(cj.scenario ?? ''),
        recipient: String(cj.recipient ?? 'your friend'),
        contentPoints: (cj.content_points as string[]) ?? [],
        wordTarget: Number(cj.word_target ?? 25),
        framingText: String(cj.framing_text ?? ''),
      };
    }
    if (msg.role === 'user' && cj.kind === 'writing_submission') {
      userText = String(cj.text ?? '');
    }
    if (msg.role === 'bob' && msg.msg_type === 'evaluation' && cj.is_final === true) {
      feedback = {
        understood: Boolean(cj.understood),
        highlights: (cj.highlights as string[]) ?? [],
        suggestions: (cj.suggestions as string[]) ?? [],
        modelAnswer: (cj.modelAnswer as string | null) ?? null,
      };
    }
  }

  return { prompt, userText, feedback };
}

/** KET Writing Part 6 — Short Message practice component. */
export function KETShortMessagePractice({
  onBack,
  sessionId: initialSessionId,
  initialMessages,
  onSessionCreated,
  onSessionFinished,
  onOpenDashboard,
}: KETShortMessagePracticeProps) {
  const t = useTranslations('cambridge');
  const [phase, setPhase] = useState<Phase>('loading');
  const [prompt, setPrompt] = useState<KETShortMessagePrompt | null>(null);
  const [text, setText] = useState('');
  const [feedback, setFeedback] = useState<KETShortMessageFeedback | null>(null);
  const [restoredUserText, setRestoredUserText] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isNewSession, setIsNewSession] = useState(false);
  const initStartedRef = useRef(false);

  useEffect(() => {
    if (initStartedRef.current) return;
    initStartedRef.current = true;
    async function init() {
      if (initialMessages && initialMessages.length > 0) {
        const restored = tryRestoreFromMessages(initialMessages);
        if (restored.prompt && restored.feedback) {
          setPrompt(restored.prompt);
          setRestoredUserText(restored.userText);
          setFeedback(restored.feedback);
          setPhase('finished');
          return;
        }
        if (restored.prompt) {
          setPrompt(restored.prompt);
          setPhase('ready');
          return;
        }
      }

      if (initialSessionId) {
        return;
      }

      setIsNewSession(true);
      const result = await generateKETShortMessageAction({
        sessionId: initialSessionId,
        userId: undefined,
      });

      if ('error' in result) {
        setErrorMsg(result.error);
        return;
      }

      if (!initialSessionId) {
        onSessionCreated?.(result.sessionId);
      }

      setPrompt(result);
      setPhase('ready');
    }

    void init();
  }, []);

  async function handleSubmit() {
    if (!prompt || !text.trim()) return;
    setPhase('evaluating');

    const result = await evaluateKETShortMessageAction({
      sessionId: prompt.sessionId,
      userId: prompt.userId,
      scenario: prompt.scenario,
      contentPoints: prompt.contentPoints,
      userText: text,
    });

    if ('error' in result) {
      setErrorMsg(result.error);
      setPhase('ready');
      return;
    }

    setFeedback(result);
    setPhase('finished');
    onSessionFinished?.();
  }

  const wordCount = countWords(text);
  const MIN_WORDS = 15;

  if (errorMsg) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 text-center min-h-[40vh]">
        <p className="text-red-500 font-semibold">{errorMsg}</p>
        <button
          type="button"
          onClick={onBack}
          className="px-5 py-2 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors text-sm"
        >
          {t('ket.shortMessage.back')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full relative">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
          aria-label={t('ket.shortMessage.back')}
        >
          ←
        </button>
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'color-mix(in oklab, var(--color-bob-brand) 12%, white)' }}
        >
          <KETWritingIcon size={18} className="text-bob-brand" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800 truncate">{t('ket.shortMessage.headerTitle')}</p>
          <p className="text-xs text-gray-400">{t('ket.shortMessage.headerSubtitle')}</p>
        </div>
        <span
          className="shrink-0 px-2 py-0.5 rounded-full text-bob-brand text-[10px] font-bold uppercase tracking-widest"
          style={{ background: 'color-mix(in oklab, var(--color-bob-brand) 12%, white)' }}
        >
          {t('ket.shortMessage.partBadge')}
        </span>
      </div>

      {phase === 'loading' && (
        <div className="flex-1 flex flex-col min-h-0">
          <BobMascotLoader message={t('ket.shortMessage.preparingExercise')} />
        </div>
      )}

      {phase === 'evaluating' && (
        <div className="flex-1 flex flex-col min-h-0">
          <BobMascotLoader message={t('ket.shortMessage.reviewingMessage')} />
        </div>
      )}

      {phase === 'ready' && prompt && (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22 }}
              className="flex flex-col gap-4"
            >
              <div className="flex items-start gap-2">
                <BobAvatar />
                <div className="bg-gray-50 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-700 leading-relaxed max-w-sm">
                  {prompt.framingText}
                </div>
              </div>
              <ScenarioCard
                scenario={prompt.scenario}
                recipient={prompt.recipient}
                contentPoints={prompt.contentPoints}
              />
            </motion.div>
          </div>

          <ChatInputBar
            variant="text"
            value={text}
            placeholder="Write your message here…"
            disabled={phase !== 'ready' || wordCount < MIN_WORDS}
            onChange={setText}
            onSend={handleSubmit}
          />
          <div className="shrink-0 px-4 pb-3 -mt-1 flex items-center justify-between text-xs text-gray-400 bg-white">
            <span>
              Words:{' '}
              <strong
                className={
                  wordCount < MIN_WORDS
                    ? 'text-amber-500'
                    : wordCount > 40
                    ? 'text-red-400'
                    : 'text-green-600'
                }
              >
                {wordCount}
              </strong>{' '}
              / target ~25
            </span>
            {wordCount < MIN_WORDS && (
              <span className="text-amber-500">
                {MIN_WORDS - wordCount} more to send
              </span>
            )}
          </div>
        </>
      )}

      {phase === 'finished' && prompt && feedback && (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <FeedbackPanel
            feedback={feedback}
            userText={restoredUserText ?? text}
            onOpenDashboard={onOpenDashboard}
            animate={isNewSession}
          />
        </div>
      )}
    </div>
  );
}
