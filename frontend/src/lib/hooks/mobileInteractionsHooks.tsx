"use client";

import { useRef } from "react";

function useLongPress(onLongPress: () => void, { delay = 500 } = {}) {
  const timerRef = useRef<number | undefined>(undefined);
  const start = () => {
    timerRef.current = window.setTimeout(onLongPress, delay);
  };
  const clear = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
  };
  return {
    onTouchStart: start,
    onTouchEnd: clear,
    onTouchCancel: clear,
  };
}

export { useLongPress };
