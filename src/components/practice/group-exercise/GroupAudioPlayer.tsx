'use client';

import React from 'react';
import { AudioClipPlayer } from '@/components/activity/AudioClipPlayer';
import { resolveListeningAudioUrl } from './listening-audio-url';

export interface GroupAudioPlayerProps {
  audioPath: string | null;
  maxPlays?: number;
  label?: string;
}

/** @param props GroupAudioPlayerProps */
export function GroupAudioPlayer({ audioPath, maxPlays = 2, label }: GroupAudioPlayerProps) {
  return (
    <AudioClipPlayer src={audioPath ? resolveListeningAudioUrl(audioPath) : null} maxPlays={maxPlays} label={label} />
  );
}
