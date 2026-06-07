'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { CheckCircle, XCircle } from 'lucide-react';
import { KETListeningIcon } from '@/components/icons/KETIcons';
import { CelebrationCard } from '@/components/practice/yl/CelebrationCard';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import { pcmToWavBase64 } from '@/lib/audio';
import {
  generateKETShortTalksPlanAction,
  generateKETPersonAudioAction,
  submitKETShortTalksAction,
  type CharKey,
  type Person,
  type PersonWithAudio,
  type Characteristic,
  type PersonResult,
  type ShortTalksExercise,
} from '@/actions/modes/ket-listening-part4';
import type { StoredMessage } from '@/actions/messages';

const ACCENT = '#F8AC37';
const ACCENT_DARK = '#D8881C';
const ACCENT_TEXT = '#B5710F';
const ACCENT_TINT = 'color-mix(in oklab, #F8AC37 14%, white)';
const CARD_SURFACE = '#FAFAF8';

export interface KETShortTalksPracticeProps {
  onBack: () => void;
  sessionId?: string;
  initialMessages?: StoredMessage[];
  onSessionCreated?: (sessionId: string) => void;
  onSessionFinished?: () => void;
  onOpenDashboard?: () => void;
}

type Phase = 'loading' | 'generating' | 'ready' | 'submitting' | 'finished';

interface RestoredState {
  exercise: ShortTalksExercise;
  framingText: string;
  personResults: PersonResult[] | null;
  correctCount: number;
  characteristics: Characteristic[];
}

function tryRestore(messages: StoredMessage[]): RestoredState | null {
  let exercise: ShortTalksExercise | null = null;
  let framingText = '';
  let personResults: PersonResult[] | null = null;
  let correctCount = 0;
  let characteristics: Characteristic[] = [];

  for (const msg of messages) {
    const cj = msg.content_json as Record<string, unknown> | null;
    if (!cj) continue;

    if (msg.role === 'bob' && cj.kind === 'short_talks_plan') {
      const raw = cj.exercise as { people: Person[]; characteristics: Characteristic[] };
      exercise = {
        people: raw.people.map((p) => ({ ...p, audio_b64: '', audio_mime: 'audio/L16;codec=pcm;rate=24000' })),
        characteristics: raw.characteristics,
      };
      characteristics = raw.characteristics;
      framingText = String(cj.framing_text ?? '');
    }
    if (msg.role === 'bob' && msg.msg_type === 'evaluation' && cj.is_final === true) {
      personResults = cj.person_results as PersonResult[];
      correctCount = Number(cj.score ?? 0);
      characteristics = (cj.characteristics as Characteristic[]) ?? characteristics;
    }
  }

  if (exercise) return { exercise, framingText, personResults, correctCount, characteristics };
  return null;
}

let _activeAudio: HTMLAudioElement | null = null;

function stopActiveAudio() {
  if (_activeAudio) {
    _activeAudio.pause();
    _activeAudio.src = '';
    _activeAudio = null;
  }
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 animate-spin" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function PersonAudioButton({
  audiob64,
  audiomime,
  name,
  loading,
}: {
  audiob64: string;
  audiomime: string;
  name: string;
  loading: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const [playing, setPlaying] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stopLocal = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlaying(false);
    if (_activeAudio === audioRef.current) _activeAudio = null;
  };

  useEffect(() => () => stopLocal(), []);

  const handlePlay = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (playing) {
      stopLocal();
      return;
    }
    stopActiveAudio();
    if (!audiob64) return;

    const url = pcmToWavBase64(audiob64, audiomime);
    const audio = new Audio(url);
    audioRef.current = audio;
    _activeAudio = audio;
    audio.onended = () => {
      stopLocal();
      setHasPlayed(true);
    };
    audio.onerror = () => stopLocal();
    setPlaying(true);
    try {
      await audio.play();
    } catch {
      stopLocal();
    }
  };

  if (loading) {
    return (
      <span
        className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-white opacity-60"
        style={{ background: ACCENT }}
        aria-label={`Loading audio for ${name}`}
      >
        <Spinner />
      </span>
    );
  }

  if (!audiob64) {
    return (
      <span className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-gray-100 text-gray-300">
        <PlayIcon />
      </span>
    );
  }

  return (
    <span className="relative shrink-0 w-10 h-10">
      {playing && (
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-full"
          style={{ background: ACCENT }}
          initial={{ scale: 1, opacity: 0.4 }}
          animate={reduceMotion ? { scale: 1, opacity: 0.25 } : { scale: [1, 1.6], opacity: [0.4, 0] }}
          transition={reduceMotion ? { duration: 0 } : { duration: 1.2, ease: 'easeOut', repeat: Infinity }}
        />
      )}
      <button
        type="button"
        onClick={handlePlay}
        aria-label={`Listen to ${name}`}
        className={[
          'relative w-10 h-10 rounded-full flex items-center justify-center text-white transition-transform active:scale-95',
          hasPlayed && !playing ? 'opacity-80' : '',
        ].join(' ')}
        style={{ background: ACCENT }}
      >
        {playing ? <PauseIcon /> : <PlayIcon />}
      </button>
    </span>
  );
}

