import { requireEnv } from '../env.ts';
import { fetchJson } from '../fetch-json.ts';
import { HttpError } from '../http.ts';
import type {
  BasicFinancials,
  CompanyProfile,
  NewsArticle,
  Quote,
  RecommendationTrend,
  SymbolSearchResult,
} from '../market-types.ts';

const BASE_URL = 'https://finnhub.io/api/v1';
const PROVIDER = 'finnhub';

function endpoint(path: string, params: Record<string, string> = {}): string {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set('token', requireEnv('FINNHUB_API_KEY'));
  return url.toString();
}

function toNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

type FinnhubQuote = {
  c?: number;
  d?: number;
  dp?: number;
  h?: number;
  l?: number;
  o?: number;
  pc?: number;
  t?: number;
};

export async function fetchQuote(symbol: string): Promise<Quote> {
  const raw = await fetchJson<FinnhubQuote>(endpoint('/quote', { symbol }), {
    provider: PROVIDER,
  });

  // Finnhub answers 200 with an all-zero body for symbols it does not know.
  if (!raw.c && !raw.pc) {
    throw new HttpError(404, 'unknown_symbol', `No quote available for ${symbol}.`);
  }

  return {
    symbol,
    price: toNumber(raw.c),
    change: toNumber(raw.d),
    changePercent: toNumber(raw.dp),
    dayHigh: toNumber(raw.h),
    dayLow: toNumber(raw.l),
    dayOpen: toNumber(raw.o),
    previousClose: toNumber(raw.pc),
    provider: PROVIDER,
    asOf: raw.t ? new Date(raw.t * 1000).toISOString() : new Date().toISOString(),
  };
}

type FinnhubSearch = {
  count?: number;
  result?: {
    description?: string;
    displaySymbol?: string;
    symbol?: string;
    type?: string;
    primaryExchange?: string;
  }[];
};

export async function searchSymbols(query: string): Promise<SymbolSearchResult[]> {
  const raw = await fetchJson<FinnhubSearch>(endpoint('/search', { q: query, exchange: 'US' }), {
    provider: PROVIDER,
  });

  return (
    (raw.result ?? [])
      // Free-tier results include foreign listings like "AAPL.SW"; the app is
      // scoped to plain US tickers.
      .filter((item) => item.symbol && !item.symbol.includes('.'))
      .slice(0, 25)
      .map((item) => ({
        symbol: (item.displaySymbol ?? item.symbol ?? '').toUpperCase(),
        name: item.description ?? null,
        exchange: item.primaryExchange ?? null,
        securityType: item.type ?? null,
      }))
      .filter((item) => item.symbol.length > 0)
  );
}

type FinnhubProfile = {
  name?: string;
  ticker?: string;
  exchange?: string;
  finnhubIndustry?: string;
  country?: string;
  currency?: string;
  marketCapitalization?: number;
  shareOutstanding?: number;
  logo?: string;
  weburl?: string;
  ipo?: string;
};

export async function fetchCompanyProfile(symbol: string): Promise<CompanyProfile> {
  const raw = await fetchJson<FinnhubProfile>(endpoint('/stock/profile2', { symbol }), {
    provider: PROVIDER,
  });

  return {
    symbol,
    name: raw.name ?? null,
    exchange: raw.exchange ?? null,
    industry: raw.finnhubIndustry ?? null,
    country: raw.country ?? null,
    currency: raw.currency ?? null,
    marketCapMillions: toNumber(raw.marketCapitalization),
    shareOutstanding: toNumber(raw.shareOutstanding),
    logo: raw.logo ?? null,
    website: raw.weburl ?? null,
    ipoDate: raw.ipo ?? null,
  };
}

type FinnhubNews = {
  category?: string;
  datetime?: number;
  headline?: string;
  id?: number;
  image?: string;
  related?: string;
  source?: string;
  summary?: string;
  url?: string;
};

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function fetchCompanyNews(symbol: string, lookbackDays = 7): Promise<NewsArticle[]> {
  const to = new Date();
  const from = new Date(to.getTime() - lookbackDays * 24 * 60 * 60 * 1000);

  const raw = await fetchJson<FinnhubNews[]>(
    endpoint('/company-news', { symbol, from: isoDate(from), to: isoDate(to) }),
    { provider: PROVIDER },
  );

  return (Array.isArray(raw) ? raw : [])
    .filter((item) => item.headline && item.url && item.datetime)
    .slice(0, 30)
    .map((item) => ({
      id: String(item.id ?? item.url),
      symbol,
      headline: item.headline!,
      summary: item.summary?.trim() ? item.summary.trim() : null,
      source: item.source ?? null,
      url: item.url!,
      imageUrl: item.image?.trim() ? item.image : null,
      publishedAt: new Date(item.datetime! * 1000).toISOString(),
    }));
}

export async function fetchPeers(symbol: string): Promise<string[]> {
  const raw = await fetchJson<string[]>(endpoint('/stock/peers', { symbol }), {
    provider: PROVIDER,
  });

  return (Array.isArray(raw) ? raw : [])
    .map((peer) => peer.toUpperCase())
    .filter((peer) => peer && peer !== symbol.toUpperCase() && !peer.includes('.'));
}

type FinnhubMetrics = {
  metric?: Record<string, unknown>;
};

export async function fetchBasicFinancials(symbol: string): Promise<BasicFinancials> {
  const raw = await fetchJson<FinnhubMetrics>(
    endpoint('/stock/metric', { symbol, metric: 'all' }),
    { provider: PROVIDER },
  );
  const metric = raw.metric ?? {};

  return {
    peRatio: toNumber(metric.peTTM ?? metric.peBasicExclExtraTTM),
    pbRatio: toNumber(metric.pbQuarterly ?? metric.pbAnnual),
    dividendYield: toNumber(metric.dividendYieldIndicatedAnnual),
    beta: toNumber(metric.beta),
    week52High: toNumber(metric['52WeekHigh']),
    week52Low: toNumber(metric['52WeekLow']),
    revenueGrowthTtmYoy: toNumber(metric.revenueGrowthTTMYoy),
    epsGrowthTtmYoy: toNumber(metric.epsGrowthTTMYoy),
    returnOnEquityTtm: toNumber(metric.roeTTM),
    grossMarginTtm: toNumber(metric.grossMarginTTM),
  };
}

type FinnhubRecommendation = {
  period?: string;
  strongBuy?: number;
  buy?: number;
  hold?: number;
  sell?: number;
  strongSell?: number;
};

export async function fetchRecommendationTrend(
  symbol: string,
): Promise<RecommendationTrend | null> {
  const raw = await fetchJson<FinnhubRecommendation[]>(
    endpoint('/stock/recommendation', { symbol }),
    { provider: PROVIDER },
  );

  const latest = Array.isArray(raw) ? raw[0] : undefined;
  if (!latest) return null;

  return {
    period: latest.period ?? '',
    strongBuy: latest.strongBuy ?? 0,
    buy: latest.buy ?? 0,
    hold: latest.hold ?? 0,
    sell: latest.sell ?? 0,
    strongSell: latest.strongSell ?? 0,
  };
}
