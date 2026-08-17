import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as api from '@/features/recommendations/api';
import type { Recommendation } from '@/features/recommendations/schemas';
import { queryKeys } from '@/lib/query-keys';

export function useRecommendations() {
  return useQuery({
    queryKey: queryKeys.recommendations.list(),
    queryFn: api.fetchRecommendations,
    staleTime: 30 * 60_000,
  });
}

export function useRefreshRecommendations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.refreshRecommendations,
    onSuccess: (response) => {
      queryClient.setQueryData<Recommendation[]>(
        queryKeys.recommendations.list(),
        response.recommendations,
      );
    },
  });
}

export function useDismissRecommendation() {
  const queryClient = useQueryClient();
  const key = queryKeys.recommendations.list();

  return useMutation({
    mutationFn: api.dismissRecommendation,
    onMutate: async (symbol) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Recommendation[]>(key);

      queryClient.setQueryData<Recommendation[]>(key, (current) =>
        (current ?? []).filter((item) => item.symbol !== symbol),
      );

      return { previous };
    },
    onError: (_error, _symbol, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
  });
}