function LetterChip({ letter, className }: { letter: string; className?: string }) {
  return (
    <span
      className={[
        'w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center shrink-0',
        className ?? 'bg-amber-200 text-amber-800',
      ].join(' ')}
    >
      {letter}
    </span>
  );
}

function PersonCard({
  person,
  matchedKey,
  matchedText,
  active,
  audioLoading,
  reduceMotion,
  onActivate,
}: {
  person: PersonWithAudio;
  matchedKey: CharKey | null;
  matchedText: string | null;
  active: boolean;
  audioLoading: boolean;
  reduceMotion: boolean;
  onActivate: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: person.number * 0.06 }}
      className="rounded-3xl border border-gray-100 shadow-sm overflow-hidden"
      style={{ background: CARD_SURFACE }}
    >
      <div className="flex items-center gap-3 px-4 pt-3.5 pb-3">
        <span
          className="w-7 h-7 rounded-full text-xs font-black flex items-center justify-center shrink-0"
          style={{ background: ACCENT_TINT, color: ACCENT_TEXT }}
        >
          {person.number}
        </span>
        <span className="text-sm font-bold text-gray-800 flex-1 min-w-0 truncate">{person.name}</span>
        <PersonAudioButton
          audiob64={person.audio_b64}
          audiomime={person.audio_mime}
          name={person.name}
          loading={audioLoading}
        />
      </div>

      <div className="px-4 pb-4">
        <motion.button
          type="button"
          onClick={onActivate}
          animate={
            active && !reduceMotion
              ? { boxShadow: ['0 0 0 3px #F8AC37, 0 0 0 6px rgba(248,172,55,0.25)', '0 0 0 3px #F8AC37, 0 0 0 9px rgba(248,172,55,0)'] }
              : active
              ? { boxShadow: '0 0 0 3px #F8AC37, 0 0 0 6px rgba(248,172,55,0.25)' }
              : { boxShadow: '0 0 0 0px rgba(248,172,55,0)' }
          }
          transition={active && !reduceMotion ? { duration: 1.1, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
          className={[
            'w-full min-h-[56px] rounded-2xl px-3 py-2.5 flex items-center gap-2.5 text-left transition-colors cursor-pointer',
            matchedKey
              ? 'bg-amber-50 border-2 border-[#F8AC37]'
              : 'border-2 border-dashed border-amber-300 bg-white',
          ].join(' ')}
        >
          {matchedKey ? (
            <>
              <LetterChip letter={matchedKey} />
              <span className="text-xs font-semibold text-gray-700 leading-snug flex-1">{matchedText}</span>
            </>
          ) : (
            <span className="text-xs font-semibold text-amber-500 flex-1">
              {active ? 'Now tap a description below' : 'Tap to match a description'}
            </span>
          )}
        </motion.button>
      </div>
    </motion.div>
  );
}

