"use client";

import { useState, useEffect } from "react";

interface ElapsedTimerProps {
  createdAt: string;
  format?: (seconds: number) => string;
}

const defaultFormat = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

function getElapsedSeconds(createdAt: string): number {
  const base = new Date(createdAt).getTime();
  return Math.floor((Date.now() - base) / 1000);
}

/**
 * Displays elapsed time since createdAt, updating every second.
 *
 * If createdAt can change, use a key prop to force remount:
 * <ElapsedTimer key={createdAt} createdAt={createdAt} />
 */
export function ElapsedTimer({ createdAt, format = defaultFormat }: ElapsedTimerProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(() => getElapsedSeconds(createdAt));

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return <span className="elapsed-time">{format(elapsedSeconds)}</span>;
}

