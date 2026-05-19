'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ChevronRight, RotateCcw, Volume2 } from 'lucide-react';
import { BobMascotLoader } from '@/components/chat/BobMascotLoader';
import { BobAvatar } from '@/components/practice/yl/_shared';
import { CelebrationCard } from '@/components/practice/yl/CelebrationCard';
import {
  startFCEListeningPart1Action,
  submitFCEListeningAnswerAction,
  finalizeFCEListeningSessionAction,
  type FCEShortExtractsItem,
} from '@/actions/modes/fce-listening-part1';
import type { StoredMessage } from '@/actions/messages';

const ITEMS_PER_SESSION = 8;
const MAX_PLAYS = 2;

export interface FCEShortExtractsPracticeProps {
  onBack: () => void;
  sessionId?: string;
  initialMessages?: StoredMessage[];
  onSessionCreated?: (sessionId: string) => void;
  onSessionFinished?: () => void;
  onOpenDashboard?: () => void;
}

type Phase = 'loading' | 'ready' | 'submitting' | 'finished' | 'error';

interface TurnRecord {
  item_id: string;
  selected_index: number;
  correct_index: number;
  correct: boolean;
}

interface RestoredState {
  items: FCEShortExtractsItem[];
  turns: TurnRecord[];
  finalScore: number | null;
}

function tryRestore(messages: StoredMessage[]): RestoredState | null {
  let items: FCEShortExtractsItem[] | null = null;
  const turns: TurnRecord[] = [];
  let finalScore: number | null = null;

  for (const msg of messages) {
    const cj = msg.content_json as Record<string, unknown> | null;
    if (!cj) continue;

    if (msg.role === 'bob' && cj.kind === 'fce_listening_part1_plan') {
      const raw = cj.items as Array<{
        id: string;
        variant_id: string;
        stimulus_audio_url: string;
        question: string;
        options: string[];
      }>;
      items = raw.map((r) => ({
        id: r.id,
        variant_id: r.variant_id,
        stimulus_audio_url: r.stimulus_audio_url,
        question: r.question,
        options: r.options,
      }));
    }

    if (
      msg.role === 'bob' &&
      msg.msg_type === 'evaluation' &&
      cj.kind === 'fce_listening_turn_result' &&
      cj.is_final === false
    ) {
      turns.push({
        item_id: String(cj.item_id),
        selected_index: Number(cj.selected_index),
        correct_index: Number(cj.correct_index),
        correct: Boolean(cj.correct),
      });
    }

    if (
      msg.role === 'bob' &&
      msg.msg_type === 'evaluation' &&
      cj.kind === 'fce_listening_final' &&
      cj.is_final === true
    ) {
      finalScore = Number(cj.score);
    }
  }

  if (!items) return null;
  return { items, turns, finalScore };
}

let _activeAudio: HTMLAudioElement | null = null;

function stopActiveAudio(): void {
  if (_activeAudio) {
    _activeAudio.pause();
    _activeAudio.src = '';
    _activeAudio = null;
  }
}

function ProgressDots({
  total,
  currentIdx,
  turns,
  phase,
}: {
  total: number;
  currentIdx: number;
  turns: TurnRecord[];
  phase: Phase;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => {
        const turn = turns[i];
        const isCurrent = i === currentIdx && phase !== 'finished';
        const isCorrect = turn?.correct === true;
        const isWrong = turn?.correct === false;

        return (
          <div
            key={i}
            className={[
              'w-2.5 h-2.5 rounded-full transition-all',
              isCorrect ? 'bg-green-500' : '',
              isWrong ? 'bg-red-400' : '',
              isCurrent ? 'bg-indigo-500 ring-2 ring-offset-1 ring-indigo-400/40' : '',
              !turn && !isCurrent ? 'bg-gray-200' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          />
        );
      })}
    </div>
  );
}

