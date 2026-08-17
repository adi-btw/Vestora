import type { SupabaseClient } from './deps.ts';
import type {
  Bar,
  BasicFinancials,
  CompanyProfile,
  NewsArticle,
  Quote,
  RecommendationTrend,
  SymbolSearchResult,
  Timeframe,
} from './market-types.ts';

function isFresh(fetchedAt: string, ttlSeconds: number, now = Date.now()): boolean {
  const age = now - new Date(fetchedAt).getTime();
  return Number.isFinite(age) && age >= 0 && age < ttlSeconds * 1000;
}

// Quotes ---------------------------------------------------------------------

type QuoteCacheRow = {
  symbol: string;
  price: number | null;
  change: number | null;
  change_percent: number | null;
  day_high: number | null;
  day_low: number | null;
  day_open: number | null;
  previous_close: number | null;
  provider: string;
  fetched_at: string;
};

function rowToQuote(row: QuoteCacheRow): Quote {
  return {
    symbol: row.symbol,
    price: row.price,
    change: row.change,
    changePercent: row.change_percent,
    dayHigh: row.day_high,
    dayLow: row.day_low,
    dayOpen: row.day_open,
    previousClose: row.previous_close,
    provider: row.provider,
    asOf: row.fetched_at,
  };
}

export type CachedQuotes = {
  fresh: Map<string, Quote>;
  /** Any cached value at all, even expired - used to serve stale data when the
   * upstream provider is failing. */
  stale: Map<string, Quote>;
};

export async function readQuoteCache(
  admin: SupabaseClient,
  symbols: string[],
  ttlSeconds: number,
): Promise<CachedQuotes> {
  const fresh = new Map<string, Quote>();
  const stale = new Map<string, Quote>();
  if (symbols.length === 0) return { fresh, stale };

  const { data, error } = await admin.from('quote_cache').select('*').in('symbol', symbols);

  if (error) {
    console.error('Quote cache read failed', error);
    return { fresh, stale };
  }

  for (const row of (data ?? []) as QuoteCacheRow[]) {
    const quote = rowToQuote(row);
    stale.set(row.symbol, quote);
    if (isFresh(row.fetched_at, ttlSeconds)) fresh.set(row.symbol, quote);
  }

  return { fresh, stale };
}

export async function writeQuoteCache(admin: SupabaseClient, quotes: Quote[]): Promise<void> {
  if (quotes.length === 0) return;

  const { error } = await admin.from('quote_cache').upsert(
    quotes.map((quote) => ({
      symbol: quote.symbol,
      price: quote.price,
      change: quote.change,
      change_percent: quote.changePercent,
      day_high: quote.dayHigh,
      day_low: quote.dayLow,
      day_open: quote.dayOpen,
      previous_close: quote.previousClose,
      provider: quote.provider,
      fetched_at: new Date().toISOString(),
    })),
    { onConflict: 'symbol' },
  );

  if (error) console.error('Quote cache write failed', error);
}

// Bars -----------------------------------------------------------------------

export async function readBarCache(
  admin: SupabaseClient,
  symbol: string,
  timeframe: Timeframe,
  ttlSeconds: number,
): Promise<Bar[] | null> {
  const { data, error } = await admin
    .from('bar_cache')
    .select('bars, fetched_at')
    .eq('symbol', symbol)
    .eq('timeframe', timeframe)
    .maybeSingle();

  if (error || !data) return null;
  if (!isFresh(data.fetched_at as string, ttlSeconds)) return null;
  return data.bars as Bar[];
}

export async function readBarCacheMany(
  admin: SupabaseClient,
  symbols: string[],
  timeframe: string,
  ttlSeconds: number,
): Promise<Map<string, Bar[]>> {
  const result = new Map<string, Bar[]>();
  if (symbols.length === 0) return result;

  const { data, error } = await admin
    .from('bar_cache')
    .select('symbol, bars, fetched_at')
    .eq('timeframe', timeframe)
    .in('symbol', symbols);

  if (error) {
    console.error('Bar cache batch read failed', error);
    return result;
  }

  for (const row of data ?? []) {
    if (isFresh(row.fetched_at as string, ttlSeconds)) {
      result.set(row.symbol as string, row.bars as Bar[]);
    }
  }

  return result;
}

export async function writeBarCacheMany(
  admin: SupabaseClient,
  timeframe: string,
  barsBySymbol: Record<string, Bar[]>,
  provider: string,
): Promise<void> {
  const rows = Object.entries(barsBySymbol)
    .filter(([, bars]) => bars.length > 0)
    .map(([symbol, bars]) => ({
      symbol,
      timeframe,
      bars,
      provider,
      fetched_at: new Date().toISOString(),
    }));

  if (rows.length === 0) return;

  const { error } = await admin.from('bar_cache').upsert(rows, { onConflict: 'symbol,timeframe' });
  if (error) console.error('Bar cache batch write failed', error);
}

