import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useAuth } from '@/features/auth/auth-provider';
import * as api from '@/features/watchlist/api';
import type { WatchlistItemRow } from '@/lib/database.types';
import { queryKeys } from '@/lib/query-keys';

export function useDefaultWatchlist() {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.watchlist.default(),
    queryFn: () => api.fetchDefaultWatchlist(user!.id),
    enabled: Boolean(user),
    staleTime: 60 * 60_000,
  });
}

export function useWatchlistItems() {
  const { data: watchlist } = useDefaultWatchlist();

  const query = useQuery({
    queryKey: queryKeys.watchlist.items(watchlist?.id ?? 'none'),
    queryFn: () => api.fetchWatchlistItems(watchlist!.id),
    enabled: Boolean(watchlist),
    staleTime: 5 * 60_000,
  });

  const symbols = useMemo(() => (query.data ?? []).map((item) => item.symbol), [query.data]);

  return { ...query, items: query.data ?? [], symbols, watchlistId: watchlist?.id ?? null };
}

export function useAddSymbol() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: watchlist } = useDefaultWatchlist();
  const { items } = useWatchlistItems();

  return useMutation({
    mutationFn: (symbol: string) => {
      if (!watchlist || !user) throw new Error('Watchlist is not ready yet.');
      return api.addWatchlistItem({
        watchlistId: watchlist.id,
        userId: user.id,
        symbol,
        sortOrder: items.length,
      });
    },
    onSuccess: () => {
      if (watchlist) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.watchlist.items(watchlist.id) });
      }
    },
  });
}

export function useRemoveSymbol() {
  const queryClient = useQueryClient();
  const { data: watchlist } = useDefaultWatchlist();
  const itemsKey = queryKeys.watchlist.items(watchlist?.id ?? 'none');

  return useMutation({
    mutationFn: (itemId: string) => api.removeWatchlistItem(itemId),
    // Removing a ticker should feel instant, so drop the row first and restore it
    // if the delete fails.
    onMutate: async (itemId) => {
      await queryClient.cancelQueries({ queryKey: itemsKey });
      const previous = queryClient.getQueryData<WatchlistItemRow[]>(itemsKey);

      queryClient.setQueryData<WatchlistItemRow[]>(itemsKey, (current) =>
        (current ?? []).filter((item) => item.id !== itemId),
      );

      return { previous };
    },
    onError: (_error, _itemId, context) => {
      if (context?.previous) queryClient.setQueryData(itemsKey, context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: itemsKey });
    },
  });
}

/** Watchlist membership for a single symbol, plus a toggle for the detail screen. */
export function useWatchlistEntry(symbol: string) {
  const normalized = symbol.toUpperCase();
  const { items, isLoading } = useWatchlistItems();
  const addSymbol = useAddSymbol();
  const removeSymbol = useRemoveSymbol();

  const entry = items.find((item) => item.symbol === normalized) ?? null;

  return {
    entry,
    isWatched: Boolean(entry),
    isLoading,
    isPending: addSymbol.isPending || removeSymbol.isPending,
    error: addSymbol.error ?? removeSymbol.error,
    toggle: () => {
      if (entry) {
        removeSymbol.mutate(entry.id);
      } else {
        addSymbol.mutate(normalized);
      }
    },
  };
}

export function useUpdateItemNotes() {
  const queryClient = useQueryClient();
  const { data: watchlist } = useDefaultWatchlist();

  return useMutation({
    mutationFn: ({ itemId, notes }: { itemId: string; notes: string }) =>
      api.updateWatchlistItemNotes(itemId, notes),
    onSuccess: () => {
      if (watchlist) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.watchlist.items(watchlist.id) });
      }
    },
  });
}
