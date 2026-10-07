'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, ChevronUp, ImageIcon, Check } from 'lucide-react';
import { KETWritingIcon } from '@/components/icons/KETIcons';
import { CelebrationCard } from '@/components/practice/yl/CelebrationCard';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import { BobAvatar } from '@/components/practice/yl/_shared';
import {
  generateKETPictureStoryPlanAction,
  evaluateKETPictureStoryAction,
  type StorySceneWithImage,
  type PictureStoryFeedback,
} from '@/actions/modes/ket-writing-part7';
import type { StoredMessage } from '@/actions/messages';
import { restorePictureStory } from '@/lib/ket/writing-restore';
import { resolveActivityBoot } from '@/lib/activity/boot';
import { ActivityLoadError } from '@/components/practice/ActivityLoadError';
import { ActivityHeader } from '@/components/activity/ActivityHeader';
import { toScore10 } from '@/lib/session/score';

const NO_LOADING: Set<number> = new Set();

export interface KETStoryWritingPracticeProps {
  onBack: () => void;
  sessionId?: string;
  initialMessages?: StoredMessage[];
  onSessionCreated?: (sessionId: string) => void;
  onSessionFinished?: () => void;
  onOpenDashboard?: () => void;
}

type Phase = 'loading' | 'generating' | 'ready' | 'evaluating' | 'finished';

const MIN_WORDS = 35;

function countWords(text: string): number {
  return text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
}

function tryRestore(messages: StoredMessage[]) {
  return restorePictureStory(messages);
}

function SceneStrip({ scenes, loadingNumbers }: { scenes: StorySceneWithImage[]; loadingNumbers?: Set<number> }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {scenes.map((scene) => (
        <div key={scene.number} className="rounded-xl overflow-hidden border border-gray-100 bg-gray-50">
          <div className="relative aspect-square w-full bg-gray-100">
            {scene.image_url ? (
              <Image
                src={scene.image_url}
                alt={scene.description}
                fill
                sizes="33vw"
                className="object-cover"
                unoptimized={scene.image_url.startsWith('data:')}
              />
            ) : loadingNumbers?.has(scene.number) ? (
              <div className="w-full h-full flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 animate-spin" style={{ color: 'var(--color-bob-brand)' }}>
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
                  <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-300"><ImageIcon className="w-6 h-6" /></div>
            )}
            <span
              className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center text-white"
              style={{ background: 'var(--color-bob-brand)' }}
            >
              {scene.number}
            </span>
          </div>
          <p className="px-2 py-1.5 text-[10px] text-gray-500 leading-snug">{scene.description}</p>
        </div>
      ))}
    </div>
  );
}

