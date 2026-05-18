'use client';

import { useEffect, useState } from 'react';

type Listener = (key: string | null) => void;

const listeners = new Set<Listener>();
let currentKey: string | null = null;

/**
 * Sets the key (message id or text) of the currently speaking message.
 * Only avatars wired to the same key will animate. Pass null to silence.
 */
export function setBobSpeaking(key: string | null): void {
  if (currentKey === key) return;
  currentKey = key;
  listeners.forEach((l) => l(key));
}

/**
 * Returns true only if `myKey` matches the currently speaking message key.
 * Avatars without a key (or with a non-matching key) stay static.
 */
export function useBobSpeaking(myKey?: string | null): boolean {
  const [key, setKey] = useState(currentKey);
  useEffect(() => {
    listeners.add(setKey);
    return () => {
      listeners.delete(setKey);
    };
  }, []);
  if (!myKey) return false;
  return key === myKey;
}
