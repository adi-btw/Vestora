import type { Timeframe } from '@/features/market/schemas';

/**
 * All cache keys in one place so invalidation from a mutation cannot drift from
 * the key a hook subscribes with.
 */
export const queryKeys = {
  watchlist: {
    all: ['watchlist'] as const,
    default: () => [...queryKeys.watchlist.all, 'default'] as const,
    items: (watchlistId: string) => [...queryKeys.watchlist.all, 'items', watchlistId] as const,
  },
  market: {
    all: ['market'] as const,
    quotes: (symbols: readonly string[]) =>
      [...queryKeys.market.all, 'quotes', [...symbols].sort().join(',')] as const,
    bars: (symbol: string, timeframe: Timeframe) =>
      [...queryKeys.market.all, 'bars', symbol, timeframe] as const,
    company: (symbol: string) => [...queryKeys.market.all, 'company', symbol] as const,
    search: (query: string) => [...queryKeys.market.all, 'search', query] as const,
  },
  news: {
    all: ['news'] as const,
    feed: (symbols: readonly string[]) =>
      [...queryKeys.news.all, 'feed', [...symbols].sort().join(',')] as const,
    summary: (symbol: string) => [...queryKeys.news.all, 'summary', symbol] as const,
  },
  chat: {
    all: ['chat'] as const,
    threads: () => [...queryKeys.chat.all, 'threads'] as const,
    messages: (threadId: string) => [...queryKeys.chat.all, 'messages', threadId] as const,
  },
  recommendations: {
    all: ['recommendations'] as const,
    list: () => [...queryKeys.recommendations.all, 'list'] as const,
  },
  alerts: {
    all: ['alerts'] as const,
    list: () => [...queryKeys.alerts.all, 'list'] as const,
    events: () => [...queryKeys.alerts.all, 'events'] as const,
  },
  portfolio: {
    all: ['portfolio'] as const,
    summary: () => [...queryKeys.portfolio.all, 'summary'] as const,
    orders: () => [...queryKeys.portfolio.all, 'orders'] as const,
    history: () => [...queryKeys.portfolio.all, 'history'] as const,
  },
} as const;
