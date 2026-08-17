import { z } from 'zod';

/**
 * Response contracts for the `market-data` Edge Function. These are the single
 * source of truth for market types on the client - everything else infers from
 * them, so a server change surfaces as a type error rather than a runtime crash.
 */

export const TIMEFRAMES = ['1D', '1W', '1M', '3M', '1Y', '5Y'] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

export const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  '1D': '1D',
  '1W': '1W',
  '1M': '1M',
  '3M': '3M',
  '1Y': '1Y',
  '5Y': '5Y',
};

const nullableNumber = z.number().nullable();

export const quoteSchema = z.object({
  symbol: z.string(),
  price: nullableNumber,
  change: nullableNumber,
  changePercent: nullableNumber,
  dayHigh: nullableNumber,
  dayLow: nullableNumber,
  dayOpen: nullableNumber,
  previousClose: nullableNumber,
  provider: z.string(),
  asOf: z.string(),
});
export type Quote = z.infer<typeof quoteSchema>;

export const quotesResponseSchema = z.object({
  quotes: z.array(quoteSchema),
  staleSymbols: z.array(z.string()),
});

export const barSchema = z.object({
  t: z.string(),
  o: z.number(),
  h: z.number(),
  l: z.number(),
  c: z.number(),
  v: z.number(),
});
export type Bar = z.infer<typeof barSchema>;

export const barsResponseSchema = z.object({
  symbol: z.string(),
  timeframe: z.enum(TIMEFRAMES),
  bars: z.array(barSchema),
});

export const sparklinesResponseSchema = z.object({
  series: z.record(z.string(), z.array(z.number())),
});

export const symbolSearchResultSchema = z.object({
  symbol: z.string(),
  name: z.string().nullable(),
  exchange: z.string().nullable(),
  securityType: z.string().nullable(),
});
export type SymbolSearchResult = z.infer<typeof symbolSearchResultSchema>;

export const searchResponseSchema = z.object({
  results: z.array(symbolSearchResultSchema),
});

export const companyProfileSchema = z.object({
  symbol: z.string(),
  name: z.string().nullable(),
  exchange: z.string().nullable(),
  industry: z.string().nullable(),
  country: z.string().nullable(),
  currency: z.string().nullable(),
  marketCapMillions: nullableNumber,
  shareOutstanding: nullableNumber,
  logo: z.string().nullable(),
  website: z.string().nullable(),
  ipoDate: z.string().nullable(),
});
export type CompanyProfile = z.infer<typeof companyProfileSchema>;

export const basicFinancialsSchema = z.object({
  peRatio: nullableNumber,
  pbRatio: nullableNumber,
  dividendYield: nullableNumber,
  beta: nullableNumber,
  week52High: nullableNumber,
  week52Low: nullableNumber,
  revenueGrowthTtmYoy: nullableNumber,
  epsGrowthTtmYoy: nullableNumber,
  returnOnEquityTtm: nullableNumber,
  grossMarginTtm: nullableNumber,
});
export type BasicFinancials = z.infer<typeof basicFinancialsSchema>;

export const recommendationTrendSchema = z.object({
  period: z.string(),
  strongBuy: z.number(),
  buy: z.number(),
  hold: z.number(),
  sell: z.number(),
  strongSell: z.number(),
});
export type RecommendationTrend = z.infer<typeof recommendationTrendSchema>;

export const companyResponseSchema = z.object({
  symbol: z.string(),
  profile: companyProfileSchema.nullable(),
  financials: basicFinancialsSchema.nullable(),
  peers: z.array(z.string()).nullable(),
  recommendationTrend: recommendationTrendSchema.nullable(),
});
export type CompanySnapshot = z.infer<typeof companyResponseSchema>;

export const newsArticleSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  headline: z.string(),
  summary: z.string().nullable(),
  source: z.string().nullable(),
  url: z.string(),
  imageUrl: z.string().nullable(),
  publishedAt: z.string(),
});
export type NewsArticle = z.infer<typeof newsArticleSchema>;

export const newsResponseSchema = z.object({
  articles: z.array(newsArticleSchema),
});