function FeedbackPanel({
  feedback,
  userText,
  onOpenDashboard,
  animate,
}: {
  feedback: PictureStoryFeedback;
  userText: string;
  onOpenDashboard?: () => void;
  animate: boolean;
}) {
  const [modelOpen, setModelOpen] = useState(false);

  return (
    <motion.div
      initial={animate ? { opacity: 0, y: 12 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-3"
    >
      {userText && (
        <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Your story</p>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{userText}</p>
          <p className="text-[10px] text-gray-400 mt-1.5">{countWords(userText)} words</p>
        </div>
      )}

      {feedback.highlights.length > 0 && (
        <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 space-y-1.5">
          <p className="text-xs font-bold text-green-800 inline-flex items-center gap-1">What you did well <Check className="w-3.5 h-3.5" /></p>
          {feedback.highlights.map((h, i) => (
            <p key={i} className="text-sm text-green-700 leading-snug">• {h}</p>
          ))}
        </div>
      )}

      {feedback.suggestions.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-1.5">
          <p className="text-xs font-bold text-amber-800">To improve</p>
          {feedback.suggestions.map((s, i) => (
            <p key={i} className="text-sm text-amber-700 leading-snug">• {s}</p>
          ))}
        </div>
      )}

      {feedback.model_answer && (
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setModelOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <span>Model story</span>
            {modelOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <AnimatePresence>
            {modelOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 pt-1 border-t border-gray-100">
                  <p className="text-sm text-gray-700 leading-relaxed">{feedback.model_answer}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <div className="flex justify-center pt-2">
        <CelebrationCard
          score={toScore10(feedback) ?? 0}
          scoreMax={10}
          showPoints={false}
          onAction={onOpenDashboard}
          actionLabel="See my progress"
          animate={animate}
        />
      </div>
    </motion.div>
  );
}

/** KET Writing Part 7, Picture Story practice component. */
export function KETStoryWritingPractice({
  onBack,
  sessionId: initialSessionId,
  initialMessages,
  onSessionCreated,
  onSessionFinished,
  onOpenDashboard,
}: KETStoryWritingPracticeProps) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [story_premise, setStoryPremise] = useState('');
  const [scenes, setScenes] = useState<StorySceneWithImage[]>([]);
  const [framingText, setFramingText] = useState('');
  const [text, setText] = useState('');
  const [feedback, setFeedback] = useState<PictureStoryFeedback | null>(null);
  const [bankGroupId, setBankGroupId] = useState<string | undefined>(undefined);
  const [loadErrorCode, setLoadErrorCode] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isNewSession, setIsNewSession] = useState(false);
  const initRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    async function init() {
      const boot = resolveActivityBoot({ initialMessages, sessionId: initialSessionId, tryRestore });
      if (boot.kind === 'restore') {
        const r = boot.data;
        setStoryPremise(r.story_premise);
        setScenes(r.scenes);
        setFramingText(r.framingText);
        setText(r.userText);
        if (r.feedback) { setFeedback(r.feedback); setPhase('finished'); }
        else setPhase('ready');
        return;
      }
      if (boot.kind === 'restore-failed') { setErrorMsg('Could not restore session. Please start a new one.'); return; }
      setIsNewSession(true); setPhase('generating');
      const plan = await generateKETPictureStoryPlanAction();
      if (!plan.ok) { setLoadErrorCode(plan.code); return; }
      setStoryPremise(plan.data.story_premise);
      setScenes(plan.data.scenes);
      setFramingText(plan.data.framing_text);
      setBankGroupId(plan.data.bank_group_id);
      setPhase('ready');
    }
    void init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit() {
    setPhase('evaluating');
    setSubmitError(null);
    const result = await evaluateKETPictureStoryAction({
      sessionId, userText: text,
      story_premise,
      framing_text: framingText,
      scenes: scenes.map(({ image_url: _, ...s }) => s),
      image_urls: scenes.map((s) => s.image_url),
      bank_group_id: bankGroupId,
    });
    if ('error' in result) { setSubmitError('We could not check your story. Please try again.'); setPhase('ready'); return; }
    setFeedback(result.feedback); setPhase('finished');
    if (!sessionId) onSessionCreated?.(result.sessionId);
    setSessionId(result.sessionId);
    onSessionFinished?.();
  }

  const wordCount = countWords(text);
  const hasEnoughWords = wordCount >= MIN_WORDS;

  if (loadErrorCode || errorMsg) return <ActivityLoadError code={loadErrorCode} message={errorMsg} onBack={onBack} />;

  return (
    <div className="flex flex-col h-full relative">
      <ActivityHeader
        title="Picture Story"
        subtitle="Writing · Part 7"
        badge="Part 7"
        icon={<KETWritingIcon size={18} className="text-bob-brand" />}
        iconStyle={{ background: 'color-mix(in oklab, var(--color-bob-brand) 12%, white)' }}
        onBack={onBack}
      />

      {(phase === 'loading' || phase === 'generating') && (
        <div className="flex-1 flex flex-col min-h-0">
          <BobMascotLoader message={phase === 'generating' ? 'Creating your story pictures…' : 'Preparing exercise…'} />
        </div>
      )}

      {phase === 'evaluating' && (
        <div className="flex-1 flex flex-col min-h-0">
          <BobMascotLoader message="Reading your story…" />
        </div>
      )}

      {phase === 'ready' && scenes.length > 0 && (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            <div className="flex items-start gap-2">
              <BobAvatar />
              <div className="bg-gray-50 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-700 leading-relaxed max-w-sm">{framingText}</div>
            </div>

            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              <SceneStrip scenes={scenes} loadingNumbers={NO_LOADING} />
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Write your story here…"
                rows={6}
                className="w-full px-4 py-3 text-sm text-gray-800 placeholder-gray-300 resize-none focus:outline-none leading-relaxed"
              />
              <div className="flex items-center justify-between px-4 py-2 border-t border-gray-50">
                <span className={`text-xs font-semibold ${wordCount >= MIN_WORDS ? 'text-green-600' : 'text-gray-400'}`}>
                  {wordCount} / {MIN_WORDS}+ words
                </span>
                {wordCount < MIN_WORDS && (
                  <span className="text-[10px] text-gray-300">{MIN_WORDS - wordCount} more to go</span>
                )}
              </div>
            </motion.div>

            <div className="h-20" />
          </div>

          <div className="shrink-0 border-t border-gray-100 bg-white px-4 py-3 flex items-center gap-3">
            <p className={`text-xs flex-1 ${submitError ? 'text-red-500' : 'text-gray-400'}`}>{submitError ?? `Write at least ${MIN_WORDS} words`}</p>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!hasEnoughWords || !text.trim()}
              className="px-5 py-2.5 rounded-xl text-white text-sm font-bold shadow-sm disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              style={{ background: 'var(--color-bob-brand)' }}
            >
              Get feedback
            </button>
          </div>
        </>
      )}

      {phase === 'finished' && feedback && (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {scenes.length > 0 && <SceneStrip scenes={scenes} />}
          <FeedbackPanel
            feedback={feedback}
            userText={text}
            onOpenDashboard={onOpenDashboard}
            animate={isNewSession}
          />
        </div>
      )}
    </div>
  );
}
