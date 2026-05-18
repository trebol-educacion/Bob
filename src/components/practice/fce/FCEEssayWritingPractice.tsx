'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { FCEWritingIcon } from '@/components/icons/FCEIcons';
import { CelebrationCard } from '@/components/practice/yl/CelebrationCard';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import { BobAvatar } from '@/components/practice/yl/_shared';
import {
  generateFCEEssayAction,
  evaluateFCEEssayAction,
  type FCEEssayPrompt,
  type FCEEssayFeedback,
  type EssayNote,
} from '@/actions/modes/fce-writing-part1';
import type { StoredMessage } from '@/actions/messages';
import { useTranslations } from 'next-intl';

export interface FCEEssayWritingPracticeProps {
  onBack: () => void;
  sessionId?: string;
  initialMessages?: StoredMessage[];
  onSessionCreated?: (sessionId: string) => void;
  onSessionFinished?: () => void;
  onOpenDashboard?: () => void;
}

type Phase = 'loading' | 'ready' | 'evaluating' | 'finished';

type BandValue = 'OK' | 'Good' | 'Excellent';

function countWords(text: string): number {
  return text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
}

function BandPill({ label, value, t }: { label: string; value: BandValue; t: ReturnType<typeof useTranslations<'cambridge'>> }) {
  const colorMap: Record<BandValue, string> = {
    OK: 'bg-gray-100 text-gray-600',
    Good: 'bg-emerald-100 text-emerald-700',
    Excellent: 'bg-emerald-200 text-emerald-800',
  };
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${colorMap[value]}`}>
        {t(`fce.essay.bandLabel.${value}` as Parameters<typeof t>[0])}
      </span>
    </div>
  );
}

function EssayBriefCard({
  prompt,
  t,
}: {
  prompt: FCEEssayPrompt;
  t: ReturnType<typeof useTranslations<'cambridge'>>;
}) {
  return (
    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 px-4 py-4 space-y-3">
      <p className="text-xs text-gray-400 italic leading-snug">{prompt.context}</p>

      <div className="border-l-4 border-emerald-200 pl-3">
        <h2 className="text-base font-bold text-gray-800 leading-snug">{prompt.title}</h2>
        <p className="text-xs text-gray-500 mt-0.5">{prompt.essayQuestion}</p>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">
          {t('fce.essay.notesLabel')}
        </p>
        {prompt.notes.map((note, i) => (
          <div key={note.id} className="flex items-start gap-2 text-sm">
            <span className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center">
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-gray-700">{note.label}</span>
              {note.label.toLowerCase() === 'your own idea' && (
                <span className="ml-1.5 inline-block px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold uppercase tracking-wide">
                  {t('fce.essay.yourOwnIdeaBadge')}
                </span>
              )}
              <p className="text-xs text-gray-500 leading-snug mt-0.5">{note.description}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-gray-400 border-t border-emerald-100 pt-2">
        {t('fce.essay.words')} 140-190
      </p>
    </div>
  );
}

function FeedbackPanel({
  feedback,
  notes,
  userText,
  onOpenDashboard,
  animate,
  t,
}: {
  feedback: FCEEssayFeedback;
  notes: [EssayNote, EssayNote, EssayNote];
  userText: string;
  onOpenDashboard?: () => void;
  animate: boolean;
  t: ReturnType<typeof useTranslations<'cambridge'>>;
}) {
  const [modelOpen, setModelOpen] = useState(false);
  const coveredCount = feedback.notesCovered.filter(Boolean).length;

  return (
    <motion.div
      initial={animate ? { opacity: 0, y: 12 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col gap-4"
    >
      <div className="rounded-2xl bg-gray-50 border border-gray-100 px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">
          {t('fce.essay.yourEssay')}
        </p>
        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{userText}</p>
      </div>

      <div className="rounded-2xl bg-white border border-gray-100 shadow-sm px-4 py-3 space-y-3">
        <div className="flex items-center gap-2">
          {feedback.understood ? (
            <CheckCircle size={18} className="text-emerald-500 shrink-0" />
          ) : (
            <XCircle size={18} className="text-amber-500 shrink-0" />
          )}
          <span className="text-sm font-semibold text-gray-700">
            {feedback.understood ? t('fce.essay.youDidIt') : t('fce.essay.reviewYourEssay')}
          </span>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-600 mb-1.5">
            {t('fce.essay.notesLabel')}
          </p>
          <div className="space-y-1">
            {notes.map((note, i) => (
              <div key={note.id} className="flex items-center gap-2 text-sm">
                {feedback.notesCovered[i] ? (
                  <CheckCircle size={14} className="text-emerald-500 shrink-0" />
                ) : (
                  <XCircle size={14} className="text-amber-400 shrink-0" />
                )}
                <span className={feedback.notesCovered[i] ? 'text-gray-700' : 'text-gray-400'}>
                  {note.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <BandPill
            label={t('fce.essay.organizationLabel')}
            value={feedback.organization}
            t={t}
          />
          <BandPill
            label={t('fce.essay.registerLabel')}
            value={feedback.register}
            t={t}
          />
        </div>

        {feedback.highlights.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-600 mb-1">
              {t('fce.essay.whatYouDidWell')}
            </p>
            <ul className="space-y-1">
              {feedback.highlights.map((h, i) => (
                <li key={i} className="flex items-start gap-1.5 text-sm text-gray-700">
                  <span className="text-emerald-500 mt-0.5">✓</span>
                  {h}
                </li>
              ))}
            </ul>
          </div>
        )}

        {feedback.suggestions.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-amber-600 mb-1">
              {t('fce.essay.toImprove')}
            </p>
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
              {modelOpen ? t('fce.essay.hideModelAnswer') : t('fce.essay.viewModelAnswer')}
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
                  <p className="mt-2 text-sm text-gray-600 bg-emerald-50 rounded-xl px-3 py-2 leading-relaxed italic">
                    {feedback.modelAnswer}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      <CelebrationCard
        score={coveredCount}
        scoreMax={3}
        feedback={t('fce.essay.celebrationFeedback')}
        onAction={onOpenDashboard}
        actionLabel={t('fce.essay.celebrationAction')}
        animate={animate}
      />
    </motion.div>
  );
}

function tryRestoreFromMessages(messages: StoredMessage[]): {
  prompt: FCEEssayPrompt | null;
  userText: string | null;
  feedback: FCEEssayFeedback | null;
} {
  let prompt: FCEEssayPrompt | null = null;
  let userText: string | null = null;
  let feedback: FCEEssayFeedback | null = null;

  for (const msg of messages) {
    const cj = msg.content_json as Record<string, unknown> | null;
    if (!cj) continue;

    if (msg.role === 'bob' && cj.kind === 'essay_prompt') {
      const rawNotes = cj.notes as EssayNote[] | null;
      if (rawNotes && rawNotes.length === 3) {
        prompt = {
          sessionId: msg.session_id ?? '',
          userId: msg.user_id ?? '',
          title: String(cj.title ?? ''),
          essayQuestion: String(cj.essay_question ?? ''),
          context: String(cj.context ?? ''),
          notes: rawNotes as [EssayNote, EssayNote, EssayNote],
          wordTargetMin: 140,
          wordTargetMax: 190,
          framingText: String(cj.framing_text ?? ''),
        };
      }
    }
    if (msg.role === 'user' && cj.kind === 'writing_submission') {
      userText = String(cj.text ?? '');
    }
    if (msg.role === 'bob' && msg.msg_type === 'evaluation' && cj.is_final === true) {
      feedback = {
        understood: Boolean(cj.understood),
        highlights: (cj.highlights as string[]) ?? [],
        suggestions: (cj.suggestions as string[]) ?? [],
        notesCovered: (cj.notesCovered as [boolean, boolean, boolean]) ?? [false, false, false],
        organization: (cj.organization as FCEEssayFeedback['organization']) ?? 'OK',
        register: (cj.register as FCEEssayFeedback['register']) ?? 'OK',
        modelAnswer: (cj.modelAnswer as string | null) ?? null,
      };
    }
  }

  return { prompt, userText, feedback };
}

/** FCE Writing Part 1 — Compulsory Essay practice component. */
export function FCEEssayWritingPractice({
  onBack,
  sessionId: initialSessionId,
  initialMessages,
  onSessionCreated,
  onSessionFinished,
  onOpenDashboard,
}: FCEEssayWritingPracticeProps) {
  const t = useTranslations('cambridge');
  const [phase, setPhase] = useState<Phase>('loading');
  const [prompt, setPrompt] = useState<FCEEssayPrompt | null>(null);
  const [text, setText] = useState('');
  const [feedback, setFeedback] = useState<FCEEssayFeedback | null>(null);
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
      const result = await generateFCEEssayAction({
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

    const result = await evaluateFCEEssayAction({
      sessionId: prompt.sessionId,
      userId: prompt.userId,
      title: prompt.title,
      notes: prompt.notes,
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
  const MIN_WORDS = 100;
  const WARN_WORDS = 220;

  if (errorMsg) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 text-center min-h-[40vh]">
        <p className="text-red-500 font-semibold">{errorMsg}</p>
        <button
          type="button"
          onClick={onBack}
          className="px-5 py-2 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors text-sm"
        >
          {t('fce.essay.back')}
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
          aria-label={t('fce.essay.back')}
        >
          ←
        </button>
        <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
          <FCEWritingIcon size={18} className="text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800 truncate">{t('fce.essay.headerTitle')}</p>
          <p className="text-xs text-gray-400">{t('fce.essay.headerSubtitle')}</p>
        </div>
        <span className="shrink-0 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-600 text-[10px] font-bold uppercase tracking-widest">
          {t('fce.essay.partBadge')}
        </span>
      </div>

      {phase === 'loading' && (
        <div className="flex-1 flex flex-col min-h-0">
          <BobMascotLoader message={t('fce.essay.preparingExercise')} />
        </div>
      )}

      {phase === 'evaluating' && (
        <div className="flex-1 flex flex-col min-h-0">
          <BobMascotLoader message={t('fce.essay.reviewingMessage')} />
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
              <EssayBriefCard prompt={prompt} t={t} />
            </motion.div>
          </div>

          <div className="shrink-0 border-t border-gray-100 bg-white px-4 py-3 space-y-2">
            <div className="relative">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t('fce.essay.placeholder')}
                rows={6}
                disabled={phase !== 'ready'}
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 pr-14 text-sm text-gray-800 leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-emerald-300 transition-shadow disabled:bg-gray-50 disabled:cursor-not-allowed"
              />
              <button
                type="button"
                onClick={handleSubmit}
                disabled={phase !== 'ready' || wordCount < MIN_WORDS}
                aria-label="Submit essay"
                className="absolute right-2.5 bottom-2.5 w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-sm hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="13 6 19 12 13 18" />
                </svg>
              </button>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>
                {t('fce.essay.words')}{' '}
                <strong
                  className={
                    wordCount < MIN_WORDS
                      ? 'text-amber-500'
                      : wordCount > WARN_WORDS
                        ? 'text-red-400'
                        : 'text-emerald-600'
                  }
                >
                  {wordCount}
                </strong>{' '}
                {t('fce.essay.target')}
              </span>
              {wordCount < MIN_WORDS && (
                <span className="text-amber-500">
                  {t('fce.essay.moreToSend', { remaining: MIN_WORDS - wordCount })}
                </span>
              )}
            </div>
          </div>
        </>
      )}

      {phase === 'finished' && prompt && feedback && (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <FeedbackPanel
            feedback={feedback}
            notes={prompt.notes}
            userText={restoredUserText ?? text}
            onOpenDashboard={onOpenDashboard}
            animate={isNewSession}
            t={t}
          />
        </div>
      )}
    </div>
  );
}
