import { mapWithConcurrency } from './concurrency.ts';
import type { SupabaseClient } from './deps.ts';
import { HttpError } from './http.ts';
import {
  readBarCache,
  readBarCacheMany,
  readCompanyCache,
  readNewsCache,
  readQuoteCache,
  readSymbolDirectory,
  writeBarCache,
  writeBarCacheMany,
  writeCompanyCache,
  writeNewsCache,
  writeQuoteCache,
  writeSymbolDirectory,
  type CompanySnapshot,
} from './market-cache.ts';
import { quoteTtlSeconds } from './market-hours.ts';
import type { Bar, NewsArticle, Quote, SymbolSearchResult, Timeframe } from './market-types.ts';
import * as alpaca from './providers/alpaca.ts';
import * as finnhub from './providers/finnhub.ts';
import * as twelveData from './providers/twelve-data.ts';

const QUOTE_FETCH_CONCURRENCY = 6;
const COMPANY_TTL_SECONDS = 86_400;
const NEWS_TTL_SECONDS = 1_800;

export function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

/**
 * Read-through quote fetch.
 *
 * 1. Serve anything still inside the market-hours-aware TTL from Postgres.
 * 2. Fetch the rest from Finnhub, falling back to Twelve Data per symbol.
 * 3. If both providers fail, serve the expired cache entry rather than a hole in
 *    the watchlist, and let the caller see which symbols are stale.
 */
export async function getQuotes(
  admin: SupabaseClient,
  rawSymbols: string[],
): Promise<{ quotes: Quote[]; staleSymbols: string[] }> {
  const symbols = [...new Set(rawSymbols.map(normalizeSymbol))].filter(Boolean);
  if (symbols.length === 0) return { quotes: [], staleSymbols: [] };

  const ttl = quoteTtlSeconds();
  const { fresh, stale } = await readQuoteCache(admin, symbols, ttl);
  const missing = symbols.filter((symbol) => !fresh.has(symbol));

  const settled = await mapWithConcurrency(missing, QUOTE_FETCH_CONCURRENCY, async (symbol) => {
    try {
      return await finnhub.fetchQuote(symbol);
    } catch (error) {
      if (error instanceof HttpError && error.code === 'unknown_symbol') throw error;
      if (!twelveData.isConfigured()) throw error;
      return await twelveData.fetchQuote(symbol);
    }
  });

  const fetched: Quote[] = [];
  const staleSymbols: string[] = [];

  settled.forEach((result, index) => {
    const symbol = missing[index];
    if (result.status === 'fulfilled') {
      fetched.push(result.value);
      return;
    }

    console.error(`Quote fetch failed for ${symbol}`, result.reason);
    const fallback = stale.get(symbol);
    if (fallback) {
      fetched.push(fallback);
      staleSymbols.push(symbol);
    }
  });

  await writeQuoteCache(
    admin,
    fetched.filter((quote) => !staleSymbols.includes(quote.symbol)),
  );

  const bySymbol = new Map<string, Quote>();
  for (const quote of [...fresh.values(), ...fetched]) {
    bySymbol.set(quote.symbol, quote);
  }

  return {
    // Preserve the caller's ordering so the watchlist does not reshuffle.
    quotes: symbols
      .map((symbol) => bySymbol.get(symbol))
      .filter((quote): quote is Quote => Boolean(quote)),
    staleSymbols,
  };
}

export async function getBars(
  admin: SupabaseClient,
  rawSymbol: string,
  timeframe: Timeframe,
): Promise<Bar[]> {
  const symbol = normalizeSymbol(rawSymbol);
  const { cacheTtlSeconds } = alpaca.TIMEFRAME_CONFIG[timeframe];

  const cached = await readBarCache(admin, symbol, timeframe, cacheTtlSeconds);
  if (cached) return cached;

  const raw = await alpaca.fetchBars(symbol, timeframe);
  const bars = timeframe === '1D' ? alpaca.keepLatestSession(raw) : raw;

  if (bars.length > 0) {
    await writeBarCache(admin, symbol, timeframe, bars, 'alpaca');
  }

  return bars;
}

/**
 * Closing prices for watchlist sparklines. Anything not already cached is fetched
 * for every missing symbol in one batched Alpaca request.
 */
