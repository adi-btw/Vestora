import { requireEnv } from '../env.ts';
import { fetchJson } from '../fetch-json.ts';
import type { Bar, Timeframe } from '../market-types.ts';

const DATA_BASE_URL = 'https://data.alpaca.markets/v2';
const PROVIDER = 'alpaca';

/**
 * Chart windows mapped to Alpaca bar sizes. Intraday granularity is only worth
 * it for short windows; anything past a quarter is daily or weekly.
 */
export const TIMEFRAME_CONFIG: Record<
  Timeframe,
  { alpacaTimeframe: string; lookbackDays: number; limit: number; cacheTtlSeconds: number }
> = {
  '1D': { alpacaTimeframe: '5Min', lookbackDays: 4, limit: 400, cacheTtlSeconds: 60 },
  '1W': { alpacaTimeframe: '30Min', lookbackDays: 9, limit: 400, cacheTtlSeconds: 300 },
  '1M': { alpacaTimeframe: '1Day', lookbackDays: 40, limit: 40, cacheTtlSeconds: 3_600 },
  '3M': { alpacaTimeframe: '1Day', lookbackDays: 110, limit: 110, cacheTtlSeconds: 3_600 },
  '1Y': { alpacaTimeframe: '1Day', lookbackDays: 380, limit: 400, cacheTtlSeconds: 21_600 },
  '5Y': { alpacaTimeframe: '1Week', lookbackDays: 1_860, limit: 300, cacheTtlSeconds: 86_400 },
};

/** Bars behind the watchlist sparklines: coarse enough to batch cheaply. */
export const SPARKLINE_CONFIG = {
  alpacaTimeframe: '1Hour',
  lookbackDays: 7,
  limitPerSymbol: 60,
  cacheTtlSeconds: 900,
  cacheKey: '1D_SPARK',
} as const;

function authHeaders(): Record<string, string> {
  return {
    'APCA-API-KEY-ID': requireEnv('ALPACA_API_KEY_ID'),
    'APCA-API-SECRET-KEY': requireEnv('ALPACA_API_SECRET_KEY'),
  };
}

type AlpacaBar = {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
};

type AlpacaBarsResponse = {
  bars?: Record<string, AlpacaBar[] | null>;
};

/**
 * Historical OHLCV. Finnhub's candle endpoint is paid-only, so bars come from
 * Alpaca's free Basic plan instead. `feed=iex` is required: the SIP feed needs a
 * paid subscription and requests to it fail outright.
 */
export async function fetchBars(symbol: string, timeframe: Timeframe): Promise<Bar[]> {
  const config = TIMEFRAME_CONFIG[timeframe];
  const end = new Date();
  const start = new Date(end.getTime() - config.lookbackDays * 24 * 60 * 60 * 1000);

  const url = new URL(`${DATA_BASE_URL}/stocks/bars`);
  url.searchParams.set('symbols', symbol.toUpperCase());
  url.searchParams.set('timeframe', config.alpacaTimeframe);
  url.searchParams.set('start', start.toISOString());
  url.searchParams.set('limit', String(config.limit));
  url.searchParams.set('adjustment', 'split');
  url.searchParams.set('feed', 'iex');
  url.searchParams.set('sort', 'asc');

  const raw = await fetchJson<AlpacaBarsResponse>(url.toString(), {
    provider: PROVIDER,
    headers: authHeaders(),
  });

  const bars = raw.bars?.[symbol.toUpperCase()] ?? [];

  return bars
    .filter((bar) => Number.isFinite(bar.c))
    .map((bar) => ({ t: bar.t, o: bar.o, h: bar.h, l: bar.l, c: bar.c, v: bar.v }));
}

/**
 * Multi-symbol bars in a single request. This is why sparklines for a 30-symbol
 * watchlist cost one upstream call instead of thirty.
 */
export async function fetchBarsForSymbols(symbols: string[]): Promise<Record<string, Bar[]>> {
  if (symbols.length === 0) return {};

  const end = new Date();
  const start = new Date(end.getTime() - SPARKLINE_CONFIG.lookbackDays * 24 * 60 * 60 * 1000);

  const url = new URL(`${DATA_BASE_URL}/stocks/bars`);
  url.searchParams.set('symbols', symbols.map((symbol) => symbol.toUpperCase()).join(','));
  url.searchParams.set('timeframe', SPARKLINE_CONFIG.alpacaTimeframe);
  url.searchParams.set('start', start.toISOString());
  url.searchParams.set('limit', String(SPARKLINE_CONFIG.limitPerSymbol * symbols.length));
  url.searchParams.set('adjustment', 'split');
  url.searchParams.set('feed', 'iex');
  url.searchParams.set('sort', 'asc');

  const raw = await fetchJson<AlpacaBarsResponse>(url.toString(), {
    provider: PROVIDER,
    headers: authHeaders(),
  });

  const result: Record<string, Bar[]> = {};
  for (const [symbol, bars] of Object.entries(raw.bars ?? {})) {
    result[symbol] = (bars ?? [])
      .filter((bar) => Number.isFinite(bar.c))
      .slice(-SPARKLINE_CONFIG.limitPerSymbol)
      .map((bar) => ({ t: bar.t, o: bar.o, h: bar.h, l: bar.l, c: bar.c, v: bar.v }));
  }

  return result;
}

/**
 * For the 1D window, trim to the most recent session so a long weekend does not
 * render as a flat line with a three-day gap.
 */
export function keepLatestSession(bars: Bar[]): Bar[] {
  if (bars.length === 0) return bars;
  const lastDay = bars[bars.length - 1].t.slice(0, 10);
  const sameDay = bars.filter((bar) => bar.t.slice(0, 10) === lastDay);
  return sameDay.length >= 2 ? sameDay : bars.slice(-60);
}
