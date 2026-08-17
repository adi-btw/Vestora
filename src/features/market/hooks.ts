import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import * as api from '@/features/market/api';
import type { Quote, Timeframe } from '@/features/market/schemas';
import { queryKeys } from '@/lib/query-keys';

/** Live quote refresh cadence. Slower than the cache TTL on purpose: the server
 * absorbs the burst, the client just needs to look alive. */
const QUOTE_REFETCH_MS = 30_000;

export function useQuotes(symbols: string[], options: { enabled?: boolean } = {}) {
  const enabled = (options.enabled ?? true) && symbols.length > 0;

  const query = useQuery({
    queryKey: queryKeys.market.quotes(symbols),
    queryFn: () => api.fetchQuotes(symbols),
    enabled,
    staleTime: 15_000,
    refetchInterval: enabled ? QUOTE_REFETCH_MS : false,
  });

  const quotesBySymbol = useMemo(() => {
    const map = new Map<string, Quote>();
    for (const quote of query.data?.quotes ?? []) map.set(quote.symbol, quote);
    return map;
  }, [query.data]);

  return { ...query, quotesBySymbol, staleSymbols: query.data?.staleSymbols ?? [] };
}

export function useQuote(symbol: string) {
  const { quotesBySymbol, ...rest } = useQuotes([symbol]);
  return { ...rest, quote: quotesBySymbol.get(symbol.toUpperCase()) ?? null };
}

export function useSparklines(symbols: string[]) {
  const query = useQuery({
    queryKey: [...queryKeys.market.all, 'sparklines', [...symbols].sort().join(',')],
    queryFn: () => api.fetchSparklines(symbols),
    enabled: symbols.length > 0,
    staleTime: 10 * 60_000,
  });

  return { ...query, series: query.data?.series ?? {} };
}

export function useBars(symbol: string, timeframe: Timeframe) {
  return useQuery({
    queryKey: queryKeys.market.bars(symbol, timeframe),
    queryFn: () => api.fetchBars(symbol, timeframe),
    // Intraday windows go stale quickly; long windows barely move.
    staleTime: timeframe === '1D' ? 60_000 : 15 * 60_000,
  });
}

export function useCompany(symbol: string) {
  return useQuery({
    queryKey: queryKeys.market.company(symbol),
    queryFn: () => api.fetchCompany(symbol),
    staleTime: 12 * 60 * 60_000,
  });
}

export function useSymbolSearch(query: string) {
  const trimmed = query.trim();

  return useQuery({
    queryKey: queryKeys.market.search(trimmed),
    queryFn: () => api.searchSymbols(trimmed),
    enabled: trimmed.length >= 1,
    staleTime: 10 * 60_000,
  });
}
