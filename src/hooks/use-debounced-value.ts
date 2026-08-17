import { useEffect, useState } from 'react';

/**
 * Delays a rapidly changing value. Used by search so typing "NVDA" is one request
 * instead of four against a rate-limited provider.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