export async function writeBarCache(
  admin: SupabaseClient,
  symbol: string,
  timeframe: Timeframe,
  bars: Bar[],
  provider: string,
): Promise<void> {
  const { error } = await admin.from('bar_cache').upsert(
    {
      symbol,
      timeframe,
      bars,
      provider,
      fetched_at: new Date().toISOString(),
    },
    { onConflict: 'symbol,timeframe' },
  );

  if (error) console.error('Bar cache write failed', error);
}

// News -----------------------------------------------------------------------

type NewsCacheRow = {
  symbol: string;
  external_id: string;
  headline: string;
  summary: string | null;
  source: string | null;
  url: string;
  image_url: string | null;
  published_at: string;
  fetched_at: string;
};

export async function readNewsCache(
  admin: SupabaseClient,
  symbols: string[],
  ttlSeconds: number,
  limit = 40,
): Promise<{ articles: NewsArticle[]; symbolsNeedingRefresh: string[] }> {
  if (symbols.length === 0) return { articles: [], symbolsNeedingRefresh: [] };

  const { data, error } = await admin
    .from('news_cache')
    .select('*')
    .in('symbol', symbols)
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('News cache read failed', error);
    return { articles: [], symbolsNeedingRefresh: symbols };
  }

  const rows = (data ?? []) as NewsCacheRow[];
  const freshBySymbol = new Set(
    rows.filter((row) => isFresh(row.fetched_at, ttlSeconds)).map((row) => row.symbol),
  );

  return {
    articles: rows.map((row) => ({
      id: row.external_id,
      symbol: row.symbol,
      headline: row.headline,
      summary: row.summary,
      source: row.source,
      url: row.url,
      imageUrl: row.image_url,
      publishedAt: row.published_at,
    })),
    symbolsNeedingRefresh: symbols.filter((symbol) => !freshBySymbol.has(symbol)),
  };
}

export async function writeNewsCache(
  admin: SupabaseClient,
  articles: NewsArticle[],
): Promise<void> {
  if (articles.length === 0) return;

  const { error } = await admin.from('news_cache').upsert(
    articles.map((article) => ({
      symbol: article.symbol,
      external_id: article.id,
      headline: article.headline,
      summary: article.summary,
      source: article.source,
      url: article.url,
      image_url: article.imageUrl,
      published_at: article.publishedAt,
      fetched_at: new Date().toISOString(),
    })),
    { onConflict: 'symbol,external_id' },
  );

  if (error) console.error('News cache write failed', error);
}

// Company fundamentals -------------------------------------------------------

export type CompanySnapshot = {
  profile: CompanyProfile | null;
  financials: BasicFinancials | null;
  peers: string[] | null;
  recommendationTrend: RecommendationTrend | null;
};

export async function readCompanyCache(
  admin: SupabaseClient,
  symbol: string,
  ttlSeconds: number,
): Promise<CompanySnapshot | null> {
  const { data, error } = await admin
    .from('company_cache')
    .select('*')
    .eq('symbol', symbol)
    .maybeSingle();

  if (error || !data) return null;
  if (!isFresh(data.fetched_at as string, ttlSeconds)) return null;

  return {
    profile: (data.profile as CompanyProfile | null) ?? null,
    financials: (data.financials as BasicFinancials | null) ?? null,
    peers: (data.peers as string[] | null) ?? null,
    recommendationTrend: (data.recommendation_trend as RecommendationTrend | null) ?? null,
  };
}

export async function writeCompanyCache(
  admin: SupabaseClient,
  symbol: string,
  snapshot: CompanySnapshot,
): Promise<void> {
  const { error } = await admin.from('company_cache').upsert(
    {
      symbol,
      profile: snapshot.profile,
      financials: snapshot.financials,
      peers: snapshot.peers,
      recommendation_trend: snapshot.recommendationTrend,
      fetched_at: new Date().toISOString(),
    },
    { onConflict: 'symbol' },
  );

  if (error) console.error('Company cache write failed', error);
}

// Symbol directory -----------------------------------------------------------

export async function readSymbolDirectory(
  admin: SupabaseClient,
  query: string,
  limit = 15,
): Promise<SymbolSearchResult[]> {
  const term = query.trim().toUpperCase();
  if (!term) return [];

  const { data, error } = await admin
    .from('symbols')
    .select('symbol, name, exchange, security_type')
    .or(`symbol.like.${term}%,name.ilike.%${term}%`)
    .limit(limit);

  if (error) {
    console.error('Symbol directory read failed', error);
    return [];
  }

  type DirectoryRow = {
    symbol: string;
    name: string | null;
    exchange: string | null;
    security_type: string | null;
  };

  return ((data ?? []) as DirectoryRow[]).map((row) => ({
    symbol: row.symbol,
    name: row.name,
    exchange: row.exchange,
    securityType: row.security_type,
  }));
}

export async function writeSymbolDirectory(
  admin: SupabaseClient,
  results: SymbolSearchResult[],
): Promise<void> {
  if (results.length === 0) return;

  const { error } = await admin.from('symbols').upsert(
    results.map((result) => ({
      symbol: result.symbol,
      name: result.name,
      exchange: result.exchange,
      security_type: result.securityType,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: 'symbol' },
  );

  if (error) console.error('Symbol directory write failed', error);
}
