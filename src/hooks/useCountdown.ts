'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

interface UseCountdownOptions {
  seconds: number;
  onComplete?: () => void;
}

export function useCountdown({ seconds, onComplete }: UseCountdownOptions) {
  const [remaining, setRemaining] = useState(seconds);
  const [isRunning, setIsRunning] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const targetTimeRef = useRef<number>(0);
  const onCompleteRef = useRef(onComplete);
  const completedRef = useRef(false);

  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRunning(false);
  }, []);

  const start = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    completedRef.current = false;
    targetTimeRef.current = performance.now() + seconds * 1000;
    setRemaining(seconds);
    setIsRunning(true);

    intervalRef.current = setInterval(() => {
      const now = performance.now();
      const diff = targetTimeRef.current - now;
      const next = Math.ceil(diff / 1000);

      if (diff <= 0) {
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
        setRemaining(0);
        setIsRunning(false);
        if (!completedRef.current) {
          completedRef.current = true;
          onCompleteRef.current?.();
        }
      } else {
        setRemaining(next);
      }
    }, 100);
  }, [seconds]);

  const reset = useCallback(() => {
    stop();
    completedRef.current = false;
    setRemaining(seconds);
  }, [seconds, stop]);

  // Cleanup on unmount
  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  return { remaining, isRunning, start, stop, reset };
}
