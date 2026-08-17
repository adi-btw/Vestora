import { QueryClient } from '@tanstack/react-query';

import { ApiError } from '@/lib/api-error';

/**
 * Defaults are tuned for a rate-limited upstream: retry sparingly, never retry a
 * 4xx, and treat data as fresh long enough that navigating between screens does
 * not burn provider quota. Per-query `staleTime` overrides live next to each hook.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: (failureCount, error) => {
          if (error instanceof ApiError && !error.isRetryable) return false;
          return failureCount < 2;
        },
        retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 8_000),
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
