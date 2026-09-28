'use client';

import { useEffect, useState } from 'react';
import { Award } from 'lucide-react';
import { getChallengeAttemptsAction, type ChallengeAttempt } from '@/actions/challenge/attempts';

const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** Compact list of the student's completed challenge attempts, displayed in the dashboard. */
export function ChallengeAttemptsList() {
  const [attempts, setAttempts] = useState<ChallengeAttempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getChallengeAttemptsAction()
      .then(setAttempts)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;

  return (
    <section className="max-w-5xl mx-auto w-full px-4 sm:px-6 mb-6">
      <div className="rounded-3xl border border-trebol-border/40 bg-white shadow-sm p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <span
            className="grid place-items-center w-9 h-9 rounded-xl shrink-0 text-white"
            style={{ background: 'linear-gradient(150deg, #7aa0ff, #3660AB)' }}
          >
            <Award size={18} strokeWidth={2.5} />
          </span>
          <h3 className="text-sm font-black text-trebol-text tracking-tight">Certifications</h3>
        </div>

        {attempts.length === 0 ? (
          <p className="text-[13px] font-semibold text-trebol-text/45 text-center py-4">
            No certifications yet
          </p>
        ) : (
          <div className="space-y-2">
            {attempts.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-3 rounded-2xl border border-trebol-border p-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-black text-trebol-text truncate">{a.exam_title}</p>
                  <p className="text-[11px] font-semibold text-trebol-text/50 mt-0.5">
                    {DATE_FORMAT.format(new Date(a.created_at))}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-black text-trebol-text tabular-nums">
                  {a.objective_correct} / {a.objective_total}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