function StatementChip({
  char,
  taken,
  candidate,
  disabled,
  onTap,
}: {
  char: Characteristic;
  taken: boolean;
  candidate: boolean;
  disabled: boolean;
  onTap: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onTap}
      disabled={disabled || taken}
      className={[
        'w-full min-h-[48px] rounded-2xl px-3 py-2 flex items-start gap-2 text-left border-2 transition-all',
        taken
          ? 'opacity-40 border-gray-200 bg-gray-50 cursor-not-allowed'
          : candidate
          ? 'border-[#F8AC37] bg-amber-50 cursor-pointer'
          : 'border-gray-200 bg-white cursor-pointer hover:border-amber-300',
        disabled && !taken ? 'cursor-not-allowed' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <sup
        className="mt-0.5 w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center shrink-0"
        style={{ background: ACCENT_TINT, color: ACCENT_TEXT }}
      >
        {char.key}
      </sup>
      <span className="text-xs font-semibold text-gray-700 leading-snug pt-0.5">{char.text}</span>
    </button>
  );
}

function PersonResultCard({
  result,
  characteristics,
  animate,
  reduceMotion,
}: {
  result: PersonResult;
  characteristics: Characteristic[];
  animate: boolean;
  reduceMotion: boolean;
}) {
  const correctChar = characteristics.find((c) => c.key === result.correct_key);
  const chosenChar = result.chosen ? characteristics.find((c) => c.key === result.chosen) : null;
  const shake = animate && !reduceMotion && !result.is_correct;

  return (
    <motion.div
      initial={animate ? { opacity: 0, y: 8 } : false}
      animate={
        shake
          ? { opacity: 1, y: 0, x: [0, -6, 6, -4, 4, 0] }
          : { opacity: 1, y: 0 }
      }
      transition={
        shake
          ? { type: 'spring', stiffness: 280, damping: 24, delay: result.number * 0.08, x: { duration: 0.4, delay: result.number * 0.08 } }
          : { type: 'spring', stiffness: 280, damping: 24, delay: result.number * 0.08 }
      }
      className="rounded-3xl border border-gray-100 shadow-sm overflow-hidden"
      style={{ background: CARD_SURFACE }}
    >
      <div className="flex items-center gap-3 px-4 pt-3.5 pb-2">
        <span
          className="w-7 h-7 rounded-full text-xs font-black flex items-center justify-center shrink-0"
          style={{ background: ACCENT_TINT, color: ACCENT_TEXT }}
        >
          {result.number}
        </span>
        <span className="text-sm font-bold text-gray-800 flex-1 min-w-0 truncate">{result.name}</span>
        {result.is_correct ? (
          <CheckCircle size={18} className="text-green-500 shrink-0" />
        ) : (
          <XCircle size={18} className="text-red-400 shrink-0" />
        )}
      </div>

      <div className="px-4 pb-4 space-y-2">
        {result.is_correct ? (
          <div className="min-h-[48px] rounded-2xl px-3 py-2 flex items-start gap-2 border-2 border-green-300 bg-green-50">
            <LetterChip letter={result.correct_key} className="bg-green-200 text-green-800" />
            <span className="text-xs font-semibold text-green-800 leading-snug pt-0.5">{correctChar?.text}</span>
          </div>
        ) : (
          <>
            <div className="min-h-[48px] rounded-2xl px-3 py-2 flex items-start gap-2 border-2 border-red-300 bg-red-50">
              {result.chosen ? (
                <>
                  <LetterChip letter={result.chosen} className="bg-red-200 text-red-700" />
                  <span className="text-xs font-semibold text-red-600 line-through leading-snug pt-0.5">
                    {chosenChar?.text}
                  </span>
                </>
              ) : (
                <span className="text-xs font-semibold text-red-400 italic pt-0.5">No answer selected</span>
              )}
            </div>
            <div className="min-h-[48px] rounded-2xl px-3 py-2 flex items-start gap-2 border-2 border-green-300 bg-green-50">
              <LetterChip letter={result.correct_key} className="bg-green-200 text-green-800" />
              <span className="text-xs font-semibold text-green-800 leading-snug pt-0.5">{correctChar?.text}</span>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}

/** KET Listening Part 4 — Short Talks (tap-to-connect matching) practice component. */
export function KETShortTalksPractice({
  onBack,
  sessionId: initialSessionId,
  initialMessages,
  onSessionCreated,
  onSessionFinished,
  onOpenDashboard,
}: KETShortTalksPracticeProps) {
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>('loading');
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId);
  const [userId, setUserId] = useState<string | undefined>();
  const [exercise, setExercise] = useState<ShortTalksExercise | null>(null);
  const [framingText, setFramingText] = useState('');
  const [answers, setAnswers] = useState<Record<number, CharKey | null>>({});
  const [activePerson, setActivePerson] = useState<number | null>(null);
  const [personResults, setPersonResults] = useState<PersonResult[]>([]);
  const [correctCount, setCorrectCount] = useState(0);
  const [characteristics, setCharacteristics] = useState<Characteristic[]>([]);
  const [audioLoading, setAudioLoading] = useState<Set<number>>(new Set());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isNewSession, setIsNewSession] = useState(false);
  const initStartedRef = useRef(false);

  /**
   * Phase 2 of two-phase loading: fetches each person's TTS audio in parallel
   * and patches it into the exercise as each one resolves, so players activate
   * progressively instead of blocking the whole screen.
   */
  async function loadAudiosInBackground(people: Person[]) {
    setAudioLoading(new Set(people.map((p) => p.number)));
    await Promise.all(
      people.map(async (p) => {
        const audio = await generateKETPersonAudioAction(p.monologue).catch(() => ({
          audio_b64: '',
          audio_mime: 'audio/L16;codec=pcm;rate=24000',
        }));
        setExercise((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            people: prev.people.map((pp) =>
              pp.number === p.number ? { ...pp, audio_b64: audio.audio_b64, audio_mime: audio.audio_mime } : pp
            ),
          };
        });
        setAudioLoading((prev) => {
          const next = new Set(prev);
          next.delete(p.number);
          return next;
        });
      })
    );
  }

  useEffect(() => {
    if (initStartedRef.current) return;
    initStartedRef.current = true;

    async function init() {
      if (initialMessages && initialMessages.length > 0) {
        const restored = tryRestore(initialMessages);
        if (restored) {
          setExercise(restored.exercise);
          setFramingText(restored.framingText);
          setCharacteristics(restored.characteristics);
          if (restored.personResults) {
            setPersonResults(restored.personResults);
            setCorrectCount(restored.correctCount);
            setPhase('finished');
          } else {
            const { createSupabaseBrowser } = await import('@/lib/supabase/browser-client');
            const { data: { user } } = await createSupabaseBrowser().auth.getUser();
            if (user) setUserId(user.id);
            setPhase('ready');
            void loadAudiosInBackground(restored.exercise.people);
          }
          return;
        }
      }

      if (initialSessionId) return;

      setIsNewSession(true);
      setPhase('generating');

      const plan = await generateKETShortTalksPlanAction({ sessionId: initialSessionId });

      if ('error' in plan) {
        setErrorMsg(plan.error);
        return;
      }

      onSessionCreated?.(plan.sessionId);
      setSessionId(plan.sessionId);
      setUserId(plan.userId);
      setExercise({
        people: plan.people.map((p) => ({ ...p, audio_b64: '', audio_mime: 'audio/L16;codec=pcm;rate=24000' })),
        characteristics: plan.characteristics,
      });
      setFramingText(plan.framing_text);
      setCharacteristics(plan.characteristics);
      setPhase('ready');

      void loadAudiosInBackground(plan.people);
    }

    void init();
  }, []);

  function handleActivatePerson(number: number) {
    setActivePerson((prev) => (prev === number ? null : number));
  }

  function handleAssignStatement(key: CharKey) {
    if (activePerson === null) return;
    setAnswers((prev) => ({ ...prev, [activePerson]: key }));
    setActivePerson(null);
  }

  async function handleSubmit() {
    if (!sessionId || !userId || !exercise) return;
    stopActiveAudio();
    setActivePerson(null);
    setPhase('submitting');

    const result = await submitKETShortTalksAction({
      sessionId,
      userId,
      answers,
      exercise: {
        people: exercise.people,
        characteristics: exercise.characteristics,
      },
    });

    if ('error' in result) {
      setErrorMsg(result.error);
      setPhase('ready');
      return;
    }

    setPersonResults(result.person_results);
    setCorrectCount(result.correct_count);
    setCharacteristics(result.characteristics);
    setPhase('finished');
    onSessionFinished?.();
  }

  const takenKeys = new Set<CharKey>(
    Object.values(answers).filter((v): v is CharKey => v !== null)
  );

  const matchedCount = Object.values(answers).filter((v) => v !== null).length;
  const total = exercise ? exercise.people.length : 0;
  const allMatched = exercise ? matchedCount === total : false;
  const progressPct = total > 0 ? (matchedCount / total) * 100 : 0;

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

  const charByKey = new Map(characteristics.map((c) => [c.key, c]));

  return (
    <div className="flex flex-col h-full relative">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600 text-lg"
          aria-label="Back"
        >
          ←
        </button>
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: ACCENT_TINT, color: ACCENT }}
        >
          <KETListeningIcon size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800 truncate">Short Talks</p>
          <p className="text-xs text-gray-400">Listening · Part 4</p>
        </div>
        <span
          className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest"
          style={{ background: ACCENT_TINT, color: ACCENT_TEXT }}
        >
          A2
        </span>
      </div>

      {phase === 'ready' && (
        <div className="h-1.5 w-full bg-gray-100 shrink-0 overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: ACCENT }}
            initial={false}
            animate={{ width: `${progressPct}%` }}
            transition={{ type: 'spring', stiffness: 200, damping: 28 }}
          />
        </div>
      )}

      {(phase === 'loading' || phase === 'generating') && (
        <div className="flex-1 flex flex-col min-h-0">
          <BobMascotLoader message={phase === 'loading' ? 'Preparing exercise…' : 'Generating audio…'} />
        </div>
      )}

      {phase === 'submitting' && (
        <div className="flex-1 flex flex-col min-h-0">
          <BobMascotLoader message="Checking your answers…" />
        </div>
      )}

      {phase === 'ready' && exercise && (
        <>
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <div className="mx-auto w-full max-w-lg space-y-4 pt-4">
              <div className="rounded-3xl border border-gray-100 shadow-sm px-4 py-3 flex items-start gap-3" style={{ background: CARD_SURFACE }}>
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: ACCENT_TINT, color: ACCENT }}
                >
                  <KETListeningIcon size={18} />
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{framingText}</p>
              </div>

              <div className="space-y-3">
                {exercise.people.map((person) => {
                  const matchedKey = answers[person.number] ?? null;
                  const matchedText = matchedKey ? charByKey.get(matchedKey)?.text ?? null : null;
                  return (
                    <PersonCard
                      key={person.number}
                      person={person}
                      matchedKey={matchedKey}
                      matchedText={matchedText}
                      active={activePerson === person.number}
                      audioLoading={audioLoading.has(person.number)}
                      reduceMotion={!!reduceMotion}
                      onActivate={() => handleActivatePerson(person.number)}
                    />
                  );
                })}
              </div>

              <div className="rounded-3xl border border-gray-100 shadow-sm overflow-hidden" style={{ background: CARD_SURFACE }}>
                <div
                  className="px-4 py-2.5 border-b border-gray-100"
                  style={{ background: 'color-mix(in oklab, #F8AC37 6%, white)' }}
                >
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Descriptions{activePerson !== null ? ' · tap one to match' : ''}
                  </p>
                </div>
                <div className="px-3 py-3 space-y-2">
                  {exercise.characteristics.map((char) => (
                    <StatementChip
                      key={char.key}
                      char={char}
                      taken={takenKeys.has(char.key)}
                      candidate={activePerson !== null && !takenKeys.has(char.key)}
                      disabled={activePerson === null}
                      onTap={() => handleAssignStatement(char.key)}
                    />
                  ))}
                </div>
              </div>

              <div className="h-20" />
            </div>
          </div>

          <div className="shrink-0 border-t border-gray-100 bg-white px-4 py-3">
            <div className="mx-auto w-full max-w-lg flex items-center gap-3">
              <p className="text-xs font-semibold text-gray-500 flex-1">
                {matchedCount} of {total} matched
              </p>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!allMatched}
                className="px-6 py-3 rounded-2xl text-white text-sm font-bold transition-transform duration-75 cursor-pointer active:translate-y-1 active:shadow-none disabled:opacity-40 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-none"
                style={{ background: ACCENT, boxShadow: allMatched ? `0 4px 0 ${ACCENT_DARK}` : 'none' }}
              >
                Check answers
              </button>
            </div>
          </div>
        </>
      )}

      {phase === 'finished' && exercise && (
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="mx-auto w-full max-w-lg space-y-3">
            {personResults.map((r) => (
              <PersonResultCard
                key={r.number}
                result={r}
                characteristics={characteristics}
                animate={isNewSession}
                reduceMotion={!!reduceMotion}
              />
            ))}

            <div className="flex justify-center pt-2">
              <CelebrationCard
                score={correctCount}
                scoreMax={exercise.people.length}
                feedback="Great listening practice!"
                onAction={onOpenDashboard}
                actionLabel="See my progress"
                animate={isNewSession}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
