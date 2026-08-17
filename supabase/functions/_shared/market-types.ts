/** Provider-neutral market shapes. Providers map into these; nothing else knows
 * whether a quote came from Finnhub or Twelve Data. */

export type Quote = {
  symbol: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  dayOpen: number | null;
  previousClose: number | null;
  provider: string;
  asOf: string;
};

export type Bar = {
  /** ISO timestamp of the bar's opening. */
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
};

export const TIMEFRAMES = ['1D', '1W', '1M', '3M', '1Y', '5Y'] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

export type SymbolSearchResult = {
  symbol: string;
  name: string | null;
  exchange: string | null;
  securityType: string | null;
};

export type CompanyProfile = {
  symbol: string;
  name: string | null;
  exchange: string | null;
  industry: string | null;
  country: string | null;
  currency: string | null;
  marketCapMillions: number | null;
  shareOutstanding: number | null;
  logo: string | null;
  website: string | null;
  ipoDate: string | null;
};

export type NewsArticle = {
  id: string;
  symbol: string;
  headline: string;
  summary: string | null;
  source: string | null;
  url: string;
  imageUrl: string | null;
  publishedAt: string;
};

export type BasicFinancials = {
  peRatio: number | null;
  pbRatio: number | null;
  dividendYield: number | null;
  beta: number | null;
  week52High: number | null;
  week52Low: number | null;
  revenueGrowthTtmYoy: number | null;
  epsGrowthTtmYoy: number | null;
  returnOnEquityTtm: number | null;
  grossMarginTtm: number | null;
};

export type RecommendationTrend = {
  period: string;
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
};
