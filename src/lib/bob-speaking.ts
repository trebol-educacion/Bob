'use client';

import { useEffect, useState } from 'react';

type Listener = (speaking: boolean) => void;

const listeners = new Set<Listener>();
let currentSpeaking = false;

/** Globally toggles Bob's "speaking" state so all avatars can react. */
export function setBobSpeaking(speaking: boolean): void {
  if (currentSpeaking === speaking) return;
  currentSpeaking = speaking;
  listeners.forEach((l) => l(speaking));
}

/** Subscribes a React component to Bob's speaking state. */
export function useBobSpeaking(): boolean {
  const [speaking, setSpeaking] = useState(currentSpeaking);
  useEffect(() => {
    listeners.add(setSpeaking);
    return () => {
      listeners.delete(setSpeaking);
    };
  }, []);
  return speaking;
}
