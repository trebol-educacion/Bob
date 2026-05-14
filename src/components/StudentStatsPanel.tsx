'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, BarChart3, RefreshCw, Trash2 } from 'lucide-react';
import {
  getStudentStatsAction,
  resetStudentHistoryAction,
  type StudentStatsResult,
} from '@/actions/stats';

interface Props {
  onBack: () => void;
  onAfterReset: () => void;
}

const MODE_LABEL: Record<string, string> = {
  cambridge_starters_part1: 'Starters · Point to the picture',
  cambridge_starters_part2: 'Starters · Scene questions',
  cambridge_starters_part3: 'Starters · Story',
  cambridge_starters_part4: 'Starters · Personal questions',
  cambridge_movers_part1: 'Movers · Spot the differences',
  cambridge_movers_part2: 'Movers · Information exchange',
  cambridge_movers_part3: 'Movers · Picture story',
  cambridge_movers_part4: 'Movers · Personal questions',
  cambridge_movers_part5: 'Movers · Picture description',
  cambridge_ket_part1: 'KET · Part 1',
  cambridge_pet_p3: 'PET · Collaborative Task',
  cambridge_fce_p1: 'FCE · Speaking',
  toefl_listen_repeat: 'TOEFL · Listen & Repeat',
  toefl_interview: 'TOEFL · Take an Interview',
  generic_conversation: 'Free Practice · Conversation',
  generic_situation: 'Free Practice · Situations',
  generic_image: 'Free Practice · Picture',
};

function inferLevel(mode: string): string {
  if (mode.includes('starters') || mode.includes('movers')) return 'A1';
  if (mode.includes('ket')) return 'A2';
  if (mode.includes('pet')) return 'B1';
  if (mode.includes('fce')) return 'B2';
  if (mode.includes('cae')) return 'C1';
  if (mode.includes('cpe')) return 'C2';
  if (mode.startsWith('toefl')) return 'B1+';
  return '—';
}

function inferFramework(mode: string): string {
  if (mode.startsWith('cambridge_')) return 'Cambridge';
  if (mode.startsWith('toefl_')) return 'TOEFL';
  if (mode.startsWith('generic_')) return 'Free';
  return 'Other';
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function StudentStatsPanel({ onBack, onAfterReset }: Props) {
  const [stats, setStats] = useState<StudentStatsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getStudentStatsAction();
      setStats(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleReset = async () => {
    setResetting(true);
    try {
      await resetStudentHistoryAction();
      setConfirmOpen(false);
      await load();
      onAfterReset();
    } catch (err) {
      console.error('[stats] reset failed:', err);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center gap-4 px-4 py-3 border-b border-trebol-border bg-white shrink-0">
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg hover:bg-trebol-secondary/20 transition-colors"
          aria-label="Back"
        >
          <ArrowLeft size={20} className="text-trebol-text" />
        </button>
        <div className="flex-1">
          <p className="text-sm font-black text-trebol-text flex items-center gap-2">
            <BarChart3 size={16} className="text-trebol-primary" />
            My progress
          </p>
          <p className="text-xs text-trebol-text/50 font-medium">Your practice history at a glance</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="p-2 rounded-lg hover:bg-trebol-secondary/20 transition-colors disabled:opacity-50"
          aria-label="Refresh"
        >
          <RefreshCw size={16} className={`text-trebol-text/60 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-12 py-6 space-y-4 max-w-3xl mx-auto w-full">
        {/* Global summary */}
        {stats && stats.total_sessions > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-trebol-border rounded-2xl p-4 flex items-center gap-6"
          >
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-trebol-text/50">Total sessions</p>
              <p className="text-2xl font-black text-trebol-text">{stats.total_sessions}</p>
            </div>
            <div className="h-10 w-px bg-trebol-border" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-trebol-text/50">Overall average</p>
              <p className="text-2xl font-black text-trebol-text">
                {stats.global_avg ?? '—'}
                {stats.global_avg !== null && <span className="text-sm text-trebol-text/50 font-semibold ml-1">/ 100</span>}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className="ml-auto flex items-center gap-2 px-3 py-1.5 text-xs rounded-full border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 size={13} />
              Reset
            </button>
          </motion.div>
        )}

        {/* Per-mode breakdown */}
        {loading && (
          <div className="text-center text-sm text-trebol-text/50 py-12">Loading…</div>
        )}
        {!loading && stats && stats.rows.length === 0 && (
          <div className="text-center py-12 text-trebol-text/50">
            <BarChart3 className="mx-auto mb-2 opacity-30" size={32} />
            <p className="text-sm">No practice yet. Pick an activity and start!</p>
          </div>
        )}
        {stats && stats.rows.map((r) => {
          const pct = Math.round((r.avg_score / r.score_max) * 100);
          return (
            <div
              key={r.mode}
              className="bg-white border border-trebol-border rounded-2xl p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 rounded-full bg-trebol-primary/10 text-trebol-primary text-[10px] font-bold">
                  {inferFramework(r.mode)}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-trebol-secondary/30 text-trebol-text text-[10px] font-bold">
                  {inferLevel(r.mode)}
                </span>
                <span className="text-xs text-trebol-text/40 ml-auto">{formatRelative(r.last_done)}</span>
              </div>
              <p className="text-sm font-bold text-trebol-text">{MODE_LABEL[r.mode] ?? r.mode}</p>
              <div className="mt-3 flex items-baseline gap-3">
                <p className="text-2xl font-black text-trebol-text">{r.avg_score}<span className="text-sm text-trebol-text/50 font-semibold">/{r.score_max}</span></p>
                <p className="text-xs text-trebol-text/60">{r.sessions_count} session{r.sessions_count !== 1 ? 's' : ''}</p>
                <p className="text-xs text-trebol-text/40 ml-auto">{pct}% avg</p>
              </div>
              <div className="mt-2 h-1.5 bg-trebol-text/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-trebol-primary transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirm reset dialog */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4"
          >
            <h3 className="text-lg font-black text-trebol-text">Reset progress?</h3>
            <p className="text-sm text-trebol-text/70 leading-relaxed">
              This will permanently delete all your sessions and their evaluations. You can&apos;t undo this.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmOpen(false)}
                disabled={resetting}
                className="px-4 py-2 rounded-lg text-sm font-bold text-trebol-text/70 hover:bg-trebol-secondary/20 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                disabled={resetting}
                className="px-4 py-2 rounded-lg text-sm font-bold bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-60 flex items-center gap-2"
              >
                {resetting && <RefreshCw size={14} className="animate-spin" />}
                Yes, reset
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
