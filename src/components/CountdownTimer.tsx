'use client';

import React from 'react';

interface CountdownTimerProps {
  seconds: number;
  remaining: number;
  isRunning: boolean;
  size?: number;
  strokeWidth?: number;
}

export function CountdownTimer({
  seconds,
  remaining,
  isRunning,
  size = 80,
  strokeWidth = 6,
}: CountdownTimerProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = seconds > 0 ? remaining / seconds : 0;
  const dashOffset = circumference - progress * circumference;

  const center = size / 2;

  const getColor = () => {
    if (!isRunning) return '#9ca3af'; // gray-400
    if (remaining > seconds * 0.5) return '#22c55e'; // green-500
    if (remaining > seconds * 0.2) return '#eab308'; // yellow-500
    return '#ef4444'; // red-500
  };

  const color = getColor();

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        {/* Background track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{ transition: isRunning ? 'stroke-dashoffset 0.1s linear, stroke 0.3s ease' : 'stroke 0.3s ease' }}
        />
      </svg>
      {/* Number in center */}
      <span
        className="absolute font-black tabular-nums"
        style={{
          color,
          fontSize: size * 0.32,
          lineHeight: 1,
          transition: 'color 0.3s ease',
        }}
      >
        {remaining}
      </span>
    </div>
  );
}
