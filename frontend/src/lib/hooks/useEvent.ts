import * as React from "react";

const useIsomorphicLayoutEffect =
  typeof window !== "undefined"
    ? React.useLayoutEffect
    : React.useEffect;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useEvent<T extends (...args: any[]) => any>(
  handler?: T
): T {
  const handlerRef = React.useRef<T | undefined>(handler);

  // Always keep latest handler
  useIsomorphicLayoutEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  // Stable function identity
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stableHandler = React.useCallback((...args: any[]) => {
    return handlerRef.current?.(...args);
  }, []);

  return stableHandler as T;
}
