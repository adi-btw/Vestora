import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { supabase } from '@/lib/supabase';

/**
 * Company names for a set of tickers, read straight from the shared `symbols`
 * directory the search flow keeps warm. Avoids a provider call just to label a row.
 */
export function useSymbolNames(symbols: string[]) {
  const sorted = useMemo(() => [...symbols].sort(), [symbols]);

  const query = useQuery({
    queryKey: ['symbol-directory', sorted.join(',')],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('symbols')
        .select('symbol, name')
        .in('symbol', sorted);

      if (error) throw error;
      return data ?? [];
    },
    enabled: sorted.length > 0,
    staleTime: 24 * 60 * 60_000,
  });

  const namesBySymbol = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const row of query.data ?? []) map.set(row.symbol, row.name);
    return map;
  }, [query.data]);

  return { namesBySymbol };
}
