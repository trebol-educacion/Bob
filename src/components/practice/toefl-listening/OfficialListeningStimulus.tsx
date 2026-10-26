import React from 'react';
import { GroupAudioPlayer } from '@/components/practice/group-exercise/GroupAudioPlayer';

export interface OfficialListeningStimulusProps {
  directions: string;
  audioPath: string | null;
  listenLabel: string;
  transcript: string | null;
  transcriptLabel: string;
}

/** @param props OfficialListeningStimulusProps */
export function OfficialListeningStimulus({ directions, audioPath, listenLabel, transcript, transcriptLabel }: OfficialListeningStimulusProps) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-3 text-center">
      <p className="text-base font-bold text-gray-800">{directions}</p>
      <GroupAudioPlayer audioPath={audioPath} label={listenLabel} />
      {transcript && (
        <details className="text-left" data-testid="official-transcript">
          <summary className="cursor-pointer text-sm font-semibold text-indigo-600">{transcriptLabel}</summary>
          <p className="mt-2 whitespace-pre-line text-sm text-gray-700 leading-relaxed">{transcript}</p>
        </details>
      )}
    </div>
  );
}
