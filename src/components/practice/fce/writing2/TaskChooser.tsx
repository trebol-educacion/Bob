'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import type { FcePart2Task } from '@/lib/writing/fce-part2';

export interface TaskChooserProps {
  tasks: FcePart2Task[];
  onChoose: (taskNumber: number) => void;
}

export function TaskChooser({ tasks, onChoose }: TaskChooserProps) {
  const t = useTranslations('cambridge');
  return (
    <div className="flex flex-col gap-3" role="list">
      {tasks.map((task) => (
        <div
          key={task.number}
          role="listitem"
          className="rounded-2xl bg-white border border-gray-100 shadow-sm px-4 py-3 space-y-2"
        >
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-bold uppercase tracking-widest">
              {t('fce.writing2.taskNumber', { number: task.number })}
            </span>
            <span className="px-2 py-0.5 rounded-full text-bob-brand text-[10px] font-bold uppercase tracking-widest bg-bob-brand/10">
              {t(`fce.writing2.types.${task.taskType}`)}
            </span>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">{task.situation}</p>
          {task.register && (
            <p className="text-xs text-gray-400">
              {t('fce.writing2.registerLabel')}: {task.register}
            </p>
          )}
          <button
            type="button"
            onClick={() => onChoose(task.number)}
            className="px-4 py-1.5 rounded-xl bg-bob-brand text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            {t('fce.writing2.chooseAction')}
          </button>
        </div>
      ))}
    </div>
  );
}
