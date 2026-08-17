import {
  barsResponseSchema,
  companyResponseSchema,
  newsResponseSchema,
  quotesResponseSchema,
  searchResponseSchema,
  sparklinesResponseSchema,
  type Timeframe,
} from '@/features/market/schemas';
import { invokeFunction } from '@/lib/functions';

const FUNCTION_NAME = 'market-data';

export function fetchQuotes(symbols: string[]) {
  return invokeFunction(FUNCTION_NAME, { action: 'quotes', symbols }, quotesResponseSchema);
}

export function fetchBars(symbol: string, timeframe: Timeframe) {
  return invokeFunction(FUNCTION_NAME, { action: 'bars', symbol, timeframe }, barsResponseSchema);
}

export function fetchSparklines(symbols: string[]) {
  return invokeFunction(FUNCTION_NAME, { action: 'sparklines', symbols }, sparklinesResponseSchema);
}

export function searchSymbols(query: string) {
  return invokeFunction(FUNCTION_NAME, { action: 'search', query }, searchResponseSchema);
}

export function fetchCompany(symbol: string) {
  return invokeFunction(FUNCTION_NAME, { action: 'company', symbol }, companyResponseSchema);
}

export function fetchNews(symbols: string[], limit?: number) {
  return invokeFunction(FUNCTION_NAME, { action: 'news', symbols, limit }, newsResponseSchema);
}