export async function getSparklines(
  admin: SupabaseClient,
  rawSymbols: string[],
): Promise<Record<string, number[]>> {
  const symbols = [...new Set(rawSymbols.map(normalizeSymbol))].filter(Boolean);
  if (symbols.length === 0) return {};

  const { cacheKey, cacheTtlSeconds } = alpaca.SPARKLINE_CONFIG;
  const cached = await readBarCacheMany(admin, symbols, cacheKey, cacheTtlSeconds);
  const missing = symbols.filter((symbol) => !cached.has(symbol));

  if (missing.length > 0) {
    try {
      const fetched = await alpaca.fetchBarsForSymbols(missing);
      await writeBarCacheMany(admin, cacheKey, fetched, 'alpaca');
      for (const [symbol, bars] of Object.entries(fetched)) cached.set(symbol, bars);
    } catch (error) {
      // Sparklines are decoration; a failure here must not break the watchlist.
      console.error('Sparkline fetch failed', error);
    }
  }

  const result: Record<string, number[]> = {};
  for (const symbol of symbols) {
    const bars = cached.get(symbol);
    if (bars?.length) result[symbol] = bars.map((bar) => bar.c);
  }

  return result;
}

export async function getNews(
  admin: SupabaseClient,
  rawSymbols: string[],
  limit = 30,
): Promise<NewsArticle[]> {
  const symbols = [...new Set(rawSymbols.map(normalizeSymbol))].filter(Boolean);
  if (symbols.length === 0) return [];

  const { articles, symbolsNeedingRefresh } = await readNewsCache(
    admin,
    symbols,
    NEWS_TTL_SECONDS,
    limit,
  );

  if (symbolsNeedingRefresh.length === 0) {
    return articles.slice(0, limit);
  }

  const settled = await mapWithConcurrency(symbolsNeedingRefresh, 4, (symbol) =>
    finnhub.fetchCompanyNews(symbol),
  );

  const merged = new Map(articles.map((article) => [`${article.symbol}:${article.id}`, article]));
  const fetchedArticles: NewsArticle[] = [];

  for (const result of settled) {
    if (result.status !== 'fulfilled') {
      console.error('News fetch failed', result.reason);
      continue;
    }
    for (const article of result.value) {
      fetchedArticles.push(article);
      merged.set(`${article.symbol}:${article.id}`, article);
    }
  }

  await writeNewsCache(admin, fetchedArticles);

  return [...merged.values()]
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, limit);
}

export async function getCompanySnapshot(
  admin: SupabaseClient,
  rawSymbol: string,
): Promise<CompanySnapshot> {
  const symbol = normalizeSymbol(rawSymbol);

  const cached = await readCompanyCache(admin, symbol, COMPANY_TTL_SECONDS);
  if (cached) return cached;

  // Fundamentals, peers and analyst trends are independent; a failure in one
  // should not blank the others on the detail screen.
  const [profile, financials, peers, recommendationTrend] = await Promise.allSettled([
    finnhub.fetchCompanyProfile(symbol),
    finnhub.fetchBasicFinancials(symbol),
    finnhub.fetchPeers(symbol),
    finnhub.fetchRecommendationTrend(symbol),
  ]);

  const snapshot: CompanySnapshot = {
    profile: profile.status === 'fulfilled' ? profile.value : null,
    financials: financials.status === 'fulfilled' ? financials.value : null,
    peers: peers.status === 'fulfilled' ? peers.value : null,
    recommendationTrend:
      recommendationTrend.status === 'fulfilled' ? recommendationTrend.value : null,
  };

  if (snapshot.profile || snapshot.financials) {
    await writeCompanyCache(admin, symbol, snapshot);
  }

  return snapshot;
}

/**
 * Symbol search hits the local directory first, which means repeated searches for
 * common tickers never leave Postgres. Provider results are folded back into the
 * directory so it warms up with real usage.
 */
export async function searchSymbols(
  admin: SupabaseClient,
  query: string,
): Promise<SymbolSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 1) return [];

  const local = await readSymbolDirectory(admin, trimmed);
  const exactLocalHit = local.some((item) => item.symbol === trimmed.toUpperCase());
  if (local.length >= 5 || exactLocalHit) return local;

  try {
    const remote = await finnhub.searchSymbols(trimmed);
    await writeSymbolDirectory(admin, remote);

    const merged = new Map(local.map((item) => [item.symbol, item]));
    for (const item of remote) merged.set(item.symbol, item);
    return [...merged.values()].slice(0, 25);
  } catch (error) {
    console.error('Symbol search failed, falling back to local directory', error);
    if (local.length > 0) return local;
    throw error;
  }
}
