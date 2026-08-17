import { optionalEnv } from '../env.ts';
import { fetchJson } from '../fetch-json.ts';
import { HttpError } from '../http.ts';
import type { Quote } from '../market-types.ts';

const BASE_URL = 'https://api.twelvedata.com';
const PROVIDER = 'twelve-data';

type TwelveDataQuote = {
  symbol?: string;
  close?: string;
  change?: string;
  percent_change?: string;
  high?: string;
  low?: string;
  open?: string;
  previous_close?: string;
  code?: number;
  message?: string;
};

function toNumber(value: string | undefined): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isConfigured(): boolean {
  return Boolean(optionalEnv('TWELVE_DATA_API_KEY'));
}

/**
 * Fallback quote source used only when Finnhub fails, so an outage on one free
 * tier does not empty the watchlist. 800 credits/day is not enough to be primary.
 */
export async function fetchQuote(symbol: string): Promise<Quote> {
  const apiKey = optionalEnv('TWELVE_DATA_API_KEY');
  if (!apiKey) {
    throw new HttpError(503, 'fallback_unavailable', 'No fallback quote provider configured.');
  }

  const url = new URL(`${BASE_URL}/quote`);
  url.searchParams.set('symbol', symbol.toUpperCase());
  url.searchParams.set('apikey', apiKey);

  const raw = await fetchJson<TwelveDataQuote>(url.toString(), { provider: PROVIDER });

  if (raw.code && raw.code >= 400) {
    throw new HttpError(502, 'provider_error', raw.message ?? 'Twelve Data rejected the request.');
  }

  return {
    symbol: symbol.toUpperCase(),
    price: toNumber(raw.close),
    change: toNumber(raw.change),
    changePercent: toNumber(raw.percent_change),
    dayHigh: toNumber(raw.high),
    dayLow: toNumber(raw.low),
    dayOpen: toNumber(raw.open),
    previousClose: toNumber(raw.previous_close),
    provider: PROVIDER,
    asOf: new Date().toISOString(),
  };
}
