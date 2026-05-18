'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { motion } from 'motion/react';
import { CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { FCESpeakingIcon } from '@/components/icons/FCEIcons';
import { CelebrationCard } from '@/components/practice/yl/CelebrationCard';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import { BobAvatar } from '@/components/practice/yl/_shared';
import { useCountdownTimer } from '@/hooks/useCountdownTimer';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { validateRecordedAudio } from '@/lib/audio-guard';
import {
  generateFCEPictureDescriptionAction,
  evaluateFCEPictureDescriptionAction,
  getFCEPictureDescriptionModelAnswerAction,
  type FCELongTurnResult,
  type FCELongTurnFeedback,
  type FCELongTurnReferenceVocabulary,
} from '@/actions/modes/fce-p2';
import type { StoredMessage } from '@/actions/messages';

export interface FCEPictureDescriptionPracticeProps {
  onBack: () => void;
  sessionId?: string;
  initialMessages?: StoredMessage[];
  onSessionCreated?: (sessionId: string) => void;
  onSessionFinished?: () => void;
  onOpenDashboard?: () => void;
}

type Phase = 'loading' | 'instructions' | 'ready' | 'recording' | 'processing' | 'finished';

const COVERAGE_DIMENSIONS = [
  'introduction',
  'comparison',
  'contrast',
  'speculation',
  'addressed_question',
  'conclusion',
] as const;

type CoverageDimension = (typeof COVERAGE_DIMENSIONS)[number];

interface RestoredState {
  plan: Pick<FCELongTurnResult, 'topic' | 'framingText' | 'comparisonQuestion' | 'scenePromptA' | 'scenePromptB' | 'referenceVocabulary' | 'languageBank' | 'imageUrlA' | 'imageUrlB'>;
  feedback: FCELongTurnFeedback | null;
  transcript: string | null;
}

function tryRestore(messages: StoredMessage[]): RestoredState | null {
  let plan: RestoredState['plan'] | null = null;
  let feedback: FCELongTurnFeedback | null = null;
  let transcript: string | null = null;

  for (const msg of messages) {
    const cj = msg.content_json as Record<string, unknown> | null;
    if (!cj) continue;

    if (msg.role === 'bob' && cj.kind === 'fce_long_turn_plan') {
      plan = {
        topic: String(cj.topic ?? ''),
        framingText: String(cj.framing_text ?? ''),
        comparisonQuestion: String(cj.comparison_question ?? ''),
        scenePromptA: String(cj.scene_prompt_a ?? ''),
        scenePromptB: String(cj.scene_prompt_b ?? ''),
        referenceVocabulary: (cj.reference_vocabulary ?? {}) as FCELongTurnReferenceVocabulary,
        languageBank: (cj.language_bank ?? {}) as FCELongTurnResult['languageBank'],
        imageUrlA: String(cj.image_url_a ?? ''),
        imageUrlB: String(cj.image_url_b ?? ''),
      };
    }
    if (msg.role === 'user' && cj.kind === 'fce_long_turn_submission') {
      transcript = String(cj.transcript ?? '');
    }
    if (msg.role === 'bob' && msg.msg_type === 'evaluation' && cj.is_final === true) {
      feedback = {
        understood: Boolean(cj.understood),
        highlights: (cj.highlights as string[]) ?? [],
        suggestions: (cj.suggestions as string[]) ?? [],
        coverage: (cj.coverage ?? {}) as FCELongTurnFeedback['coverage'],
        fluency_band: (cj.fluency_band as 'OK' | 'Good' | 'Excellent') ?? 'OK',
        language_band: (cj.language_band as 'OK' | 'Good' | 'Excellent') ?? 'OK',
        transcript_used: String(cj.transcript_used ?? ''),
        transcript: '',
      };
    }
  }

  if (!plan) return null;
  return { plan, feedback, transcript };
}

function InstructionsScreen({
  framingText,
  onStart,
  showCta = true,
}: {
  framingText: string;
  onStart: () => void;
  showCta?: boolean;
}) {
  const t = useTranslations('cambridge');
  const sections = framingText.split('\n\n').filter(Boolean);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
      <div className="space-y-3">
        {sections.map((section, i) => {
          const lines = section.split('\n');
          const heading = lines[0];
          const body = lines.slice(1).join('\n').trim();

          const isNumberedList = body.split('\n').some((l) => /^\d+\./.test(l.trim()));
          const isBulletList = body.split('\n').some((l) => /^[-•]/.test(l.trim()));

          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden"
            >
              {heading.startsWith('THE ') || heading.startsWith('LANGUAGE') || heading.startsWith('GOLDEN') || heading.startsWith('WHAT ') ? (
                <div className="px-4 pt-3 pb-1">
                  <p className="text-[11px] font-black uppercase tracking-widest text-emerald-600">{heading}</p>
                </div>
              ) : (
                <div className="px-4 pt-3 pb-1">
                  <p className="text-sm font-bold text-gray-800">{heading}</p>
                </div>
              )}
              {body && (
                <div className="px-4 pb-3 pt-1">
                  {isNumberedList ? (
                    <ul className="space-y-1">
                      {body.split('\n').map((line, j) => {
                        const match = line.trim().match(/^(\d+)\.\s*(.*)/);
                        if (!match) return null;
                        const [, num, text] = match;
                        return (
                          <li key={j} className="flex items-start gap-2 text-sm text-gray-700">
                            <span className="shrink-0 w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black flex items-center justify-center mt-0.5">
                              {num}
                            </span>
                            <span className="leading-snug">{text}</span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : isBulletList ? (
                    <ul className="space-y-1">
                      {body.split('\n').map((line, j) => {
                        const text = line.replace(/^[-•]\s*/, '').trim();
                        if (!text) return null;
                        return (
                          <li key={j} className="flex items-start gap-2 text-sm text-gray-700">
                            <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-400 mt-2" />
                            <span className="leading-snug">{text}</span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{body}</p>
                  )}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      <div className="h-24" />

      {showCta && (
        <div className="sticky bottom-0 left-0 right-0 -mx-4 px-4 py-3 bg-white/95 backdrop-blur border-t border-gray-100 mt-auto flex justify-end">
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            type="button"
            onClick={onStart}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-sm shadow-sm hover:bg-emerald-700 active:scale-98 transition-all cursor-pointer"
          >
            {t('fce.pictureDescription.startTimer')}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="13 6 19 12 13 18" />
            </svg>
          </motion.button>
        </div>
      )}
    </div>
  );
}

function TimerDisplay({ seconds, isWarning }: { seconds: number; isWarning: boolean }) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const label = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  return (
    <div
      className={[
        'text-4xl font-black tabular-nums transition-colors duration-300',
        seconds === 0 ? 'text-red-600' : isWarning ? 'text-amber-500' : 'text-gray-700',
      ].join(' ')}
    >
      {label}
    </div>
  );
}

function DualImageGrid({
  imageUrlA,
  imageUrlB,
  t,
}: {
  imageUrlA: string;
  imageUrlB: string;
  t: (key: string) => string;
}) {
  return (
    <div className="max-w-2xl mx-auto w-full">
      <div className="grid grid-cols-2 gap-3">
        {[
          { url: imageUrlA, label: t('fce.pictureDescription.picture1Label') },
          { url: imageUrlB, label: t('fce.pictureDescription.picture2Label') },
        ].map(({ url, label }) => (
          <div key={label} className="flex flex-col gap-1.5">
            <p className="text-[10px] font-black uppercase tracking-widest text-center text-emerald-700">{label}</p>
            {url ? (
              <div className="rounded-2xl overflow-hidden shadow-md aspect-[3/2]">
                <Image
                  src={url}
                  alt={label}
                  width={400}
                  height={267}
                  className="w-full h-full object-cover block"
                  unoptimized={url.startsWith('data:')}
                />
              </div>
            ) : (
              <div className="rounded-2xl bg-gray-100 aspect-[3/2] flex items-center justify-center">
                <span className="text-gray-400 text-xs">Loading…</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function CoverageChecklist({
  coverage,
  animate,
}: {
  coverage: FCELongTurnFeedback['coverage'];
  animate: boolean;
}) {
  const t = useTranslations('cambridge');
  const dims = COVERAGE_DIMENSIONS;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      <div className="px-4 pt-3 pb-1">
        <p className="text-xs font-black uppercase tracking-widest text-gray-500">
          {t('fce.pictureDescription.coverageTitle')}
        </p>
      </div>
      <div className="px-4 pb-3 grid grid-cols-2 gap-1.5">
        {dims.map((dim, i) => {
          const hit = coverage[dim as CoverageDimension] ?? false;
          return (
            <motion.div
              key={dim}
              initial={animate ? { opacity: 0, x: -6 } : false}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={[
                'flex items-center gap-2 rounded-xl px-3 py-2 text-sm',
                hit ? 'bg-green-50 text-green-800' : 'bg-gray-50 text-gray-400',
              ].join(' ')}
            >
              {hit ? (
                <CheckCircle size={14} className="text-green-500 shrink-0" />
              ) : (
                <XCircle size={14} className="text-gray-300 shrink-0" />
              )}
              <span className="font-semibold capitalize text-xs">
                {t(`fce.pictureDescription.dimensions.${dim}`)}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function BandPill({ band, label }: { band: 'OK' | 'Good' | 'Excellent'; label: string }) {
  const colors: Record<string, string> = {
    OK: 'bg-gray-100 text-gray-600',
    Good: 'bg-emerald-100 text-emerald-700',
    Excellent: 'bg-green-100 text-green-700',
  };
  return (
    <div className="flex items-center gap-2 px-1">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{label}</p>
      <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wide ${colors[band] ?? colors.OK}`}>
        {band}
      </span>
    </div>
  );
}

function ReferenceVocabularyCard({ vocab }: { vocab: FCELongTurnReferenceVocabulary }) {
  const t = useTranslations('cambridge');
  const entries = Object.entries(vocab) as [string, string[]][];

  return (
    <div className="rounded-2xl border border-amber-100 bg-amber-50 shadow-sm overflow-hidden">
      <div className="px-4 pt-3 pb-1">
        <p className="text-xs font-black uppercase tracking-widest text-amber-700">
          {t('fce.pictureDescription.referenceVocabularyTitle')}
        </p>
      </div>
      <div className="px-4 pb-3 space-y-2">
        {entries.map(([dim, words]) => (
          <div key={dim}>
            <p className="text-[10px] font-bold uppercase tracking-wide text-amber-600 mb-1">
              {t(`fce.pictureDescription.referenceDimensions.${dim}`)}
            </p>
            <div className="flex flex-wrap gap-1">
              {words.map((w) => (
                <span key={w} className="px-2 py-0.5 rounded-lg bg-white border border-amber-200 text-amber-800 text-xs font-semibold">
                  {w}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ModelAnswerSection({
  topic,
  scenePromptA,
  scenePromptB,
  comparisonQuestion,
}: {
  topic: string;
  scenePromptA: string;
  scenePromptB: string;
  comparisonQuestion: string;
}) {
  const t = useTranslations('cambridge');
  const [open, setOpen] = useState(false);
  const [modelAnswer, setModelAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef(false);

  async function handleOpen() {
    setOpen((prev) => !prev);
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      setLoading(true);
      const result = await getFCEPictureDescriptionModelAnswerAction({
        topic,
        scenePromptA,
        scenePromptB,
        comparisonQuestion,
      });
      setLoading(false);
      if (!('error' in result)) {
        setModelAnswer(result.modelAnswer);
      }
    }
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={handleOpen}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <p className="text-sm font-bold text-gray-700">
          {open ? t('fce.pictureDescription.hideModelAnswer') : t('fce.pictureDescription.showModelAnswer')}
        </p>
        {open ? (
          <ChevronUp size={16} className="text-gray-400 shrink-0" />
        ) : (
          <ChevronDown size={16} className="text-gray-400 shrink-0" />
        )}
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-gray-100">
          {loading ? (
            <p className="text-sm text-gray-400 italic pt-3">Loading…</p>
          ) : modelAnswer ? (
            <div className="mt-3 bg-amber-50 rounded-xl p-3">
              <p className="text-xs font-bold text-amber-700 mb-2 uppercase tracking-wide">
                {t('fce.pictureDescription.modelAnswerTitle')}
              </p>
              <p className="text-sm text-amber-900 leading-relaxed italic">{modelAnswer}</p>
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic pt-3">Could not load model answer.</p>
          )}
        </div>
      )}
    </div>
  );
}

/** Cambridge B2 FCE Speaking Part 2 — Long Turn (Picture Description) practice component. */
export function FCEPictureDescriptionPractice({
  onBack,
  sessionId: initialSessionId,
  initialMessages,
  onSessionCreated,
  onSessionFinished,
  onOpenDashboard,
}: FCEPictureDescriptionPracticeProps) {
  const t = useTranslations('cambridge');

  const [phase, setPhase] = useState<Phase>('loading');
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId);
  const [userId, setUserId] = useState<string | undefined>();
  const [topic, setTopic] = useState('');
  const [framingText, setFramingText] = useState('');
  const [comparisonQuestion, setComparisonQuestion] = useState('');
  const [scenePromptA, setScenePromptA] = useState('');
  const [scenePromptB, setScenePromptB] = useState('');
  const [referenceVocabulary, setReferenceVocabulary] = useState<FCELongTurnReferenceVocabulary>({
    comparison: [],
    speculation: [],
    activity_verbs: [],
    emotions: [],
    settings: [],
  });
  const [languageBank, setLanguageBank] = useState<FCELongTurnResult['languageBank']>({
    openers: [],
    contrast: [],
    speculation: [],
    conclusion: [],
  });
  const [imageUrlA, setImageUrlA] = useState('');
  const [imageUrlB, setImageUrlB] = useState('');
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [mimeType, setMimeType] = useState('audio/webm');
  const [feedback, setFeedback] = useState<FCELongTurnFeedback | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [audioError, setAudioError] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isNewSession, setIsNewSession] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  const initStartedRef = useRef(false);
  const recordingStartRef = useRef<number | null>(null);

  void audioBlob;
  void mimeType;

  const timer = useCountdownTimer({
    totalSeconds: 60,
    warnAt: 10,
    onFinished: () => {
      if (phase === 'recording') {
        stopRecording();
      }
    },
  });

  const { isRecording, startRecording, stopRecording } = useAudioRecorder({
    onRecorded: (blob) => {
      const duration = recordingStartRef.current
        ? (Date.now() - recordingStartRef.current) / 1000
        : 60 - timer.seconds;
      setAudioBlob(blob);
      setAudioDuration(duration);
      setMimeType('audio/webm');
      setPhase('processing');
      void handleEvaluate(blob, 'audio/webm', duration);
    },
    onError: () => {
      setAudioError(true);
      setPhase('ready');
    },
  });

  void isRecording;
  void audioDuration;

  useEffect(() => {
    if (initStartedRef.current) return;
    initStartedRef.current = true;

    async function init() {
      if (initialMessages && initialMessages.length > 0) {
        const restored = tryRestore(initialMessages);
        if (restored) {
          setTopic(restored.plan.topic);
          setFramingText(restored.plan.framingText);
          setComparisonQuestion(restored.plan.comparisonQuestion);
          setScenePromptA(restored.plan.scenePromptA);
          setScenePromptB(restored.plan.scenePromptB);
          setReferenceVocabulary(restored.plan.referenceVocabulary);
          setLanguageBank(restored.plan.languageBank);
          setImageUrlA(restored.plan.imageUrlA);
          setImageUrlB(restored.plan.imageUrlB);

          if (restored.feedback) {
            setFeedback(restored.feedback);
            setTranscript(restored.transcript);
            setPhase('finished');
          } else {
            setPhase('ready');
          }
          return;
        }
      }

      if (initialSessionId) {
        return;
      }

      setIsNewSession(true);
      const result = await generateFCEPictureDescriptionAction({ sessionId: initialSessionId });

      if ('error' in result) {
        setErrorMsg(result.error);
        return;
      }

      if (!initialSessionId) {
        onSessionCreated?.(result.sessionId);
      }

      setSessionId(result.sessionId);
      setUserId(result.userId);
      setTopic(result.topic);
      setFramingText(result.framingText);
      setComparisonQuestion(result.comparisonQuestion);
      setScenePromptA(result.scenePromptA);
      setScenePromptB(result.scenePromptB);
      setReferenceVocabulary(result.referenceVocabulary);
      setLanguageBank(result.languageBank);
      setImageUrlA(result.imageUrlA);
      setImageUrlB(result.imageUrlB);
      setPhase('instructions');
    }

    void init();
  }, []);

  async function handleStartRecording() {
    setAudioError(false);
    recordingStartRef.current = Date.now();
    timer.start();
    setPhase('recording');
    await startRecording();
  }

  function handleStopRecording() {
    timer.pause();
    stopRecording();
  }

  async function handleEvaluate(blob: Blob, mime: string, duration: number) {
    if (!sessionId || !userId) return;

    const result = await evaluateFCEPictureDescriptionAction({
      sessionId,
      userId,
      topic,
      comparisonQuestion,
      scenePromptA,
      scenePromptB,
      referenceVocabulary,
      audioBlob: blob,
      mimeType: mime,
      audioDuration: duration,
    });

    if ('error' in result) {
      if (result.error === 'audio_required') {
        setAudioError(true);
        setPhase('ready');
        return;
      }
      setErrorMsg(result.error);
      return;
    }

    setFeedback(result);
    setTranscript(result.transcript || result.transcript_used);
    setPhase('finished');
    onSessionFinished?.();
  }

  const coverageHits = feedback
    ? Object.values(feedback.coverage).filter(Boolean).length
    : 0;

  if (errorMsg) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 text-center min-h-[40vh]">
        <p className="text-red-500 font-semibold">{errorMsg}</p>
        <button
          type="button"
          onClick={onBack}
          className="px-5 py-2 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors text-sm"
        >
          {t('fce.pictureDescription.back')}
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
          aria-label={t('fce.pictureDescription.back')}
        >
          ←
        </button>
        <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
          <FCESpeakingIcon size={18} className="text-emerald-700" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800 truncate">
            {t('fce.pictureDescription.headerTitle')}
          </p>
          <p className="text-xs text-gray-400">
            {t('fce.pictureDescription.headerSubtitle')}
            {topic ? ` · ${topic}` : ''}
          </p>
        </div>
        {framingText && phase !== 'instructions' && phase !== 'loading' && (
          <button
            type="button"
            onClick={() => setShowInstructions(true)}
            className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold hover:bg-emerald-100 transition-colors cursor-pointer"
            aria-label={t('fce.pictureDescription.showInstructionsButton')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            {t('fce.pictureDescription.showInstructionsButton')}
          </button>
        )}
        <span className="shrink-0 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-widest">
          {t('fce.pictureDescription.partBadge')}
        </span>
      </div>

      {showInstructions && framingText && (
        <div className="absolute inset-0 z-30 bg-white flex flex-col">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white shrink-0">
            <button
              type="button"
              onClick={() => setShowInstructions(false)}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
              aria-label={t('fce.pictureDescription.closeInstructions')}
            >
              ✕
            </button>
            <p className="text-sm font-bold text-gray-800">{t('fce.pictureDescription.instructionsTitle')}</p>
          </div>
          <InstructionsScreen
            framingText={framingText}
            onStart={() => setShowInstructions(false)}
            showCta={false}
          />
        </div>
      )}

      {phase === 'loading' && (
        <div className="flex-1 flex flex-col min-h-0">
          <BobMascotLoader message={t('fce.pictureDescription.preparingExercise')} />
        </div>
      )}

      {phase === 'instructions' && (
        <InstructionsScreen framingText={framingText} onStart={() => setPhase('ready')} />
      )}

      {phase === 'ready' && (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            <DualImageGrid imageUrlA={imageUrlA} imageUrlB={imageUrlB} t={t} />

            <div className="flex items-start gap-2">
              <BobAvatar />
              <div className="bg-gray-50 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-700 leading-relaxed max-w-sm">
                <p className="font-semibold text-gray-800 mb-1">{comparisonQuestion}</p>
                <p className="text-xs text-gray-500">{t('fce.pictureDescription.readyReminder')}</p>
              </div>
            </div>

            {audioError && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-2"
              >
                <BobAvatar />
                <div className="bg-red-50 border border-red-200 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-red-700 leading-relaxed max-w-sm">
                  {t('fce.pictureDescription.audioRequired')}
                </div>
              </motion.div>
            )}

            <div className="h-24" />
          </div>

          <div className="shrink-0 border-t border-gray-100 bg-white/90 backdrop-blur px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500 font-medium pl-2">
              {t('fce.pictureDescription.mic.tap')}
            </p>
            <button
              type="button"
              onClick={handleStartRecording}
              className="w-14 h-14 rounded-full bg-emerald-600 text-white shadow-lg hover:scale-105 active:scale-95 transition-transform flex items-center justify-center"
              aria-label={t('fce.pictureDescription.mic.tap')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                <rect x="9" y="3" width="6" height="12" rx="3" />
                <path d="M5 11a7 7 0 0 0 14 0" />
                <line x1="12" y1="18" x2="12" y2="22" />
              </svg>
            </button>
          </div>
        </>
      )}

      {phase === 'recording' && (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            <DualImageGrid imageUrlA={imageUrlA} imageUrlB={imageUrlB} t={t} />

            <div className="flex flex-col items-center gap-4 py-4">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
                {t('fce.pictureDescription.recordingTimer')}
              </p>
              <TimerDisplay seconds={timer.seconds} isWarning={timer.isWarning} />

              <motion.div
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ repeat: Infinity, duration: 1.2 }}
                className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center shadow-lg"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
                  <rect x="9" y="3" width="6" height="12" rx="3" />
                  <path d="M5 11a7 7 0 0 0 14 0" />
                  <line x1="12" y1="18" x2="12" y2="22" />
                </svg>
              </motion.div>

              <p className="text-xs font-bold text-red-500">{t('fce.pictureDescription.mic.recording')}</p>
            </div>
          </div>

          <div className="shrink-0 border-t border-gray-100 bg-white/90 backdrop-blur px-4 py-3 flex items-center justify-center">
            <button
              type="button"
              onClick={handleStopRecording}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-bold hover:bg-gray-200 transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
              {t('fce.pictureDescription.mic.stop')}
            </button>
          </div>
        </>
      )}

      {phase === 'processing' && (
        <div className="flex-1 flex flex-col min-h-0">
          <BobMascotLoader message={t('fce.pictureDescription.processingDescription')} />
        </div>
      )}

      {phase === 'finished' && feedback && (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <DualImageGrid imageUrlA={imageUrlA} imageUrlB={imageUrlB} t={t} />

          {transcript && (
            <div className="flex justify-end gap-2">
              <div className="rounded-2xl rounded-tr-sm px-4 py-2.5 bg-gradient-to-br from-emerald-600 to-emerald-700 text-white text-sm max-w-xs shadow-sm">
                <p className="leading-relaxed">{transcript}</p>
              </div>
            </div>
          )}

          <CoverageChecklist coverage={feedback.coverage} animate={isNewSession} />

          <div className="rounded-2xl border border-green-100 bg-green-50 shadow-sm overflow-hidden">
            <div className="px-4 pt-3 pb-1">
              <p className="text-xs font-black uppercase tracking-widest text-green-700">
                {t('fce.pictureDescription.highlightsTitle')}
              </p>
            </div>
            <ul className="px-4 pb-3 space-y-1.5">
              {feedback.highlights.map((h, i) => (
                <motion.li
                  key={i}
                  initial={isNewSession ? { opacity: 0, x: -6 } : false}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="flex items-start gap-2 text-sm text-green-800"
                >
                  <CheckCircle size={14} className="text-green-500 shrink-0 mt-0.5" />
                  <span className="leading-snug">{h}</span>
                </motion.li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-amber-100 bg-amber-50 shadow-sm overflow-hidden">
            <div className="px-4 pt-3 pb-1">
              <p className="text-xs font-black uppercase tracking-widest text-amber-700">
                {t('fce.pictureDescription.suggestionsTitle')}
              </p>
            </div>
            <ul className="px-4 pb-3 space-y-1.5">
              {feedback.suggestions.map((s, i) => (
                <motion.li
                  key={i}
                  initial={isNewSession ? { opacity: 0, x: -6 } : false}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 + 0.15 }}
                  className="flex items-start gap-2 text-sm text-amber-800"
                >
                  <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-amber-400 mt-2" />
                  <span className="leading-snug">{s}</span>
                </motion.li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-2">
            <BandPill band={feedback.fluency_band} label={t('fce.pictureDescription.fluencyTitle')} />
            <BandPill band={feedback.language_band} label={t('fce.pictureDescription.languageTitle')} />
          </div>

          <ReferenceVocabularyCard vocab={referenceVocabulary} />

          <ModelAnswerSection
            topic={topic}
            scenePromptA={scenePromptA}
            scenePromptB={scenePromptB}
            comparisonQuestion={comparisonQuestion}
          />

          <div className="flex justify-center pt-2">
            <CelebrationCard
              score={coverageHits}
              scoreMax={6}
              feedback={t('fce.pictureDescription.celebrationFeedback')}
              onAction={onOpenDashboard}
              actionLabel={t('fce.pictureDescription.celebrationAction')}
              animate={isNewSession}
            />
          </div>

          <div className="h-8" />
        </div>
      )}
    </div>
  );
}
