'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle, XCircle } from 'lucide-react';
import { KETListeningIcon } from '@/components/icons/KETIcons';
import { CelebrationCard } from '@/components/practice/yl/CelebrationCard';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import { BobAvatar } from '@/components/practice/yl/_shared';
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

export interface KETShortTalksPracticeProps {
  onBack: () => void;
  sessionId?: string;
  initialMessages?: StoredMessage[];
  onSessionCreated?: (sessionId: string) => void;
  onSessionFinished?: () => void;
  onOpenDashboard?: () => void;
}

type Phase = 'loading' | 'generating' | 'ready' | 'submitting' | 'finished';

const CHAR_KEYS: CharKey[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

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

function MiniAudioPlayer({ audiob64, audiomime, name, loading }: { audiob64: string; audiomime: string; name: string; loading: boolean }) {
  const [playing, setPlaying] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stopLocal = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setPlaying(false);
  };

  useEffect(() => () => stopLocal(), []);

  const handlePlay = async () => {
    if (playing) { stopLocal(); return; }
    stopActiveAudio();
    if (!audiob64) return;

    const url = pcmToWavBase64(audiob64, audiomime);
    const audio = new Audio(url);
    audioRef.current = audio;
    _activeAudio = audio;
    audio.onended = () => { stopLocal(); setHasPlayed(true); };
    audio.onerror = () => stopLocal();
    setPlaying(true);
    try { await audio.play(); } catch { stopLocal(); }
  };

  if (loading) {
    return (
      <span
        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
        style={{ background: 'color-mix(in oklab, var(--color-bob-brand) 12%, white)' }}
        aria-label={`Loading audio for ${name}`}
      >
        <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 animate-spin" style={{ color: 'var(--color-bob-brand)' }}>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
          <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </span>
    );
  }

  if (!audiob64) {
    return (
      <span className="text-[10px] text-gray-400 italic">no audio</span>
    );
  }

  return (
    <button
      type="button"
      onClick={handlePlay}
      aria-label={`Listen to ${name}`}
      className={[
        'w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0 transition-all',
        playing ? 'animate-pulse' : '',
        hasPlayed ? 'opacity-70' : '',
      ].join(' ')}
      style={{ background: 'var(--color-bob-brand)' }}
    >
      {playing ? (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
          <rect x="6" y="5" width="4" height="14" rx="1" />
          <rect x="14" y="5" width="4" height="14" rx="1" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
          <path d="M8 5v14l11-7z" />
        </svg>
      )}
    </button>
  );
}

