'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles, BookOpen, MessageSquare } from 'lucide-react';
import { PETWritingIcon } from '@/components/icons/PETIcons';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import { ChatInputBar } from '@/components/chat/ChatInputBar';
import { BobAvatar } from '@/components/practice/yl/_shared';
import {
  generatePETWritingChallengeAction,
  submitPETWritingChallengeAction,
  type PETWritingChallengePrompt,
  type PETWritingChallengeFeedback,
} from '@/actions/modes/pet-writing-challenge';
import type { StoredMessage } from '@/actions/messages';
import type { YLRenderProps } from '@/lib/routing';

export type PETWritingChallengePracticeProps = YLRenderProps;

type Phase = 'loading' | 'ready' | 'evaluating' | 'finished';

const FORMAT_LABEL: Record<PETWritingChallengePrompt['format'], string> = {
  email: 'Email reply',
  review: 'Online review',
  story: 'Story continuation',
};

function countWords(text: string): number {
  return text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
}

function ChallengeCard({ prompt }: { prompt: PETWritingChallengePrompt }) {
  return (
    <div
      className="rounded-2xl px-4 py-3 space-y-3"
      style={{
        background: 'color-mix(in oklab, var(--color-bob-brand) 6%, white)',
        border: '1px solid color-mix(in oklab, var(--color-bob-brand) 15%, white)',
      }}
    >
      <div
        className="flex items-center gap-2 pb-2"
        style={{ borderBottom: '1px solid color-mix(in oklab, var(--color-bob-brand) 15%, white)' }}
      >
        <span
          className="px-2 py-0.5 rounded-full text-bob-brand text-[10px] font-bold uppercase tracking-widest"
          style={{ background: 'color-mix(in oklab, var(--color-bob-brand) 14%, white)' }}
        >
          {FORMAT_LABEL[prompt.format]}
        </span>
        {prompt.title && <p className="text-sm font-semibold text-gray-800 truncate">{prompt.title}</p>}
      </div>

      <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-line">{prompt.stimulus}</p>

      <p className="text-sm font-medium text-gray-700 leading-relaxed">{prompt.task}</p>

      <div
        className="pt-2 space-y-1"
        style={{ borderTop: '1px solid color-mix(in oklab, var(--color-bob-brand) 15%, white)' }}
      >
        <p className="text-xs font-bold uppercase tracking-widest text-bob-brand">Include these</p>
        {prompt.guidePoints.map((point, i) => (
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
    </div>
  );
}

function FeedbackPanel({
  feedback,
  userText,
  onOpenDashboard,
  animate,
}: {
  feedback: PETWritingChallengeFeedback;
  userText: string;
  onOpenDashboard?: () => void;
  animate: boolean;
}) {
  return (
    <motion.div
      initial={animate ? { opacity: 0, y: 12 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col gap-4"
    >
      <div className="rounded-2xl bg-gray-50 border border-gray-100 px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Your text</p>
        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{userText}</p>
      </div>

      <div className="rounded-2xl bg-white border border-gray-100 shadow-sm px-4 py-3 space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Sparkles size={16} className="text-amber-500 shrink-0" />
            <p className="text-xs font-bold uppercase tracking-widest text-amber-600">Well done</p>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">{feedback.motivation}</p>
        </div>

        {feedback.vocabulary.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <BookOpen size={16} className="text-emerald-500 shrink-0" />
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">Stronger words</p>
            </div>
            <ul className="space-y-1.5">
              {feedback.vocabulary.map((v, i) => (
                <li key={i} className="text-sm text-gray-700 leading-relaxed">
                  <span className="line-through text-gray-400">{v.original}</span>{' '}
                  <span className="text-gray-400">→</span>{' '}
                  <strong className="text-emerald-700">{v.suggestion}</strong>
                  {v.example && <span className="block text-xs text-gray-500 italic mt-0.5">{v.example}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {feedback.grammar.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <MessageSquare size={16} className="text-sky-500 shrink-0" />
              <p className="text-xs font-bold uppercase tracking-widest text-sky-600">Grammar tips</p>
            </div>
            <ul className="space-y-1.5">
              {feedback.grammar.map((g, i) => (
                <li key={i} className="text-sm text-gray-700 leading-relaxed">
                  {g.note}
                  {g.corrected && (
                    <span className="block text-xs text-gray-600 bg-sky-50 rounded-lg px-2 py-1 mt-1">{g.corrected}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onOpenDashboard}
        className="self-start px-5 py-2 bg-bob-brand text-white rounded-xl font-semibold hover:opacity-90 transition-opacity text-sm"
      >
        Go to dashboard
      </button>
    </motion.div>
  );
}

function tryRestoreFromMessages(messages: StoredMessage[]): {
  prompt: PETWritingChallengePrompt | null;
  userText: string | null;
  feedback: PETWritingChallengeFeedback | null;
} {
  let prompt: PETWritingChallengePrompt | null = null;
  let userText: string | null = null;
  let feedback: PETWritingChallengeFeedback | null = null;

  for (const msg of messages) {
    const cj = msg.content_json as Record<string, unknown> | null;
    if (!cj) continue;

    if (msg.role === 'bob' && cj.kind === 'pet_writing_challenge_prompt') {
      const fmt = cj.format as PETWritingChallengePrompt['format'];
      prompt = {
        sessionId: msg.session_id ?? '',
        userId: msg.user_id ?? '',
        format: fmt === 'email' || fmt === 'review' || fmt === 'story' ? fmt : 'email',
        title: String(cj.title ?? ''),
        theme: String(cj.theme ?? ''),
        stimulus: String(cj.stimulus ?? ''),
        task: String(cj.task ?? ''),
        guidePoints: (cj.guide_points as string[]) ?? [],
        minWords: Number(cj.min_words ?? 60),
        maxWords: Number(cj.max_words ?? 100),
        framingText: String(cj.framing_text ?? ''),
      };
    }
    if (msg.role === 'user' && cj.kind === 'writing_submission') {
      userText = String(cj.text ?? '');
    }
    if (msg.role === 'bob' && msg.msg_type === 'evaluation' && cj.is_final === true) {
      feedback = {
        kind: 'formative',
        motivation: String(cj.motivation ?? ''),
        vocabulary: (cj.vocabulary as PETWritingChallengeFeedback['vocabulary']) ?? [],
        grammar: (cj.grammar as PETWritingChallengeFeedback['grammar']) ?? [],
      };
    }
  }

  return { prompt, userText, feedback };
}

/** Cambridge B1 PET Writing Challenge — rotating short-writing generator with formative feedback. */
export function PETWritingChallengePractice({
  onBack,
  sessionId: initialSessionId,
  initialMessages,
  onSessionCreated,
  onSessionFinished,
  onOpenDashboard,
}: PETWritingChallengePracticeProps) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [prompt, setPrompt] = useState<PETWritingChallengePrompt | null>(null);
  const [text, setText] = useState('');
  const [feedback, setFeedback] = useState<PETWritingChallengeFeedback | null>(null);
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
      const result = await generatePETWritingChallengeAction({ sessionId: initialSessionId, userId: undefined });

      if ('error' in result) {
        setErrorMsg(result.error);
        return;
      }

      onSessionCreated?.(result.sessionId);
      setPrompt(result);
      setPhase('ready');
    }

    void init();
  }, []);

  async function handleSubmit() {
    if (!prompt || !text.trim()) return;
    setPhase('evaluating');

    const result = await submitPETWritingChallengeAction({
      sessionId: prompt.sessionId,
      userId: prompt.userId,
      task: prompt.task,
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
  const minWords = prompt?.minWords ?? 60;
  const maxWords = prompt?.maxWords ?? 100;

  if (errorMsg) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 text-center min-h-[40vh]">
        <p className="text-red-500 font-semibold">{errorMsg}</p>
        <button
          type="button"
          onClick={onBack}
          className="px-5 py-2 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors text-sm"
        >
          Back
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
          aria-label="Back"
        >
          ←
        </button>
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'color-mix(in oklab, var(--color-bob-brand) 12%, white)' }}
        >
          <PETWritingIcon size={18} className="text-bob-brand" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800 truncate">Writing Challenge</p>
          <p className="text-xs text-gray-400">Cambridge B1 · Writing</p>
        </div>
        <span
          className="shrink-0 px-2 py-0.5 rounded-full text-bob-brand text-[10px] font-bold uppercase tracking-widest"
          style={{ background: 'color-mix(in oklab, var(--color-bob-brand) 12%, white)' }}
        >
          B1
        </span>
      </div>

      {phase === 'loading' && (
        <div className="flex-1 flex flex-col min-h-0">
          <BobMascotLoader message="Preparing your challenge..." />
        </div>
      )}

      {phase === 'evaluating' && (
        <div className="flex-1 flex flex-col min-h-0">
          <BobMascotLoader message="Reading your text..." />
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
              <ChallengeCard prompt={prompt} />
            </motion.div>
          </div>

          <ChatInputBar
            variant="text"
            value={text}
            placeholder="Write your text in English..."
            disabled={phase !== 'ready' || wordCount < minWords}
            onChange={setText}
            onSend={handleSubmit}
          />
          <div className="shrink-0 px-4 pb-3 -mt-1 flex items-center justify-between text-xs text-gray-400 bg-white">
            <span>
              Words:{' '}
              <strong
                className={
                  wordCount < minWords
                    ? 'text-amber-500'
                    : wordCount > maxWords
                    ? 'text-red-400'
                    : 'text-green-600'
                }
              >
                {wordCount}
              </strong>{' '}
              / {minWords}-{maxWords}
            </span>
            {wordCount < minWords && (
              <span className="text-amber-500">{minWords - wordCount} more to send</span>
            )}
          </div>
        </>
      )}

      {phase === 'finished' && feedback && (
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
