import { useQuery } from '@tanstack/react-query';

import type { NewsArticle } from '@/features/market/schemas';
import * as api from '@/features/news/api';
import { queryKeys } from '@/lib/query-keys';

/** Finnhub reuses one id when the same story is tagged to several tickers. */
function uniqueArticles(articles: NewsArticle[]): NewsArticle[] {
  const seen = new Set<string>();
  return articles.filter((article) => {
    if (seen.has(article.id)) return false;
    seen.add(article.id);
    return true;
  });
}

/** News plus the AI summary for a single ticker. */
export function useSymbolNews(symbol: string) {
  const query = useQuery({
    queryKey: queryKeys.news.summary(symbol),
    queryFn: () => api.fetchNewsFeed({ symbols: [symbol], limit: 12 }),
    enabled: symbol.length > 0,
    // Summaries are generated once a day; refetching sooner cannot change them.
    staleTime: 30 * 60_000,
  });

  return {
    ...query,
    articles: uniqueArticles(query.data?.articles ?? []),
    summary: query.data?.summaries.find((item) => item.symbol === symbol.toUpperCase()) ?? null,
    aiEnabled: query.data?.aiEnabled ?? false,
    quotaExhausted: query.data?.quotaExhausted ?? false,
  };
}

/**
 * Combined feed across the whole watchlist. Summaries are skipped here: showing
 * twelve of them would burn the daily model quota on a single screen.
 */
export function useWatchlistNews(symbols: string[]) {
  const capped = symbols.slice(0, 12);

  const query = useQuery({
    queryKey: queryKeys.news.feed(capped),
    queryFn: () => api.fetchNewsFeed({ symbols: capped, limit: 30, includeSummaries: false }),
    enabled: capped.length > 0,
    staleTime: 10 * 60_000,
  });

  return { ...query, articles: uniqueArticles(query.data?.articles ?? []) };
}