function CharacteristicsPanel({ characteristics }: { characteristics: Characteristic[] }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      <div
        className="px-4 py-2.5 border-b border-gray-100"
        style={{ background: 'color-mix(in oklab, var(--color-bob-brand) 6%, white)' }}
      >
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Descriptions</p>
      </div>
      <div className="px-4 py-3 grid grid-cols-1 gap-1.5">
        {characteristics.map((c) => (
          <div key={c.key} className="flex items-start gap-2">
            <span
              className="shrink-0 w-6 h-6 rounded-full text-xs font-black flex items-center justify-center"
              style={{
                background: 'color-mix(in oklab, var(--color-bob-brand) 12%, white)',
                color: 'var(--color-bob-brand)',
              }}
            >
              {c.key}
            </span>
            <span className="text-sm text-gray-700 leading-snug pt-0.5">{c.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PersonRow({
  person,
  selected,
  takenKeys,
  onSelect,
  disabled,
  audioLoading,
}: {
  person: PersonWithAudio;
  selected: CharKey | null;
  takenKeys: Set<CharKey>;
  onSelect: (k: CharKey) => void;
  disabled: boolean;
  audioLoading: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: person.number * 0.06 }}
      className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden"
    >
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-50">
        <span
          className="w-6 h-6 rounded-full text-xs font-black flex items-center justify-center shrink-0"
          style={{
            background: 'color-mix(in oklab, var(--color-bob-brand) 14%, white)',
            color: 'var(--color-bob-brand)',
          }}
        >
          {person.number}
        </span>
        <span className="text-sm font-bold text-gray-800 flex-1">{person.name}</span>
        <MiniAudioPlayer audiob64={person.audio_b64} audiomime={person.audio_mime} name={person.name} loading={audioLoading} />
      </div>
      <div className="px-4 py-3 flex flex-wrap gap-2">
        {CHAR_KEYS.map((k) => {
          const isSelected = selected === k;
          const isTakenByOther = takenKeys.has(k) && !isSelected;
          return (
            <button
              key={k}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(k)}
              className={[
                'w-8 h-8 rounded-full text-xs font-black flex items-center justify-center border transition-all cursor-pointer',
                isSelected ? 'text-white border-transparent' : '',
                isTakenByOther ? 'opacity-40' : '',
                !isSelected && !isTakenByOther ? 'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-400' : '',
                disabled ? 'cursor-not-allowed' : '',
              ].filter(Boolean).join(' ')}
              style={isSelected ? { background: 'var(--color-bob-brand)', borderColor: 'var(--color-bob-brand)' } : undefined}
            >
              {k}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}

function PersonResultRow({
  result,
  characteristics,
  animate,
}: {
  result: PersonResult;
  characteristics: Characteristic[];
  animate: boolean;
}) {
  const correctChar = characteristics.find((c) => c.key === result.correct_key);
  const chosenChar = result.chosen ? characteristics.find((c) => c.key === result.chosen) : null;

  return (
    <motion.div
      initial={animate ? { opacity: 0, y: 6 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: result.number * 0.06 }}
      className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden"
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <span
          className="w-6 h-6 rounded-full text-xs font-black flex items-center justify-center shrink-0"
          style={{
            background: 'color-mix(in oklab, var(--color-bob-brand) 14%, white)',
            color: 'var(--color-bob-brand)',
          }}
        >
          {result.number}
        </span>
        <span className="text-sm font-bold text-gray-800 flex-1">{result.name}</span>
        {result.is_correct ? (
          <CheckCircle size={16} className="text-green-500 shrink-0" />
        ) : (
          <XCircle size={16} className="text-red-400 shrink-0" />
        )}
      </div>
      <div className="px-4 pb-3 space-y-1.5">
        {result.is_correct ? (
          <div className="flex items-start gap-2">
            <span
              className="shrink-0 w-6 h-6 rounded-full text-xs font-black flex items-center justify-center bg-green-100 text-green-700"
            >
              {result.correct_key}
            </span>
            <span className="text-sm text-green-800 leading-snug pt-0.5">{correctChar?.text}</span>
          </div>
        ) : (
          <>
            {chosenChar && (
              <div className="flex items-start gap-2">
                <span className="shrink-0 w-6 h-6 rounded-full text-xs font-black flex items-center justify-center bg-red-100 text-red-600">
                  {result.chosen}
                </span>
                <span className="text-sm text-red-600 line-through leading-snug pt-0.5">{chosenChar.text}</span>
              </div>
            )}
            {!chosenChar && (
              <p className="text-xs text-gray-400 italic">No answer selected</p>
            )}
            <div className="flex items-start gap-2">
              <span className="shrink-0 w-6 h-6 rounded-full text-xs font-black flex items-center justify-center bg-green-100 text-green-700">
                {result.correct_key}
              </span>
              <span className="text-sm text-green-800 leading-snug pt-0.5">{correctChar?.text}</span>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}

/** KET Listening Part 4 — Short Talks (matching) practice component. */
export function KETShortTalksPractice({
  onBack,
  sessionId: initialSessionId,
  initialMessages,
  onSessionCreated,
  onSessionFinished,
  onOpenDashboard,
}: KETShortTalksPracticeProps) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId);
  const [userId, setUserId] = useState<string | undefined>();
  const [exercise, setExercise] = useState<ShortTalksExercise | null>(null);
  const [framingText, setFramingText] = useState('');
  const [answers, setAnswers] = useState<Record<number, CharKey | null>>({});
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
   * progressively instead of blocking the whole screen on a 12s "Preparing…".
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

  async function handleSubmit() {
    if (!sessionId || !userId || !exercise) return;
    stopActiveAudio();
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

  const answeredCount = Object.values(answers).filter((v) => v !== null).length;
  const allAnswered = exercise ? answeredCount === exercise.people.length : false;

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
          <KETListeningIcon size={18} className="text-bob-brand" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800 truncate">Short Talks</p>
          <p className="text-xs text-gray-400">KET Listening · Part 4</p>
        </div>
        <span
          className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest"
          style={{
            background: 'color-mix(in oklab, var(--color-bob-brand) 12%, white)',
            color: 'var(--color-bob-brand)',
          }}
        >
          A2
        </span>
      </div>

      {(phase === 'loading' || phase === 'generating') && (
        <div className="flex-1 flex flex-col min-h-0">
          <BobMascotLoader
            message={phase === 'loading' ? 'Preparing exercise…' : 'Generating audio…'}
          />
        </div>
      )}

      {phase === 'submitting' && (
        <div className="flex-1 flex flex-col min-h-0">
          <BobMascotLoader message="Checking your answers…" />
        </div>
      )}

      {phase === 'ready' && exercise && (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            <div className="flex items-start gap-2">
              <BobAvatar />
              <div className="bg-gray-50 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-700 leading-relaxed max-w-sm">
                {framingText}
              </div>
            </div>

            <CharacteristicsPanel characteristics={exercise.characteristics} />

            {exercise.people.map((person) => (
              <PersonRow
                key={person.number}
                person={person}
                selected={answers[person.number] ?? null}
                takenKeys={takenKeys}
                onSelect={(k) => setAnswers((prev) => ({ ...prev, [person.number]: k }))}
                disabled={false}
                audioLoading={audioLoading.has(person.number)}
              />
            ))}

            <div className="h-20" />
          </div>

          <div className="shrink-0 border-t border-gray-100 bg-white px-4 py-3 flex items-center gap-3">
            <p className="text-xs text-gray-400 flex-1">
              {answeredCount} of {exercise.people.length} matched
            </p>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!allAnswered}
              className="px-5 py-2.5 rounded-xl text-white text-sm font-bold shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              style={{ background: 'var(--color-bob-brand)' }}
            >
              Check answers
            </button>
          </div>
        </>
      )}

      {phase === 'finished' && exercise && (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {personResults.map((r) => (
            <PersonResultRow
              key={r.number}
              result={r}
              characteristics={characteristics}
              animate={isNewSession}
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
      )}
    </div>
  );
}
