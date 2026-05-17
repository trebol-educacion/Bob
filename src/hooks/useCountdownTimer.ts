'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface CountdownState {
  seconds: number;
  totalSeconds: number;
  isWarning: boolean;
  isFinished: boolean;
  isRunning: boolean;
}

export interface CountdownControls {
  start: () => void;
  pause: () => void;
  reset: () => void;
}

/**
 * Countdown timer that fires every second and triggers `isWarning`
 * when remaining time hits `warnAt`. Calls `onFinished` exactly once
 * when it reaches zero.
 */
export function useCountdownTimer(opts: {
  totalSeconds: number;
  warnAt?: number;
  autoStart?: boolean;
  onFinished?: () => void;
}): CountdownState & CountdownControls {
  const { totalSeconds, warnAt = 10, autoStart = false, onFinished } = opts;

  const [seconds, setSeconds] = useState(totalSeconds);
  const [isRunning, setIsRunning] = useState(autoStart);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishedFiredRef = useRef(false);
  const onFinishedRef = useRef(onFinished);

  useEffect(() => {
    onFinishedRef.current = onFinished;
  }, [onFinished]);

  const clearTick = () => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    if (!isRunning) return;

    intervalRef.current = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          clearTick();
          setIsRunning(false);
          if (!finishedFiredRef.current) {
            finishedFiredRef.current = true;
            onFinishedRef.current?.();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return clearTick;
  }, [isRunning]);

  useEffect(() => {
    return clearTick;
  }, []);

  const start = useCallback(() => {
    if (finishedFiredRef.current) return;
    setIsRunning(true);
  }, []);

  const pause = useCallback(() => {
    setIsRunning(false);
  }, []);

  const reset = useCallback(() => {
    clearTick();
    setIsRunning(false);
    finishedFiredRef.current = false;
    setSeconds(totalSeconds);
  }, [totalSeconds]);

  return {
    seconds,
    totalSeconds,
    isWarning: seconds <= warnAt && seconds > 0,
    isFinished: seconds === 0,
    isRunning,
    start,
    pause,
    reset,
  };
}
