import { useState, useEffect, useCallback, useRef } from "react";

interface UseIdleTimeoutOptions {
  timeoutMs?: number;
  warningMs?: number;
  onIdle: () => void;
}

export function useIdleTimeout({
  timeoutMs = 15 * 60 * 1000, // 15 minutes default
  warningMs = 60 * 1000,      // 1 minute default
  onIdle,
}: UseIdleTimeoutOptions) {
  const [isWarning, setIsWarning] = useState(false);
  const [countdown, setCountdown] = useState(warningMs / 1000);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isWarningRef = useRef(isWarning);
  const onIdleRef = useRef(onIdle);

  useEffect(() => {
    isWarningRef.current = isWarning;
  }, [isWarning]);

  // Keep callback ref updated
  useEffect(() => {
    onIdleRef.current = onIdle;
  }, [onIdle]);

  const clearTimers = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
  };

  const startTimers = useCallback(() => {
    clearTimers();
    setIsWarning(false);
    setCountdown(warningMs / 1000);

    // Start warning timer
    const timeUntilWarning = timeoutMs - warningMs;
    
    warningTimerRef.current = setTimeout(() => {
      setIsWarning(true);
      
      // Start countdown interval for UI display
      countdownIntervalRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownIntervalRef.current!);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, timeUntilWarning);

    // Start strict idle timer
    timerRef.current = setTimeout(() => {
      clearTimers();
      setIsWarning(false);
      onIdleRef.current();
    }, timeoutMs);
  }, [timeoutMs, warningMs]);

  const forceReset = useCallback(() => {
    startTimers();
  }, [startTimers]);

  useEffect(() => {
    startTimers();

    const events = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
    ];

    let timeout: NodeJS.Timeout;
    const handleActivity = () => {
      if (!isWarningRef.current) {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          if (!isWarningRef.current) startTimers();
        }, 500);
      }
    };

    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      clearTimers();
      clearTimeout(timeout);
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [startTimers]);

  return {
    isWarning,
    countdown,
    resetTimer: forceReset,
  };
}