function AudioButton({
  audioUrl,
  playsUsed,
  onPlay,
}: {
  audioUrl: string;
  playsUsed: number;
  onPlay: () => void;
}) {
  const canPlay = playsUsed < MAX_PLAYS;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={onPlay}
        disabled={!canPlay}
        className={[
          'flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition cursor-pointer',
          canPlay
            ? 'bg-indigo-600 text-white hover:bg-indigo-700'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed',
        ].join(' ')}
      >
        <Volume2 size={16} />
        {playsUsed === 0 ? 'Play audio' : playsUsed >= MAX_PLAYS ? 'Audio played' : 'Play again'}
      </button>
      <p className="text-xs text-gray-400">
        {playsUsed === 0
          ? `You can listen up to ${MAX_PLAYS} times`
          : playsUsed >= MAX_PLAYS
          ? 'Maximum plays reached'
          : `${MAX_PLAYS - playsUsed} play${MAX_PLAYS - playsUsed !== 1 ? 's' : ''} remaining`}
      </p>
    </div>
  );
}

/** FCE B2 Listening Part 1 — 8 short extracts, 3-option multiple choice. */
export function FCEShortExtractsPractice({
  onBack,
  sessionId: initialSessionId,
  initialMessages,
  onSessionCreated,
  onSessionFinished,
  onOpenDashboard,
}: FCEShortExtractsPracticeProps) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId);
  const [items, setItems] = useState<FCEShortExtractsItem[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [playsUsed, setPlaysUsed] = useState(0);
  const [turns, setTurns] = useState<TurnRecord[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isNewSession, setIsNewSession] = useState(false);
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const initStartedRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (initStartedRef.current) return;
    initStartedRef.current = true;

    async function init() {
      if (initialMessages && initialMessages.length > 0) {
        const restored = tryRestore(initialMessages);
        if (restored) {
          setItems(restored.items);
          setTurns(restored.turns);

          if (restored.finalScore !== null) {
            setFinalScore(restored.finalScore);
            setPhase('finished');
          } else {
            setCurrentIdx(restored.turns.length);
            setPhase('ready');
          }
          return;
        }
      }

      if (initialSessionId) {
        setErrorMsg('Could not restore session. Please start a new one.');
        setPhase('error');
        return;
      }

      setIsNewSession(true);
      const result = await startFCEListeningPart1Action();

      if ('error' in result) {
        setErrorMsg(result.error);
        setPhase('error');
        return;
      }

      onSessionCreated?.(result.session_id);
      setSessionId(result.session_id);
      setItems(result.items);
      setPhase('ready');
    }

    void init();
  }, []);

  const handlePlay = useCallback(() => {
    const item = items[currentIdx];
    if (!item || playsUsed >= MAX_PLAYS) return;

    stopActiveAudio();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    const fullUrl = `${supabaseUrl}/storage/v1/object/public/bob-listening${item.stimulus_audio_url}`;
    const audio = new Audio(fullUrl);
    audioRef.current = audio;
    _activeAudio = audio;
    audio.play().catch(() => {});
    setPlaysUsed((prev) => prev + 1);
  }, [items, currentIdx, playsUsed]);

  const handleNext = useCallback(async () => {
    if (selectedIndex === null || !sessionId) return;
    const item = items[currentIdx];
    if (!item) return;

    setPhase('submitting');
    stopActiveAudio();

    const result = await submitFCEListeningAnswerAction(sessionId, item.id, selectedIndex);

    if ('error' in result) {
      setErrorMsg('Could not submit answer. Please try again.');
      setPhase('ready');
      return;
    }

    const newTurn: TurnRecord = {
      item_id: item.id,
      selected_index: selectedIndex,
      correct_index: result.correct_index,
      correct: result.correct,
    };

    const updatedTurns = [...turns, newTurn];
    setTurns(updatedTurns);

    const isLastItem = currentIdx === items.length - 1;

    if (isLastItem) {
      const correctCount = updatedTurns.filter((t) => t.correct).length;
      const finalResult = await finalizeFCEListeningSessionAction(sessionId, correctCount);

      if ('error' in finalResult) {
        setErrorMsg('Could not save final result. Please try again.');
        setPhase('ready');
        return;
      }

      setFinalScore(finalResult.score);
      setPhase('finished');
      onSessionFinished?.();
    } else {
      setCurrentIdx((prev) => prev + 1);
      setSelectedIndex(null);
      setPlaysUsed(0);
      audioRef.current = null;
      setPhase('ready');
    }
  }, [selectedIndex, sessionId, items, currentIdx, turns, onSessionFinished]);

  const handleRetry = useCallback(() => {
    initStartedRef.current = false;
    setPhase('loading');
    setSessionId(undefined);
    setItems([]);
    setCurrentIdx(0);
    setSelectedIndex(null);
    setPlaysUsed(0);
    setTurns([]);
    setErrorMsg(null);
    setFinalScore(null);
    audioRef.current = null;

    startFCEListeningPart1Action().then((result) => {
      if ('error' in result) {
        setErrorMsg(result.error);
        setPhase('error');
        return;
      }
      onSessionCreated?.(result.session_id);
      setSessionId(result.session_id);
      setItems(result.items);
      setIsNewSession(true);
      setPhase('ready');
    });
  }, [onSessionCreated]);

  const OPTION_LABELS = ['A', 'B', 'C', 'D'];

  const currentItem = items[currentIdx];

  if (phase === 'loading') {
    return (
      <div className="flex flex-col h-full">
        <Header onBack={onBack} currentIdx={0} total={ITEMS_PER_SESSION} turns={[]} phase="loading" />
        <div className="flex-1 flex flex-col min-h-0">
          <BobMascotLoader message="Loading your listening exercise…" />
        </div>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="flex flex-col h-full">
        <Header onBack={onBack} currentIdx={0} total={ITEMS_PER_SESSION} turns={[]} phase="error" />
        <div className="flex flex-col items-center justify-center flex-1 p-8 gap-6 text-center">
          <p className="text-lg font-bold text-gray-800">Something went wrong</p>
          <p className="text-sm text-gray-500 max-w-xs">{errorMsg}</p>
          <button
            type="button"
            onClick={handleRetry}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 transition cursor-pointer"
          >
            <RotateCcw size={16} />
            Try again
          </button>
          <button
            type="button"
            onClick={onBack}
            className="text-sm text-gray-400 hover:text-gray-600 transition"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'finished') {
    const score = finalScore ?? turns.filter((t) => t.correct).length;

    return (
      <div className="flex flex-col h-full">
        <Header
          onBack={onBack}
          currentIdx={items.length}
          total={ITEMS_PER_SESSION}
          turns={turns}
          phase="finished"
        />
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <div className="flex items-start gap-2">
            <BobAvatar />
            <div className="bg-gray-50 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-700 leading-relaxed max-w-sm">
              Well done for completing the exercise! Here is how each question went.
            </div>
          </div>

          {items.map((item, i) => {
            const turn = turns[i];
            if (!turn) return null;
            return (
              <motion.div
                key={item.id}
                initial={isNewSession ? { opacity: 0, y: 10 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: i * 0.07 }}
                className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden"
              >
                <div className="px-4 pt-4 pb-2 flex items-center gap-2">
                  <span
                    className="w-6 h-6 rounded-full text-xs font-black flex items-center justify-center shrink-0 text-indigo-600"
                    style={{ background: 'color-mix(in oklab, #6366f1 14%, white)' }}
                  >
                    {i + 1}
                  </span>
                  <p className="text-sm font-semibold text-gray-700 flex-1">{item.question}</p>
                  {turn.correct ? (
                    <span className="ml-auto text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full shrink-0">
                      Correct
                    </span>
                  ) : (
                    <span className="ml-auto text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full shrink-0">
                      Incorrect
                    </span>
                  )}
                </div>
                <div className="px-4 pb-4 space-y-1.5 mt-2">
                  {item.options.map((label, optIdx) => {
                    const isChosen = optIdx === turn.selected_index;
                    const isCorrectOpt = optIdx === turn.correct_index;
                    return (
                      <div
                        key={optIdx}
                        className={[
                          'flex items-center gap-2 rounded-xl border px-3 py-2 text-sm',
                          isCorrectOpt ? 'border-green-300 bg-green-50' : '',
                          isChosen && !isCorrectOpt ? 'border-red-300 bg-red-50' : '',
                          !isCorrectOpt && !isChosen ? 'border-gray-100 bg-gray-50 opacity-50' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        <span
                          className={[
                            'shrink-0 w-6 h-6 rounded-full border text-xs font-black flex items-center justify-center',
                            isCorrectOpt ? 'border-green-500 bg-green-500 text-white' : '',
                            isChosen && !isCorrectOpt ? 'border-red-400 bg-red-400 text-white' : '',
                            !isCorrectOpt && !isChosen ? 'border-gray-300 bg-white text-gray-400' : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        >
                          {OPTION_LABELS[optIdx] ?? optIdx + 1}
                        </span>
                        <span
                          className={[
                            isCorrectOpt ? 'text-green-800' : '',
                            isChosen && !isCorrectOpt ? 'text-red-700' : '',
                            !isCorrectOpt && !isChosen ? 'text-gray-400' : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        >
                          {label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}

          <div className="flex justify-center pt-2 pb-6">
            <CelebrationCard
              score={score}
              scoreMax={ITEMS_PER_SESSION}
              feedback="Great work! Keep practising to sharpen your listening skills."
              onAction={onOpenDashboard}
              actionLabel="Go to dashboard"
              animate={isNewSession}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        onBack={onBack}
        currentIdx={currentIdx}
        total={ITEMS_PER_SESSION}
        turns={turns}
        phase={phase}
      />

      {phase === 'submitting' ? (
        <div className="flex-1 flex flex-col min-h-0">
          <BobMascotLoader message="Checking your answer…" />
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide text-center">
                Question {currentIdx + 1} of {items.length}
              </p>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-4">
                {currentItem && (
                  <>
                    <AudioButton
                      audioUrl={currentItem.stimulus_audio_url}
                      playsUsed={playsUsed}
                      onPlay={handlePlay}
                    />

                    <p className="text-base font-bold text-gray-800 text-center">
                      {currentItem.question}
                    </p>

                    <div className="flex flex-col gap-2">
                      {currentItem.options.map((label, optIdx) => (
                        <button
                          key={optIdx}
                          type="button"
                          onClick={() => setSelectedIndex(optIdx)}
                          className={[
                            'w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition cursor-pointer',
                            selectedIndex === optIdx
                              ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                              : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50',
                          ].join(' ')}
                        >
                          <span className="font-bold mr-2">{OPTION_LABELS[optIdx] ?? optIdx + 1}.</span>
                          {label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="shrink-0 border-t border-gray-100 bg-white px-4 py-3 flex items-center gap-3 max-w-3xl mx-auto w-full">
            <button
              type="button"
              onClick={handleNext}
              disabled={selectedIndex === null}
              className={[
                'flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition w-full justify-center cursor-pointer',
                selectedIndex !== null
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed',
              ].join(' ')}
            >
              {currentIdx === items.length - 1 ? 'Submit' : 'Next'}
              <ChevronRight size={16} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Header({
  onBack,
  currentIdx,
  total,
  turns,
  phase,
}: {
  onBack: () => void;
  currentIdx: number;
  total: number;
  turns: TurnRecord[];
  phase: Phase;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white shrink-0">
      <button
        type="button"
        onClick={onBack}
        className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600 cursor-pointer"
        aria-label="Go back"
      >
        ←
      </button>
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: 'color-mix(in oklab, #6366f1 12%, white)' }}
      >
        <Volume2 size={18} className="text-indigo-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-800 truncate">Listening Part 1 — Short Extracts</p>
        <p className="text-xs text-gray-400">Multiple Choice</p>
      </div>
      <div className="shrink-0 flex items-center gap-2">
        <ProgressDots
          total={total}
          currentIdx={currentIdx}
          turns={turns}
          phase={phase}
        />
        <span
          className="shrink-0 px-2 py-0.5 rounded-full text-indigo-600 text-[10px] font-bold uppercase tracking-widest"
          style={{ background: 'color-mix(in oklab, #6366f1 12%, white)' }}
        >
          B2 · FCE
        </span>
      </div>
    </div>
  );
}
