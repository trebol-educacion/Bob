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
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  const stop = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsRunning(false);
  }, []);

  const start = useCallback(() => {
    setRemaining(seconds);
    setIsRunning(true);
    intervalRef.current = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          setIsRunning(false);
          onCompleteRef.current?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [seconds]);

  const reset = useCallback(() => {
    stop();
    setRemaining(seconds);
  }, [seconds, stop]);

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  return { remaining, isRunning, start, stop, reset };
}
