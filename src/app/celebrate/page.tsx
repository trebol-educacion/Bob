'use client';

import { useState } from 'react';
import { CelebrationCard } from '@/components/practice/yl/CelebrationCard';

export default function CelebrateDemoPage() {
  const [key, setKey] = useState(0);
  const [score, setScore] = useState(8);
  const [scoreMax, setScoreMax] = useState(8);

  const replay = () => setKey((k) => k + 1);

  return (
    <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center gap-6">
      <div className="w-full max-w-md flex flex-col gap-3 bg-white rounded-2xl p-4 ring-1 ring-slate-200">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
          Celebrate demo (route /celebrate)
        </p>
        <div className="flex gap-2 items-center">
          <label className="text-sm font-medium text-slate-600">Score</label>
          <input
            type="number"
            min={0}
            max={scoreMax}
            value={score}
            onChange={(e) => setScore(Number(e.target.value))}
            className="w-20 border rounded px-2 py-1"
          />
          <span className="text-slate-400">/</span>
          <input
            type="number"
            min={1}
            value={scoreMax}
            onChange={(e) => setScoreMax(Number(e.target.value))}
            className="w-20 border rounded px-2 py-1"
          />
          <span className="ml-auto text-sm font-bold text-slate-700">
            {scoreMax > 0 ? Math.round((score / scoreMax) * 100) : 0}%
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setScore(8);
              setScoreMax(8);
              replay();
            }}
            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 cursor-pointer"
          >
            100%
          </button>
          <button
            onClick={() => {
              setScore(6);
              setScoreMax(8);
              replay();
            }}
            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-violet-100 text-violet-700 hover:bg-violet-200 cursor-pointer"
          >
            75%
          </button>
          <button
            onClick={() => {
              setScore(4);
              setScoreMax(8);
              replay();
            }}
            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-violet-50 text-violet-600 hover:bg-violet-100 cursor-pointer"
          >
            50%
          </button>
          <button
            onClick={() => {
              setScore(2);
              setScoreMax(8);
              replay();
            }}
            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer"
          >
            25%
          </button>
          <button
            onClick={replay}
            className="ml-auto px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-800 text-white hover:bg-slate-900 cursor-pointer"
          >
            Replay
          </button>
        </div>
      </div>

      <div className="w-full max-w-md flex justify-center">
        <CelebrationCard
          key={key}
          score={score}
          scoreMax={scoreMax}
          feedback="Demo feedback — looking good, keep going!"
          onAction={() => alert('Action clicked')}
          actionLabel="See my progress"
          animate
        />
      </div>
    </div>
  );
}
