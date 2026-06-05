'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { KETWritingIcon } from '@/components/icons/KETIcons';
import { CelebrationCard } from '@/components/practice/yl/CelebrationCard';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import { BobAvatar } from '@/components/practice/yl/_shared';
import {
  generateKETPictureStoryPlanAction,
  generateKETSceneImageAction,
  evaluateKETPictureStoryAction,
  type StorySceneWithImage,
  type StoryScene,
  type PictureStoryFeedback,
} from '@/actions/modes/ket-writing-part7';
import type { StoredMessage } from '@/actions/messages';

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

interface RestoredState {
  story_premise: string;
  scenes: StorySceneWithImage[];
  framingText: string;
  userText: string;
  feedback: PictureStoryFeedback | null;
}

function tryRestore(messages: StoredMessage[]): RestoredState | null {
  let story_premise = '';
  let scenes: StorySceneWithImage[] | null = null;
  let framingText = '';
  let userText = '';
  let feedback: PictureStoryFeedback | null = null;

  for (const msg of messages) {
    const cj = msg.content_json as Record<string, unknown> | null;
    if (!cj) continue;

    if (msg.role === 'bob' && cj.kind === 'picture_story_prompt') {
      story_premise = String(cj.story_premise ?? '');
      framingText = String(cj.framing_text ?? '');
      const rawScenes = cj.scenes as StoryScene[];
      const imageUrls = cj.image_urls as string[];
      scenes = rawScenes.map((s, i) => ({ ...s, image_url: imageUrls?.[i] ?? '' }));
    }
    if (msg.role === 'user' && msg.content_text) {
      userText = msg.content_text;
    }
    if (msg.role === 'bob' && msg.msg_type === 'evaluation' && cj.is_final === true) {
      feedback = {
        understood: Boolean(cj.understood),
        highlights: (cj.highlights as string[]) ?? [],
        suggestions: (cj.suggestions as string[]) ?? [],
        model_answer: (cj.model_answer as string) ?? null,
      };
    }
  }

  if (scenes) return { story_premise, scenes, framingText, userText, feedback };
  return null;
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
              <div className="w-full h-full flex items-center justify-center text-gray-300 text-2xl">📷</div>
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
          <p className="text-xs font-bold text-green-800">What you did well ✓</p>
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
          score={feedback.understood ? 1 : 0}
          scoreMax={1}
          feedback="Keep practising your writing!"
          onAction={onOpenDashboard}
          actionLabel="See my progress"
          animate={animate}
        />
      </div>
    </motion.div>
  );
}

/** KET Writing Part 7 — Picture Story practice component. */
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
  const [userId, setUserId] = useState<string | undefined>();
  const [story_premise, setStoryPremise] = useState('');
  const [scenes, setScenes] = useState<StorySceneWithImage[]>([]);
  const [framingText, setFramingText] = useState('');
  const [text, setText] = useState('');
  const [feedback, setFeedback] = useState<PictureStoryFeedback | null>(null);
  const [imageLoading, setImageLoading] = useState<Set<number>>(new Set());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isNewSession, setIsNewSession] = useState(false);
  const initRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /**
   * Phase 2 of two-phase loading: fetches each scene image in parallel and
   * patches it in as it resolves, so the strip fills progressively instead of
   * blocking the screen on a ~9s "Creating your story pictures…".
   */
  async function loadSceneImagesInBackground(sid: string, planScenes: StoryScene[]) {
    setImageLoading(new Set(planScenes.map((s) => s.number)));
    await Promise.all(
      planScenes.map(async (scene) => {
        const { image_url } = await generateKETSceneImageAction({ imagePrompt: scene.image_prompt, sessionId: sid }).catch(
          () => ({ image_url: '' })
        );
        setScenes((prev) =>
          prev.map((s) => (s.number === scene.number ? { ...s, image_url } : s))
        );
        setImageLoading((prev) => {
          const next = new Set(prev);
          next.delete(scene.number);
          return next;
        });
      })
    );
  }

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    async function init() {
      if (initialMessages?.length) {
        const r = tryRestore(initialMessages);
        if (r) {
          setStoryPremise(r.story_premise);
          setScenes(r.scenes);
          setFramingText(r.framingText);
          setText(r.userText);
          if (r.feedback) { setFeedback(r.feedback); setPhase('finished'); }
          else {
            const { createSupabaseBrowser } = await import('@/lib/supabase/browser-client');
            const { data: { user } } = await createSupabaseBrowser().auth.getUser();
            if (user) setUserId(user.id);
            setPhase('ready');
            const missing = r.scenes.filter((s) => !s.image_url);
            if (missing.length > 0 && initialSessionId) {
              void loadSceneImagesInBackground(initialSessionId, missing.map(({ image_url: _i, ...s }) => s));
            }
          }
          return;
        }
      }
      if (initialSessionId) return;
      setIsNewSession(true); setPhase('generating');
      const plan = await generateKETPictureStoryPlanAction({ sessionId: initialSessionId });
      if ('error' in plan) { setErrorMsg(plan.error); return; }
      onSessionCreated?.(plan.sessionId);
      setSessionId(plan.sessionId); setUserId(plan.userId);
      setStoryPremise(plan.story_premise);
      setScenes(plan.scenes.map((s) => ({ ...s, image_url: '' })));
      setFramingText(plan.framing_text);
      setPhase('ready');
      void loadSceneImagesInBackground(plan.sessionId, plan.scenes);
    }
    void init();
  }, []);

  async function handleSubmit() {
    if (!sessionId || !userId) return;
    setPhase('evaluating');
    const result = await evaluateKETPictureStoryAction({
      sessionId, userId, userText: text,
      story_premise,
      scenes: scenes.map(({ image_url: _, ...s }) => s),
    });
    if ('error' in result) { setErrorMsg(result.error); setPhase('ready'); return; }
    setFeedback(result); setPhase('finished'); onSessionFinished?.();
  }

  const wordCount = countWords(text);
  const hasEnoughWords = wordCount >= MIN_WORDS;

  if (errorMsg) return (
    <div className="flex flex-col items-center justify-center gap-4 p-8 text-center min-h-[40vh]">
      <p className="text-red-500 font-semibold">{errorMsg}</p>
      <button type="button" onClick={onBack} className="px-5 py-2 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 text-sm">Back</button>
    </div>
  );

  return (
    <div className="flex flex-col h-full relative">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white shrink-0">
        <button type="button" onClick={onBack} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600">←</button>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'color-mix(in oklab, var(--color-bob-brand) 12%, white)' }}>
          <KETWritingIcon size={18} className="text-bob-brand" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800 truncate">Picture Story</p>
          <p className="text-xs text-gray-400">KET Writing · Part 7</p>
        </div>
        <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest" style={{ background: 'color-mix(in oklab, var(--color-bob-brand) 12%, white)', color: 'var(--color-bob-brand)' }}>A2</span>
      </div>

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
              <SceneStrip scenes={scenes} loadingNumbers={imageLoading} />
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
            <p className="text-xs text-gray-400 flex-1">Write at least {MIN_WORDS} words</p>
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
